import { createServerFn } from "@tanstack/react-start";

// أغلفة RPC لقراءة الدفتر (المرحلة ٠). القراءةُ بلا مُدخلات.
export const getLedgerOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { ledgerOverviewData } = await import("@/server/ledger.server");
  return ledgerOverviewData();
});

export const backfillLedger = createServerFn({ method: "POST" }).handler(async () => {
  const { backfillLedgerData } = await import("@/server/ledger.server");
  return backfillLedgerData();
});

export const getJournal = createServerFn({ method: "GET" }).handler(async () => {
  const { journalData } = await import("@/server/ledger.server");
  return journalData();
});

export const getDonorsList = createServerFn({ method: "GET" })
  .validator((d: unknown) => (d ?? {}) as { q?: string })
  .handler(async ({ data }) => {
    const { donorsListData } = await import("@/server/ledger.server");
    return donorsListData(data?.q);
  });

export const getDonorStatement = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { donorId: string })
  .handler(async ({ data }) => {
    const { donorStatementFullData } = await import("@/server/ledger.server");
    return donorStatementFullData(data.donorId);
  });

export const recordPledge = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { donorName: string; amount: number; fund?: "general"|"zakat"|"sadaqah"|"waqf"|"projects"; note?: string })
  .handler(async ({ data }) => {
    const { recordPledgeData } = await import("@/server/ledger.server");
    return recordPledgeData(data);
  });

export const getOpenPledges = createServerFn({ method: "GET" }).handler(async () => {
  const { openPledgesData } = await import("@/server/ledger.server");
  return openPledgesData();
});

export const setBudget = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { period: string; fundId: string; accountId?: string; amount: number; note?: string })
  .handler(async ({ data }) => {
    const { setBudgetData } = await import("@/server/ledger.server");
    return setBudgetData(data);
  });

export const getBudgetReport = createServerFn({ method: "GET" })
  .validator((d: unknown) => (d ?? {}) as { period?: string })
  .handler(async ({ data }) => {
    const { budgetReportData } = await import("@/server/ledger.server");
    const { hijriMonthKey } = await import("@/server/utils/week");
    return budgetReportData(data?.period ?? hijriMonthKey(new Date()).slice(0, 4)); // الافتراض: السنة الهجريّة الحاليّة
  });

export const submitClaim = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { fundId?: string; category?: string; amount: number; note?: string; receiptUrl?: string })
  .handler(async ({ data }) => {
    const { submitClaimData } = await import("@/server/ledger.server");
    return submitClaimData(data);
  });

export const decideClaim = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { claimId: string; approve: boolean; reason?: string })
  .handler(async ({ data }) => {
    const { decideClaimData } = await import("@/server/ledger.server");
    return decideClaimData(data);
  });

export const getClaims = createServerFn({ method: "GET" }).handler(async () => {
  const { claimsData } = await import("@/server/ledger.server");
  return claimsData("pending");
});

export const getFinancialStatements = createServerFn({ method: "GET" })
  .validator((d: unknown) => (d ?? {}) as { period?: string })
  .handler(async ({ data }) => {
    const { financialStatementsData } = await import("@/server/ledger.server");
    return financialStatementsData(data?.period);
  });

export const addAdjustment = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { personId: string; month: string; kind: "allowance" | "deduction"; amount: number; note?: string })
  .handler(async ({ data }) => {
    const { addAdjustmentData } = await import("@/server/ledger.server");
    return addAdjustmentData(data);
  });

export const removeAdjustment = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { removeAdjustmentData } = await import("@/server/ledger.server");
    return removeAdjustmentData(data.id);
  });

export const getPayslip = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { personId: string; month: string })
  .handler(async ({ data }) => {
    const { payslipData } = await import("@/server/ledger.server");
    return payslipData(data);
  });

export const getPayslipByEntitlement = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { entitlementId: string })
  .handler(async ({ data }) => {
    const { payslipByEntitlementData } = await import("@/server/ledger.server");
    return payslipByEntitlementData(data.entitlementId);
  });

