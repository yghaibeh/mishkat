/**
 * أنواعُ المكتبة التدريبية — عقدُ الوحدة `features/library/SPEC.md`.
 *
 * أربعةُ ثوابتٍ تُفرَض **هنا بالنوع** قبل أيّ سطرِ منطق:
 *  ١. **المادةُ ذاتُ موطنٍ تنظيميّ** (§١/§٣): `unitId` و`unitPath` **حقلان إلزاميّا النوع**
 *     — فلا يوجد في النموذج **مكانٌ** لمادةٍ شبكيةٍ بلا نطاق، وهو عينُ ما أنتج **ح-٦** في v1
 *     (`canManage` بلا بُعدٍ نطاقيٍّ إطلاقاً).
 *  ٢. **الجمهورُ قدرةٌ لا اسمُ دور** (§٢، G6): `LibraryAudience.capabilityId` معرّفُ قدرةٍ من
 *     الكتالوج الذهبيّ — والانتماءُ سؤالٌ للمحرّك. فلا قائمةَ أدوارٍ مُصلَّبةٌ في الشجرة.
 *  ٣. **خطُّ الزمن ثلاثُ خَتماتٍ صريحة** (§٤، ق-٩٦): `deliveredAt` إلزاميٌّ لأنّ السجلّ **لا
 *     يوجد** قبل الاستلام، و`openedAt`/`completedAt` **صريحان لا مشتقّان من صمت**.
 *  ٤. **الفئةُ والجمهورُ والصيغةُ بياناتٌ مرجعية** (قب-٢٢/ق-٨٩): تُضاف صفّاً فتعمل بلا كود.
 *     **وللفئة ثلاثةُ حقولٍ بلا مفتاح تفعيل** — قب-٤٠: مفتاحُ التفعيل على معجمٍ مرجعيّ
 *     **بابٌ ثانٍ للمنع** فوق الصلاحية (ع-٨)، فلا حقلَ يُسأل عنه هنا.
 *
 * **ولا حقلَ مزوّدِ تخزينٍ هنا**: المادةُ تحمل `storageKey` لا مسارَ R2 ولا نطاقاً —
 * التخزينُ خلف واجهة المستودع (ADR-001 §٥، المادة ٨/٤).
 * **ولا عدّادَ مخزَّناً** في أيّ كيان: كلُّ رقمٍ اشتقاقٌ عند القراءة (§١) — يُقاس بحارسٍ محتوائيّ.
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"

/** فئةُ المادة (ق-١١٧: «القواميس المغلقة المعربة») — **بياناتٌ مرجعية بلا مفتاح تفعيل**. */
export type LibraryCategory = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
}

/**
 * جمهورُ المادة (ق-٩٦: «تُوجَّه لجمهورٍ بدوره») — **مُعرَّفٌ بقدرةٍ لا بدور**.
 * فحزمةُ العمل في v2 اسمُها قدرة، ودورٌ جديدٌ يدخل جمهورَه **يومَ تُمنح له القدرة**
 * في الملف الذهبيّ بلا سطرِ كودٍ ولا قائمةٍ يتذكّرها إنسان.
 */
export type LibraryAudience = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly capabilityId: CapId
}

/** صيغةُ رفعٍ مقبولة (المادة ٨/٤) — **بياناتٌ مرجعية**؛ والإيقافُ بيانٌ لا حذف. */
export type LibraryFormat = {
  readonly tenantId: string
  readonly id: string
  readonly contentType: string
  readonly active: boolean
}

/** إسقاطُ الوحدة في هذه الوحدة: معرّفٌ ومسارٌ واسم — لا شجرةَ تنظيمٍ موازية. */
export type LibraryUnit = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly path: string
}

/** صنفُ المادة (ب-١٥): ملفٌّ يُرفع أو رابطٌ يُشار إليه — لا ثالثَ لهما. */
export type MaterialKind = "pdf" | "audio" | "link"

/** **المادةُ كيانٌ ذو موطنٍ تنظيميّ** — ومنه وحدَه يُشتقّ نطاقُ كل فعلٍ عليها (§٣). */
export type LibraryMaterial = {
  readonly tenantId: string
  readonly id: string
  readonly titleAr: string
  readonly categoryId: string
  /** **لمن** — جمهورٌ من المعجم، ومعناه قدرةٌ يُسأل عنها المحرّك (§٢). */
  readonly audienceId: string
  readonly kind: MaterialKind
  /** **أين** — المعرّفُ للربط والمسارُ للتنطيق الهابط (ق-١٧): موتُ ح-٦. */
  readonly unitId: string
  readonly unitPath: string
  readonly mandatory: boolean
  /** مفتاحُ التخزين **من المستودع لا من المدخل** — غيرُ قابلٍ للتخمين (المادة ٨/٤). */
  readonly storageKey: string | null
  readonly contentType: string | null
  readonly sizeBytes: number | null
  readonly externalUrl: string | null
  readonly createdBy: string
  readonly createdAt: Date
  /** الأرشفةُ وسمٌ لا محو (المادة ٧/٤): مَن ومتى يبقيان. */
  readonly archivedAt: Date | null
  readonly archivedBy: string | null
}

/**
 * **خطُّ زمنِ الشخص على المادة** (ق-٩٦) — السجلُّ **لا يُنشأ إلا بالاستلام**، فحالةُ
 * «لم تُستلَم» غيابُ سجلٍّ لا حقلٌ فارغ. وما بعده خَتماتٌ صريحةٌ بترتيبها.
 */
export type MaterialProgress = {
  readonly tenantId: string
  readonly materialId: string
  readonly personId: string
  readonly deliveredAt: Date
  readonly openedAt: Date | null
  readonly completedAt: Date | null
}

/** حالةُ خط الزمن — **مشتقّةٌ من الخَتمات وحدها**، ولا حالةَ خامسة. */
export type ProgressState = "notDelivered" | "delivered" | "opened" | "completed"

/** رمزُ خطأٍ خاصٌّ بهذه الوحدة — §١٢ من عقد الوحدة. */
export type LibraryErrorCode =
  | "EMPTY_TITLE"
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_AUDIENCE"
  | "UNKNOWN_LIBRARY_UNIT"
  | "UNKNOWN_MATERIAL"
  | "MATERIAL_ARCHIVED"
  | "NOT_IN_AUDIENCE"
  | "OUT_OF_MATERIAL_SCOPE"
  | "NOT_DELIVERED"
  | "NOT_OPENED_YET"
  | "LINK_REQUIRED"
  | "FILE_REQUIRED"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "FORMAT_INACTIVE"
  | "EXECUTABLE_MEDIA_REJECTED"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "UPLOAD_LIMIT_UNSET"

export type LibraryError = {
  readonly code: LibraryErrorCode
  readonly detail?: string
}

export type LibraryOk<T> = { readonly ok: true; readonly value: T }
export type LibraryErr = { readonly ok: false; readonly error: LibraryError }
export type LibraryResult<T> = LibraryOk<T> | LibraryErr

export function libraryOk<T>(value: T): LibraryOk<T> {
  return { ok: true, value }
}

export function libraryErr(code: LibraryErrorCode, detail?: string): LibraryErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
