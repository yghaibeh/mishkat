// المرحلة ١ — المانحون والأموال المقيّدة: سنداتُ قبضٍ مرقّمة، وسمُ الصندوق، وضبطُ صرف المقيّد.
// كلُّه بلغةٍ بشريّةٍ للمستخدم غير المحاسب؛ والدفترُ الخفيّ يستقبل القيدَ آليًّا.
import { and, eq, sql } from "drizzle-orm";
import { donations, donors, counters, funds } from "../database/schema";
import { fundBalances, toCents } from "./ledger";
import { postDonation } from "./ledgerPost";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

// سندُ قبضٍ متسلسلٌ بلا فجوات: R-000001, R-000002… (عدّادٌ ذرّيّ).
export async function nextReceiptNo(db: Db): Promise<string> {
  await db.update(counters).set({ value: sql`${counters.value} + 1` }).where(eq(counters.name, "receipt")).run();
  const row = (await db.select({ v: counters.value }).from(counters).where(eq(counters.name, "receipt")).all())[0];
  const n = row?.v ?? 1;
  return `R-${String(n).padStart(6, "0")}`;
}

// مانحٌ بالاسم — يُنشأ إن لم يوجد (بلا تكرار)
async function ensureDonor(db: Db, name?: string): Promise<string | null> {
  const nm = (name ?? "").trim();
  if (!nm) return null;
  const existing = (await db.select({ id: donors.id }).from(donors).where(eq(donors.name, nm)).all())[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(donors).values({ id, name: nm, phone: null, note: null, createdAt: Date.now() }).run();
  return id;
}

// تسجيلُ تبرّعٍ كاملٍ: مانحٌ + صندوقٌ + سندٌ مرقّمٌ + ترحيلٌ للدفتر.
export async function recordDonation(db: Db, input: { mosqueId: string; amount: number; fund?: string; donorName?: string; donorId?: string; note?: string; currency?: string; collectedBy?: string; dateHijri?: string }): Promise<{ id: string; receiptNo: string; donorId: string | null; usdAmount: number }> {
  const fund = input.fund ?? "general";
  const donorId = input.donorId ?? await ensureDonor(db, input.donorName);
  const receiptNo = await nextReceiptNo(db);
  const id = crypto.randomUUID();
  // تعدّدُ العملات: input.amount بالعملة الأصليّة؛ يُخزَّن `amount` بقيمته الدولاريّة، ويُحفَظ الأصلُ في orig_amount.
  const foreign = !!input.currency && input.currency !== "USD";
  const usdAmount = foreign ? await (await import("./currencies")).convertToBase(db, input.currency!, input.amount) : input.amount;
  await db.insert(donations).values({
    id, mosqueId: input.mosqueId, donorName: input.donorName?.trim() || null, amount: usdAmount,
    collectedBy: input.collectedBy ?? null, approvedByAmir: true, note: input.note?.trim() || null,
    fundId: fund, donorId, receiptNo, currency: foreign ? input.currency : null, origAmount: foreign ? input.amount : null, at: Date.now(),
  }).run();
  await writeAudit(db, { actorUserId: input.collectedBy ?? null, action: "add_donation", entity: "donation", entityId: id, after: { amount: usdAmount, currency: input.currency ?? "USD", fund, receiptNo } });
  // الدفتر: مدين النقد / دائن التبرّعات (موسومٌ بالصندوق والعملة)
  try { await postDonation(db, { id, amount: usdAmount, fundId: fund, dateHijri: input.dateHijri, currency: foreign ? input.currency : undefined, origAmount: foreign ? input.amount : undefined, memo: `تبرّعٌ ${input.donorName ?? ""} — ${receiptNo}`.trim(), createdBy: input.collectedBy }); }
  catch (e) { console.error("[ledger] recordDonation post failed:", (e as Error)?.message ?? e); }
  // و٣: يُطبَّق التبرّعُ آليًّا على تعهّدات المانح المفتوحة لنفس الصندوق (غيرُ حرج)
  if (donorId) {
    try { const { applyToPledges } = await import("./pledges"); await applyToPledges(db, { donorId, fund, amount: usdAmount }); }
    catch (e) { console.error("[pledges] apply failed:", (e as Error)?.message ?? e); }
  }
  return { id, receiptNo, donorId, usdAmount };
}

// ضبطُ صرف المقيّد: لا يُصرَف من صندوقٍ مقيّدٍ (زكاة/وقف/مشاريع) أكثرُ من رصيده. الحرُّ لا يُقيَّد.
export async function assertFundCanSpend(db: Db, fundId: string, amountCents: number): Promise<void> {
  const f = (await db.select().from(funds).where(eq(funds.id, fundId)).all())[0];
  if (!f || !f.restricted) return; // الصندوقُ الحرّ (أو مجهول) لا يُقيَّد بالرصيد هنا
  const bal = (await fundBalances(db)).find((x) => x.fundId === fundId)?.balance ?? 0;
  if (amountCents > bal) {
    const have = (bal / 100).toFixed(2);
    throw new Error(`رصيدُ صندوق «${f.name}» لا يكفي هذا الصرف (المتاح ${have} فقط) — لا يجوز صرفُ المقيَّد فيما يتجاوزه`);
  }
}

// كشفُ المانح: تبرّعاتُه بصناديقها ومجموعُها.
export async function donorStatement(db: Db, donorId: string | null): Promise<{ donorName: string; total: number; items: Array<{ receiptNo: string | null; fund: string; amount: number; at: number }> }> {
  if (!donorId) return { donorName: "—", total: 0, items: [] };
  const d = (await db.select().from(donors).where(eq(donors.id, donorId)).all())[0];
  const rows = await db.select().from(donations).where(eq(donations.donorId, donorId)).all();
  const items = rows.map((r) => ({ receiptNo: r.receiptNo, fund: r.fundId, amount: r.amount, at: r.at })).sort((a, b) => b.at - a.at);
  return { donorName: d?.name ?? "—", total: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100, items };
}
