// محرّكُ الاعتماد الثنائيّ (Dual-Control Engine) — الوثيقة ٢٨.
// نقطةُ اختناقٍ واحدة: أفعالُ مَن عليه سياسةُ اعتمادٍ (المسؤول الماليّ) تُقترَح ولا تُنفَّذ،
// والمديرُ (finance.supervise) يعتمدها فتُنفَّذ عبر الخدمات القائمة نفسِها — مع معاينةِ أثرِ الدفتر قبل القرار.
import { and, desc, eq, inArray } from "drizzle-orm";
import { financeActions, approvalPolicies, accounts, funds, roleAssignments, persons, users, notifications, expenseClaims, fixedAssets, pettyCashBoxes, staffAdvances } from "../database/schema";
import { postJournal, toCents, hasActivePosting } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ===== سجلُّ المنفّذين: kind ⇐ الخدمة القائمة (لا ازدواجَ منطق) =====
// ctx: المقترِح (صاحبُ العمل) والمعتمِد (صاحبُ القرار) — يُسجَّلان معًا.
export type ExecCtx = { proposedBy: string; approvedBy: string };
type Executor = (db: Db, payload: Record<string, unknown>, ctx: ExecCtx) => Promise<{ ref?: string }>;

const p = <T>(x: unknown) => x as T;