// سُلَفُ الموظّفين (المرحلة ٤ تكملة)
export const grantAdvance = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { personId: string; principal: number; monthlyDeduction: number; fundId?: string; note?: string })
  .handler(async ({ data }) => {
    const { grantAdvanceData } = await import("@/server/ledger.server");
    return grantAdvanceData(data);
  });

export const repayAdvance = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { advanceId: string; amount: number; month?: string })
  .handler(async ({ data }) => {
    const { repayAdvanceData } = await import("@/server/ledger.server");
    return repayAdvanceData(data);
  });

export const getAdvances = createServerFn({ method: "GET" }).handler(async () => {
  const { advancesData } = await import("@/server/ledger.server");
  return advancesData();
});

// الصندوقُ النثريّ (المرحلة ٣ متخصّص)
export const openPettyBox = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { name: string; floatAmount: number; custodianPersonId?: string; fundId?: string; note?: string })
  .handler(async ({ data }) => {
    const { openPettyBoxData } = await import("@/server/ledger.server");
    return openPettyBoxData(data);
  });

export const pettyExpense = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { boxId: string; amount: number; category?: string; note?: string })
  .handler(async ({ data }) => {
    const { pettyExpenseData } = await import("@/server/ledger.server");
    return pettyExpenseData(data);
  });

export const replenishPettyBox = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { boxId: string })
  .handler(async ({ data }) => {
    const { replenishPettyBoxData } = await import("@/server/ledger.server");
    return replenishPettyBoxData(data.boxId);
  });

export const getPettyBoxes = createServerFn({ method: "GET" }).handler(async () => {
  const { pettyBoxesData } = await import("@/server/ledger.server");
  return pettyBoxesData();
});

export const getPettyBoxTxns = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { boxId: string })
  .handler(async ({ data }) => {
    const { pettyBoxTxnsData } = await import("@/server/ledger.server");
    return pettyBoxTxnsData(data.boxId);
  });

// الأصولُ الثابتةُ والإهلاك (المرحلة ٥)
export const capitalizeAsset = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { name: string; cost: number; salvageValue?: number; usefulLifeMonths: number; startPeriod: string; fundId?: string; note?: string })
  .handler(async ({ data }) => {
    const { capitalizeAssetData } = await import("@/server/ledger.server");
    return capitalizeAssetData(data);
  });

export const runDepreciation = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { period: string })
  .handler(async ({ data }) => {
    const { runDepreciationData } = await import("@/server/ledger.server");
    return runDepreciationData(data.period);
  });

export const getFixedAssets = createServerFn({ method: "GET" }).handler(async () => {
  const { fixedAssetsData } = await import("@/server/ledger.server");
  return fixedAssetsData();
});

export const disposeAsset = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { fixedAssetId: string; proceeds?: number; note?: string })
  .handler(async ({ data }) => {
    const { disposeAssetData } = await import("@/server/ledger.server");
    return disposeAssetData(data);
  });

// دفعاتُ الصرف المجمّعة (المرحلة ٣)
export const createBatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { title: string; period?: string; fundId?: string })
  .handler(async ({ data }) => {
    const { createBatchData } = await import("@/server/ledger.server");
    return createBatchData(data);
  });

export const addBatchItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { batchId: string; personName: string; amount: number; note?: string })
  .handler(async ({ data }) => {
    const { addBatchItemData } = await import("@/server/ledger.server");
    return addBatchItemData(data);
  });

export const removeBatchItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { itemId: string })
  .handler(async ({ data }) => {
    const { removeBatchItemData } = await import("@/server/ledger.server");
    return removeBatchItemData(data.itemId);
  });

export const payBatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { batchId: string })
  .handler(async ({ data }) => {
    const { payBatchData } = await import("@/server/ledger.server");
    return payBatchData(data.batchId);
  });

export const getBatches = createServerFn({ method: "GET" }).handler(async () => {
  const { batchesData } = await import("@/server/ledger.server");
  return batchesData();
});

export const getBatchDetail = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { batchId: string })
  .handler(async ({ data }) => {
    const { batchDetailData } = await import("@/server/ledger.server");
    return batchDetailData(data.batchId);
  });

