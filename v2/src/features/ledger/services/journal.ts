/**
 * القيدُ المزدوج — ق-٤٩ (`SPEC_finance_ledger` §٢) وحارسُ ق-٤٨ عند الحدّ وق-٥٥ عند الصرف.
 *
 * تعمل **بعد** فرض القدرة في طبقة الخادم؛ مسؤوليتها ثوابتُ المحاسبة: التوازن لكل عملة،
 * والذرّية، والتصحيح بعكسٍ لا حذف، والقفل الزمنيّ، وضبطُ المقيَّد شرعاً.
 *
 * **صفر رقمٍ تشغيليّ** (قب-٦/G14): مدةُ القفل والعملاتُ وشكلُ السند وأعلامُ الضبط كلُّها من
 * **مُحلِّل الإعدادات المحقون** — يُقرأ بنطاقٍ وبتاريخ دائماً (§٨.٣).
 * **الأخطاءُ قيمٌ معلنة** (المادة ٣/٤): لا استثناءَ لخطأ عمل، والرسالةُ العربية من طبقة العرض.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { LedgerStore, LineDraft } from "../data/store.js"
import { cents, ZERO_CENTS } from "./money.js"
import {
  LedgerStorageError,
  SOURCE_TYPES,
  err,
  ok,
  type Cents,
  type CurrencyCode,
  type DeductionKind,
  type Err,
  type JournalEntry,
  type LineKind,
  type Result,
  type SourceType,
} from "../types.js"

export type LedgerContext = {
  readonly now: Date
  /** يُحقن ولا يُستورد (`SPEC_settings` §١-٨) — فيُبدَّل في الاختبار بلا حِيَل. */
  readonly settings: SettingsResolver
  readonly actorPersonId: string
}

export type LineInput = {
  readonly accountId: string
  /** معرّفُ الوحدة؛ **المسارُ يأتي من الوحدة المخزَّنة** لا من مدخل العميل (§٥.٢). */
  readonly unitId: string
  readonly currency: CurrencyCode
  /** الاتجاهُ بالطرف لا بالإشارة — فالسطرُ ذو الطرفين مستحيلٌ بالبناء (§٢.٢). */
  readonly side: "debit" | "credit"
  readonly amount: Cents
  readonly fundId?: string
  readonly kind?: LineKind
  readonly deductionKind?: DeductionKind
}

export type JournalInput = {
  readonly at: Date
  readonly unitId: string
  readonly memoAr: string
  readonly sourceType: SourceType
  readonly sourceId: string
  readonly lines: readonly LineInput[]
  /** `null` صراحةً = قيدٌ لا يُحرس بمفتاح تكرار (العكس مثلاً). الافتراضُ اشتقاقُه (§٣.٢). */
  readonly postingKey?: string | null
  readonly reasonAr?: string
}

export type CurrencyTotals = { readonly debit: Cents; readonly credit: Cents }
export type BalanceProof = {
  readonly byCurrency: ReadonlyMap<CurrencyCode, CurrencyTotals>
  readonly balanced: boolean
}

// ── قراءةُ الإعدادات بأنواعٍ صريحة (لا `any`، ولا رقمٌ صلب) ────────────────────
function settingNumber(ctx: LedgerContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}
function settingBoolean(ctx: LedgerContext, id: string, scopePath: string): boolean {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError(`الإعداد ${id} ليس مفتاحاً`)
  return value
}
function settingList(ctx: LedgerContext, id: string, scopePath: string): readonly string[] {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (!Array.isArray(value)) throw new TypeError(`الإعداد ${id} ليس قائمة`)
  return value
}
function settingText(ctx: LedgerContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}

/** طرحُ الأيام بحساب التقويم — بلا ثابتٍ زمنيٍّ صلبٍ في طبقة الخدمات (G14). */
function minusDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

/** ب-٣٩د + ق-٤٥: القفلُ الرجعيّ ومنعُ التأريخ المستقبليّ — كلاهما إعدادٌ حيّ (§٢.٥). */
function checkDating(ctx: LedgerContext, scopePath: string, at: Date): Err | null {
  if (!settingBoolean(ctx, "records.allow_future_dating", scopePath)) {
    if (at.getTime() > ctx.now.getTime()) return err("FUTURE_DATING_REJECTED", at.toISOString())
  }
  const lockDays = settingNumber(ctx, "records.backdate_lock_days", scopePath)
  if (at.getTime() < minusDays(ctx.now, lockDays).getTime()) {
    return err("PERIOD_LOCKED", at.toISOString())
  }
  return null
}

/** شكلُ رقم السند — بادئتُه وعددُ خاناته **إعدادان حيّان** (ق-٥٦، §٦.٢). */
export function formatVoucherNo(ctx: LedgerContext, scopePath: string, seq: number): string {
  const prefix = settingText(ctx, "finance.receipt.prefix", scopePath)
  const padding = settingNumber(ctx, "finance.receipt.number_padding", scopePath)
  return `${prefix}${String(seq).padStart(padding, "0")}`
}

