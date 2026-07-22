/**
 * أنواعُ السجلّ اليوميّ للحلقة — عقدُ الوحدة `features/tahfeezLog/SPEC.md`.
 *
 * **ب-٢٨ يُفرَض هنا بالنوع قبل أيّ سطرِ منطق** (عقدُ الوحدة §١):
 *  ١. **لا كيانَ حلقةٍ ولا تسجيلٍ هنا**: ليس في هذا الملفّ اسمُ حلقةٍ ولا سعةٌ ولا معلّمٌ
 *     ولا اسمُ طالب — بل `circleId` و`enrollmentId` **مرجعان** إلى نموذج T16 الواحد.
 *     فـ«ثلاثةُ الأنظمة» تستحيل **بغياب النسخة الثانية** لا بالامتناع عن كتابتها.
 *  ٢. **صفر عدّادٍ مخزَّن** (عقدُ الوحدة §٩): لا حقلَ يحفظ حضوراً ولا نسبةً ولا متوسّطاً —
 *     كلُّ رقمٍ اشتقاقٌ لحظةَ السؤال، فلا يوجد ما يتباعد عن الواقع أصلاً (ع-٢٩).
 *  ٣. **نطاقُ الحفظ نوعٌ مغلق** (ق-٨٩): لا حقلَ نصٍّ حرٍّ لاسم سورة — الاسمُ يُشتقّ من
 *     الكتالوج المرجعيّ عند العرض، فالكتابةُ الحرّة **غيرُ ممكنةٍ بالنوع**.
 *  ٤. **الحضورُ رباعيٌّ مغلق** (ق-٩٠): خامسٌ = خطأُ ترجمةٍ لا خطأُ تشغيل.
 */

/** ق-٩٠ — الحضورُ الرباعيّ: حاضر · غائب · تارك · مستأذن. */
export type AttendanceMark = "present" | "absent" | "left" | "excused"

export const ATTENDANCE_MARKS: readonly AttendanceMark[] = Object.freeze([
  "present",
  "absent",
  "left",
  "excused",
])

/**
 * ق-٨٩ — **سورةٌ بياناتٌ مرجعية** (قب-٢٢، نظيرُ كتالوج أنواع الحلقات): تُضاف صفّاً فتعمل
 * بلا سطر كود. و`ayahCount` **بيانٌ لا رقمٌ صلب** — ولذلك لا قائمةَ سورٍ في هذا المصدر.
 */
export type SurahRef = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly ayahCount: number
}

/** ق-٨٩ — **المصحفُ مرجعٌ** كذلك: حدُّ الصفحات بيانٌ يُبذَر لا ثابتٌ في الكود. */
export type MushafRef = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly pageCount: number
}

/**
 * ق-٨٩ — **نطاقُ الحفظ/المراجعة**: إمّا سورةٌ بآياتها وإمّا صفحاتٌ من المصحف.
 * **لا وجهَ ثالثٌ ولا نصٌّ حرّ** — والاسمُ العربيُّ يُشتقّ من الكتالوج لا يُكتب.
 */
export type Recitation =
  | {
      readonly mode: "surah"
      readonly surahId: string
      readonly fromAyah: number
      readonly toAyah: number
    }
  | {
      readonly mode: "pages"
      readonly mushafId: string
      readonly fromPage: number
      readonly toPage: number
    }

/**
 * ب-٤١/ع-١٠ — **المادةُ الإثرائية بعلامة**: نوعُها من **كتالوج أنواع T16 نفسِه**
 * (ق-٨٩: «المنهجُ المصاحب من مصدر الحقيقة القائم لا قائمةٍ مخترعة») — فمعجمُ الأنواع
 * واحدٌ في النظام كلِّه، ولا معجمَ ثانٍ يتباعد (درسُ CR-014).
 */
export type Enrichment = {
  readonly typeId: string
  readonly grade: number | null
}

/**
 * **سطرُ الطالب في جلسة اليوم** — يشير إلى `enrollmentId` في سجلّ العضوية الواحد (ق-٣١)،
 * **ولا يحمل اسمه**: الاسمُ موطنُه وحدة `circles`، ونسخُه هنا هو بعينه ازدواجُ v1.
 */
