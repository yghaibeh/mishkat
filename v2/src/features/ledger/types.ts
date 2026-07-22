/**
 * أنواع نواة الدفتر — `rebuild/specs/SPEC_finance_ledger.md` §١، §٢، §٣، §١٠.
 *
 * ثلاثة ثوابت تُفرَض هنا بالنوع قبل أي سطرِ منطق:
 *  ١. **المال نوعٌ موسوم** (`Cents`) لا `number` عارٍ — فلا يُمرَّر مبلغٌ مكان عددٍ آخر سهواً،
 *     ولا يدخل الدفترَ كسرٌ عشريّ (ق-٤٨ §١.١).
 *  ٢. **السطر بطرفٍ واحد**: `debit`/`credit` كلاهما `Cents` وأحدهما صفرٌ حتماً — الاتجاه
 *     يُعبَّر عنه بالطرف لا بالإشارة (§٢.٢).
 *  ٣. **أخطاء العمل قيمٌ معلنة** (المادة ٣/٤): الخدمات تعيد `Result` ولا تُلقي استثناءً
 *     لخطأ عمل؛ ورسالةُ المستخدم العربية من طبقة العرض لا من هنا.
 */

/**
 * السنت الصحيح — **الوحدة الوحيدة للتخزين والحساب** (ق-٤٨).
 * الوسمُ يمنع تمرير `number` عارٍ: لا سبيل لبناء `Cents` إلا عبر `services/money.ts`.
 */
export type Cents = number & { readonly __cents: unique symbol }

/** رمزُ العملة — يُتحقَّق منه ضد `finance.currencies.enabled` (قب-٦، §٤.١). */
export type CurrencyCode = string

/** سعرُ صرفٍ **معلن** بعددين صحيحين — لا عددٌ عائمٌ في التحويل أبداً (§٤.٣). */
export type FxRate = { readonly baseCents: Cents; readonly foreignCents: Cents }

export type AccountKind = "asset" | "liability" | "netAssets" | "revenue" | "expense"

/** حسابٌ في شجرة الحسابات — التكاملُ المرجعيّ عليه **في طبقة البيانات** (§٢.٣). */
export type LedgerAccount = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly kind: AccountKind
}

/** صندوقٌ شرعيّ — المقيَّد لا يُصرف فوق رصيده (ق-٥٥، §٦.٣). */
export type Fund = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly restricted: boolean
}

/**
 * إسقاطُ قراءةٍ للوحدة التنظيمية داخل الدفتر — **مصدرُ اشتقاق النطاق** (§٥.٢ من مواصفة
 * الصلاحيات): العميلُ يمرّر `unitId` والمسارُ يأتي من الكيان المخزَّن لا من مدخله.
 */
export type LedgerUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

export type LineKind = "normal" | "deduction"
/** التسويةُ المحاسبية مسموحةٌ دائماً؛ والعقابيّ ممنوعٌ افتراضاً (ب-٣١، §٧.١). */
export type DeductionKind = "settlement" | "penal"

/** كتالوجُ مصادر الأحداث **مغلق** — نوعٌ خارجه يُرفض (§٣.٢). */
export const SOURCE_TYPES = Object.freeze([
  "donation",
  "expense",
  "payroll",
  "handover",
  "manualJournal",
  "openingBalance",
  "reversal",
] as const)

export type SourceType = (typeof SOURCE_TYPES)[number]

export type JournalLine = {
  readonly tenantId: string
  readonly id: string
  readonly entryId: string
  readonly accountId: string
  /** **بُعد الوحدة على السطر** — مصدرُ رصيد كل صندوق (ق-٦٠، §٦.١). */
  readonly unitPath: string
  readonly fundId: string | null
  readonly currency: CurrencyCode
  readonly debit: Cents
  readonly credit: Cents
  readonly kind: LineKind
  readonly deductionKind: DeductionKind | null
}

/**
 * صفُّ الرولّ-أب — **تجميعٌ مسبق** لرصيد صندوقٍ بعملةٍ في وحدة (ADR-001 ع-٦، CR-026 أ).
 *
 * مفتاحُه **الصندوق × العملة × مفتاح التوجيه**، ومسوّغُ كلِّ ضلعٍ في `db/README.md`.
 * وهو **ليس رقماً في تقرير** بل مدخلُ الحارس الشرعيّ ق-٥٥ — فثابتُه أنه يساوي مجموعَ
 * الأسطر دائماً، ولا يُكتب إلا من كتابة السطر نفسِه.
 */
export type FundRollupRow = {
  readonly unitPath: string
  readonly fundId: string
  readonly currency: CurrencyCode
  readonly balance: Cents
}

export type JournalEntry = {
  readonly tenantId: string
  readonly id: string
  /** سندٌ متسلسلٌ بلا فجوات — شكلُه من الإعدادات (ق-٥٦، §٦.٢). */
  readonly voucherNo: string
  readonly voucherSeq: number
  readonly at: Date
  readonly unitPath: string
  readonly memoAr: string
  readonly sourceType: SourceType
  readonly sourceId: string
  /** مفتاحُ التكرار الطبيعيّ `sourceType:sourceId` (§٣.٢) — `null` لِما لا يُرحَّل آلياً. */
  readonly postingKey: string | null
  readonly reversalOf: string | null
  readonly reversedBy: string | null
  readonly reasonAr: string | null
  readonly postedBy: string
}

/** سطرٌ كما يصل من الحدود — الاتجاهُ بالطرف لا بالإشارة، والمسارُ يُشتقّ من الوحدة المخزَّنة. */
export type LineInput = {
  readonly accountId: string
  readonly unitId: string
  readonly currency: CurrencyCode
  readonly side: "debit" | "credit"
  readonly amount: Cents
  readonly fundId?: string
  readonly kind?: LineKind
  readonly deductionKind?: DeductionKind
}