export const FINANCE_ACTION_KINDS: Record<string, { label: string; execute: Executor }> = {
  exchange: {
    label: "تصريفُ عملة",
    execute: async (db, pl, ctx) => {
      const { recordExchange } = await import("./currencies");
      await recordExchange(db, { ...p<{ fromCurrency: string; fromAmount: number; toCurrency: string; toAmount: number; fundId?: string }>(pl), createdBy: ctx.proposedBy });
      return {};
    },
  },
  fx_rate_set: {
    label: "ضبطُ سعر صرف",
    execute: async (db, pl, ctx) => {
      const { setRate } = await import("./currencies");
      const r = await setRate(db, { ...p<{ currency: string; rateToBase: number }>(pl), createdBy: ctx.proposedBy });
      return { ref: r.id };
    },
  },
  budget_set: {
    label: "ضبطُ موازنة",
    execute: async (db, pl, ctx) => {
      const { setBudget } = await import("./budgets");
      await setBudget(db, { ...p<{ period: string; fundId: string; accountId?: string; amount: number; note?: string }>(pl), createdBy: ctx.proposedBy });
      return {};
    },
  },
  claim_decide: {
    label: "بتُّ مطالبة صرف",
    execute: async (db, pl, ctx) => {
      const { approveClaim, rejectClaim } = await import("./expenseClaims");
      const input = p<{ claimId: string; approve: boolean; reason?: string }>(pl);
      // المقرِّرُ الفعليُّ هو المعتمِد (فصلُ المهامّ داخل approveClaim يبقى ساريًا)
      if (input.approve) await approveClaim(db, { claimId: input.claimId, decidedBy: ctx.approvedBy });
      else await rejectClaim(db, { claimId: input.claimId, decidedBy: ctx.approvedBy, reason: input.reason ?? "" });
      return { ref: input.claimId };
    },
  },
  batch_pay: {
    label: "صرفُ دفعةٍ مجمّعة",
    execute: async (db, pl, ctx) => {
      const { payBatch } = await import("./paymentBatches");
      const input = p<{ batchId: string }>(pl);
      await payBatch(db, { batchId: input.batchId, createdBy: ctx.proposedBy });
      return { ref: input.batchId };
    },
  },
  petty_open: {
    label: "فتحُ صندوقٍ نثريّ",
    execute: async (db, pl, ctx) => {
      const { openBox } = await import("./pettyCash");
      const r = await openBox(db, { ...p<{ name: string; floatAmount: number; fundId?: string }>(pl), createdBy: ctx.proposedBy });
      return { ref: r.id };
    },
  },
  petty_expense: {
    label: "مصروفٌ نثريّ",
    execute: async (db, pl, ctx) => {
      const { recordPettyExpense } = await import("./pettyCash");
      await recordPettyExpense(db, { ...p<{ boxId: string; amount: number; category?: string; note?: string }>(pl), createdBy: ctx.proposedBy });
      return {};
    },
  },
  petty_replenish: {
    label: "تزويدُ نثريّة",
    execute: async (db, pl, ctx) => {
      const { replenishBox } = await import("./pettyCash");
      await replenishBox(db, { ...p<{ boxId: string }>(pl), createdBy: ctx.proposedBy });
      return {};
    },
  },
  advance_grant: {
    label: "منحُ سُلفة",
    execute: async (db, pl, ctx) => {
      const { grantAdvance } = await import("./advances");
      const r = await grantAdvance(db, { ...p<{ personId: string; principal: number; monthlyDeduction: number; fundId?: string; note?: string }>(pl), createdBy: ctx.proposedBy });
      return { ref: r.id };
    },
  },
  advance_repay: {
    label: "استردادُ سُلفة",
    execute: async (db, pl, ctx) => {
      const { recordRepayment } = await import("./advances");
      await recordRepayment(db, { ...p<{ advanceId: string; amount: number; month?: string }>(pl), createdBy: ctx.proposedBy });
      return {};
    },
  },
  payroll_adjust_add: {
    label: "بدل/خصمُ راتب",
    execute: async (db, pl, ctx) => {
      const { addAdjustment } = await import("./payroll");
      const r = await addAdjustment(db, { ...p<{ personId: string; month: string; kind: "allowance" | "deduction"; amount: number; note?: string }>(pl), createdBy: ctx.proposedBy });
      return { ref: r.id };
    },
  },
  payroll_adjust_remove: {
    label: "حذفُ بند راتب",
    execute: async (db, pl) => {
      const { removeAdjustment } = await import("./payroll");
      await removeAdjustment(db, p<{ id: string }>(pl).id);
      return {};
    },
  },
  asset_capitalize: {
    label: "رسملةُ أصل",
    execute: async (db, pl, ctx) => {
      const { capitalizeAsset } = await import("./depreciation");
      const r = await capitalizeAsset(db, { ...p<{ name: string; cost: number; salvageValue?: number; usefulLifeMonths: number; startPeriod: string; fundId?: string }>(pl), createdBy: ctx.proposedBy });
      return { ref: r.id };
    },
  },
  depreciation_run: {
    label: "تشغيلُ إهلاك شهر",
    execute: async (db, pl, ctx) => {
      const { runDepreciation } = await import("./depreciation");
      await runDepreciation(db, { period: p<{ period: string }>(pl).period, createdBy: ctx.proposedBy });
      return {};
    },
  },
  asset_dispose: {
    label: "استبعادُ أصل",
    execute: async (db, pl, ctx) => {
      const { disposeAsset } = await import("./depreciation");
      const input = p<{ fixedAssetId: string; proceeds?: number; note?: string }>(pl);
      await disposeAsset(db, { ...input, createdBy: ctx.proposedBy });
      return { ref: input.fixedAssetId };
    },
  },
  donation_add: {
    label: "تسجيلُ تبرّع",
    execute: async (db, pl, ctx) => {
      const { recordDonation } = await import("./donorsFinance");
      const r = await recordDonation(db, { ...p<{ mosqueId: string; amount: number; fund?: string; donorName?: string; note?: string; currency?: string }>(pl), collectedBy: ctx.proposedBy });
      return { ref: r.receiptNo };
    },
  },
  expense_add: {
    label: "تسجيلُ مصروف",
    execute: async (db, pl, ctx) => {
      const { enterExpense } = await import("./financeEntry");
      const r = await enterExpense(db, p<{ mosqueId: string; category?: string; amount: number; note?: string; fund?: string; currency?: string; origAmount?: number }>(pl), ctx.proposedBy);
      return { ref: r.id };
    },
  },
  manual_journal: {
    label: "قيدٌ يدويّ",
    execute: async (db, pl, ctx) => {
      const input = p<{ memo: string; dateHijri?: string; lines: Array<{ accountId: string; fundId: string; debit?: number; credit?: number }> }>(pl);
      const r = await postJournal(db, { source: "manual", memo: input.memo, dateHijri: input.dateHijri, createdBy: ctx.proposedBy },
        input.lines.map((l) => ({ accountId: l.accountId, fundId: l.fundId, debit: l.debit ? toCents(l.debit) : undefined, credit: l.credit ? toCents(l.credit) : undefined })));
      return { ref: r.id };
    },
  },
  opening_balance: {
    label: "رصيدٌ افتتاحيّ",
    execute: async (db, pl, ctx) => {
      const input = p<{ accountId: string; fundId: string; amount: number; currency?: string; origAmount?: number }>(pl);
      const ref = `${input.accountId}:${input.fundId}`;
      if (await hasActivePosting(db, "opening", ref)) throw new Error("رصيدٌ افتتاحيٌّ مسجَّلٌ لهذا الحساب والصندوق من قبل");
      const cents = toCents(input.amount);
      const foreign = input.currency && input.currency !== "USD";
      const r = await postJournal(db, { source: "opening", sourceRef: ref, memo: "رصيدٌ افتتاحيّ", createdBy: ctx.proposedBy }, [
        { accountId: input.accountId, fundId: input.fundId, debit: cents, currency: foreign ? input.currency : undefined, amountOrig: foreign && input.origAmount ? toCents(input.origAmount) : undefined },
        { accountId: "3100", fundId: input.fundId, credit: cents },
      ]);
      return { ref: r.id };
    },
  },
  bulk_import: {
    label: "استيرادٌ من ملفّ",
    execute: async (db, pl, ctx) => {
      // التنفيذُ المستأنَف صفًّا صفًّا عبر الخدمات القائمة (financeImport) — الإعادةُ لا تزدوج.
      const { executeImportBatch, resetFailedRows } = await import("./financeImport");
      const input = p<{ batchId: string }>(pl);
      await resetFailedRows(db, input.batchId); // إعادةُ المحاولة تعالج الفاشلَ وتتخطّى المنجَز
      const res = await executeImportBatch(db, input.batchId, ctx);
      return { ref: `${input.batchId}:${res.executed}/${res.total}` };
    },
  },
};

