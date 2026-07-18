// المرحلة ٥ — الأصولُ الثابتةُ والإهلاك (القسط الثابت / straight-line):
// الرسملة: النقدُ يصير أصلًا ثابتًا (Dr 1210 / Cr 1110). الإهلاكُ الشهريّ: مصروفٌ يقابله مجمّعٌ (Dr 5400 / Cr 1190).
// القيمةُ الدفتريّة = التكلفة − مجمّعُ الإهلاك، ولا تنزل تحت القيمة المتبقّية. الإهلاكُ idempotent لكلّ (أصل، فترة).
import { eq, and } from "drizzle-orm";
import { fixedAssets, depreciationRuns } from "../database/schema";
import { postJournal, toCents } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACC = { cash: "1110", fixed: "1210", accumDep: "1190", depExpense: "5400", gain: "4900", loss: "5900" } as const;

// رسملةُ أصلٍ ثابت: يُنشئ السجلَّ ويُرحّل Dr 1210 / Cr 1110 بالتكلفة (النقدُ يتحوّل إلى أصلٍ، صافي الأصول ثابت).
export async function capitalizeAsset(db: Db, input: { name: string; cost: number; salvageValue?: number; usefulLifeMonths: number; startPeriod: string; fundId?: string; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("اسمُ الأصل مطلوب");
  const cost = round2(input.cost);
  const salvage = round2(input.salvageValue ?? 0);
  if (!(cost > 0)) throw new Error("تكلفةُ الأصل يجب أن تكون موجبة");
  if (salvage < 0 || salvage >= cost) throw new Error("القيمةُ المتبقّية بين صفرٍ وأقلَّ من التكلفة");
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) throw new Error("العمرُ الإنتاجيّ أشهرٌ صحيحةٌ موجبة");
  if (!/^\d{4}-\d{2}$/.test(input.startPeriod)) throw new Error("شهرُ البدء بصيغة '1447-01'");
  const id = crypto.randomUUID();
  const fundId = input.fundId ?? "general";
  await db.insert(fixedAssets).values({
    id, name, cost, salvageValue: salvage, usefulLifeMonths: input.usefulLifeMonths, startPeriod: input.startPeriod,
    fundId, status: "active", note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  const cents = toCents(cost);
  await postJournal(db, { source: "capitalize", sourceRef: id, memo: `رسملةُ أصل: ${name}`, createdBy: input.createdBy }, [
    { accountId: ACC.fixed, fundId, debit: cents },
    { accountId: ACC.cash, fundId, credit: cents },
  ]);
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "capitalize_asset", entity: "fixed_asset", entityId: id, after: { name, cost, salvage, usefulLifeMonths: input.usefulLifeMonths } });
  return { id };
}

// القسطُ الشهريّ الثابت = (التكلفة − المتبقّية) ÷ العمر.
function monthlyOf(fa: { cost: number; salvageValue: number; usefulLifeMonths: number }): number {
  return round2((fa.cost - fa.salvageValue) / fa.usefulLifeMonths);
}

async function accumulatedOf(db: Db, fixedAssetId: string): Promise<number> {
  const runs = await db.select({ a: depreciationRuns.amount }).from(depreciationRuns).where(eq(depreciationRuns.fixedAssetId, fixedAssetId)).all();
  return round2(runs.reduce((s, r) => s + r.a, 0));
}

// تشغيلُ إهلاكِ أصلٍ لفترةٍ: idempotent (يتخطّى إن سبق تشغيلُ الفترة أو اكتمل الإهلاك). يُرحّل Dr 5400 / Cr 1190.
export async function runDepreciationForAsset(db: Db, input: { fixedAssetId: string; period: string; createdBy?: string }): Promise<{ amount: number; skipped?: boolean }> {
  const fa = (await db.select().from(fixedAssets).where(eq(fixedAssets.id, input.fixedAssetId)).all())[0];
  if (!fa) throw new Error("الأصلُ غير موجود");
  if (fa.status !== "active") return { amount: 0, skipped: true };
  const existing = (await db.select({ id: depreciationRuns.id }).from(depreciationRuns).where(and(eq(depreciationRuns.fixedAssetId, fa.id), eq(depreciationRuns.period, input.period))).all())[0];
  if (existing) return { amount: 0, skipped: true }; // الفترةُ أُهلِكت من قبل
  const accumulated = await accumulatedOf(db, fa.id);
  const depreciable = round2(fa.cost - fa.salvageValue);
  const remaining = round2(depreciable - accumulated);
  if (remaining <= 0) return { amount: 0, skipped: true }; // اكتمل الإهلاك
  const amount = round2(Math.min(monthlyOf(fa), remaining)); // آخرُ قسطٍ يُقصّ على المتبقّي
  const cents = toCents(amount);
  await postJournal(db, { source: "depreciation", sourceRef: `${fa.id}:${input.period}`, memo: `إهلاك: ${fa.name} (${input.period})`, createdBy: input.createdBy }, [
    { accountId: ACC.depExpense, fundId: fa.fundId, debit: cents },
    { accountId: ACC.accumDep, fundId: fa.fundId, credit: cents },
  ]);
  await db.insert(depreciationRuns).values({ id: crypto.randomUUID(), fixedAssetId: fa.id, period: input.period, amount, createdAt: Date.now() }).run();
  return { amount };
}