export type SessionRow = {
  readonly enrollmentId: string
  readonly attendance: AttendanceMark
  readonly memorization: Recitation | null
  readonly memorizationGrade: number | null
  readonly review: Recitation | null
  readonly reviewGrade: number | null
  readonly tajweedGrade: number | null
  readonly enrichment: Enrichment | null
}

/**
 * **جلسةُ اليوم** (IA ك-٣) — مفتاحُها الطبيعيّ `(circleId, dayKey)`، فإعادةُ الإرسال
 * **تستبدل أسطرَ اليوم** ولا تُنشئ جلسةً ثانية (ق-٩٠ «upsert»).
 */
export type DaySession = {
  readonly tenantId: string
  readonly id: string
  readonly circleId: string
  /** مفتاحُ اليوم `YYYY-MM-DD` **في المنطقة المضبوطة** — يُشتقّ ولا يُستقبَل نصاً. */
  readonly dayKey: string
  readonly rows: readonly SessionRow[]
  /** مَن سجّل — من الجلسة لا من المدخل. */
  readonly recordedByPersonId: string
  readonly recordedAt: Date
}

/**
 * **ملاحظةُ الإشراف على الحلقة** (IA ك-٥، ق-٨٧/ب-٣٥أ) — **سجلٌّ يُلحق لا يُستبدل**:
 * لا تحريرَ ولا محو (المادة ٧/٤)، فالمعلّمُ لا يجد ما يحرّره أصلاً.
 */
export type SupervisionNote = {
  readonly tenantId: string
  readonly id: string
  readonly circleId: string
  /** **نصٌّ حرٌّ عمداً** — ق-٨٩ نصاً: «المفتوحُ بطبيعته (ملاحظات) يبقى حرّاً». */
  readonly bodyAr: string
  readonly authorPersonId: string
  readonly writtenAt: Date
}

/**
 * **رابطُ وليّ الأمر** (IA ك-٦، ق-٩٣ + ب-٣٦أ) — ابنُ **التسجيل** لا الحلقة:
 * فهو «لا يكشف إلا طالبَه». والإلغاءُ **وسمٌ لا محو**، والموتُ بالأرشفة **بنيويّ**
 * (يُسأل عنه نموذجُ الحلقة لحظةَ الحلّ) لا حقلُ حالةٍ يُنسى تحديثُه.
 */
export type GuardianLink = {
  readonly tenantId: string
  readonly id: string
  readonly token: string
  readonly enrollmentId: string
  readonly circleId: string
  readonly issuedAt: Date
  readonly expiresAt: Date
  readonly revokedAt: Date | null
}

export type DayLogErrorCode =
  | "UNKNOWN_CIRCLE"
  | "CIRCLE_ARCHIVED"
  | "UNKNOWN_ENROLLMENT"
  | "ENROLLMENT_NOT_IN_CIRCLE"
  | "DUPLICATE_STUDENT_ROW"
  | "EMPTY_SESSION"
  | "FUTURE_DATING_BLOCKED"
  | "GRADE_OUT_OF_RANGE"
  | "GRADE_WITHOUT_ATTENDANCE"
  | "UNKNOWN_SURAH"
  | "AYAH_OUT_OF_RANGE"
  | "UNKNOWN_MUSHAF"
  | "PAGE_OUT_OF_RANGE"
  | "UNKNOWN_ENRICHMENT_TYPE"
  | "EMPTY_NOTE"
  | "UNKNOWN_LINK"
  | "LINK_ALREADY_ACTIVE"
  | "LINK_EXPIRED"
  | "LINK_REVOKED"
  | "LINK_DEAD"
  | "RENEWAL_DISABLED"

export type DayLogError = {
  readonly code: DayLogErrorCode
  readonly detail?: string
}

export type DayLogOk<T> = { readonly ok: true; readonly value: T }
export type DayLogErr = { readonly ok: false; readonly error: DayLogError }
export type DayLogResult<T> = DayLogOk<T> | DayLogErr

export function logOk<T>(value: T): DayLogOk<T> {
  return { ok: true, value }
}

export function logErr(code: DayLogErrorCode, detail?: string): DayLogErr {
  return detail === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, detail } }
}