// ===== سياسةُ الاعتماد: هل يلزم هذا المستخدمَ اعتمادٌ لهذا الفعل؟ =====
export async function requiresApproval(db: Db, roles: string[], kind: string, amountUsd: number): Promise<boolean> {
  if (!roles.length) return false;
  const pols = await db.select().from(approvalPolicies).where(inArray(approvalPolicies.role, roles)).all();
  // الأخصُّ يغلب: سياسةُ النوع المحدَّد قبل «*»
  const match = pols.find((x) => x.kind === kind) ?? pols.find((x) => x.kind === "*");
  if (!match || match.mode !== "approve") return false;
  return Math.abs(amountUsd) >= match.thresholdUsd;
}

// نقطةُ الاختناق: تُستدعى من كلّ server-fn ماليٍّ مُغيِّر. queued=true ⇒ اقتُرح ولم يُنفَّذ.
export async function guardFinanceAction(db: Db, u: { userId: string; assignments: Array<{ role: string }> }, input: {
  kind: string; payload: Record<string, unknown>; summary: string; amountUsd?: number; currency?: string; origAmount?: number; clientUuid?: string;
}): Promise<{ queued: boolean; id?: string }> {
  const roles = [...new Set(u.assignments.map((a) => a.role))];
  if (!(await requiresApproval(db, roles, input.kind, input.amountUsd ?? 0))) return { queued: false };
  if (!FINANCE_ACTION_KINDS[input.kind]) throw new Error(`فعلٌ ماليٌّ غيرُ معروفٍ للمحرّك: ${input.kind}`);
  const clientUuid = input.clientUuid ?? crypto.randomUUID();
  const dup = (await db.select({ id: financeActions.id }).from(financeActions).where(eq(financeActions.clientUuid, clientUuid)).all())[0];
  if (dup) return { queued: true, id: dup.id }; // idempotency: نفسُ الإرسال لا يزدوج
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(financeActions).values({
    id, kind: input.kind, payload: JSON.stringify(input.payload), summary: input.summary,
    amountUsd: round2(input.amountUsd ?? 0), currency: input.currency ?? null, origAmount: input.origAmount ?? null,
    status: "pending", proposedBy: u.userId, proposedAt: now, clientUuid, createdAt: now,
  }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "propose_finance_action", entity: "finance_action", entityId: id, after: { kind: input.kind, summary: input.summary, amountUsd: input.amountUsd ?? 0 } });
  await notifySupervisors(db, { summary: input.summary, amountUsd: round2(input.amountUsd ?? 0) });
  return { queued: true, id };
}

