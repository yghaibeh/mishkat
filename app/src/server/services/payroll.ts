// المرحلة ٤ — الرواتب: بدلاتٌ (+) وخصوماتٌ (−) على المستحقّ الإجماليّ فيصير الصافي ≠ الإجماليّ.
// المستخدمُ يرى كشفَ راتبٍ واضحًا (إجماليّ، بدلات، خصومات، صافٍ) — لا محاسبة.
import { and, eq } from "drizzle-orm";
import { payrollAdjustments, monthlyEntitlements, persons } from "../database/schema";
import { writeAudit } from "../utils/audit";
import { scheduledRecovery } from "./advances";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function addAdjustment(db: Db, input: { personId: string; month: string; kind: "allowance" | "deduction"; amount: number; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(payrollAdjustments).values({
    id, personId: input.personId, month: input.month, kind: input.kind, amount: Math.abs(input.amount),
    note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "add_payroll_adjustment", entity: "payroll_adjustment", entityId: id, after: { personId: input.personId, month: input.month, kind: input.kind, amount: input.amount } });
  return { id };
}

export async function removeAdjustment(db: Db, id: string): Promise<void> {
  await db.delete(payrollAdjustments).where(eq(payrollAdjustments.id, id)).run();
}

// احتسابُ الصافي = الإجماليّ (من المستحقّ) + البدلات − الخصومات − قسطُ استرداد السُلَف (≥ ٠).
// قسطُ السلفة مجدولٌ للعرض؛ يُرحَّل للدفتر فعليًّا عند الصرف عبر recordRepayment (لا أثرَ جانبيَّ في القراءة).
export async function computeNetPay(db: Db, personId: string, month: string): Promise<{ gross: number; allowances: number; deductions: number; advanceRecovery: number; net: number }> {
  const ent = (await db.select({ g: monthlyEntitlements.grossAmount }).from(monthlyEntitlements)
    .where(and(eq(monthlyEntitlements.personId, personId), eq(monthlyEntitlements.month, month))).all())[0];
  const gross = round2(ent?.g ?? 0);
  const adj = await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.personId, personId), eq(payrollAdjustments.month, month))).all();
  const allowances = round2(adj.filter((a) => a.kind === "allowance").reduce((s, a) => s + a.amount, 0));
  const deductions = round2(adj.filter((a) => a.kind === "deduction").reduce((s, a) => s + a.amount, 0));
  const advanceRecovery = await scheduledRecovery(db, personId);
  return { gross, allowances, deductions, advanceRecovery, net: Math.max(0, round2(gross + allowances - deductions - advanceRecovery)) };
}

// كشفُ الراتب: بيانات الشخص + الشهر + البنود + الصافي (للعرض والطباعة).
export async function payslip(db: Db, personId: string, month: string): Promise<{
  personId: string; personName: string; month: string; gross: number; allowances: number; deductions: number; advanceRecovery: number; net: number;
  items: Array<{ id: string; kind: string; amount: number; note: string | null }>;
}> {
  const p = (await db.select({ n: persons.fullName }).from(persons).where(eq(persons.id, personId)).all())[0];
  const np = await computeNetPay(db, personId, month);
  const items = (await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.personId, personId), eq(payrollAdjustments.month, month))).all())
    .map((a) => ({ id: a.id, kind: a.kind, amount: a.amount, note: a.note }));
  return { personId, personName: p?.n ?? "—", month, ...np, items };
}

// كشفٌ من معرّف المستحقّ مباشرةً (تحلّ منه هويّةُ الشخص والشهر) — لأزرار صفوف الماليّة.
export async function payslipByEntitlement(db: Db, entitlementId: string) {
  const ent = (await db.select({ personId: monthlyEntitlements.personId, month: monthlyEntitlements.month })
    .from(monthlyEntitlements).where(eq(monthlyEntitlements.id, entitlementId)).all())[0];
  if (!ent) return null;
  return payslip(db, ent.personId, ent.month);
}
