/**
 * أنواعُ الإعلام والتغطيات — عقدُ الوحدة `features/media/SPEC.md`.
 *
 * ثلاثةُ ثوابتٍ تُفرَض هنا بالنوع قبل أيّ سطرِ منطق:
 *  ١. **التغطيةُ كيانُ حدثٍ لا صورةٌ عائمة** (ق-١٠٣/ز-٥): أربعةُ أجوبةٍ حقولٌ **إلزاميةُ
 *     النوع** — عنوانٌ ونوعٌ ووحدةٌ **وتاريخُ وقوع** وناشرٌ باسمه. ولا صورةَ إلا بمعرّف
 *     تغطيتها: `MediaPhoto.coverageId` ليس اختيارياً، فلا يوجد في النموذج **مكانٌ** لصورةٍ
 *     يتيمة (وهو عينُ ز-٥ مقتولاً بالنوع لا بالانضباط).
 *  ٢. **المعجمان بياناتٌ مرجعية** (قب-٦/G14): نوعُ التغطية وصيغةُ الرفع كيانان بحالةِ تفعيل
 *     — لا اتحادَ نصوصٍ مغلقٍ في الكود، فيُدار المعجمُ بياناً لا نشراً.
 *  ٣. **أخطاءُ العمل قيمٌ معلنةٌ مصنَّفة** (المادة ٣/٤): لكل رفضٍ سببُه المُشخِّص — فلا
 *     «تعذّر الرفع» مبهمةٌ تُخفي أيَّ الحارسين ردّ.
 *
 * **ولا حقلَ مزوّدِ تخزينٍ هنا**: الصورةُ تحمل `storageKey` لا مسارَ R2 ولا نطاقاً —
 * التخزينُ خلف واجهة المستودع (ADR-001 §٥).
 */

/** نوعُ التغطية من المعجم المغلق (ق-١٠٣ «نوعٌ من معجم») — **بياناتٌ مرجعية**. */
export type MediaKind = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  /** الإيقافُ بيانٌ لا حذف (المادة ٧/٤). */
  readonly active: boolean
}

/** صيغةُ رفعٍ مقبولة (المادة ٨/٤) — **بياناتٌ مرجعية** كذلك. */
export type MediaFormat = {
  readonly tenantId: string
  readonly id: string
  readonly contentType: string
  readonly active: boolean
}

/** إسقاطُ الوحدة في هذه الوحدة: معرّفٌ ومسارٌ واسم — لا شجرةَ تنظيمٍ موازية. */
export type MediaUnit = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly path: string
}

/**
 * **التغطيةُ سجلُّ حدث** (ك-٣١): أربعةُ أجوبةٍ لا يُنشأ الكيانُ بدونها (ق-١٠٣).
 * و`occurredOn` **تاريخُ الوقوع** غيرُ `createdAt` **تاريخِ الرفع** — فصلٌ متعمَّدٌ يجيب
 * سؤال «متى كان هذا؟» بعد شهرٍ بالصدق لا بيوم الرفع.
 */
export type MediaCoverage = {
  readonly tenantId: string
  readonly id: string
  /** **ماذا** */
  readonly titleAr: string
  readonly kindId: string
  /** **أين** — المعرّفُ للربط والمسارُ للعزل الهابط (ق-١٧). */
  readonly unitId: string
  readonly unitPath: string
  /** **متى** — تاريخُ الوقوع لا الرفع. */
  readonly occurredOn: Date
  /** **مَن** — صاحبُها باسمه؛ وهو وحده مَن يرفع صورَها ويحذفها (ق-١٠٥). */
  readonly publisherPersonId: string
  readonly createdAt: Date
  /** الحذفُ بيانٌ لا محو (المادة ٧/٤): مَن ومتى يبقيان. */
  readonly deletedAt: Date | null
  readonly deletedBy: string | null
}

/** صورةٌ في ألبوم تغطيةٍ — **لا وجودَ لها بلا تغطيتها** (ق-١٠٣). */
export type MediaPhoto = {
  readonly tenantId: string
  readonly id: string
  readonly coverageId: string
  /** مفتاحُ التخزين **من المستودع لا من المدخل** — غيرُ قابلٍ للتخمين (المادة ٨/٤). */
  readonly storageKey: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly uploadedBy: string
  readonly uploadedAt: Date
}

/** رمزُ خطأٍ خاصٌّ بهذه الوحدة — §٨ من عقد الوحدة. */
export type MediaErrorCode =
  | "EMPTY_TITLE"
  | "UNKNOWN_COVERAGE_KIND"
  | "KIND_INACTIVE"
  | "UNKNOWN_MEDIA_UNIT"
  | "FUTURE_OCCURRENCE_DATE"
  | "OUT_OF_PUBLISHING_SCOPE"
  | "COVERAGE_NOT_FOUND"
  | "NOT_COVERAGE_PUBLISHER"
  | "COVERAGE_DELETED"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "FORMAT_INACTIVE"
  | "EXECUTABLE_MEDIA_REJECTED"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "UPLOAD_LIMIT_UNSET"

export type MediaError = {
  readonly code: MediaErrorCode
  readonly detail?: string
}

export type MediaOk<T> = { readonly ok: true; readonly value: T }
export type MediaErr = { readonly ok: false; readonly error: MediaError }
export type MediaResult<T> = MediaOk<T> | MediaErr

export function mediaOk<T>(value: T): MediaOk<T> {
  return { ok: true, value }
}

export function mediaErr(code: MediaErrorCode, detail?: string): MediaErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
