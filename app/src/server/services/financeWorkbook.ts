// المصنّفُ الشامل (الوثيقة ٢٨ §٣.٢): دالّةٌ مجمِّعةٌ واحدةٌ تستدعي الخدماتِ القائمةَ نفسَها
// وتعيد JSON جاهزًا لـ١٩ ورقة — المتصفّحُ يصوغ ملفَّ Excel، والخادمُ لا يلمس xlsx إطلاقًا.
// كلُّ الأرقام تخرج من نفس الدوالّ التي تعرضها الشاشات ⇒ تطابقٌ بالسنت مضمونٌ بالبناء.
import { desc, eq, inArray } from "drizzle-orm";
import {
  accounts, funds, journalEntries, journalLines, donations, expenses, orgUnits,
  donors, pledges, monthlyEntitlements, persons, budgets, expenseClaims,
  fixedAssets, depreciationRuns, fxRates, financeActions, users,
} from "../database/schema";
import type { Db } from "../utils/db";
import { trialBalance, fundBalances, fromCents } from "./ledger";
import { statementOfActivities, statementOfPosition, cashFlowStatement } from "./statements";
import { budgetReport } from "./budgets";
import { outstandingAdvances } from "./advances";
import { listBoxes, boxTxns } from "./pettyCash";
import { listBatches, batchDetail } from "./paymentBatches";
import { currencyBalances, listCurrencies } from "./currencies";
import { reconciliationSummary } from "./reconciliation";
import { computeNetPay } from "./payroll";
import { hijriMonthKey } from "../utils/week";

const r2 = (n: number) => Math.round(n * 100) / 100;

// أسماءُ أشخاصٍ من معرّفات مستخدمين (شرائحُ ≤٩٠ احترامًا لحدود متغيّرات D1)
async function userNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const rows = await db.select({ id: users.id, name: persons.fullName })
      .from(users).innerJoin(persons, eq(persons.id, users.personId)).where(inArray(users.id, chunk)).all();
    for (const r of rows) out.set(r.id, r.name);
  }
  return out;
}

export type WorkbookData = Awaited<ReturnType<typeof collectFinanceWorkbook>>;

