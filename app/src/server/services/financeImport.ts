// د٤ (الوثيقة ٢٨ §٣.٣-٣.٤): محرّكُ الاستيراد بالقوالب — تحقّقٌ صفًّا صفًّا (الكلُّ أو لا شيء)،
// دفعةٌ ببصمة محتوًى (لا يُرفَع الملفُّ نفسُه مرّتين)، وتنفيذٌ مستأنَفٌ صفًّا صفًّا عبر الخدمات
// القائمة نفسِها (صفرُ ازدواجِ منطق) بمؤشّر executed_rows + حالةِ كلّ صفّ ⇒ الإعادةُ لا تزدوج.
import { and, asc, eq } from "drizzle-orm";
import {
  importBatches, importRows, funds, orgUnits, currencies, persons, paymentBatches, donors,
} from "../database/schema";
import type { Db } from "../utils/db";
import type { ExecCtx } from "./financeActions";

export const IMPORT_LIMITS = { maxRows: 500, maxBytes: 2 * 1024 * 1024 };

export type ImportRowInput = Record<string, unknown>;
export type RowError = { row: number; error: string };

const HIJRI_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v.trim()))) return Number(v.trim());
  return null;
};
const str = (v: unknown): string => (v == null ? "" : String(v)).trim();

// سياقُ المراجع المشتركة (يُحمَّل مرّةً لكلّ ملفّ لا لكلّ صفّ)
async function refCtx(db: Db) {
  const fundIds = new Set((await db.select({ id: funds.id }).from(funds).all()).map((f) => f.id));
  const curRows = await db.select({ code: currencies.code }).from(currencies).all();
  const curs = new Set(curRows.map((c) => c.code));
  const mosques = await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.type, "mosque")).all();
  const mosqueByName = new Map(mosques.map((m) => [m.name.trim(), m.id]));
  const mosqueIds = new Set(mosques.map((m) => m.id));
  return { fundIds, curs, mosqueByName, mosqueIds };
}
type RefCtx = Awaited<ReturnType<typeof refCtx>>;

function resolveMosque(ctx: RefCtx, v: string): string | null {
  if (ctx.mosqueIds.has(v)) return v;
  return ctx.mosqueByName.get(v) ?? null;
}
function checkCommon(ctx: RefCtx, r: ImportRowInput): { fund: string; amount: number; currency: string; dateHijri?: string } | string {
  const amount = num(r.amount);
  if (amount == null || amount <= 0) return "المبلغُ يجب أن يكون رقمًا موجبًا";
  const fund = str(r.fund) || "general";
  if (!ctx.fundIds.has(fund)) return `صندوقٌ مجهول: «${fund}»`;
  const currency = str(r.currency) || "USD";
  if (!ctx.curs.has(currency)) return `عملةٌ مجهولة: «${currency}»`;
  const dh = str(r.date_hijri);
  if (dh && !HIJRI_RE.test(dh)) return "التاريخُ الهجريّ بصيغة 1447-05 أو 1447-05-12";
  return { fund, amount, currency, dateHijri: dh ? dh.slice(0, 7) : undefined };
}

