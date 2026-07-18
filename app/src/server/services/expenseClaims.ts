// المرحلة ٣ — مطالباتُ الصرف: فصلُ المهامّ (مُدخِلٌ يطلب، معتمِدٌ يُقرّ فيُرحَّل للدفتر).
// المطالبةُ المعلّقةُ لا تُحرّك مالًا؛ عند الاعتماد يُنشأ المصروفُ ويُرحَّل مع ضبطِ صرف المقيّد.
import { desc, eq } from "drizzle-orm";
import { expenseClaims, funds } from "../database/schema";
import { addExpense } from "./mosqueFinance";
import { assertFundCanSpend } from "./donorsFinance";
import { postExpense } from "./ledgerPost";
import { toCents } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

export async function submitClaim(db: Db, input: { mosqueId?: string; fundId?: string; category?: string; amount: number; note?: string; receiptUrl?: string; requestedBy: string }): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(expenseClaims).values({
    id, mosqueId: input.mosqueId ?? null, fundId: input.fundId ?? "general", category: input.category?.trim() || null,
    amount: input.amount, note: input.note?.trim() || null, status: "pending",
    requestedBy: input.requestedBy, requestedAt: Date.now(), decidedBy: null, decidedAt: null, rejectReason: null, expenseId: null,
    receiptUrl: input.receiptUrl?.trim() || null,
  }).run();
  await writeAudit(db, { actorUserId: input.requestedBy, action: "submit_claim", entity: "expense_claim", entityId: id, after: { fund: input.fundId ?? "general", amount: input.amount } });
  return { id };
}

// اعتمادٌ: فصلُ مهامّ (لا يعتمدها طالبُها) + ضبطُ المقيّد + إنشاءُ المصروف وترحيلُه + تنبيهُ الموازنة.
export async function approveClaim(db: Db, input: { claimId: string; decidedBy: string }): Promise<{ ok: true; budgetWarning: string | null } | { error: string }> {
  const c = (await db.select().from(expenseClaims).where(eq(expenseClaims.id, input.claimId)).all())[0];
  if (!c) return { error: "المطالبة غير موجودة" };
  if (c.status !== "pending") return { error: "بُتَّ في هذه المطالبة" };
  if (c.requestedBy === input.decidedBy) return { error: "لا يعتمد المطالبةَ طالبُها (فصلُ المهامّ)" };
  // ضبطُ صرف المقيّد (زكاة/وقف/مشاريع لا تتجاوز رصيدها)
  try { await assertFundCanSpend(db, c.fundId, toCents(c.amount)); }
  catch (e) { return { error: (e as Error).message }; }
  // إنشاءُ المصروف الفعليّ (سجلّ المسجد) ثمّ ترحيلُه للدفتر
  const { id: expenseId } = await addExpense(db, { mosqueId: c.mosqueId ?? "", category: c.category ?? undefined, amount: c.amount, spentBy: input.decidedBy, note: c.note ?? undefined, fund: c.fundId } as never, input.decidedBy);
  try { await postExpense(db, { id: expenseId, amount: c.amount, fundId: c.fundId, category: c.category ?? undefined, createdBy: input.decidedBy }); }
  catch (e) { console.error("[ledger] approveClaim post failed:", (e as Error)?.message ?? e); }
  await db.update(expenseClaims).set({ status: "approved", decidedBy: input.decidedBy, decidedAt: Date.now(), expenseId }).where(eq(expenseClaims.id, input.claimId)).run();
  await writeAudit(db, { actorUserId: input.decidedBy, action: "approve_claim", entity: "expense_claim", entityId: input.claimId, after: { expenseId, amount: c.amount } });
  let budgetWarning: string | null = null;
  try { const { budgetWarningForFund } = await import("./budgets"); budgetWarning = await budgetWarningForFund(db, c.fundId); } catch { /* */ }
  return { ok: true, budgetWarning };
}

export async function rejectClaim(db: Db, input: { claimId: string; decidedBy: string; reason: string }): Promise<{ ok: true } | { error: string }> {
  const c = (await db.select().from(expenseClaims).where(eq(expenseClaims.id, input.claimId)).all())[0];
  if (!c) return { error: "المطالبة غير موجودة" };
  if (c.status !== "pending") return { error: "بُتَّ في هذه المطالبة" };
  await db.update(expenseClaims).set({ status: "rejected", decidedBy: input.decidedBy, decidedAt: Date.now(), rejectReason: input.reason.trim() || "بلا سبب" }).where(eq(expenseClaims.id, input.claimId)).run();
  await writeAudit(db, { actorUserId: input.decidedBy, action: "reject_claim", entity: "expense_claim", entityId: input.claimId, after: { reason: input.reason } });
  return { ok: true };
}

export async function listClaims(db: Db, status: "pending" | "approved" | "rejected" = "pending"): Promise<Array<{ id: string; fundId: string; fundName: string; category: string | null; amount: number; note: string | null; receiptUrl: string | null; requestedBy: string; requestedAt: number }>> {
  const rows = await db.select().from(expenseClaims).where(eq(expenseClaims.status, status)).orderBy(desc(expenseClaims.requestedAt)).all();
  if (!rows.length) return [];
  const fundName = new Map((await db.select({ id: funds.id, name: funds.name }).from(funds).all()).map((f) => [f.id, f.name]));
  return rows.map((c) => ({ id: c.id, fundId: c.fundId, fundName: fundName.get(c.fundId) ?? c.fundId, category: c.category, amount: c.amount, note: c.note, receiptUrl: c.receiptUrl, requestedBy: c.requestedBy, requestedAt: c.requestedAt }));
}
