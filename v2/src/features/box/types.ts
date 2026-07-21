/**
 * أنواعُ الصندوق ومالية المسجد — عقدُ الوحدة `features/box/SPEC.md`.
 *
 * ثلاثةُ ثوابتٍ تُفرَض هنا بالنوع قبل أيّ سطرِ منطق:
 *  ١. **لا حقلَ رصيدٍ ولا مبلغٍ مخزَّنٍ في كياناتِ هذه الوحدة** (ق-٦٠): سجلُّ التسليم يحمل
 *     **معرّفَ القيد** ويُقرأ مبلغُه من الدفتر — فالمالُ حقيقةٌ واحدةٌ في النواة لا نسخةٌ هنا.
 *  ٢. **الفئةُ كيانُ بياناتٍ مرجعيّ** (ق-٦٤/قب-٦): معرّفٌ وحسابٌ وحالةُ تفعيل — لا اتحادَ
 *     نصوصٍ مغلقٍ في الكود، فالقاموسُ يُدار بياناً لا نشراً.
 *  ٣. **أخطاءُ العمل قيمٌ معلنة** (المادة ٣/٤): أخطاءُ هذه الوحدة تُضاف إلى أخطاء النواة
 *     ولا تحجبها — فيصل سببُ النواة كما هو إلى الشاشة (`RESTRICTED_FUND_OVERSPEND` مثلاً).
 */

import type { LedgerErrorCode } from "../ledger/types.js"

/** فئةُ صرفٍ من القاموس المغلق المركزيّ (ق-٦٤) — **بياناتٌ مرجعية**. */
export type SpendCategory = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  /** حسابُ المصروف الذي تُرحَّل إليه — من شجرة حسابات النواة (تكاملٌ مرجعيّ في الترحيل). */
  readonly accountId: string
  /** الإيقافُ بيانٌ لا حذف (المادة ٧/٤: لا محوَ لبيانات العمل). */
  readonly active: boolean
}

/**
 * سجلُّ تسليمٍ نازل (ق-٦١) — **توثيقُ البصمتين**: مَن سلّم ومَن أقرّ.
 * **لا مبلغَ ولا عملةَ ولا رصيدَ فيه**: القيدُ (`entryId`) هو مصدرُ كل رقم (ق-٦٠).
 */
export type BoxHandover = {
  readonly tenantId: string
  readonly id: string
  /** القيدُ الواحدُ الذرّيّ الذي نقل المال — ومنه يُقرأ المبلغ والعملة والسند. */
  readonly entryId: string
  readonly fromUnitPath: string
  readonly toUnitPath: string
  /** أمينُ الوجهة: هو **وحده** مَن يقرّ (§١.١ قدرةٌ شخصية، خ-٧). */
  readonly toCustodianPersonId: string
  readonly handedOverBy: string
  readonly at: Date
  readonly acknowledgedBy: string | null
  readonly acknowledgedAt: Date | null
}

/** نتيجةُ ترحيلِ عمليةِ صندوق — سندُها من النواة لا من هذه الوحدة (ق-٥٦). */
export type BoxPosting = {
  readonly entryId: string
  readonly voucherNo: string
  /** تكرارُ العملية نفسِها لا يزدوج (ق-٥٠): يُعاد القيدُ القائم موسوماً. */
  readonly duplicated: boolean
}

/**
 * **ملاحظةُ تصميمٍ محروسةٌ باختبار**: هذا الملفّ لكياناتِ الوحدة **المخزَّنة** وحدها، ولذلك
 * ليس فيه حقلُ مبلغٍ ولا رصيد (ق-٦٠). مدخلاتُ العمليات (وفيها المبالغُ العابرة) موطنُها
 * طبقةُ الخدمات — والحارسُ في `tests/features/box/derived-balances.test.ts` يمسح هذا الملفّ
 * ومستودعَ الوحدة فيفشل عند أوّل حقلِ مالٍ يُخزَّن.
 */

/** رمزُ خطأٍ خاصٌّ بهذه الوحدة — §٨ من عقد الوحدة. */
export type BoxErrorCode =
  | "UNKNOWN_BOX_UNIT"
  | "NO_OPERATION_LINES"
  | "UNKNOWN_CATEGORY"
  | "CATEGORY_INACTIVE"
  | "NOT_DESCENDANT_UNIT"
  | "SAME_UNIT_HANDOVER"
  | "NOT_RECEIVING_CUSTODIAN"
  | "HANDOVER_NOT_FOUND"
  | "ALREADY_ACKNOWLEDGED"

/** خطأُ الصندوق أو خطأُ النواة كما هو — **لا تُبتلع أسبابُ النواة ولا تُعاد تسميتها**. */
export type BoxFailureCode = BoxErrorCode | LedgerErrorCode

export type BoxError = {
  readonly code: BoxFailureCode
  readonly detail?: string
}

export type BoxOk<T> = { readonly ok: true; readonly value: T }
export type BoxErr = { readonly ok: false; readonly error: BoxError }
export type BoxResult<T> = BoxOk<T> | BoxErr

export function boxOk<T>(value: T): BoxOk<T> {
  return { ok: true, value }
}

export function boxErr(code: BoxFailureCode, detail?: string): BoxErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
