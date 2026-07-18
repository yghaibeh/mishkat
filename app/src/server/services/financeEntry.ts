// إدخالُ مصروفٍ كامل (خدمةٌ مستخرجةٌ من mosqueFinance.server ليستدعيَها محرّكُ الاعتماد نظيفًا):
// حارسُ الصندوق المقيَّد ⇒ صفُّ المصروف ⇒ ترحيلُ الدفتر ⇒ تحذيرُ الموازنة (غيرُ مانع).
import { addExpense } from "./mosqueFinance";
import { postExpense } from "./ledgerPost";
import { assertFundCanSpend } from "./donorsFinance";
import { toCents } from "./ledger";
import { budgetWarningForFund } from "./budgets";
import type { Db } from "../utils/db";

export async function enterExpense(db: Db, input: {
  mosqueId: string; category?: string; amount: number; note?: string; fund?: string;
  currency?: string; origAmount?: number; dateHijri?: string;
}, actorUserId: string): Promise<{ id: string; budgetWarning: string | null }> {
  const fund = input.fund ?? "general";
  await assertFundCanSpend(db, fund, toCents(input.amount)); // يرمي رسالةً بشريّةً عند تجاوز المقيَّد
  const { id } = await addExpense(db, { ...input, fund, spentBy: actorUserId }, actorUserId);
  await postExpense(db, { id, amount: input.amount, fundId: fund, category: input.category, dateHijri: input.dateHijri, currency: input.currency, origAmount: input.origAmount, createdBy: actorUserId });
  let budgetWarning: string | null = null;
  try { budgetWarning = await budgetWarningForFund(db, fund); } catch { /* غير حرج */ }
  return { id, budgetWarning };
}
