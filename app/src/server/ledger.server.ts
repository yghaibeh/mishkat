// المرحلة ٠ — قراءةُ الدفتر: ميزانُ المراجعة وأرصدةُ الصناديق (يُثبت سلامةَ المحرّك الخفيّ).
// المستخدمُ يقرأ أرقامًا نهائيّةً بلغةٍ بسيطة؛ لا يرى قيدًا ولا مدينًا ولا دائنًا.
import { desc, eq, inArray } from "drizzle-orm";
import { currentUser } from "./auth.server";
import { useDb } from "./utils/db";
import { isGlobalAdmin } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { accounts, journalEntries, journalLines, donors, expenseClaims, financeActions as financeActionsT, importBatches as importBatchesT, funds as fundsT, currencies as currenciesT, orgUnits as orgUnitsT } from "./database/schema";
import { trialBalance, fundBalances, fromCents } from "./services/ledger";

async function requireFinanceView() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.view")) throw new Error("لا تملك صلاحية الملف المالي");
  return u;
}

// نظرةٌ عامّةٌ على الدفتر: رصيدُ كلّ صندوقٍ (بالدولار) + ميزانُ المراجعة + برهانُ التوازن.
export async function ledgerOverviewData() {
  await requireFinanceView();
  const db = useDb();
  const [funds, tb] = await Promise.all([fundBalances(db), trialBalance(db)]);
  const totalDebit = tb.reduce((s, r) => s + r.debit, 0);
  const totalCredit = tb.reduce((s, r) => s + r.credit, 0);
  return {
    funds: funds.map((f) => ({ id: f.fundId, name: f.name, restricted: f.restricted, balance: fromCents(f.balance) })),
    trialBalance: tb.map((r) => ({ accountId: r.accountId, name: r.name, type: r.type, debit: fromCents(r.debit), credit: fromCents(r.credit), balance: fromCents(r.balance) })),
    balanced: totalDebit === totalCredit,           // برهانُ سلامة المحرّك: يجب أن يكون true دومًا
    totals: { debit: fromCents(totalDebit), credit: fromCents(totalCredit) },
  };
}

// ه٧: ترحيلُ الحركات التاريخيّة للدفتر (الإدارة العليا) — idempotent فالإعادةُ آمنة.
export async function backfillLedgerData() {
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) throw new Error("الترحيل للإدارة العليا فقط");
  const { backfillLedger } = await import("./services/ledgerBackfill");
  return backfillLedger(useDb(), u.userId);
}

// ه٨: دفترُ اليوميّة — أحدثُ القيود بسطورها (للمدقّق). finance.view.
export async function journalData(limit = 40) {
  await requireFinanceView();
  const db = useDb();
  const entries = await db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate)).limit(limit).all();
  if (!entries.length) return { entries: [] as Array<{ id: string; memo: string | null; dateHijri: string | null; source: string | null; lines: Array<{ account: string; debit: number; credit: number }> }> };
  const ids = entries.map((e) => e.id);
  const lines = await db.select().from(journalLines).where(inArray(journalLines.entryId, ids)).all();
  const accs = new Map((await db.select({ id: accounts.id, name: accounts.name }).from(accounts).all()).map((a) => [a.id, a.name]));
  return {
    entries: entries.map((e) => ({
      id: e.id, memo: e.memo, dateHijri: e.dateHijri, source: e.source,
      lines: lines.filter((l) => l.entryId === e.id).map((l) => ({
        account: accs.get(l.accountId) ?? l.accountId, debit: fromCents(l.debitCents), credit: fromCents(l.creditCents),
      })),
    })),
  };
}

// و٢: قائمةُ المانحين + كشفُ مانحٍ كامل (finance.view).
export async function donorsListData(q?: string) {
  await requireFinanceView();
  const { donorsList } = await import("./services/donorsReport");
  return { items: await donorsList(useDb(), q) };
}
export async function donorStatementFullData(donorId: string) {
  await requireFinanceView();
  const { donorFullStatement } = await import("./services/donorsReport");
  return donorFullStatement(useDb(), donorId);
}