// قرارُ المدير: اعتمادٌ (⇒ تنفيذٌ فوريٌّ عبر الخدمة القائمة) أو رفضٌ بسببٍ إلزاميّ.
export async function decideFinanceAction(db: Db, input: { actionId: string; approve: boolean; reason?: string; decidedBy: string }): Promise<{ status: string; error?: string }> {
  const a = (await db.select().from(financeActions).where(eq(financeActions.id, input.actionId)).all())[0];
  if (!a) throw new Error("الاقتراحُ غير موجود");
  if (a.status !== "pending") throw new Error("الاقتراحُ مبتوتٌ فيه من قبل");
  if (a.proposedBy === input.decidedBy) throw new Error("لا يعتمد أحدٌ فعلَ نفسه — الاعتمادُ لغيرِ المقترِح");
  const now = Date.now();
  if (!input.approve) {
    const reason = input.reason?.trim();
    if (!reason) throw new Error("سببُ الرفض إلزاميّ");
    await db.update(financeActions).set({ status: "rejected", decidedBy: input.decidedBy, decidedAt: now, rejectReason: reason }).where(eq(financeActions.id, a.id)).run();
    await writeAudit(db, { actorUserId: input.decidedBy, action: "reject_finance_action", entity: "finance_action", entityId: a.id, after: { reason } });
    await notifyUser(db, a.proposedBy, { outcome: "rejected", summary: a.summary, reason });
    return { status: "rejected" };
  }
  await db.update(financeActions).set({ status: "approved", decidedBy: input.decidedBy, decidedAt: now }).where(eq(financeActions.id, a.id)).run();
  return executeAction(db, a.id, input.decidedBy);
}

// تنفيذُ فعلٍ معتمَد (أو إعادةُ محاولةِ فاشل) — الفشلُ يُسجَّل بسببه ولا يُبتلَع.
export async function executeAction(db: Db, actionId: string, decidedBy: string): Promise<{ status: string; error?: string }> {
  const a = (await db.select().from(financeActions).where(eq(financeActions.id, actionId)).all())[0];
  if (!a) throw new Error("الاقتراحُ غير موجود");
  if (a.status !== "approved" && a.status !== "failed") throw new Error("لا يُنفَّذ إلا المعتمَدُ أو الفاشل");
  const kind = FINANCE_ACTION_KINDS[a.kind];
  if (!kind) throw new Error(`منفّذٌ مفقود: ${a.kind}`);
  try {
    const r = await kind.execute(db, JSON.parse(a.payload) as Record<string, unknown>, { proposedBy: a.proposedBy, approvedBy: decidedBy });
    await db.update(financeActions).set({ status: "executed", executedAt: Date.now(), resultRef: r.ref ?? null, error: null }).where(eq(financeActions.id, a.id)).run();
    await writeAudit(db, { actorUserId: decidedBy, action: "execute_finance_action", entity: "finance_action", entityId: a.id, after: { kind: a.kind, ref: r.ref ?? null } });
    await notifyUser(db, a.proposedBy, { outcome: "approved", summary: a.summary });
    return { status: "executed" };
  } catch (e) {
    const msg = (e as Error).message || "فشلٌ غيرُ معروف";
    await db.update(financeActions).set({ status: "failed", error: msg }).where(eq(financeActions.id, a.id)).run();
    await notifyUser(db, a.proposedBy, { outcome: "failed", summary: a.summary, error: msg });
    return { status: "failed", error: msg };
  }
}

// إلغاءُ المقترِح لاقتراحه المعلّق.
export async function cancelFinanceAction(db: Db, actionId: string, byUserId: string): Promise<void> {
  const a = (await db.select().from(financeActions).where(eq(financeActions.id, actionId)).all())[0];
  if (!a) throw new Error("الاقتراحُ غير موجود");
  if (a.proposedBy !== byUserId) throw new Error("الإلغاءُ لصاحب الاقتراح");
  if (a.status !== "pending") throw new Error("لا يُلغى إلا المعلّق");
  await db.update(financeActions).set({ status: "cancelled", decidedAt: Date.now() }).where(eq(financeActions.id, a.id)).run();
}