// مواصفةُ كلّ قالب: أعمدتُه (مفاتيحُ إنجليزيّةٌ ثابتة)، تحقّقُه، منفّذُ صفِّه (خدمةٌ قائمة).
export const IMPORT_KINDS: Record<string, {
  label: string;
  columns: Array<{ key: string; label: string; required?: boolean; list?: "funds" | "currencies" | "mosques" | "adj_kinds" }>;
  validate: (db: Db, ctx: RefCtx, r: ImportRowInput, rowNo: number) => Promise<{ payload: Record<string, unknown>; usd: number } | string>;
  executeRow: (db: Db, payload: Record<string, unknown>, ctx: ExecCtx, meta: Record<string, unknown>) => Promise<string>;
}> = {
  donations: {
    label: "تبرّعات",
    columns: [
      { key: "date_hijri", label: "التاريخ الهجريّ (اختياريّ)" }, { key: "donor", label: "المانح" },
      { key: "fund", label: "الصندوق", required: true, list: "funds" }, { key: "amount", label: "المبلغ", required: true },
      { key: "currency", label: "العملة", list: "currencies" }, { key: "mosque", label: "المسجد (رمزٌ أو اسم)", required: true, list: "mosques" },
      { key: "note", label: "ملاحظة" },
    ],
    validate: async (_db, ctx, r) => {
      const c = checkCommon(ctx, r);
      if (typeof c === "string") return c;
      const mosqueId = resolveMosque(ctx, str(r.mosque));
      if (!mosqueId) return `مسجدٌ مجهول: «${str(r.mosque)}»`;
      return { payload: { mosqueId, donorName: str(r.donor) || undefined, note: str(r.note) || undefined, ...c, currency: c.currency === "USD" ? undefined : c.currency }, usd: c.currency === "USD" ? c.amount : 0 };
    },
    executeRow: async (db, p, ctx) => {
      const { recordDonation } = await import("./donorsFinance");
      const res = await recordDonation(db, { mosqueId: p.mosqueId as string, amount: p.amount as number, fund: p.fund as string, donorName: p.donorName as string | undefined, note: p.note as string | undefined, currency: p.currency as string | undefined, dateHijri: p.dateHijri as string | undefined, collectedBy: ctx.approvedBy });
      return res.receiptNo;
    },
  },
  expenses: {
    label: "مصروفات",
    columns: [
      { key: "date_hijri", label: "التاريخ الهجريّ (اختياريّ)" }, { key: "category", label: "البند" },
      { key: "fund", label: "الصندوق", required: true, list: "funds" }, { key: "amount", label: "المبلغ", required: true },
      { key: "currency", label: "العملة", list: "currencies" }, { key: "mosque", label: "المسجد (رمزٌ أو اسم)", required: true, list: "mosques" },
      { key: "note", label: "ملاحظة" },
    ],
    validate: async (db, ctx, r) => {
      const c = checkCommon(ctx, r);
      if (typeof c === "string") return c;
      const mosqueId = resolveMosque(ctx, str(r.mosque));
      if (!mosqueId) return `مسجدٌ مجهول: «${str(r.mosque)}»`;
      let usd = c.amount, orig: number | undefined;
      if (c.currency !== "USD") {
        try { const { convertToBase } = await import("./currencies"); usd = await convertToBase(db, c.currency, c.amount); orig = c.amount; }
        catch (e) { return (e as Error).message; }
      }
      return { payload: { mosqueId, category: str(r.category) || undefined, note: str(r.note) || undefined, fund: c.fund, amount: usd, currency: c.currency === "USD" ? undefined : c.currency, origAmount: orig, dateHijri: c.dateHijri }, usd };
    },
    executeRow: async (db, p, ctx) => {
      const { enterExpense } = await import("./financeEntry");
      const res = await enterExpense(db, p as never, ctx.approvedBy);
      return res.id;
    },
  },
  opening_balances: {
    label: "أرصدة افتتاحيّة",
    columns: [
      { key: "account", label: "الحساب (1110/1115/1116/1120/1130)", required: true },
      { key: "fund", label: "الصندوق", required: true, list: "funds" }, { key: "amount", label: "المبلغ $", required: true },
    ],
    validate: async (db, ctx, r) => {
      const c = checkCommon(ctx, r);
      if (typeof c === "string") return c;
      const account = str(r.account);
      if (!/^(1110|1115|1116|1120|1130)$/.test(account)) return `حسابُ نقدٍ مجهول: «${account}»`;
      const { hasActivePosting } = await import("./ledger");
      if (await hasActivePosting(db, "opening", `${account}:${c.fund}`)) return `رصيدٌ افتتاحيٌّ مسجَّلٌ سلفًا للحساب ${account} وصندوق ${c.fund}`;
      return { payload: { accountId: account, fundId: c.fund, amount: c.amount }, usd: c.amount };
    },
    executeRow: async (db, p, ctx) => {
      const ref = `${p.accountId}:${p.fundId}`;
      const { hasActivePosting } = await import("./ledger");
      if (await hasActivePosting(db, "opening", ref)) return ref; // idempotent عند الاستئناف
      const { FINANCE_ACTION_KINDS } = await import("./financeActions");
      await FINANCE_ACTION_KINDS.opening_balance.execute(db, p, ctx);
      return ref;
    },
  },
  batch_items: {
    label: "بنودُ دفعة صرف",
    columns: [
      { key: "person", label: "اسمُ المستفيد", required: true }, { key: "amount", label: "المبلغ $", required: true }, { key: "note", label: "ملاحظة" },
    ],
    validate: async (_db, ctx, r) => {
      const amount = num(r.amount);
      if (amount == null || amount <= 0) return "المبلغُ يجب أن يكون رقمًا موجبًا";
      const person = str(r.person);
      if (!person) return "اسمُ المستفيد مطلوب";
      return { payload: { personName: person, amount, note: str(r.note) || undefined }, usd: amount };
    },
    executeRow: async (db, p, _ctx, meta) => {
      const batchId = str(meta.paymentBatchId);
      if (!batchId) throw new Error("لم تُحدَّد دفعةُ الصرف الهدف");
      const b = (await db.select().from(paymentBatches).where(eq(paymentBatches.id, batchId)).all())[0];
      if (!b || b.status !== "draft") throw new Error("دفعةُ الصرف غيرُ موجودةٍ أو ليست مسودّة");
      const { addBatchItem } = await import("./paymentBatches");
      const res = await addBatchItem(db, { batchId, personName: p.personName as string, amount: p.amount as number, note: p.note as string | undefined });
      return res.id;
    },
  },
  payroll_adjustments: {
    label: "تعديلاتُ رواتب",
    columns: [
      { key: "person", label: "الشخص (اسمُه الكامل)", required: true }, { key: "month", label: "الشهر الهجريّ", required: true },
      { key: "kind", label: "النوع (allowance/deduction)", required: true, list: "adj_kinds" },
      { key: "amount", label: "المبلغ $", required: true }, { key: "note", label: "البيان" },
    ],
    validate: async (db, _ctx, r) => {
      const amount = num(r.amount);
      if (amount == null || amount <= 0) return "المبلغُ يجب أن يكون رقمًا موجبًا";
      const month = str(r.month);
      if (!/^\d{4}-\d{2}$/.test(month)) return "الشهرُ بصيغة 1447-05";
      const kind = str(r.kind);
      if (kind !== "allowance" && kind !== "deduction") return "النوعُ allowance (بدل) أو deduction (خصم)";
      const name = str(r.person);
      const p = (await db.select({ id: persons.id }).from(persons).where(eq(persons.fullName, name)).all())[0];
      if (!p) return `شخصٌ مجهول: «${name}»`;
      return { payload: { personId: p.id, month, kind, amount, note: str(r.note) || undefined }, usd: amount };
    },
    executeRow: async (db, p, ctx) => {
      const { addAdjustment } = await import("./payroll");
      const res = await addAdjustment(db, { ...(p as never as { personId: string; month: string; kind: "allowance" | "deduction"; amount: number; note?: string }), createdBy: ctx.approvedBy });
      return res.id;
    },
  },
  fx_rates: {
    label: "أسعارُ صرف",
    columns: [
      { key: "currency", label: "العملة", required: true, list: "currencies" }, { key: "rate", label: "السعرُ للدولار", required: true },
    ],
    validate: async (_db, ctx, r) => {
      const rate = num(r.rate);
      if (rate == null || rate <= 0) return "السعرُ يجب أن يكون موجبًا";
      const currency = str(r.currency);
      if (!ctx.curs.has(currency)) return `عملةٌ مجهولة: «${currency}»`;
      if (currency === "USD") return "لا سعرَ لعملة الأساس نفسِها";
      return { payload: { currency, rateToBase: rate }, usd: 0 };
    },
    executeRow: async (db, p, ctx) => {
      const { setRate } = await import("./currencies");
      const res = await setRate(db, { currency: p.currency as string, rateToBase: p.rateToBase as number, createdBy: ctx.approvedBy });
      return res.id;
    },
  },
  budgets: {
    label: "موازنات",
    columns: [
      { key: "period", label: "الفترة (1447 أو 1447-05)", required: true },
      { key: "fund", label: "الصندوق", required: true, list: "funds" }, { key: "amount", label: "المبلغ $", required: true },
    ],
    validate: async (_db, ctx, r) => {
      const amount = num(r.amount);
      if (amount == null || amount <= 0) return "المبلغُ يجب أن يكون رقمًا موجبًا";
      const period = str(r.period);
      if (!/^\d{4}(-\d{2})?$/.test(period)) return "الفترةُ بصيغة 1447 أو 1447-05";
      const fund = str(r.fund) || "general";
      if (!ctx.fundIds.has(fund)) return `صندوقٌ مجهول: «${fund}»`;
      return { payload: { period, fundId: fund, amount }, usd: 0 };
    },
    executeRow: async (db, p, ctx) => {
      const { setBudget } = await import("./budgets");
      const res = await setBudget(db, { period: p.period as string, fundId: p.fundId as string, amount: p.amount as number, createdBy: ctx.approvedBy });
      return res.id;
    },
  },
  assets: {
    label: "أصولٌ ثابتة",
    columns: [
      { key: "name", label: "اسمُ الأصل", required: true }, { key: "cost", label: "التكلفة $", required: true },
      { key: "salvage", label: "المتبقّية $" }, { key: "life_months", label: "العمرُ بالأشهر", required: true },
      { key: "start_period", label: "شهرُ البدء (1447-01)", required: true }, { key: "fund", label: "الصندوق", list: "funds" },
    ],
    validate: async (_db, ctx, r) => {
      const cost = num(r.cost), life = num(r.life_months), salvage = num(r.salvage) ?? 0;
      if (cost == null || cost <= 0) return "التكلفةُ يجب أن تكون موجبة";
      if (life == null || life <= 0 || !Number.isInteger(life)) return "العمرُ عددُ أشهرٍ صحيحٌ موجب";
      if (salvage < 0 || salvage >= cost) return "المتبقّيةُ أقلُّ من التكلفة وغيرُ سالبة";
      const start = str(r.start_period);
      if (!/^\d{4}-\d{2}$/.test(start)) return "شهرُ البدء بصيغة 1447-01";
      const name = str(r.name);
      if (!name) return "اسمُ الأصل مطلوب";
      const fund = str(r.fund) || "general";
      if (!ctx.fundIds.has(fund)) return `صندوقٌ مجهول: «${fund}»`;
      return { payload: { name, cost, salvageValue: salvage, usefulLifeMonths: life, startPeriod: start, fundId: fund }, usd: cost };
    },
    executeRow: async (db, p, ctx) => {
      const { capitalizeAsset } = await import("./depreciation");
      const res = await capitalizeAsset(db, { ...(p as never as { name: string; cost: number; salvageValue: number; usefulLifeMonths: number; startPeriod: string; fundId: string }), createdBy: ctx.approvedBy });
      return res.id;
    },
  },
  donors: {
    label: "مانحون",
    columns: [
      { key: "name", label: "الاسم", required: true }, { key: "phone", label: "الهاتف" }, { key: "note", label: "ملاحظة" },
    ],
    validate: async (db, _ctx, r) => {
      const name = str(r.name);
      if (!name) return "الاسمُ مطلوب";
      const existing = (await db.select({ id: donors.id }).from(donors).where(eq(donors.name, name)).all())[0];
      if (existing) return `المانحُ «${name}» موجودٌ سلفًا`;
      return { payload: { name, phone: str(r.phone) || undefined, note: str(r.note) || undefined }, usd: 0 };
    },
    executeRow: async (db, p) => {
      const name = p.name as string;
      const existing = (await db.select({ id: donors.id }).from(donors).where(eq(donors.name, name)).all())[0];
      if (existing) return existing.id; // idempotent عند الاستئناف
      const id = crypto.randomUUID();
      await db.insert(donors).values({ id, name, phone: (p.phone as string) ?? null, note: (p.note as string) ?? null, createdAt: Date.now() }).run();
      return id;
    },
  },
};