// تعدّدُ العملات
export const getCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  const { currenciesData } = await import("@/server/ledger.server");
  return currenciesData();
});

export const setRate = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { currency: string; rateToBase: number })
  .handler(async ({ data }) => {
    const { setRateData } = await import("@/server/ledger.server");
    return setRateData(data);
  });

export const recordExchange = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { fromCurrency: string; fromAmount: number; toCurrency: string; toAmount: number; fundId?: string })
  .handler(async ({ data }) => {
    const { recordExchangeData } = await import("@/server/ledger.server");
    return recordExchangeData(data);
  });

// محرّكُ الاعتماد الثنائيّ (الوثيقة ٢٨)
export const getFinanceActions = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { status?: string; mine?: boolean })
  .handler(async ({ data }) => {
    const { financeActionsData } = await import("@/server/ledger.server");
    return financeActionsData(data);
  });

export const decideFinanceAction = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { actionId: string; approve: boolean; reason?: string })
  .handler(async ({ data }) => {
    const { decideFinanceActionData } = await import("@/server/ledger.server");
    return decideFinanceActionData(data);
  });

export const retryFinanceAction = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { actionId: string })
  .handler(async ({ data }) => {
    const { retryFinanceActionData } = await import("@/server/ledger.server");
    return retryFinanceActionData(data.actionId);
  });

export const cancelFinanceAction = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { actionId: string })
  .handler(async ({ data }) => {
    const { cancelFinanceActionData } = await import("@/server/ledger.server");
    return cancelFinanceActionData(data.actionId);
  });

export const previewFinanceAction = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { actionId: string })
  .handler(async ({ data }) => {
    const { previewFinanceActionData } = await import("@/server/ledger.server");
    return previewFinanceActionData(data.actionId);
  });

export const postManualJournal = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { memo: string; dateHijri?: string; lines: Array<{ accountId: string; fundId: string; debit?: number; credit?: number }> })
  .handler(async ({ data }) => {
    const { manualJournalData } = await import("@/server/ledger.server");
    return manualJournalData(data);
  });

export const postOpeningBalance = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { accountId: string; fundId: string; amount: number; currency?: string; origAmount?: number })
  .handler(async ({ data }) => {
    const { openingBalanceData } = await import("@/server/ledger.server");
    return openingBalanceData(data);
  });

// المطابقةُ البنكيّة
export const getReconciliation = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { accountId: string })
  .handler(async ({ data }) => {
    const { reconciliationData } = await import("@/server/ledger.server");
    return reconciliationData(data.accountId);
  });

export const setReconciled = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { entryId: string; accountId: string; reconciled: boolean })
  .handler(async ({ data }) => {
    const { setReconciledData } = await import("@/server/ledger.server");
    return setReconciledData(data);
  });

// د٣: بياناتُ المصنّف الشامل (١٩ ورقة) — المتصفّحُ يصوغ ملفَّ Excel من هذا الـJSON
export const getFinanceWorkbook = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { period?: string })
  .handler(async ({ data }) => {
    const { financeWorkbookData } = await import("@/server/ledger.server");
    return financeWorkbookData(data.period);
  });

// د٤: الاستيرادُ بالقوالب
export const validateImport = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { kind: string; rows: Array<Record<string, unknown>> })
  .handler(async ({ data }) => {
    const { validateImportData } = await import("@/server/ledger.server");
    return validateImportData(data);
  });

export const submitImport = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { kind: string; rows: Array<Record<string, unknown>>; filename?: string; meta?: Record<string, unknown> })
  .handler(async ({ data }) => {
    const { submitImportData } = await import("@/server/ledger.server");
    return submitImportData(data);
  });

export const getImportBatches = createServerFn({ method: "GET" })
  .handler(async () => {
    const { importBatchesData } = await import("@/server/ledger.server");
    return importBatchesData();
  });

export const getImportTemplateSpec = createServerFn({ method: "GET" })
  .handler(async () => {
    const { importTemplateSpecData } = await import("@/server/ledger.server");
    return importTemplateSpecData();
  });