// و٣: تسجيلُ تعهّدٍ (مُدخِل/إدارة) + التعهّداتُ المفتوحة (finance.view).
export async function recordPledgeData(input: { donorName: string; amount: number; fund?: string; note?: string }) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.entry") && !hasCap(c, "finance.approve")) throw new Error("تسجيلُ التعهّد للمُدخِل أو المعتمِد");
  const db = useDb();
  const nm = input.donorName.trim();
  if (nm.length < 2) return { error: "اسمُ المتعهِّد مطلوب" as const };
  // مانحٌ بالاسم — يُنشأ إن لم يوجد
  let donor = (await db.select({ id: donors.id }).from(donors).where(eq(donors.name, nm)).all())[0];
  if (!donor) { const id = crypto.randomUUID(); await db.insert(donors).values({ id, name: nm, phone: null, note: null, createdAt: Date.now() }).run(); donor = { id }; }
  const { recordPledge } = await import("./services/pledges");
  await recordPledge(db, { donorId: donor.id, amount: input.amount, fund: input.fund, note: input.note, createdBy: u.userId });
  return { ok: true as const };
}

export async function openPledgesData() {
  await requireFinanceView();
  const { openPledges } = await import("./services/pledges");
  return { items: await openPledges(useDb()) };
}

// المرحلة ٢: ضبطُ الموازنة (معتمِد) + تقريرُها (مطّلِع).
export async function setBudgetData(input: { period: string; fundId: string; accountId?: string; amount: number; note?: string }) {
  const u = await requireFinanceActor();
  if (!/^\d{4}(-\d{2})?$/.test(input.period)) return { error: "الفترة سنةٌ '1447' أو شهرٌ '1447-12'" as const };
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const q = await dualControl(u, "budget_set", { ...input }, `موازنةُ ${input.period} — صندوق ${input.fundId}: $${input.amount}`, input.amount);
  if (q) return q;
  const { setBudget } = await import("./services/budgets");
  await setBudget(useDb(), { ...input, createdBy: u.userId });
  return { ok: true as const };
}
export async function budgetReportData(period: string) {
  await requireFinanceView();
  const { budgetReport } = await import("./services/budgets");
  return { period, items: await budgetReport(useDb(), period) };
}

// المرحلة ٣: مطالباتُ الصرف — تقديمٌ (مُدخِل) + بتٌّ (معتمِد) + قائمةٌ (مطّلِع).
export async function submitClaimData(input: { fundId?: string; category?: string; amount: number; note?: string; mosqueId?: string; receiptUrl?: string }) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.entry") && !hasCap(c, "finance.approve")) throw new Error("تقديمُ المطالبة للمُدخِل");
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const { submitClaim } = await import("./services/expenseClaims");
  await submitClaim(useDb(), { ...input, requestedBy: u.userId });
  return { ok: true as const };
}
export async function decideClaimData(input: { claimId: string; approve: boolean; reason?: string }) {
  const u = await requireFinanceActor();
  const db = useDb();
  const claim = (await db.select().from(expenseClaims).where(eq(expenseClaims.id, input.claimId)).all())[0];
  if (!claim) return { error: "المطالبة غير موجودة" as const };
  const q = await dualControl(u, "claim_decide", { ...input },
    `${input.approve ? "اعتمادُ" : "رفضُ"} مطالبة «${claim.category ?? "مصروف"}» بمبلغ $${claim.amount}`, claim.amount);
  if (q) return q;
  const { approveClaim, rejectClaim } = await import("./services/expenseClaims");
  if (input.approve) return approveClaim(db, { claimId: input.claimId, decidedBy: u.userId });
  return rejectClaim(db, { claimId: input.claimId, decidedBy: u.userId, reason: input.reason ?? "" });
}
export async function claimsData(status: "pending" | "approved" | "rejected" = "pending") {
  await requireFinanceView();
  const { listClaims } = await import("./services/expenseClaims");
  return { items: await listClaims(useDb(), status) };
}