// قوائمُ الطابور (بأسماء المقترِحين) — للصندوق و«مقترحاتي» والسجلّ.
export async function listFinanceActions(db: Db, filter: { status?: string; proposedBy?: string; limit?: number }) {
  const conds = [] as ReturnType<typeof eq>[];
  if (filter.status) conds.push(eq(financeActions.status, filter.status));
  if (filter.proposedBy) conds.push(eq(financeActions.proposedBy, filter.proposedBy));
  const rows = await db.select().from(financeActions)
    .where(conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined)
    .orderBy(desc(financeActions.proposedAt)).limit(filter.limit ?? 60).all();
  const uids = [...new Set(rows.flatMap((r) => [r.proposedBy, r.decidedBy].filter(Boolean) as string[]))];
  const names = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 90) {
    const us = await db.select({ id: users.id, name: persons.fullName }).from(users)
      .innerJoin(persons, eq(persons.id, users.personId)).where(inArray(users.id, uids.slice(i, i + 90))).all();
    for (const r of us) names.set(r.id, r.name);
  }
  return rows.map((r) => ({
    id: r.id, kind: r.kind, kindLabel: FINANCE_ACTION_KINDS[r.kind]?.label ?? r.kind,
    summary: r.summary, amountUsd: r.amountUsd, currency: r.currency, origAmount: r.origAmount,
    status: r.status, proposedByName: names.get(r.proposedBy) ?? "—", proposedAt: r.proposedAt,
    decidedByName: r.decidedBy ? (names.get(r.decidedBy) ?? "—") : null, decidedAt: r.decidedAt,
    rejectReason: r.rejectReason, error: r.error, payload: r.payload,
  }));
}

// ===== معاينةُ أثر الدفتر (Dry-Run): السطورُ التي ستُرحَّل — قبل الاعتماد =====
// اختباراتُ التطابق تضمن ألّا تنحرف المعاينةُ عن الترحيل الفعليّ (preview == posted).
export type PreviewLine = { accountId: string; accountName: string; fundId: string; fundName: string; debit: number; credit: number };

export async function previewFinanceAction(db: Db, kind: string, payloadJson: string): Promise<PreviewLine[]> {
  const pl = JSON.parse(payloadJson) as Record<string, unknown>;
  const raw = await rawPreviewLines(db, kind, pl);
  if (!raw.length) return [];
  const accIds = [...new Set(raw.map((l) => l.accountId))];
  const accs = new Map((await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accIds)).all()).map((a) => [a.id, a.name]));
  const fundIds = [...new Set(raw.map((l) => l.fundId))];
  const fns = new Map((await db.select({ id: funds.id, name: funds.name }).from(funds).where(inArray(funds.id, fundIds)).all()).map((f) => [f.id, f.name]));
  return raw.map((l) => ({ ...l, accountName: accs.get(l.accountId) ?? l.accountId, fundName: fns.get(l.fundId) ?? l.fundId }));
}