/** أوّلُ عملةٍ مختلّة، أو `null` إن توازن القيدُ **في كل عملةٍ على حدة** (§٤.٢). */
function firstImbalance(lines: readonly LineDraft[]): string | null {
  const byCurrency = new Map<string, number>()
  for (const l of lines) {
    byCurrency.set(l.currency, (byCurrency.get(l.currency) ?? 0) + l.debit - l.credit)
  }
  for (const [currency, net] of byCurrency) if (net !== 0) return currency
  return null
}

/**
 * ق-٥٥ — المقيَّد شرعاً لا يُصرف فوق رصيده: **منعٌ قاطع**، والحرُّ لا يُقيَّد.
 * المفتاحُ إعدادٌ حيّ (`finance.restricted_funds.block_overspend`).
 */
function checkRestrictedFunds(
  store: LedgerStore,
  ctx: LedgerContext,
  scopePath: string,
  lines: readonly LineDraft[],
): Err | null {
  if (!settingBoolean(ctx, "finance.restricted_funds.block_overspend", scopePath)) return null
  const deltas = new Map<string, number>()
  for (const l of lines) {
    if (l.fundId === null) continue
    const fund = store.getFund(l.fundId)
    if (fund === null || !fund.restricted) continue
    // حركةُ مالِ الصندوق هي **أسطر الأصول** الموسومة — نظيرُ `fundBalance` بالضبط.
    if (store.getAccount(l.accountId)?.kind !== "asset") continue
    const key = `${l.fundId}|${l.currency}`
    deltas.set(key, (deltas.get(key) ?? 0) + l.debit - l.credit)
  }
  for (const [key, delta] of deltas) {
    const [fundId, currency] = key.split("|")
    const after = store.fundBalance(fundId!, currency!) + delta
    if (after < 0) return err("RESTRICTED_FUND_OVERSPEND", key)
  }
  return null
}

/** تجهيزُ الأسطر بالتحقّق عند الحدّ — يعيد الأسطرَ أو أوّلَ خطأٍ مصنَّف. */
function prepareLines(
  store: LedgerStore,
  ctx: LedgerContext,
  scopePath: string,
  input: JournalInput,
): Result<readonly LineDraft[]> {
  const enabled = settingList(ctx, "finance.currencies.enabled", scopePath)
  const penalAllowed = settingBoolean(ctx, "finance.penal_deductions_allowed", scopePath)
  const out: LineDraft[] = []

  for (const line of input.lines) {
    const unit = store.getUnit(line.unitId)
    if (unit === null) return err("UNKNOWN_UNIT", line.unitId)

    const amount = cents(line.amount)
    if (!amount.ok) return amount
    if (amount.value < 0) return err("NEGATIVE_AMOUNT", line.accountId)
    if (amount.value === 0) return err("ZERO_LINE", line.accountId)
    if (!enabled.includes(line.currency)) return err("CURRENCY_NOT_ENABLED", line.currency)

    const kind: LineKind = line.kind ?? "normal"
    const deductionKind: DeductionKind | null = line.deductionKind ?? null
    // ب-٣١: الخصمُ العقابيّ ممنوعٌ افتراضاً، والتسويةُ المحاسبية مسموحةٌ دائماً (§٧.١).
    if (deductionKind === "penal" && !penalAllowed) {
      return err("PENAL_DEDUCTION_NOT_ALLOWED", line.accountId)
    }

    out.push({
      accountId: line.accountId,
      unitPath: unit.path,
      fundId: line.fundId ?? null,
      currency: line.currency,
      debit: line.side === "debit" ? amount.value : ZERO_CENTS,
      credit: line.side === "credit" ? amount.value : ZERO_CENTS,
      kind,
      deductionKind,
    })
  }
  return ok(out)
}

/** يترجم رميةَ طبقة البيانات إلى خطأِ عملٍ مصنَّف؛ وما عداها خطأٌ برمجيٌّ يمرّ. */
function asBusinessError(e: unknown): Err {
  if (e instanceof LedgerStorageError) return err(e.code, e.detail)
  throw e
}

/**
 * الترحيل — ق-٤٩: يتحقق ثم يكتب **دفعةً ذرّية** (رأسٌ + أسطرٌ + سندٌ + مفتاحٌ + تدقيق).
 * الفشلُ في أي منتصفٍ يُرجع كلَّ شيء، بما فيه عدّادُ السندات (§٢.٣).
 */
