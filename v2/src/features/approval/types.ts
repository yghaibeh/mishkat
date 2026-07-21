/**
 * أنواعُ محرّك الاعتماد — عقدُ الوحدة §٢/§٩.
 *
 * **الحالاتُ ثلاثٌ لا رابعَ لها** (ق-٥): مسودة ← مقدَّم ← معتمَد. والرفضُ ليس حالةً مستقرّة
 * بل **عودةٌ إلى المسودة** بأثرٍ محفوظ (ق-٧) — فلا يبقى في النظام سجلٌّ «ميتٌ مرفوض» لا يُعاد
 * تقديمُه. أخطاءُ العمل **قيمٌ معلنة** (المادة ٣/٤): الخدماتُ تعيد `Result` ولا تُلقي استثناءً.
 */

/** الحالةُ المستقرّة للطلب — لا حالةَ رابعة، ولا حالةٌ ضمنية. */
export type ApprovalState = "draft" | "submitted" | "approved"

/** طريقُ الاعتماد — **يُوسَم على الطلب** فلا يقع استثناءٌ صامت (ق-٣/ق-١٢). */
export type ApprovalRoute = "nearest" | "override" | "breakGlass"

/** حمولةُ الطلب: بنيةٌ مجمَّدةٌ **تُشتقّ** ولا تُدخَل (ق-٦٧). */
export type ApprovalPayload = Readonly<Record<string, unknown>>

/** الفترةُ المعتمَدُ عنها — معرّفُها ونهايتُها (القفلُ الزمنيّ يقاس على النهاية). */
export type ApprovalPeriod = {
  readonly id: string
  readonly endsAt: Date
}

/** بصمةُ قرارٍ — مَن ومتى ولماذا (السببُ إلزاميٌّ في الرفض والمخارج المحكومة). */
export type ApprovalStamp = {
  readonly by: string
  readonly at: Date
  readonly reasonAr: string | null
}

/**
 * الطلبُ: **الكيانُ الوحيدُ الذي يحمل حالةَ اعتمادٍ في مِشكاة** (G22).
 * مفتاحُه الطبيعيّ `(النوع، الوحدة، الفترة)` — ومنه يستحيل إقفالان لفترةٍ واحدة (ق-٦٧).
 */
export type ApprovalRequest = {
  readonly tenantId: string
  readonly id: string
  readonly typeId: string
  readonly unitPath: string
  readonly period: ApprovalPeriod
  readonly state: ApprovalState
  readonly payload: ApprovalPayload
  readonly submittedBy: string | null
  readonly submittedAt: Date | null
  readonly approvedBy: string | null
  readonly approvedAt: Date | null
  readonly route: ApprovalRoute | null
  /** ختمُ القفل عند الاعتماد (ق-٨) — `null` = مفتوحٌ للكتابة. */
  readonly lockedAt: Date | null
  readonly lastRejection: ApprovalStamp | null
}

/** صنفُ الإشعار — الإشعارُ **يتبع التوجيه** فلا يصل غيرَ الأقرب (ق-١١). */
export type ApprovalNoticeKind = "approvalNeeded" | "rejected" | "escalation"

export type ApprovalNotice = {
  readonly tenantId: string
  readonly at: Date
  readonly kind: ApprovalNoticeKind
  readonly requestId: string
  readonly recipients: readonly string[]
}

export type ApprovalErrorCode =
  | "UNKNOWN_APPROVAL_TYPE"
  | "REQUEST_NOT_FOUND"
  | "DUPLICATE_PERIOD"
  | "ALREADY_SUBMITTED"
  | "NOT_SUBMITTED"
  | "LOCKED"
  | "NOT_NEAREST_LAYER"
  | "NOT_ABOVE_NEAREST"
  | "NOT_ABOVE_UNIT"
  | "LAYER_NOT_VACANT"
  | "NO_BREAK_GLASS_CAPABILITY"
  | "NO_OVERRIDE_CAPABILITY"
  | "OVERRIDE_NOT_AVAILABLE"
  | "SELF_APPROVAL_REJECTED"
  | "REASON_REQUIRED"
  | "NOT_SUBMITTER"
  | "RETRACT_NOT_AVAILABLE"
  | "RETRACT_DISABLED"
  | "PERIOD_TIME_LOCKED"
  | "EMPTY_PAYLOAD"

export type ApprovalError = {
  readonly code: ApprovalErrorCode
  readonly detail?: string
}

export type ApprovalOk<T> = { readonly ok: true; readonly value: T }
export type ApprovalErr = { readonly ok: false; readonly error: ApprovalError }
export type ApprovalResult<T> = ApprovalOk<T> | ApprovalErr

export function approvalOk<T>(value: T): ApprovalOk<T> {
  return { ok: true, value }
}

export function approvalErr(code: ApprovalErrorCode, detail?: string): ApprovalErr {
  return detail === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, detail } }
}