async function rawPreviewLines(db: Db, kind: string, pl: Record<string, unknown>): Promise<Array<{ accountId: string; fundId: string; debit: number; credit: number }>> {
  const fund = (pl.fundId as string) || (pl.fund as string) || "general";
  const amt = (n: unknown) => round2(Number(n) || 0);
  switch (kind) {
    case "donation_add": {
      const usd = pl.currency && pl.currency !== "USD" ? await (await import("./currencies")).convertToBase(db, pl.currency as string, amt(pl.amount)) : amt(pl.amount);
      const acc = pl.currency && pl.currency !== "USD" ? await (await import("./currencies")).cashAccountFor(db, pl.currency as string) : "1110";
      return [{ accountId: acc, fundId: fund, debit: usd, credit: 0 }, { accountId: "4100", fundId: fund, debit: 0, credit: usd }];
    }
    case "expense_add": {
      const { expenseAccount } = await import("./ledgerPost");
      const usd = amt(pl.amount);
      const acc = pl.currency && pl.currency !== "USD" ? await (await import("./currencies")).cashAccountFor(db, pl.currency as string) : "1110";
      return [{ accountId: expenseAccount(pl.category as string | undefined), fundId: fund, debit: usd, credit: 0 }, { accountId: acc, fundId: fund, debit: 0, credit: usd }];
    }
    case "exchange": {
      const { convertToBase, cashAccountFor } = await import("./currencies");
      const usdFrom = await convertToBase(db, pl.fromCurrency as string, amt(pl.fromAmount));
      const usdTo = await convertToBase(db, pl.toCurrency as string, amt(pl.toAmount));
      const lines = [
        { accountId: await cashAccountFor(db, pl.toCurrency as string), fundId: fund, debit: usdTo, credit: 0 },
        { accountId: await cashAccountFor(db, pl.fromCurrency as string), fundId: fund, debit: 0, credit: usdFrom },
      ];
      const diff = round2(usdTo - usdFrom);
      if (diff > 0) lines.push({ accountId: "4910", fundId: fund, debit: 0, credit: diff });
      else if (diff < 0) lines.push({ accountId: "5910", fundId: fund, debit: -diff, credit: 0 });
      return lines;
    }
    case "petty_open": return [{ accountId: "1130", fundId: fund, debit: amt(pl.floatAmount), credit: 0 }, { accountId: "1110", fundId: fund, debit: 0, credit: amt(pl.floatAmount) }];
    case "petty_expense": {
      const box = (await db.select().from(pettyCashBoxes).where(eq(pettyCashBoxes.id, pl.boxId as string)).all())[0];
      const { expenseAccount } = await import("./ledgerPost");
      const f = box?.fundId ?? fund;
      return [{ accountId: expenseAccount(pl.category as string | undefined), fundId: f, debit: amt(pl.amount), credit: 0 }, { accountId: "1130", fundId: f, debit: 0, credit: amt(pl.amount) }];
    }
    case "petty_replenish": {
      const box = (await db.select().from(pettyCashBoxes).where(eq(pettyCashBoxes.id, pl.boxId as string)).all())[0];
      if (!box) return [];
      const topUp = round2(box.floatAmount - box.balance);
      if (topUp <= 0) return [];
      return [{ accountId: "1130", fundId: box.fundId, debit: topUp, credit: 0 }, { accountId: "1110", fundId: box.fundId, debit: 0, credit: topUp }];
    }
    case "advance_grant": return [{ accountId: "1200", fundId: fund, debit: amt(pl.principal), credit: 0 }, { accountId: "1110", fundId: fund, debit: 0, credit: amt(pl.principal) }];
    case "advance_repay": {
      const adv = (await db.select().from(staffAdvances).where(eq(staffAdvances.id, pl.advanceId as string)).all())[0];
      if (!adv) return [];
      const applied = round2(Math.min(amt(pl.amount), adv.balance));
      return [{ accountId: "1110", fundId: adv.fundId, debit: applied, credit: 0 }, { accountId: "1200", fundId: adv.fundId, debit: 0, credit: applied }];
    }
    case "batch_pay": {
      const { batchDetail } = await import("./paymentBatches");
      const b = await batchDetail(db, pl.batchId as string);
      return [{ accountId: "5100", fundId: "general", debit: b.total, credit: 0 }, { accountId: "1110", fundId: "general", debit: 0, credit: b.total }];
    }
    case "claim_decide": {
      if (!(pl.approve as boolean)) return [];
      const c = (await db.select().from(expenseClaims).where(eq(expenseClaims.id, pl.claimId as string)).all())[0];
      if (!c) return [];
      const { expenseAccount } = await import("./ledgerPost");
      return [{ accountId: expenseAccount(c.category ?? undefined), fundId: c.fundId, debit: c.amount, credit: 0 }, { accountId: "1110", fundId: c.fundId, debit: 0, credit: c.amount }];
    }
    case "asset_capitalize": return [{ accountId: "1210", fundId: fund, debit: amt(pl.cost), credit: 0 }, { accountId: "1110", fundId: fund, debit: 0, credit: amt(pl.cost) }];
    case "asset_dispose": {
      const fa = (await db.select().from(fixedAssets).where(eq(fixedAssets.id, pl.fixedAssetId as string)).all())[0];
      if (!fa) return [];
      const { assetBook } = await import("./depreciation");
      const bk = await assetBook(db, fa.id);
      const proceeds = amt(pl.proceeds);
      const nbv = bk.netBookValue;
      const gain = round2(Math.max(0, proceeds - nbv)), loss = round2(Math.max(0, nbv - proceeds));
      const lines = [{ accountId: "1210", fundId: fa.fundId, debit: 0, credit: round2(fa.cost) }];
      if (bk.accumulated > 0) lines.push({ accountId: "1190", fundId: fa.fundId, debit: bk.accumulated, credit: 0 });
      if (proceeds > 0) lines.push({ accountId: "1110", fundId: fa.fundId, debit: proceeds, credit: 0 });
      if (loss > 0) lines.push({ accountId: "5900", fundId: fa.fundId, debit: loss, credit: 0 });
      if (gain > 0) lines.push({ accountId: "4900", fundId: fa.fundId, debit: 0, credit: gain });
      return lines;
    }
    case "depreciation_run": {
      const rows = await db.select().from(fixedAssets).where(eq(fixedAssets.status, "active")).all();
      const { assetBook } = await import("./depreciation");
      let total = 0;
      for (const fa of rows) {
        const bk = await assetBook(db, fa.id);
        const remaining = round2(fa.cost - fa.salvageValue - bk.accumulated);
        if (remaining > 0) total = round2(total + Math.min(bk.monthly, remaining));
      }
      if (total <= 0) return [];
      return [{ accountId: "5400", fundId: "general", debit: total, credit: 0 }, { accountId: "1190", fundId: "general", debit: 0, credit: total }];
    }
    case "manual_journal": {
      const lines = (pl.lines as Array<{ accountId: string; fundId: string; debit?: number; credit?: number }>) ?? [];
      return lines.map((l) => ({ accountId: l.accountId, fundId: l.fundId, debit: amt(l.debit), credit: amt(l.credit) }));
    }
    case "opening_balance": return [{ accountId: pl.accountId as string, fundId: fund, debit: amt(pl.amount), credit: 0 }, { accountId: "3100", fundId: fund, debit: 0, credit: amt(pl.amount) }];
    default: return []; // fx_rate_set / budget_set / payroll_adjust_* — بلا أثرِ دفترٍ مباشر
  }
}