// (٢-٣) تحقّقٌ شامل «الكلُّ أو لا شيء»: يعيد الصفوفَ المطبَّعةَ أو قائمةَ أخطاءٍ بالسطر.
export async function validateImportRows(db: Db, kind: string, rows: ImportRowInput[]): Promise<
  { ok: true; payloads: Array<Record<string, unknown>>; totalUsd: number } | { ok: false; errors: RowError[] }
> {
  const spec = IMPORT_KINDS[kind];
  if (!spec) return { ok: false, errors: [{ row: 0, error: `نوعُ قالبٍ مجهول: «${kind}»` }] };
  if (!rows.length) return { ok: false, errors: [{ row: 0, error: "الملفُّ لا يحوي صفوفًا" }] };
  if (rows.length > IMPORT_LIMITS.maxRows) return { ok: false, errors: [{ row: 0, error: `الحدُّ ${IMPORT_LIMITS.maxRows} صفًّا لكلّ ملفّ` }] };
  const ctx = await refCtx(db);
  const errors: RowError[] = [];
  const payloads: Array<Record<string, unknown>> = [];
  let totalUsd = 0;
  // كشفُ التكرار داخل الملفّ نفسِه (تبرّعات/مصروفات: مفتاحُ مانح+مبلغ+تاريخ)
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 2; // +1 للرأس +1 للفهرسة البشريّة
    const res = await spec.validate(db, ctx, rows[i], rowNo);
    if (typeof res === "string") { errors.push({ row: rowNo, error: res }); continue; }
    if (kind === "donations" || kind === "expenses") {
      const k = JSON.stringify([rows[i].donor ?? rows[i].category, rows[i].amount, rows[i].date_hijri, rows[i].mosque]);
      if (seen.has(k)) errors.push({ row: rowNo, error: "صفٌّ مكرّرٌ داخل الملفّ (نفسُ الجهة والمبلغ والتاريخ)" });
      seen.add(k);
    }
    payloads.push(res.payload);
    totalUsd += res.usd;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, payloads, totalUsd: Math.round(totalUsd * 100) / 100 };
}