// المرحلة ٦ (مُقدَّمة): القوائم الماليّة (finance.view).
export async function financialStatementsData(period?: string) {
  await requireFinanceView();
  const db = useDb();
  const { statementOfActivities, statementOfPosition, cashFlowStatement } = await import("./services/statements");
  const { hijriMonthKey } = await import("./utils/week");
  const p = period ?? hijriMonthKey(new Date()).slice(0, 4);
  const [activities, position, cashFlow] = await Promise.all([statementOfActivities(db, p), statementOfPosition(db), cashFlowStatement(db, p)]);
  return { activities, position, cashFlow };
}

// المرحلة ٤: تعديلاتُ الراتب (معتمِد) + كشفُ الراتب (مطّلِع).
export async function addAdjustmentData(input: { personId: string; month: string; kind: "allowance" | "deduction"; amount: number; note?: string }) {
  const u = await requireFinanceActor();
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const q = await dualControl(u, "payroll_adjust_add", { ...input }, `${input.kind === "allowance" ? "بدلُ" : "خصمُ"} راتبٍ $${input.amount} لشهر ${input.month}${input.note ? ` — ${input.note}` : ""}`, input.amount);
  if (q) return q;
  const { addAdjustment } = await import("./services/payroll");
  await addAdjustment(useDb(), { ...input, createdBy: u.userId });
  return { ok: true as const };
}
export async function removeAdjustmentData(id: string) {
  const u = await requireFinanceActor();
  const q = await dualControl(u, "payroll_adjust_remove", { id }, "حذفُ بندِ راتبٍ (بدل/خصم)");
  if (q) return q;
  const { removeAdjustment } = await import("./services/payroll");
  await removeAdjustment(useDb(), id);
  return { ok: true as const };
}
export async function payslipData(input: { personId: string; month: string }) {
  await requireFinanceView();
  const { payslip } = await import("./services/payroll");
  return payslip(useDb(), input.personId, input.month);
}
export async function payslipByEntitlementData(entitlementId: string) {
  await requireFinanceView();
  const { payslipByEntitlement } = await import("./services/payroll");
  return payslipByEntitlement(useDb(), entitlementId);
}

// المرحلة ٤ (تكملة): سُلَفُ الموظّفين — منحٌ/استردادٌ (معتمِد) + قائمةٌ (مطّلِع).
export async function grantAdvanceData(input: { personId: string; principal: number; monthlyDeduction: number; fundId?: string; note?: string }) {
  const u = await requireFinanceActor();
  if (!(input.principal > 0) || !(input.monthlyDeduction > 0)) return { error: "المبلغُ والقسطُ موجبان" as const };
  if (input.monthlyDeduction > input.principal) return { error: "القسطُ لا يتجاوز أصلَ السلفة" as const };
  const q = await dualControl(u, "advance_grant", { ...input }, `منحُ سُلفةٍ $${input.principal} (قسطٌ شهريّ $${input.monthlyDeduction})`, input.principal);
  if (q) return q;
  const { grantAdvance } = await import("./services/advances");
  await grantAdvance(useDb(), { ...input, createdBy: u.userId });
  return { ok: true as const };
}
export async function repayAdvanceData(input: { advanceId: string; amount: number; month?: string }) {
  const u = await requireFinanceActor();
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const q = await dualControl(u, "advance_repay", { ...input }, `استردادُ سُلفةٍ $${input.amount}`, input.amount);
  if (q) return q;
  const { recordRepayment } = await import("./services/advances");
  return recordRepayment(useDb(), { ...input, createdBy: u.userId });
}
export async function advancesData() {
  await requireFinanceView();
  const { outstandingAdvances } = await import("./services/advances");
  return { items: await outstandingAdvances(useDb()) };
}

// المرحلة ٣ (متخصّص): الصندوقُ النثريّ — فتحٌ/صرفٌ/تزويدٌ (معتمِد) + قائمةٌ وحركاتٌ (مطّلِع).
async function requireFinanceApprove() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.approve")) throw new Error("هذا الإجراءُ للمعتمِد");
  return u;
}

