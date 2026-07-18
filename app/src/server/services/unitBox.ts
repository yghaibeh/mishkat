// «الصندوق» الهرمي (ق-د٢ — الوثيقة ٣٩): سلسلة العهدة المالية على شجرة الوحدات نفسها.
// المبدأ: لا دفتر موازٍ — كل عملية قيدٌ مزدوجٌ في الدفتر الواحد موسومُ الأسطر بالوحدة (unit_id)،
// ورصيدُ صندوق كل وحدةٍ يُشتقّ اشتقاقاً. القبضُ متعدد العملات بأسطر في العملية الواحدة (ق-د٢).
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { journalLines, orgUnits, roleAssignments, users, monthlyEntitlements, expenseCategories, handovers } from "../database/schema";
import { postJournal, toCents, fromCents } from "./ledger";
import { cashAccountFor, convertToBase, foreignCashAccounts } from "./currencies";
import { expenseAccount } from "./ledgerPost";

type Db = Parameters<typeof postJournal>[0];
export type CurrencyLine = { currency: string; amount: number }; // بالوحدة الطبيعية للعملة (دولارات/ليرات)

const CASH_USD = "1110";

// سطرُ نقدٍ لعملةٍ ما: الأساس بالدولار سنتاتٍ؛ الأجنبية بحسابها + المقدار الأصلي + مكافئه بالدولار
async function cashLegFor(db: Db, l: CurrencyLine, unitId: string): Promise<{ accountId: string; usdCents: number; currency?: string; amountOrig?: number; unitId: string }> {
  if (!l.currency || l.currency === "USD") return { accountId: CASH_USD, usdCents: toCents(l.amount), unitId };
  const usd = await convertToBase(db, l.currency, l.amount);
  return { accountId: await cashAccountFor(db, l.currency), usdCents: toCents(usd), currency: l.currency, amountOrig: Math.round(l.amount), unitId };
}

async function unitOrThrow(db: Db, unitId: string): Promise<{ id: string; path: string }> {
  if (unitId === "root") return { id: "root", path: "/" };
  const u = (await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!u) throw new Error("الوحدة غير موجودة");
  return u;
}