// ===== إشعارات — تمرُّ بطابور الإرسال الموحّد (status='queued') فتصل الجرسَ + تيليغرام + Web Push =====
// الحمولةُ مُهيكَلةٌ بمفاتيح يفهمها notifText (الجرس) وbuildMessage (الإرسال) — لا نصٌّ خامٌّ مبهم.
async function notifySupervisors(db: Db, payload: { summary: string; amountUsd?: number; by?: string }) {
  try {
    const admins = await db.select({ personId: roleAssignments.personId }).from(roleAssignments)
      .where(and(eq(roleAssignments.role, "admin"), eq(roleAssignments.approvalStatus, "approved"))).all();
    const now = Date.now();
    for (const a of [...new Set(admins.map((x) => x.personId))]) {
      await db.insert(notifications).values({ id: crypto.randomUUID(), personId: a, channel: "inapp", kind: "finance_proposal", payload: JSON.stringify(payload), status: "queued", createdAt: now, sentAt: null }).run();
    }
  } catch { /* الإشعارُ غيرُ حرج */ }
}
async function notifyUser(db: Db, userId: string, payload: { outcome: "approved" | "rejected" | "failed"; summary: string; reason?: string; error?: string }) {
  try {
    const u = (await db.select({ personId: users.personId }).from(users).where(eq(users.id, userId)).all())[0];
    if (!u) return;
    const now = Date.now();
    await db.insert(notifications).values({ id: crypto.randomUUID(), personId: u.personId, channel: "inapp", kind: "finance_decision", payload: JSON.stringify(payload), status: "queued", createdAt: now, sentAt: null }).run();
  } catch { /* غير حرج */ }
}

// ملخّصُ فائدة: عددُ المعلّق (لعدّادات الواجهة)
export async function pendingFinanceActionsCount(db: Db): Promise<number> {
  const rows = await db.select({ id: financeActions.id }).from(financeActions).where(eq(financeActions.status, "pending")).all();
  return rows.length;
}