// فاعلٌ ماليّ: معتمِدٌ (ينفّذ مباشرةً) أو مُدخِلٌ عليه سياسةُ اعتماد (المسؤول الماليّ ⇒ يقترح).
// الاعتراضُ الثنائيّ (الوثيقة ٢٨): إن كان على المستخدم سياسةٌ يُقيَّد فعلُه في الطابور بدل التنفيذ.
async function requireFinanceActor() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.approve") && !hasCap(c, "finance.entry")) throw new Error("هذا الإجراءُ لمعتمِدٍ أو مُدخِلٍ ماليّ");
  return u;
}
type Guarded = { queued: true; actionId: string; message: string } | null;
async function dualControl(u: Awaited<ReturnType<typeof requireFinanceActor>>, kind: string, payload: Record<string, unknown>, summary: string, amountUsd = 0, extra?: { currency?: string; origAmount?: number }): Promise<Guarded> {
  const { guardFinanceAction } = await import("./services/financeActions");
  const g = await guardFinanceAction(useDb(), u, { kind, payload, summary, amountUsd, ...extra });
  if (g.queued) return { queued: true, actionId: g.id!, message: "أُرسل الاقتراحُ لاعتماد المدير — لن يُنفَّذ قبل اعتماده" };
  return null;
}
export async function openPettyBoxData(input: { name: string; floatAmount: number; custodianPersonId?: string; fundId?: string; note?: string }) {
  const u = await requireFinanceActor();
  if (!(input.floatAmount > 0)) return { error: "سقفُ النثريّة موجب" as const };
  if (!input.name?.trim()) return { error: "اسمُ الصندوق مطلوب" as const };
  const q = await dualControl(u, "petty_open", { ...input }, `فتحُ نثريّة «${input.name.trim()}» بسقف $${input.floatAmount}`, input.floatAmount);
  if (q) return q;
  const { openBox } = await import("./services/pettyCash");
  await openBox(useDb(), { ...input, createdBy: u.userId });
  return { ok: true as const };
}
export async function pettyExpenseData(input: { boxId: string; amount: number; category?: string; note?: string }) {
  const u = await requireFinanceActor();
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const q = await dualControl(u, "petty_expense", { ...input }, `مصروفٌ نثريّ ${input.category ?? ""} $${input.amount}`.trim(), input.amount);
  if (q) return q;
  const { recordPettyExpense } = await import("./services/pettyCash");
  try { return { ...(await recordPettyExpense(useDb(), { ...input, createdBy: u.userId })), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function replenishPettyBoxData(boxId: string) {
  const u = await requireFinanceActor();
  const q = await dualControl(u, "petty_replenish", { boxId }, "تزويدُ صندوقٍ نثريٍّ إلى سقفه");
  if (q) return q;
  const { replenishBox } = await import("./services/pettyCash");
  return replenishBox(useDb(), { boxId, createdBy: u.userId });
}
export async function pettyBoxesData() {
  await requireFinanceView();
  const { listBoxes } = await import("./services/pettyCash");
  return { items: await listBoxes(useDb()) };
}
export async function pettyBoxTxnsData(boxId: string) {
  await requireFinanceView();
  const { boxTxns } = await import("./services/pettyCash");
  return { items: await boxTxns(useDb(), boxId) };
}

// المرحلة ٥: الأصولُ الثابتةُ والإهلاك — رسملةٌ/تشغيلُ إهلاك (معتمِد) + قائمةٌ (مطّلِع).
export async function capitalizeAssetData(input: { name: string; cost: number; salvageValue?: number; usefulLifeMonths: number; startPeriod: string; fundId?: string; note?: string }) {
  const u = await requireFinanceActor();
  if (!input.name?.trim()) return { error: "اسمُ الأصل مطلوب" as const };
  if (!(input.cost > 0)) return { error: "التكلفةُ موجبة" as const };
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) return { error: "العمرُ أشهرٌ صحيحةٌ موجبة" as const };
  if (!/^\d{4}-\d{2}$/.test(input.startPeriod)) return { error: "شهرُ البدء '1447-01'" as const };
  const q = await dualControl(u, "asset_capitalize", { ...input }, `رسملةُ أصل «${input.name.trim()}» بتكلفة $${input.cost}`, input.cost);
  if (q) return q;
  const { capitalizeAsset } = await import("./services/depreciation");
  try { await capitalizeAsset(useDb(), { ...input, createdBy: u.userId }); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function runDepreciationData(period: string) {
  const u = await requireFinanceActor();
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "الفترةُ شهرٌ '1447-01'" as const };
  const q = await dualControl(u, "depreciation_run", { period }, `تشغيلُ إهلاك شهر ${period} لكلّ الأصول النشطة`);
  if (q) return q;
  const { runDepreciation } = await import("./services/depreciation");
  return { ...(await runDepreciation(useDb(), { period, createdBy: u.userId })), ok: true as const };
}
export async function fixedAssetsData() {
  await requireFinanceView();
  const { listFixedAssets } = await import("./services/depreciation");
  return { items: await listFixedAssets(useDb()) };
}
export async function disposeAssetData(input: { fixedAssetId: string; proceeds?: number; note?: string }) {
  const u = await requireFinanceActor();
  if (input.proceeds != null && input.proceeds < 0) return { error: "المتحصّلُ غير سالب" as const };
  const q = await dualControl(u, "asset_dispose", { ...input }, `استبعادُ أصلٍ بمتحصّل $${input.proceeds ?? 0}`, input.proceeds ?? 0);
  if (q) return q;
  const { disposeAsset } = await import("./services/depreciation");
  try { return { ...(await disposeAsset(useDb(), { ...input, createdBy: u.userId })), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}

// المرحلة ٣ (متخصّص): دفعاتُ الصرف المجمّعة — إنشاءٌ/إضافةٌ/حذفٌ (مُدخِل) + صرفٌ (معتمِد) + قائمةٌ/تفصيلٌ (مطّلِع).
async function requireFinanceEntry() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.entry") && !hasCap(c, "finance.approve")) throw new Error("هذا الإجراءُ للمُدخِل");
  return u;
}
export async function createBatchData(input: { title: string; period?: string; fundId?: string }) {
  const u = await requireFinanceEntry();
  if (!input.title?.trim()) return { error: "عنوانُ الدفعة مطلوب" as const };
  const { createBatch } = await import("./services/paymentBatches");
  return { ...(await createBatch(useDb(), { ...input, createdBy: u.userId })), ok: true as const };
}
export async function addBatchItemData(input: { batchId: string; personName: string; amount: number; note?: string }) {
  const u = await requireFinanceEntry();
  if (!input.personName?.trim()) return { error: "اسمُ المستفيد مطلوب" as const };
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const { addBatchItem } = await import("./services/paymentBatches");
  try { return { ...(await addBatchItem(useDb(), input)), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function removeBatchItemData(itemId: string) {
  await requireFinanceEntry();
  const { removeBatchItem } = await import("./services/paymentBatches");
  try { await removeBatchItem(useDb(), { itemId }); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function payBatchData(batchId: string) {
  const u = await requireFinanceActor();
  const { payBatch, batchDetail } = await import("./services/paymentBatches");
  try {
    const b = await batchDetail(useDb(), batchId);
    const q = await dualControl(u, "batch_pay", { batchId }, `صرفُ دفعة «${b.title}» — ${b.items.length} مستفيدًا بإجمالي $${b.total}`, b.total);
    if (q) return q;
    return { ...(await payBatch(useDb(), { batchId, createdBy: u.userId })), ok: true as const };
  } catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function batchesData() {
  await requireFinanceView();
  const { listBatches } = await import("./services/paymentBatches");
  return { items: await listBatches(useDb()) };
}
export async function batchDetailData(batchId: string) {
  await requireFinanceView();
  const { batchDetail } = await import("./services/paymentBatches");
  return batchDetail(useDb(), batchId);
}

// تعدّدُ العملات: أسعارٌ + أرصدةٌ (مطّلِع) + ضبطُ سعرٍ + تصريفٌ (معتمِد).
export async function currenciesData() {
  await requireFinanceView();
  const db = useDb();
  const { listCurrencies, currencyBalances } = await import("./services/currencies");
  const [list, balances] = await Promise.all([listCurrencies(db), currencyBalances(db)]);
  return { list, balances };
}
export async function setRateData(input: { currency: string; rateToBase: number }) {
  const u = await requireFinanceActor();
  if (!(input.rateToBase > 0)) return { error: "السعرُ موجب" as const };
  const q = await dualControl(u, "fx_rate_set", { ...input }, `ضبطُ سعر صرف ${input.currency}: 1 = $${input.rateToBase}`);
  if (q) return q;
  const { setRate } = await import("./services/currencies");
  try { await setRate(useDb(), { ...input, createdBy: u.userId }); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function recordExchangeData(input: { fromCurrency: string; fromAmount: number; toCurrency: string; toAmount: number; fundId?: string }) {
  const u = await requireFinanceActor();
  if (!(input.fromAmount > 0) || !(input.toAmount > 0)) return { error: "المبلغان موجبان" as const };
  const approxUsd = input.fromCurrency === "USD" ? input.fromAmount : input.toCurrency === "USD" ? input.toAmount : 0;
  const q = await dualControl(u, "exchange", { ...input }, `تصريف: ${input.fromAmount.toLocaleString()} ${input.fromCurrency} ⇐ ${input.toAmount.toLocaleString()} ${input.toCurrency}`, approxUsd);
  if (q) return q;
  const { recordExchange } = await import("./services/currencies");
  try { return { ...(await recordExchange(useDb(), { ...input, createdBy: u.userId })), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}

// ===== محرّكُ الاعتماد الثنائيّ (الوثيقة ٢٨): الصندوق + القرار + المعاينة + مقترحاتي =====
async function requireFinanceSupervise() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.supervise")) throw new Error("اعتمادُ الاقتراحات الماليّة للمدير");
  return u;
}
export async function financeActionsData(input: { status?: string; mine?: boolean }) {
  const u = await requireFinanceView();
  const { listFinanceActions } = await import("./services/financeActions");
  return { items: await listFinanceActions(useDb(), { status: input.status, proposedBy: input.mine ? u.userId : undefined }) };
}
export async function decideFinanceActionData(input: { actionId: string; approve: boolean; reason?: string }) {
  const u = await requireFinanceSupervise();
  const { decideFinanceAction } = await import("./services/financeActions");
  try { return { ...(await decideFinanceAction(useDb(), { ...input, decidedBy: u.userId })), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function retryFinanceActionData(actionId: string) {
  const u = await requireFinanceSupervise();
  const { executeAction } = await import("./services/financeActions");
  try { return { ...(await executeAction(useDb(), actionId, u.userId)), ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function cancelFinanceActionData(actionId: string) {
  const u = await requireFinanceActor();
  const { cancelFinanceAction } = await import("./services/financeActions");
  try { await cancelFinanceAction(useDb(), actionId, u.userId); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
// معاينةُ أثر الدفتر لاقتراحٍ — للمدير قبل القرار (أو لصاحب الاقتراح).
export async function previewFinanceActionData(actionId: string) {
  await requireFinanceView();
  const db = useDb();
  const a = (await db.select().from(financeActionsT).where(eq(financeActionsT.id, actionId)).all())[0];
  const { previewFinanceAction } = await import("./services/financeActions");
  if (!a) return { lines: [] as Awaited<ReturnType<typeof previewFinanceAction>> };
  return { lines: await previewFinanceAction(db, a.kind, a.payload) };
}
// قيدٌ يدويٌّ (ميزةُ الوثيقة ٢٨ §٤) — يخضع للاعتماد الثنائيّ؛ المعتمِدُ ينفّذ مباشرةً عبر المنفّذ نفسِه.
export async function manualJournalData(input: { memo: string; dateHijri?: string; lines: Array<{ accountId: string; fundId: string; debit?: number; credit?: number }> }) {
  const u = await requireFinanceActor();
  if (!input.memo?.trim()) return { error: "بيانُ القيد مطلوب" as const };
  if (!input.lines || input.lines.length < 2) return { error: "القيدُ سطران فأكثر" as const };
  const totalDebit = input.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) return { error: `قيدٌ غير متوازن (مدين $${totalDebit} ≠ دائن $${totalCredit})` as const };
  const q = await dualControl(u, "manual_journal", { ...input }, `قيدٌ يدويّ: ${input.memo.trim()} ($${totalDebit})`, totalDebit);
  if (q) return q;
  const { FINANCE_ACTION_KINDS } = await import("./services/financeActions");
  try { await FINANCE_ACTION_KINDS.manual_journal.execute(useDb(), input as never, { proposedBy: u.userId, approvedBy: u.userId }); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}
export async function openingBalanceData(input: { accountId: string; fundId: string; amount: number; currency?: string; origAmount?: number }) {
  const u = await requireFinanceActor();
  if (!(input.amount > 0)) return { error: "المبلغ موجب" as const };
  const q = await dualControl(u, "opening_balance", { ...input }, `رصيدٌ افتتاحيّ $${input.amount} على حساب ${input.accountId} (${input.fundId})`, input.amount);
  if (q) return q;
  const { FINANCE_ACTION_KINDS } = await import("./services/financeActions");
  try { await FINANCE_ACTION_KINDS.opening_balance.execute(useDb(), input as never, { proposedBy: u.userId, approvedBy: u.userId }); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message } as { error: string }; }
}

// المطابقةُ البنكيّة/النقديّة: قائمةٌ + ملخّصٌ (مطّلِع) + وسمٌ (معتمِد).
export async function reconciliationData(accountId: string) {
  await requireFinanceView();
  const db = useDb();
  const { reconcilableEntries, reconciliationSummary } = await import("./services/reconciliation");
  const [entries, summary] = await Promise.all([reconcilableEntries(db, accountId), reconciliationSummary(db, accountId)]);
  return { accountId, entries, summary };
}
export async function setReconciledData(input: { entryId: string; accountId: string; reconciled: boolean }) {
  const u = await requireFinanceApprove();
  const { setReconciled } = await import("./services/reconciliation");
  await setReconciled(useDb(), { ...input, reconciledBy: u.userId });
  return { ok: true as const };
}

// د٣ (الوثيقة ٢٨): المصنّفُ الشامل — دالّةٌ مجمِّعةٌ واحدةٌ لكلّ أوراق التصدير (المتصفّحُ يصوغ الملفّ).
export async function financeWorkbookData(period?: string) {
  await requireFinanceView();
  if (period && !/^\d{4}(-\d{2})?$/.test(period)) throw new Error("الفترةُ بصيغة 1447 أو 1447-05");
  const { collectFinanceWorkbook } = await import("./services/financeWorkbook");
  return collectFinanceWorkbook(useDb(), period);
}

// ===== د٤ (الوثيقة ٢٨): الاستيرادُ بالقوالب عبر محرّك الاعتماد =====
// (٢-٣) تحقّقٌ شامل «الكلُّ أو لا شيء» — يعيد الأخطاءَ بالسطر ليصلحها المستورِد.
export async function validateImportData(input: { kind: string; rows: Array<Record<string, unknown>> }) {
  await requireFinanceActor();
  const { validateImportRows, IMPORT_LIMITS } = await import("./services/financeImport");
  if (input.rows.length > IMPORT_LIMITS.maxRows) return { ok: false as const, errors: [{ row: 0, error: `الحدُّ ${IMPORT_LIMITS.maxRows} صفًّا` }] };
  const res = await validateImportRows(useDb(), input.kind, input.rows);
  if (!res.ok) return { ok: false as const, errors: res.errors };
  type Json = Record<string, string | number | boolean | null>;
  return { ok: true as const, count: res.payloads.length, totalUsd: res.totalUsd, sample: res.payloads.slice(0, 3) as Json[] };
}

// (٤) تأكيدُ المستورِد ⇒ دفعةٌ + فعلُ bulk_import: يُعترَض لمن عليه سياسة، ويُنفَّذ فورًا لمن دونها.
export async function submitImportData(input: { kind: string; rows: Array<Record<string, unknown>>; filename?: string; meta?: Record<string, unknown> }) {
  const u = await requireFinanceActor();
  const db = useDb();
  const { validateImportRows, createImportBatch, IMPORT_KINDS } = await import("./services/financeImport");
  const v = await validateImportRows(db, input.kind, input.rows);
  if (!v.ok) return { error: `الملفُّ لم يجتز التحقّق (${v.errors.length} خطأ) — نزِّل ورقةَ الأخطاء وأصلِحها`, errors: v.errors };
  const created = await createImportBatch(db, { kind: input.kind, filename: input.filename, rows: input.rows, payloads: v.payloads, totalUsd: v.totalUsd, meta: input.meta, createdBy: u.userId });
  if ("error" in created) return { error: created.error };
  const label = IMPORT_KINDS[input.kind]?.label ?? input.kind;
  const summary = `استيرادُ ${v.payloads.length} صفًّا (${label})${v.totalUsd ? ` بإجماليّ $${v.totalUsd.toLocaleString()}` : ""}${input.filename ? ` — ${input.filename}` : ""}`;
  const q = await dualControl(u, "bulk_import", { batchId: created.batchId }, summary, v.totalUsd);
  if (q) return { ...q, batchId: created.batchId };
  // مَن لا سياسةَ عليه (المدير): تنفيذٌ مباشرٌ بنفس المنفّذ (بعد تأكيد المعاينة في الواجهة)
  const { FINANCE_ACTION_KINDS } = await import("./services/financeActions");
  try {
    const res = await FINANCE_ACTION_KINDS.bulk_import.execute(db, { batchId: created.batchId }, { proposedBy: u.userId, approvedBy: u.userId });
    return { ok: true as const, batchId: created.batchId, ref: res.ref };
  } catch (e) { return { error: (e as Error).message, batchId: created.batchId }; }
}

// دفعاتُ الاستيراد (للمتابعة والاستئناف)
export async function importBatchesData() {
  await requireFinanceView();
  const db = useDb();
  const t = importBatchesT;
  const rows = await db.select().from(t).orderBy(desc(t.createdAt)).limit(30).all();
  return { items: rows.map((b) => ({ id: b.id, kind: b.kind, filename: b.filename, rowCount: b.rowCount, totalUsd: b.totalUsd, status: b.status, executedRows: b.executedRows, error: b.error, createdAt: b.createdAt })) };
}

// قوالبُ التنزيل: مواصفةُ الأعمدة + قوائمُ التحقّق الحيّة (صناديق/عملات/مساجد) ليصوغها المتصفّح.
export async function importTemplateSpecData() {
  await requireFinanceActor();
  const db = useDb();
  const { IMPORT_KINDS } = await import("./services/financeImport");
  const [fundRows, curRows, mosqueRows] = await Promise.all([
    db.select({ id: fundsT.id, name: fundsT.name }).from(fundsT).all(),
    db.select({ code: currenciesT.code }).from(currenciesT).all(),
    db.select({ name: orgUnitsT.name }).from(orgUnitsT).where(eq(orgUnitsT.type, "mosque")).all(),
  ]);
  return {
    kinds: Object.entries(IMPORT_KINDS).map(([kind, s]) => ({ kind, label: s.label, columns: s.columns })),
    lists: { funds: fundRows.map((f) => f.id), currencies: curRows.map((c) => c.code), mosques: mosqueRows.map((m) => m.name), adj_kinds: ["allowance", "deduction"] },
  };
}