// بصمةُ الملفّ: SHA-256 على JSON الصفوف — تمنع رفعَ نفس الملفّ مرّتين لنفس النوع.
export async function contentHash(kind: string, rows: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(kind + "\n" + JSON.stringify(rows));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// (٤) إنشاءُ الدفعة بصفوفها (بعد نجاح التحقّق) — التنفيذُ لاحقًا عبر فعل bulk_import في محرّك الاعتماد.
export async function createImportBatch(db: Db, input: {
  kind: string; filename?: string; rows: ImportRowInput[]; payloads: Array<Record<string, unknown>>;
  totalUsd: number; meta?: Record<string, unknown>; createdBy: string;
}): Promise<{ batchId: string } | { error: string }> {
  const hash = await contentHash(input.kind, input.rows);
  const dup = (await db.select({ id: importBatches.id, status: importBatches.status }).from(importBatches)
    .where(and(eq(importBatches.kind, input.kind), eq(importBatches.contentHash, hash))).all())[0];
  if (dup) return { error: `هذا الملفُّ رُفع سلفًا (دفعة ${dup.id.slice(0, 8)} — حالتُها ${dup.status})` };
  const batchId = crypto.randomUUID();
  await db.insert(importBatches).values({
    id: batchId, kind: input.kind, filename: input.filename ?? null, contentHash: hash,
    rowCount: input.payloads.length, totalUsd: input.totalUsd, status: "pending", executedRows: 0,
    meta: input.meta ? JSON.stringify(input.meta) : null, createdBy: input.createdBy, createdAt: Date.now(),
  }).run();
  // صفوفٌ على شرائح ≤٢٥ (حدودُ D1)
  for (let i = 0; i < input.payloads.length; i += 25) {
    const chunk = input.payloads.slice(i, i + 25).map((p, j) => ({
      id: crypto.randomUUID(), batchId, rowNo: i + j + 1, payload: JSON.stringify(p), status: "pending" as const,
    }));
    for (const row of chunk) await db.insert(importRows).values(row).run();
  }
  return { batchId };
}

// (٥-٦) التنفيذُ المستأنَف: صفًّا صفًّا بترتيب rowNo، يتخطّى المنجَز، ويحدّث المؤشّرَ بعد كلّ صفّ.
// فشلُ صفٍّ يوقف الدفعةَ (الكلُّ أو لا شيء زمنَ التحقّق؛ وقتَ التنفيذ يُسجَّل الفشلُ ويُستأنَف بعد إصلاح السبب).
export async function executeImportBatch(db: Db, batchId: string, ctx: ExecCtx): Promise<{ executed: number; total: number }> {
  const batch = (await db.select().from(importBatches).where(eq(importBatches.id, batchId)).all())[0];
  if (!batch) throw new Error("دفعةُ الاستيراد غيرُ موجودة");
  if (batch.status === "done") return { executed: batch.executedRows, total: batch.rowCount };
  const spec = IMPORT_KINDS[batch.kind];
  if (!spec) throw new Error(`نوعُ قالبٍ مجهول: «${batch.kind}»`);
  const meta = batch.meta ? (JSON.parse(batch.meta) as Record<string, unknown>) : {};
  await db.update(importBatches).set({ status: "executing", error: null }).where(eq(importBatches.id, batchId)).run();
  const pending = await db.select().from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, "pending")))
    .orderBy(asc(importRows.rowNo)).all();
  let executed = batch.executedRows;
  for (const row of pending) {
    try {
      const ref = await spec.executeRow(db, JSON.parse(row.payload) as Record<string, unknown>, ctx, meta);
      await db.update(importRows).set({ status: "done", resultRef: ref, error: null }).where(eq(importRows.id, row.id)).run();
      executed += 1;
      await db.update(importBatches).set({ executedRows: executed }).where(eq(importBatches.id, batchId)).run();
    } catch (e) {
      const msg = (e as Error).message;
      await db.update(importRows).set({ status: "failed", error: msg }).where(eq(importRows.id, row.id)).run();
      await db.update(importBatches).set({ status: "failed", error: `الصفّ ${row.rowNo}: ${msg}` }).where(eq(importBatches.id, batchId)).run();
      throw new Error(`توقّف عند الصفّ ${row.rowNo}: ${msg} — أصلِح السببَ ثمّ أعِد المحاولة (المنجَزُ لا يزدوج)`);
    }
  }
  await db.update(importBatches).set({ status: "done" }).where(eq(importBatches.id, batchId)).run();
  return { executed, total: batch.rowCount };
}

// استئنافُ صفٍّ فاشل: يعيده pending ليعالجَه التنفيذُ التالي.
export async function resetFailedRows(db: Db, batchId: string): Promise<number> {
  const failed = await db.select({ id: importRows.id }).from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, "failed"))).all();
  for (const f of failed) await db.update(importRows).set({ status: "pending", error: null }).where(eq(importRows.id, f.id)).run();
  return failed.length;
}