/**
 * الوجهُ المبسَّط للمالي — ثلاثةُ أفعالٍ بلغته لا حسابٌ ولا مدينٌ ولا دائن (قب-٨، §٦.٤).
 * المحرّكُ تحتها قيدٌ مزدوجٌ كامل: **الوجه يتبسّط والمحرك يبقى**.
 */
export type SimpleOperation =
  | {
      readonly verb: "received"
      readonly unitId: string
      readonly currency: CurrencyCode
      readonly amount: Cents
      readonly memoAr: string
      readonly fundId?: string
    }
  | {
      readonly verb: "paid"
      readonly unitId: string
      readonly currency: CurrencyCode
      readonly amount: Cents
      readonly memoAr: string
      readonly fundId?: string
    }
  | {
      readonly verb: "handedOver"
      readonly unitId: string
      readonly toUnitId: string
      readonly currency: CurrencyCode
      readonly amount: Cents
      readonly memoAr: string
    }

/** حمولةُ القيد اليدويّ (ب-٣٩أ) — تُجمَّد عند الاقتراح وتُنفَّذ حرفياً عند الاعتماد. */
export type ManualJournalPayload = {
  readonly at: Date
  readonly unitId: string
  readonly memoAr: string
  readonly sourceType: SourceType
  readonly sourceId: string
  readonly lines: readonly LineInput[]
}

/** أفعالُ الدفتر — **كتالوجٌ مغلقٌ ليس فيه حذفٌ ولا تعديل** (§٢.٤، §٥.٢). */
export const ACTION_KINDS = Object.freeze([
  "journal.manual",
  "journal.reverse",
  "operation.simple",
] as const)

export type ActionKind = (typeof ACTION_KINDS)[number]

export type ActionStatus = "pending" | "approved" | "rejected" | "failed"

/** حمولةُ الفعل — اتحادٌ مميَّزٌ بالنوع، فلا حمولةٌ مجهولةُ الشكل تُنفَّذ عند الاعتماد. */
export type ActionPayload =
  | { readonly kind: "journal.manual"; readonly entry: ManualJournalPayload }
  | { readonly kind: "journal.reverse"; readonly entryId: string; readonly reasonAr: string }
  | { readonly kind: "operation.simple"; readonly operation: SimpleOperation }

/** فعلٌ معلَّقٌ بحمولةٍ **مجمَّدة** — المعاينةُ تطابق الترحيل حرفياً (ق-٥٣، §٥.١). */
export type PendingAction = {
  readonly tenantId: string
  readonly id: string
  readonly kind: ActionKind
  readonly payload: ActionPayload
  readonly unitPath: string
  readonly requestedBy: string
  readonly requestedAt: Date
  readonly status: ActionStatus
  readonly decidedBy: string | null
  readonly decidedAt: Date | null
  readonly reasonAr: string | null
  readonly resultEntryId: string | null
  readonly failureCode: LedgerErrorCode | null
}

/** رمزُ الخطأ المصنَّف — §١٠ من العقد الحاكم. */
export type LedgerErrorCode =
  | "FRACTIONAL_AMOUNT"
  | "NEGATIVE_AMOUNT"
  | "AMOUNT_NOT_SAFE"
  | "UNBALANCED"
  | "TOO_FEW_LINES"
  | "ZERO_LINE"
  | "DOUBLE_SIDED_LINE"
  | "UNKNOWN_ACCOUNT"
  | "UNKNOWN_UNIT"
  | "UNKNOWN_FUND"
  | "CURRENCY_NOT_ENABLED"
  | "FX_RATE_UNDECLARED"
  | "FX_RATE_MISSING"
  | "PERIOD_LOCKED"
  | "FUTURE_DATING_REJECTED"
  | "ALREADY_REVERSED"
  | "CANNOT_REVERSE_REVERSAL"
  | "REASON_REQUIRED"
  | "ENTRY_NOT_FOUND"
  | "UNKNOWN_SOURCE_TYPE"
  | "DUPLICATE_POSTING_KEY"
  | "UNKNOWN_ACTION"
  | "ACTION_NOT_FOUND"
  | "ALREADY_DECIDED"
  | "SELF_APPROVAL_REJECTED"
  | "PAYLOAD_SEALED"
  | "RESTRICTED_FUND_OVERSPEND"
  | "PENAL_DEDUCTION_NOT_ALLOWED"
  | "OPENING_BALANCE_VIA_IMPORT_ONLY"
  /** تعثُّرٌ غيرُ مصنَّفٍ في الترحيل **التابع** — يُدوَّن ولا يُسقط الحدث الأصلي (§٣.٤). */
  | "POSTING_FAILED"

export type LedgerError = {
  readonly code: LedgerErrorCode
  /** تفصيلٌ آليٌّ للتشخيص (الحساب الساقط، العملة غير المتوازنة…) — لا رسالةُ مستخدم. */
  readonly detail?: string
}

export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err = { readonly ok: false; readonly error: LedgerError }
export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err(code: LedgerErrorCode, detail?: string): Err {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}

/**
 * خطأُ ثابتٍ في طبقة البيانات — يُرمى من المستودع (تكاملٌ مرجعيّ، مفتاحٌ مكرَّر، ختمٌ مختلّ)
 * فيرتدّ الترحيلُ ذرّياً (§٢.٣)، وتترجمه الخدمةُ إلى `Result` مصنَّف.
 */
export class LedgerStorageError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    readonly detail?: string,
  ) {
    super(`${code}${detail === undefined ? "" : `: ${detail}`}`)
    this.name = "LedgerStorageError"
  }
}
