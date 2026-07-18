// المرحلة ٢ — الموازنة: المخطّطُ مقابل الفعليّ. الفعليُّ يُقرأ من مصروفات الدفتر (لا إدخالٌ مزدوج).
// «كلُّ مصروفٍ يُقارَن بموازنة صندوقه للفترة» — تنبيهٌ بشريٌّ عند الاقتراب/التجاوز، لا مصطلحٌ محاسبيّ.
import { and, eq } from "drizzle-orm";
import { budgets, funds, accounts, journalEntries, journalLines } from "../database/schema";
import { fromCents } from "./ledger";
import { hijriMonthKey } from "../utils/week";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ضبطُ موازنةٍ (upsert بمفتاح فترة+صندوق+حساب)
export async function setBudget(db: Db, input: { period: string; fundId: string; accountId?: string; amount: number; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const accountId = input.accountId ?? "";
  const existing = (await db.select().from(budgets).where(and(
    eq(budgets.period, input.period), eq(budgets.fundId, input.fundId), eq(budgets.accountId, accountId),
  )).all())[0];
  if (existing) {
    await db.update(budgets).set({ amount: input.amount, note: input.note?.trim() || null }).where(eq(budgets.id, existing.id)).run();
    return { id: existing.id };
  }
  const id = crypto.randomUUID();
  await db.insert(budgets).values({
    id, period: input.period, fundId: input.fundId, accountId, amount: input.amount,
    note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  return { id };
}

// الصرفُ الفعليُّ (بالدولار) على صندوقٍ في فترةٍ — مجموعُ مدين حسابات المصروف في قيود الفترة.
// الفترةُ تُطابَق بالتاريخ الهجريّ لكلّ قيد (سنةٌ '1447' تُطابق startsWith؛ شهرٌ '1447-12' يُطابق تمامًا).
async function actualSpendByFund(db: Db, period: string): Promise<Map<string, Map<string, number>>> {
  const expenseAccIds = new Set((await db.select({ id: accounts.id, type: accounts.type }).from(accounts).all())
    .filter((a) => a.type === "expense").map((a) => a.id));
  const rows = await db.select({
    fundId: journalLines.fundId, accountId: journalLines.accountId, debit: journalLines.debitCents,
    entryDate: journalEntries.entryDate, dateHijri: journalEntries.dateHijri, source: journalEntries.source,
  }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId)).all();
  // خريطةُ fundId ⇒ (accountId ⇒ سنتات، و '' ⇒ إجماليّ الصندوق)
  const byFund = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.source === "reversal") continue; // العكوسُ تُطرح تلقائيًّا لأنّها تُقيَّد كدائنٍ على المصروف (debit=0) فلا تُحسب هنا
    if (!expenseAccIds.has(r.accountId)) continue;
    if (r.debit <= 0) continue;
    const hp = r.dateHijri || hijriMonthKey(new Date(r.entryDate));
    if (!hp.startsWith(period)) continue;
    const m = byFund.get(r.fundId) ?? new Map<string, number>();
    m.set(r.accountId, (m.get(r.accountId) ?? 0) + r.debit);
    m.set("", (m.get("") ?? 0) + r.debit); // إجماليّ الصندوق
    byFund.set(r.fundId, m);
  }
  return byFund;
}

// تقريرُ الموازنة لفترة: لكلّ موازنةٍ المخطّطُ والفعليُّ والمتبقّي وحالةُ التجاوز.
export async function budgetReport(db: Db, period: string): Promise<Array<{
  id: string; fundId: string; fundName: string; accountId: string; accountName: string | null;
  planned: number; actual: number; remaining: number; pct: number; over: boolean;
}>> {
  const buds = await db.select().from(budgets).where(eq(budgets.period, period)).all();
  if (!buds.length) return [];
  const fundName = new Map((await db.select({ id: funds.id, name: funds.name }).from(funds).all()).map((f) => [f.id, f.name]));
  const accName = new Map((await db.select({ id: accounts.id, name: accounts.name }).from(accounts).all()).map((a) => [a.id, a.name]));
  const spend = await actualSpendByFund(db, period);
  return buds.map((b) => {
    const actualCents = spend.get(b.fundId)?.get(b.accountId) ?? 0;
    const actual = round2(fromCents(actualCents));
    const remaining = round2(b.amount - actual);
    return {
      id: b.id, fundId: b.fundId, fundName: fundName.get(b.fundId) ?? b.fundId,
      accountId: b.accountId, accountName: b.accountId ? (accName.get(b.accountId) ?? b.accountId) : null,
      planned: b.amount, actual, remaining, pct: b.amount > 0 ? Math.round((actual / b.amount) * 100) : 0, over: actual > b.amount,
    };
  }).sort((a, b) => b.pct - a.pct);
}

// فحصٌ استباقيٌّ قبل صرفٍ جديد: هل يتجاوز موازنةَ الصندوق (والحساب إن وُجد)؟
export async function checkBudget(db: Db, input: { period: string; fundId: string; accountId?: string; addAmount: number }): Promise<{ planned: number; actual: number; remaining: number; wouldExceed: boolean }> {
  const accountId = input.accountId ?? "";
  const bud = (await db.select().from(budgets).where(and(
    eq(budgets.period, input.period), eq(budgets.fundId, input.fundId), eq(budgets.accountId, accountId),
  )).all())[0];
  if (!bud) return { planned: 0, actual: 0, remaining: 0, wouldExceed: false }; // لا موازنة ⇒ لا قيد
  const spend = await actualSpendByFund(db, input.period);
  const actual = round2(fromCents(spend.get(input.fundId)?.get(accountId) ?? 0));
  const remaining = round2(bud.amount - actual);
  return { planned: bud.amount, actual, remaining, wouldExceed: round2(actual + input.addAmount) > bud.amount };
}

// تنبيهٌ بشريٌّ لصرفٍ على صندوقٍ: يفحص موازنتَي الشهر والسنة الحاليّتين، ويُعيد رسالةً إن تُجووِزت (أو null).
export async function budgetWarningForFund(db: Db, fundId: string, atMs = Date.now()): Promise<string | null> {
  const monthP = hijriMonthKey(new Date(atMs));
  const yearP = monthP.slice(0, 4);
  const fundName = new Map((await db.select({ id: funds.id, name: funds.name }).from(funds).all()).map((f) => [f.id, f.name]));
  for (const period of [monthP, yearP]) {
    const c = await checkBudget(db, { period, fundId, addAmount: 0 });
    if (c.planned > 0 && c.actual > c.planned) {
      const over = round2(c.actual - c.planned);
      return `تجاوزتَ موازنةَ «${fundName.get(fundId) ?? fundId}» لهذه الفترة بمقدار $${over.toFixed(2)} (المخطّط $${c.planned.toFixed(2)}).`;
    }
  }
  return null;
}