// ═══ القبض: تبرع/استلام مالٍ إلى صندوق وحدة — أسطرُ عملاتٍ في عمليةٍ واحدة ═══
export async function receiveToBox(db: Db, input: { unitId: string; fundId?: string; lines: CurrencyLine[]; donorName?: string | null; memo?: string; createdBy?: string }): Promise<{ entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  await unitOrThrow(db, input.unitId);
  const fund = input.fundId ?? "general";
  const legs = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.unitId)));
  const total = legs.reduce((s, g) => s + g.usdCents, 0);
  const { id } = await postJournal(db, {
    memo: input.memo ?? (input.donorName ? `قبض من ${input.donorName}` : "قبض إلى الصندوق"),
    source: "box_receive", sourceRef: crypto.randomUUID(), createdBy: input.createdBy,
  }, [
    ...legs.map((g) => ({ accountId: g.accountId, fundId: fund, debit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
    { accountId: "4100", fundId: fund, credit: total, unitId: input.unitId },
  ]);
  return { entryId: id };
}

// ═══ الصرف: من صندوق وحدةٍ بفئةٍ من القاموس المغلق — وربطُ الاستحقاق (لا دفعَ مرتين) ═══
export async function spendFromBox(db: Db, input: { unitId: string; fundId?: string; category: string; lines: CurrencyLine[]; payeeName?: string | null; memo?: string; entitlementId?: string; createdBy?: string }): Promise<{ entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  await unitOrThrow(db, input.unitId);
  const cat = (await db.select().from(expenseCategories).where(and(eq(expenseCategories.key, input.category), eq(expenseCategories.active, true))).all())[0];
  if (!cat) throw new Error("فئة الصرف غير معرّفة — أضفها من قاموس «الإدارة»");
  if (input.entitlementId) {
    const ent = (await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.id, input.entitlementId)).all())[0];
    if (!ent) throw new Error("الاستحقاق غير موجود");
    if (ent.status === "paid") throw new Error("هذا الاستحقاق مدفوعٌ سلفاً — لا يُدفع مرتين");
  }
  const fund = input.fundId ?? "general";
  const legs = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.unitId)));
  const total = legs.reduce((s, g) => s + g.usdCents, 0);
  const { id } = await postJournal(db, {
    memo: input.memo ?? `صرف «${cat.label}»${input.payeeName ? ` — ${input.payeeName}` : ""}`,
    source: "box_spend", sourceRef: input.entitlementId ?? crypto.randomUUID(), createdBy: input.createdBy,
  }, [
    { accountId: expenseAccount(input.category), fundId: fund, debit: total, unitId: input.unitId },
    ...legs.map((g) => ({ accountId: g.accountId, fundId: fund, credit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
  ]);
  if (input.entitlementId) {
    await db.update(monthlyEntitlements).set({ status: "paid" }).where(eq(monthlyEntitlements.id, input.entitlementId)).run();
  }
  return { entryId: id };
}

// ═══ التسليم: عمليةُ عهدةٍ بطرفين — دفعٌ من الأعلى وقبضٌ آليٌّ عند الأدنى بقيدٍ واحد ═══
export async function handoverDown(db: Db, input: { fromUnitId: string; toUnitId: string; purpose: string; batchId?: string; lines: CurrencyLine[]; note?: string; deliveredBy: string }): Promise<{ id: string; entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  const from = await unitOrThrow(db, input.fromUnitId);
  const to = await unitOrThrow(db, input.toUnitId);
  // سلسلةُ العهدة تتبع الشجرة: لا تسليم إلا لوحدةٍ تحت المُسلِّم
  if (!(from.id === "root" || (to.path.startsWith(from.path) && to.id !== from.id))) throw new Error("التسليم لوحدةٍ ضمن نطاقك فقط — سلسلة العهدة تتبع الهيكل");
  const now = Date.now();
  const legsOut = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.fromUnitId)));
  const legsIn = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.toUnitId)));
  const { id: entryId } = await postJournal(db, {
    memo: `تسليم عهدة${input.purpose === "salaries" ? " (رواتب)" : ""} إلى الوحدة`,
    source: "box_handover", sourceRef: crypto.randomUUID(), createdBy: input.deliveredBy,
  }, [
    ...legsOut.map((g) => ({ accountId: g.accountId, fundId: "general", credit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
    ...legsIn.map((g) => ({ accountId: g.accountId, fundId: "general", debit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
  ]);
  const hid = crypto.randomUUID();
  await db.insert(handovers).values({
    id: hid, fromUnitId: input.fromUnitId, toUnitId: input.toUnitId, purpose: input.purpose,
    batchId: input.batchId ?? null, lines: JSON.stringify(input.lines), note: input.note ?? null,
    status: "delivered", deliveredBy: input.deliveredBy, deliveredAt: now, entryId, createdAt: now,
  }).run();
  return { id: hid, entryId };
}

// إقرارُ الاستلام — بصمةُ الطرف الثاني: أمينُ الوحدة المستلمة حصراً (تكليفٌ نشطٌ عليها)
export async function acknowledgeHandover(db: Db, handoverId: string, userId: string): Promise<{ status: string }> {
  const h = (await db.select().from(handovers).where(eq(handovers.id, handoverId)).all())[0];
  if (!h) throw new Error("التسليم غير موجود");
  if (h.status === "acknowledged") return { status: "acknowledged" };
  const u = (await db.select({ personId: users.personId }).from(users).where(eq(users.id, userId)).all())[0];
  const isCustodian = !!u && (await db.select({ id: roleAssignments.id }).from(roleAssignments)
    .where(and(eq(roleAssignments.personId, u.personId), eq(roleAssignments.orgUnitId, h.toUnitId),
      isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()).length > 0;
  if (!isCustodian) throw new Error("إقرارُ الاستلام لأمين الوحدة المستلمة حصراً");
  await db.update(handovers).set({ status: "acknowledged", acknowledgedBy: userId, acknowledgedAt: Date.now() }).where(eq(handovers.id, handoverId)).run();
  return { status: "acknowledged" };
}

// ═══ رصيدُ الصندوق بالعملات — مشتقٌّ من أسطر الدفتر الموسومة بالوحدة ═══
export async function boxBalances(db: Db, unitId: string): Promise<Array<{ currency: string; amount: number }>> {
  const cashAccounts = new Set<string>([CASH_USD, ...(await foreignCashAccounts(db))]);
  const rows = await db.select({
    accountId: journalLines.accountId, currency: journalLines.currency,
    debit: journalLines.debitCents, credit: journalLines.creditCents, amountOrig: journalLines.amountOrig,
  }).from(journalLines).where(eq(journalLines.unitId, unitId)).all();
  const by = new Map<string, number>();
  for (const r of rows) {
    if (!cashAccounts.has(r.accountId)) continue;
    const sign = (r.debit ?? 0) > 0 ? 1 : -1;
    if (!r.currency) by.set("USD", (by.get("USD") ?? 0) + ((r.debit ?? 0) - (r.credit ?? 0)));
    else by.set(r.currency, (by.get(r.currency) ?? 0) + sign * (r.amountOrig ?? 0));
  }
  return [...by.entries()].filter(([, v]) => v !== 0)
    .map(([currency, v]) => ({ currency, amount: currency === "USD" ? fromCents(v) : v }));
}

// أرصدةُ ما تحت وحدةٍ (للشجرة): تجميعٌ بالأبناء المباشرين — بالمكافئ الدولاري للعرض التجميعي
export async function subtreeBoxSummary(db: Db, parentPath: string): Promise<Array<{ unitId: string; usd: number }>> {
  const depth = parentPath.split("/").filter(Boolean).length;
  const units = await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).all();
  const childOf = new Map<string, string>(); // unitId → ابن مباشر لparent يقع تحته
  for (const u of units) if (u.path.startsWith(parentPath)) {
    const segs = u.path.split("/").filter(Boolean);
    if (segs.length > depth) childOf.set(u.id, segs[depth]);
  }
  if (!childOf.size) return [];
  const cashAccounts = new Set<string>([CASH_USD, ...(await foreignCashAccounts(db))]);
  // قراءةٌ واحدةٌ بلا IN ضخمة (حدُّ متغيّرات SQLite في D1 — نفس عثرة الإشراف المعروفة) ثم ترشيحٌ في الذاكرة
  const rows = (await db.select({ unitId: journalLines.unitId, accountId: journalLines.accountId, d: journalLines.debitCents, c: journalLines.creditCents })
    .from(journalLines).where(sql`unit_id IS NOT NULL`).all()).filter((r) => childOf.has(r.unitId!));
  // الأبناء المباشرون يُعرضون دائماً ولو بصفر — وإلا استحال أولُ تسليمٍ في السلسلة
  const agg = new Map<string, number>();
  for (const u of units) {
    const segs = u.path.split("/").filter(Boolean);
    if (u.path.startsWith(parentPath) && segs.length === depth + 1) agg.set(u.id, 0);
  }
  for (const r of rows) {
    if (!r.unitId || !cashAccounts.has(r.accountId)) continue;
    const child = childOf.get(r.unitId)!;
    agg.set(child, (agg.get(child) ?? 0) + (r.d ?? 0) - (r.c ?? 0));
  }
  return [...agg.entries()].map(([unitId, cents]) => ({ unitId, usd: fromCents(cents) }));
}

// خريطةُ توزيع دفعةٍ: سلسلة التسليمات وحالتها لكل وحدة (عينُ المدير — ٣٩ §٩)
export async function distributionMap(db: Db, batchId: string) {
  const hs = await db.select().from(handovers).where(eq(handovers.batchId, batchId)).all();
  const unitIds = [...new Set(hs.flatMap((h) => [h.fromUnitId, h.toUnitId]))].filter((x) => x !== "root");
  const names = unitIds.length ? await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, unitIds)).all() : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return hs.map((h) => ({
    id: h.id, from: h.fromUnitId === "root" ? "المركز" : nameOf.get(h.fromUnitId) ?? h.fromUnitId,
    to: nameOf.get(h.toUnitId) ?? h.toUnitId, toUnitId: h.toUnitId,
    purpose: h.purpose, lines: JSON.parse(h.lines) as CurrencyLine[],
    status: h.status, deliveredAt: h.deliveredAt, acknowledgedAt: h.acknowledgedAt,
  }));
}
