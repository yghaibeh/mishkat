/**
 * أنواعُ وحدة اللجان والاجتماعات — عقدُ الوحدة §١…§٤.
 *
 * **ما لا يوجد هنا أهمُّ ممّا يوجد**:
 *  - **لا معرّفَ شخصٍ في كيان العضو** (ق-٣١): الأعضاءُ أسماءٌ حرّةٌ بلا حسابات — استحالةٌ
 *    بالنوع لا انضباطٌ يُنسى؛ فمُحرّرُ اللجنة لا يستطيع أصلاً أن يبحث في أشخاص النظام.
 *  - **لا نصابَ ولا صوتَ ولا حضورٌ مفصَّل في كيان الاجتماع** (ب-٢ مدفونٌ بقرار المالك):
 *    الاجتماعُ **محضرٌ وقرارات** لا غير.
 *  - **لا حالةَ اعتمادٍ في أيّ كيانٍ هنا** (G22): حالةُ الاعتماد تعيش في مستودع المحرّك وحده.
 *
 * وأخطاءُ العمل **قيمٌ معلنةٌ مصنَّفة** (المادة ٣/٤): الخدماتُ تعيد `Result` ولا تُلقي استثناءً.
 */

/** وحدةُ الشجرة كما تراها هذه الوحدة: معرّفٌ ومسارٌ — لا نسخةَ شجرةٍ ثانية. */
export type CommitteeUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

/**
 * اللجنة (ك-٢٣) — كيانٌ **تحت المسجد**: مسارُها مشتقٌّ من مسار مسجدها ومعرّفها (ت-٢)،
 * فيصير أميرُ المسجد **أقربَ سلَفٍ إشرافيٍّ فوقها** وتنطبق عليها سلسلةُ ق-١٣ بلا حالةٍ خاصة.
 */
export type Committee = {
  readonly tenantId: string
  readonly id: string
  readonly mosqueUnitId: string
  readonly mosquePath: string
  /** مسارُ نطاق اللجنة — **يُبنى بدالة** لا بسلسلةٍ حرّة (ت-٢). */
  readonly path: string
  readonly labelAr: string
  /** مسؤولُها إن مكَّن له الأميرُ حساباً (ع-١٧)، و`null` إن كان **اسماً حرّاً** (ق-٣١). */
  readonly headPersonId: string | null
  /** اسمُ المسؤول نصاً — يُحفظ دائماً ولو بلا حساب (ق-٣١). */
  readonly headNameAr: string
  /** الإيقافُ **حالةٌ في البيانات** لا محو (المادة ٧/٤). */
  readonly active: boolean
}

/** عضوُ اللجنة — **اسمٌ حرٌّ لا حساب** (ق-٣١/ب-٤٣): لا حقلَ معرّفِ شخصٍ في هذا النوع. */
export type CommitteeMember = {
  readonly tenantId: string
  readonly id: string
  readonly committeeId: string
  readonly nameAr: string
}

/**
 * نشاطُ اللجنة (ب-٤٣/ع-١٨) — «عددُ الشباب المشاركين وأسماؤهم وتاريخُ الإنجاز».
 * **الأسماءُ حرّةٌ هنا كذلك** (ق-٣١)، والعددُ يطابق الأسماء إن ذُكرت فلا يتناقض سطران.
 */
export type CommitteeActivity = {
  readonly tenantId: string
  readonly id: string
  readonly committeeId: string
  /** الفترةُ التي يدخل بها النشاطُ سجلَّ المسجد (ق-١٣). */
  readonly periodId: string
  readonly titleAr: string
  readonly participantCount: number
  readonly participantNamesAr: readonly string[]
  readonly completedAt: Date
}

/**
 * الاجتماع/المحضر (ك-٢٤، ب-١٨) — **محضرٌ وقرارات فقط**.
 * ب-٢ مدفونٌ بقرار المالك: لا نصابَ ولا أصواتَ ولا سجلَّ حضورٍ مفصَّل — ولا حقلَ لها هنا.
 */
export type Meeting = {
  readonly tenantId: string
  readonly id: string
  readonly mosqueUnitId: string
  readonly mosquePath: string
  readonly heldAt: Date
  readonly minutesAr: string
  readonly decisionsAr: readonly string[]
}

/** رمزُ الخطأ المصنَّف — رسالتُه العربية تُصاغ في طبقة العرض لا هنا (المادة ٣/٤). */
export type CommitteeErrorCode =
  | "UNKNOWN_MOSQUE_UNIT"
  | "COMMITTEE_NOT_FOUND"
  | "COMMITTEE_INACTIVE"
  | "DUPLICATE_COMMITTEE"
  | "EMPTY_LABEL"
  | "EMPTY_HEAD_NAME"
  | "EMPTY_MEMBER_NAME"
  | "EMPTY_ACTIVITY_TITLE"
  | "PARTICIPANT_COUNT_MISMATCH"
  | "NEGATIVE_PARTICIPANTS"
  | "FUTURE_COMPLETION_DATE"
  | "EMPTY_MINUTES"
  | "NO_DECISIONS"
  | "MODULE_DISABLED"

export type CommitteeError = {
  readonly code: CommitteeErrorCode
  readonly detail?: string
}

export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err = { readonly ok: false; readonly error: CommitteeError }
export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err(code: CommitteeErrorCode, detail?: string): Err {
  return detail === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, detail } }
}