// period: '' = الكلّ، '1447' = سنة، '1447-05' = شهر هجريّ.
export async function collectFinanceWorkbook(db: Db, period?: string) {
  const p = (period ?? "").trim();
  const inPeriod = (hijri: string | null, atMs: number) =>
    !p || (hijri || hijriMonthKey(new Date(atMs))).startsWith(p);

  // ١+٣: الملخّص وميزان المراجعة (تراكميّان — أرصدةٌ لا حركات)
  const [fb, tb, curBal, curList] = await Promise.all([
    fundBalances(db), trialBalance(db), currencyBalances(db), listCurrencies(db),
  ]);

  // ٢: دفترُ اليوميّة (قيودٌ بسطورها) — مرشَّحٌ بالفترة
  const accName = new Map((await db.select({ id: accounts.id, name: accounts.name }).from(accounts).all()).map((a) => [a.id, a.name]));
  const fundName = new Map((await db.select({ id: funds.id, name: funds.name }).from(funds).all()).map((f) => [f.id, f.name]));
  const entries = (await db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate)).all())
    .filter((e) => inPeriod(e.dateHijri, e.entryDate));
  const entryIds = entries.map((e) => e.id);
  const linesByEntry = new Map<string, Array<typeof journalLines.$inferSelect>>();
  for (let i = 0; i < entryIds.length; i += 90) {
    const chunk = entryIds.slice(i, i + 90);
    for (const l of await db.select().from(journalLines).where(inArray(journalLines.entryId, chunk)).all()) {
      const arr = linesByEntry.get(l.entryId) ?? []; arr.push(l); linesByEntry.set(l.entryId, arr);
    }
  }
  const journal = entries.flatMap((e) => (linesByEntry.get(e.id) ?? []).map((l) => ({
    date: e.entryDate, dateHijri: e.dateHijri, memo: e.memo, source: e.source, sourceRef: e.sourceRef,
    accountId: l.accountId, accountName: accName.get(l.accountId) ?? l.accountId,
    fundName: fundName.get(l.fundId) ?? l.fundId,
    debit: r2(fromCents(l.debitCents)), credit: r2(fromCents(l.creditCents)),
    currency: l.currency, origAmount: l.amountOrig != null ? r2(l.amountOrig / 100) : null,
  })));

  // ٤+٥+٦: القوائم الثلاث (النشاط بالفترة؛ المركزُ تراكميّ؛ التدفّق بالفترة)
  const [activities, position, cashflow] = await Promise.all([
    statementOfActivities(db, p || hijriMonthKey(new Date()).slice(0, 4)),
    statementOfPosition(db),
    cashFlowStatement(db, p || undefined),
  ]);

  // ٧+٨: التبرّعات والمصروفات التفصيليّة (بأسماء المساجد)
  const mosqueName = new Map((await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.type, "mosque")).all()).map((m) => [m.id, m.name]));
  const donRows = (await db.select().from(donations).orderBy(desc(donations.at)).all()).filter((d) => inPeriod(null, d.at));
  const expRows = (await db.select().from(expenses).orderBy(desc(expenses.at)).all()).filter((e) => inPeriod(null, e.at));
  const donationsSheet = donRows.map((d) => ({
    receiptNo: d.receiptNo, at: d.at, donorName: d.donorName, fundName: fundName.get(d.fundId) ?? d.fundId,
    amountUsd: r2(d.amount), currency: d.currency ?? "USD", origAmount: d.origAmount != null ? r2(d.origAmount) : null,
    mosque: mosqueName.get(d.mosqueId) ?? d.mosqueId, note: d.note,
  }));
  const expensesSheet = expRows.map((e) => ({
    at: e.at, category: e.category, fundName: fundName.get(e.fundId) ?? e.fundId,
    amountUsd: r2(e.amount), currency: e.currency ?? "USD", origAmount: e.origAmount != null ? r2(e.origAmount) : null,
    mosque: mosqueName.get(e.mosqueId) ?? e.mosqueId, spentBy: e.spentBy, note: e.note,
  }));

  // ٩: المانحون وتعهّداتهم
  const donorRows = await db.select().from(donors).all();
  const donTotals = new Map<string, { total: number; count: number }>();
  for (const d of donRows) if (d.donorId) { const t = donTotals.get(d.donorId) ?? { total: 0, count: 0 }; t.total += d.amount; t.count += 1; donTotals.set(d.donorId, t); }
  const pledgeRows = await db.select().from(pledges).all();
  const donorsSheet = donorRows.map((d) => ({
    name: d.name, phone: d.phone, total: r2(donTotals.get(d.id)?.total ?? 0), count: donTotals.get(d.id)?.count ?? 0,
    pledges: pledgeRows.filter((pl) => pl.donorId === d.id).map((pl) => ({
      fundName: fundName.get(pl.fundId) ?? pl.fundId, amount: r2(pl.amount), fulfilled: r2(pl.fulfilled), remaining: r2(pl.amount - pl.fulfilled), status: pl.status,
    })),
  }));

  // ١٠: الموازنات — لفترة التصدير (أو كلّ فترات الجدول إن لم تُحدَّد)
  const budgetPeriods = p ? [p] : [...new Set((await db.select({ p: budgets.period }).from(budgets).all()).map((b) => b.p))].sort();
  const budgetsSheet = (await Promise.all(budgetPeriods.map(async (bp) => (await budgetReport(db, bp)).map((row) => ({ period: bp, ...row }))))).flat();

  // ١١: مطالباتُ الصرف بكلّ حالاتها (بأسماء الطالب والمقرِّر)
  const claimRows = await db.select().from(expenseClaims).orderBy(desc(expenseClaims.requestedAt)).all();
  const claimNames = await userNames(db, claimRows.flatMap((c) => [c.requestedBy, c.decidedBy ?? ""]));
  const claimsSheet = claimRows.filter((c) => inPeriod(null, c.requestedAt)).map((c) => ({
    at: c.requestedAt, category: c.category, fundName: fundName.get(c.fundId) ?? c.fundId, amount: r2(c.amount),
    status: c.status, requestedBy: claimNames.get(c.requestedBy) ?? c.requestedBy,
    decidedBy: c.decidedBy ? claimNames.get(c.decidedBy) ?? c.decidedBy : null, rejectReason: c.rejectReason, receiptUrl: c.receiptUrl,
  }));

  // ١٢: الرواتب — مستحقّاتُ شهر الفترة (إن كانت شهرًا) أو الشهر الأحدث في الجدول
  const allMonths = [...new Set((await db.select({ m: monthlyEntitlements.month }).from(monthlyEntitlements).all()).map((r) => r.m))].sort();
  const payMonth = /^\d{4}-\d{2}$/.test(p) ? p : allMonths[allMonths.length - 1];
  const entRows = payMonth ? await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.month, payMonth)).all() : [];
  const personName = new Map<string, string>();
  for (let i = 0; i < entRows.length; i += 90) {
    const chunk = [...new Set(entRows.slice(i, i + 90).map((e) => e.personId))];
    for (const r of await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, chunk)).all()) personName.set(r.id, r.name);
  }
  const payrollSheet = await Promise.all(entRows.map(async (e) => {
    const np = await computeNetPay(db, e.personId, e.month);
    return { person: personName.get(e.personId) ?? e.personId, month: e.month, gross: r2(np.gross), allowances: r2(np.allowances), deductions: r2(np.deductions), advanceRecovery: r2(np.advanceRecovery), net: r2(np.net), status: e.status };
  }));

  // ١٣: السُلَف — قائمةُ الخدمة نفسِها
  const advancesSheet = await outstandingAdvances(db);

  // ١٤: النثريّة — الصناديق وحركاتُها
  const boxes = await listBoxes(db);
  const pettySheet = await Promise.all(boxes.map(async (b) => ({ ...b, txns: (await boxTxns(db, b.id)).filter((t) => inPeriod(null, t.createdAt)) })));

  // ١٥: دفعاتُ الصرف ببنودها
  const batchList = await listBatches(db);
  const batchesSheet = await Promise.all(batchList.map(async (b) => ({ ...b, detail: await batchDetail(db, b.id) })));

  // ١٦: الأصولُ الثابتة — المجمّعُ من depreciationRuns (نفسُ مصدرِ الشاشة) وجدولُ إهلاكِ كلّ أصل
  const assetRows = await db.select().from(fixedAssets).all();
  const depRows = await db.select().from(depreciationRuns).all();
  const assetsSheet = assetRows.map((a) => {
    const runs = depRows.filter((d) => d.fixedAssetId === a.id);
    const monthly = r2((a.cost - a.salvageValue) / a.usefulLifeMonths);
    const accumulated = r2(runs.reduce((s, d) => s + d.amount, 0));
    return {
      name: a.name, cost: r2(a.cost), salvage: r2(a.salvageValue), lifeMonths: a.usefulLifeMonths,
      startPeriod: a.startPeriod, monthly, accumulated, netBookValue: r2(a.cost - accumulated),
      status: a.status, fundName: fundName.get(a.fundId) ?? a.fundId,
      schedule: runs.map((d) => ({ period: d.period, amount: r2(d.amount) })).sort((x, y) => x.period.localeCompare(y.period)),
    };
  });

  // ١٧: العملات — الأسعارُ التاريخيّة + عمليّاتُ التصريف من الدفتر
  const rateRows = (await db.select().from(fxRates).orderBy(desc(fxRates.effectiveAt)).all()).filter((r) => inPeriod(null, r.effectiveAt));
  const exchangeEntries = entries.filter((e) => e.source === "exchange");
  const exchangesSheet = exchangeEntries.map((e) => {
    const ls = linesByEntry.get(e.id) ?? [];
    const gain = ls.filter((l) => l.accountId === "4910").reduce((s, l) => s + l.creditCents, 0);
    const loss = ls.filter((l) => l.accountId === "5910").reduce((s, l) => s + l.debitCents, 0);
    return { at: e.entryDate, memo: e.memo, gain: r2(fromCents(gain)), loss: r2(fromCents(loss)) };
  });

  // ١٨: المطابقةُ البنكيّة لكلّ حسابات النقد
  const cashAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.parentId, "1100")).all();
  const reconSheet = await Promise.all(cashAccounts.map(async (a) => ({ accountId: a.id, accountName: a.name, ...(await reconciliationSummary(db, a.id)) })));

  // ١٩: سجلُّ الاعتمادات (محرّكُ الاعتماد الثنائيّ)
  const actionRows = (await db.select().from(financeActions).orderBy(desc(financeActions.proposedAt)).all()).filter((a) => inPeriod(null, a.proposedAt));
  const actionNames = await userNames(db, actionRows.flatMap((a) => [a.proposedBy, a.decidedBy ?? ""]));
  const approvalsSheet = actionRows.map((a) => ({
    kind: a.kind, summary: a.summary, amountUsd: r2(a.amountUsd), status: a.status,
    proposedBy: actionNames.get(a.proposedBy) ?? a.proposedBy, proposedAt: a.proposedAt,
    decidedBy: a.decidedBy ? actionNames.get(a.decidedBy) ?? a.decidedBy : null, decidedAt: a.decidedAt,
    rejectReason: a.rejectReason, error: a.error,
  }));

  return {
    meta: { period: p || "الكلّ", txnCount: journal.length, donCount: donationsSheet.length, expCount: expensesSheet.length },
    summary: {
      fundBalances: fb.map((f) => ({ ...f, balance: r2(fromCents(f.balance)) })), // الخدمةُ تعيد سنتات
      currencyBalances: curBal, currencies: curList,
    },
    journal, trialBalance: tb.map((t) => ({ ...t, debit: r2(fromCents(t.debit)), credit: r2(fromCents(t.credit)), balance: r2(fromCents(t.balance)) })),
    activities, position, cashflow,
    donations: donationsSheet, expenses: expensesSheet, donors: donorsSheet,
    budgets: budgetsSheet, claims: claimsSheet, payroll: { month: payMonth ?? null, rows: payrollSheet },
    advances: advancesSheet, petty: pettySheet, batches: batchesSheet, assets: assetsSheet,
    currencies: { rates: rateRows.map((r) => ({ currency: r.currency, rateToBase: r.rateToBase, effectiveAt: r.effectiveAt })), exchanges: exchangesSheet },
    reconciliation: reconSheet, approvals: approvalsSheet,
  };
}