export function postJournal(
  store: LedgerStore,
  ctx: LedgerContext,
  input: JournalInput,
): Result<JournalEntry> {
  if (!SOURCE_TYPES.includes(input.sourceType)) {
    return err("UNKNOWN_SOURCE_TYPE", String(input.sourceType))
  }
  const unit = store.getUnit(input.unitId)
  if (unit === null) return err("UNKNOWN_UNIT", input.unitId)

  const dating = checkDating(ctx, unit.path, input.at)
  if (dating !== null) return dating

  if (input.lines.length < 2) return err("TOO_FEW_LINES", input.sourceId)

  const prepared = prepareLines(store, ctx, unit.path, input)
  if (!prepared.ok) return prepared

  const imbalance = firstImbalance(prepared.value)
  if (imbalance !== null) return err("UNBALANCED", imbalance)

  const restricted = checkRestrictedFunds(store, ctx, unit.path, prepared.value)
  if (restricted !== null) return restricted

  const postingKey =
    input.postingKey === undefined ? `${input.sourceType}:${input.sourceId}` : input.postingKey

  try {
    return ok(
      store.transaction(() => {
        const seq = store.allocateVoucherSeq()
        const entryId = store.openEntry({
          voucherNo: formatVoucherNo(ctx, unit.path, seq),
          voucherSeq: seq,
          at: input.at,
          unitPath: unit.path,
          memoAr: input.memoAr,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          postingKey,
          reversalOf: null,
          reasonAr: input.reasonAr ?? null,
          postedBy: ctx.actorPersonId,
        })
        for (const line of prepared.value) store.appendLine(entryId, line)
        const sealed = store.sealEntry(entryId)
        store.appendAudit({
          at: ctx.now,
          actorPersonId: ctx.actorPersonId,
          action: "ledger.post",
          targetId: entryId,
          reason: input.reasonAr ?? null,
        })
        return sealed
      }),
    )
  } catch (e) {
    return asBusinessError(e)
  }
}

/**
 * التصحيح بعكسٍ لا بحذف — ق-٤٩ (§٢.٤): يولّد قيداً عاكساً بسندٍ جديد ويربطه بأصله،
 * **والأصلُ يبقى كما هو حرفياً**. ويحرّر مفتاحَ التكرار فيُقبل ترحيلٌ جديدٌ به (§٣.٣).
 */
export function reverseEntry(
  store: LedgerStore,
  ctx: LedgerContext,
  entryId: string,
  reasonAr: string,
): Result<JournalEntry> {
  const original = store.getEntry(entryId)
  if (original === null) return err("ENTRY_NOT_FOUND", entryId)
  if (reasonAr.trim().length === 0) return err("REASON_REQUIRED", entryId)
  if (original.reversedBy !== null) return err("ALREADY_REVERSED", entryId)
  if (original.reversalOf !== null) return err("CANNOT_REVERSE_REVERSAL", entryId)

  const originalLines = store.linesOf(entryId)
  try {
    return ok(
      store.transaction(() => {
        const seq = store.allocateVoucherSeq()
        const reversalId = store.openEntry({
          voucherNo: formatVoucherNo(ctx, original.unitPath, seq),
          voucherSeq: seq,
          at: ctx.now,
          unitPath: original.unitPath,
          memoAr: original.memoAr,
          sourceType: "reversal",
          sourceId: original.id,
          // العكسُ ليس ترحيلَ حدث؛ فلا يحمل مفتاحَ تكرارٍ يزاحم الأصل.
          postingKey: null,
          reversalOf: original.id,
          reasonAr,
          postedBy: ctx.actorPersonId,
        })
        for (const line of originalLines) {
          store.appendLine(reversalId, {
            accountId: line.accountId,
            unitPath: line.unitPath,
            fundId: line.fundId,
            currency: line.currency,
            // المدينُ يصير دائناً والعكس — أثرُ الأصل يُلغى بالضبط.
            debit: line.credit,
            credit: line.debit,
            kind: line.kind,
            deductionKind: line.deductionKind,
          })
        }
        const sealed = store.sealEntry(reversalId)
        store.linkReversal(original.id, reversalId)
        store.appendAudit({
          at: ctx.now,
          actorPersonId: ctx.actorPersonId,
          action: "ledger.reverse",
          targetId: original.id,
          reason: reasonAr,
        })
        return sealed
      }),
    )
  } catch (e) {
    return asBusinessError(e)
  }
}

/** برهانُ التوازن — يصمد بعد كل عملية (ق-٧٢ روحاً، §٦.١): Σمدين = Σدائن لكل عملة. */
export function balanceProof(store: LedgerStore): BalanceProof {
  const totals = new Map<CurrencyCode, { debit: number; credit: number }>()
  for (const line of store.lines()) {
    const t = totals.get(line.currency) ?? { debit: 0, credit: 0 }
    totals.set(line.currency, { debit: t.debit + line.debit, credit: t.credit + line.credit })
  }
  const byCurrency = new Map<CurrencyCode, CurrencyTotals>()
  let balanced = true
  for (const [currency, t] of totals) {
    byCurrency.set(currency, { debit: t.debit as Cents, credit: t.credit as Cents })
    if (t.debit !== t.credit) balanced = false
  }
  return { byCurrency, balanced }
}