// تشغيلُ إهلاكِ فترةٍ على كلِّ الأصول النشطة (زرٌّ واحدٌ للإدارة). يُرجع عددَ الأصول والمجموع.
export async function runDepreciation(db: Db, input: { period: string; createdBy?: string }): Promise<{ count: number; total: number }> {
  const assets = await db.select({ id: fixedAssets.id }).from(fixedAssets).where(eq(fixedAssets.status, "active")).all();
  let count = 0, total = 0;
  for (const a of assets) {
    const r = await runDepreciationForAsset(db, { fixedAssetId: a.id, period: input.period, createdBy: input.createdBy });
    if (!r.skipped) { count += 1; total = round2(total + r.amount); }
  }
  return { count, total };
}

// دفترُ أصلٍ: التكلفة/المتبقّية/القسط/المجمّع/القيمة الدفتريّة.
export async function assetBook(db: Db, fixedAssetId: string): Promise<{ cost: number; salvage: number; monthly: number; accumulated: number; netBookValue: number }> {
  const fa = (await db.select().from(fixedAssets).where(eq(fixedAssets.id, fixedAssetId)).all())[0];
  if (!fa) throw new Error("الأصلُ غير موجود");
  const accumulated = await accumulatedOf(db, fa.id);
  return { cost: fa.cost, salvage: fa.salvageValue, monthly: monthlyOf(fa), accumulated, netBookValue: round2(fa.cost - accumulated) };
}

// استبعادُ أصلٍ (بيعٌ أو خُردة): يشطب التكلفةَ (Cr 1210) والمجمّعَ (Dr 1190)، يقبض المتحصّلَ (Dr 1110)،
// ويثبت الفرقَ مكسبًا (Cr 4900) أو خسارةً (Dr 5900). النتيجةُ متوازنةٌ حتمًا: مجمّع + متحصّل + خسارة = تكلفة + مكسب.
export async function disposeAsset(db: Db, input: { fixedAssetId: string; proceeds?: number; note?: string; createdBy?: string }): Promise<{ netBookValue: number; proceeds: number; gain: number; loss: number }> {
  const fa = (await db.select().from(fixedAssets).where(eq(fixedAssets.id, input.fixedAssetId)).all())[0];
  if (!fa) throw new Error("الأصلُ غير موجود");
  if (fa.status !== "active") throw new Error("الأصلُ مستبعَدٌ من قبل");
  const proceeds = round2(Math.max(0, input.proceeds ?? 0));
  const accumulated = await accumulatedOf(db, fa.id);
  const cost = round2(fa.cost);
  const nbv = round2(cost - accumulated);
  const gain = round2(Math.max(0, proceeds - nbv));
  const loss = round2(Math.max(0, nbv - proceeds));
  const lines: Array<{ accountId: string; fundId: string; debit?: number; credit?: number }> = [
    { accountId: ACC.fixed, fundId: fa.fundId, credit: toCents(cost) }, // شطبُ التكلفة
  ];
  if (accumulated > 0) lines.push({ accountId: ACC.accumDep, fundId: fa.fundId, debit: toCents(accumulated) }); // شطبُ المجمّع
  if (proceeds > 0) lines.push({ accountId: ACC.cash, fundId: fa.fundId, debit: toCents(proceeds) });           // المتحصّل
  if (loss > 0) lines.push({ accountId: ACC.loss, fundId: fa.fundId, debit: toCents(loss) });                    // خسارةُ الاستبعاد
  if (gain > 0) lines.push({ accountId: ACC.gain, fundId: fa.fundId, credit: toCents(gain) });                   // مكسبُ الاستبعاد
  await postJournal(db, { source: "dispose", sourceRef: fa.id, memo: `استبعادُ أصل: ${fa.name}`, createdBy: input.createdBy }, lines);
  await db.update(fixedAssets).set({ status: "disposed", note: input.note?.trim() || fa.note }).where(eq(fixedAssets.id, fa.id)).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "dispose_asset", entity: "fixed_asset", entityId: fa.id, after: { proceeds, nbv, gain, loss } });
  return { netBookValue: nbv, proceeds, gain, loss };
}

// قائمةُ الأصول الثابتة مع دفترِ كلٍّ (للعرض والطباعة).
export async function listFixedAssets(db: Db): Promise<Array<{ id: string; name: string; cost: number; salvage: number; monthly: number; accumulated: number; netBookValue: number; usefulLifeMonths: number; startPeriod: string; status: string }>> {
  const rows = await db.select().from(fixedAssets).all();
  const out = [];
  for (const fa of rows) {
    const accumulated = await accumulatedOf(db, fa.id);
    out.push({ id: fa.id, name: fa.name, cost: fa.cost, salvage: fa.salvageValue, monthly: monthlyOf(fa), accumulated, netBookValue: round2(fa.cost - accumulated), usefulLifeMonths: fa.usefulLifeMonths, startPeriod: fa.startPeriod, status: fa.status });
  }
  return out;
}
