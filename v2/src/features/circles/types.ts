/**
 * أنواعُ نموذج الحلقات الموحّد — عقدُ الوحدة `features/circles/SPEC.md`.
 *
 * **ب-٢٨ يُفرَض هنا بالنوع قبل أيّ سطرِ منطق** — أربعةُ ثوابت:
 *  ١. **كيانُ حلقةٍ واحد** (`Circle`) **نوعُه حقلٌ عليه** (`typeId`) — لا `TahfeezCircle` ولا
 *     `BaseeraHalaqa` ولا جدولٌ لكل نوع. فـ«ثلاثةُ الأنظمة» تستحيل **بغياب النوع الثاني**
 *     لا بالامتناع عن كتابته.
 *  ٢. **النوعُ بلا مفتاح تفعيل** (`CircleType` ثلاثةُ حقولٍ لا رابعَ لها): فلا يوجد حقلٌ
 *     يُسأل عنه «أمفعَّل؟» — وهو **البابُ الثاني للمنع** الذي أنتج ع-٨ («قسمها غير مفعّل»).
 *  ٣. **صفر عدّادٍ مخزَّن**: ليس في أيّ كيانٍ هنا حقلٌ يحفظ عدداً — فالعددُ اشتقاقٌ لحظةَ
 *     السؤال، ولا يوجد ما يتباعد عن الواقع أصلاً (ع-١٩، ع-٢٩).
 *  ٤. **العضويةُ ابنةُ الحلقة باسمٍ حرّ** (ق-٣١): لا معرّفَ شخصٍ فيها — فليس كلُّ مذكورٍ
 *     مستخدماً، والحسابُ يُنشأ عند الحاجة في `org` لا هنا.
 */

/** وحدةٌ تنظيمية كما يعرفها هذا المستودع — معرّفُها ومسارُها (ت-٢). */
export type CirclesUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

/**
 * نوعُ الحلقة — **بياناتٌ مرجعية قابلة للتوسّع** (قب-٢٢، نظيرُ كتالوج الأنشطة وقاموس فئات
 * الصرف): يُضاف صفّاً فيعمل بلا سطر كود. **وليس فيه `active` ولا `enabled` عمداً**: مفتاحُ
 * تفعيلِ النوع هو عينُ ع-٨، ولا يُحرَس بالانضباط بل **بغياب الحقل**.
 */
export type CircleType = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
}

/**
 * **الحلقة** (IA ك-١) — كيانٌ واحدٌ ابنٌ لوحدته، **نوعُه صفةٌ عليه**.
 *
 * `unitPath` هو موطنُها التنظيميّ، ومنه **يُشتقّ النطاق** في كل دالة خادم (§٥.٢ ثابت ٢)؛
 * ولأنّ `circle.manage` نطاقُها «ذ» (مطابقةٌ تامّة) فمالكُها **قائدُ تلك الوحدة بعينها**
 * لا مَن فوقه — وهذا نصُّ «الحلقةُ تابعةٌ له لا بإزائه» (ع-٧).
 */
export type Circle = {
  readonly tenantId: string
  readonly id: string
  readonly unitPath: string
  /** ب-٢٨: **النوعُ صفةٌ** — معرّفٌ من الكتالوج (ق-٨٩: قائمةٌ لا كتابةٌ حرّة). */
  readonly typeId: string
  readonly nameAr: string
  /** ع-٣: السعةُ **تُعرض** عند الإضافة؛ وهي حدُّ عرضٍ لا حارسُ قبول (عقدُ الوحدة §٦). */
  readonly capacity: number
  /** إسنادُ المعلّم — و`circle.teach` الشخصية تُفرَض في المحرّك لا هنا (قب-٣٨). */
  readonly teacherPersonId: string | null
  /** الأرشفةُ **وسمٌ يُقرأ لا صفٌّ يُمحى** (المادة ٧/٤). */
  readonly archivedAt: Date | null
  readonly createdAt: Date
}

/**
 * **التسجيل/الطالب** (IA ك-٢) — ابنُ الحلقة في **موضعٍ واحد**: لا سجلَّي طلابٍ متوازيين
 * (وهو ما كسر v1: «أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب»).
 * والاسمُ **نصٌّ حرٌّ بلا هوية** (ق-٣١)، والخروجُ **وسمٌ** لا محو.
 */
export type Enrollment = {
  readonly tenantId: string
  readonly id: string
  readonly circleId: string
  readonly nameAr: string
  readonly joinedAt: Date
  readonly leftAt: Date | null
}

export type CirclesErrorCode =
  | "UNKNOWN_UNIT"
  | "UNKNOWN_CIRCLE_TYPE"
  | "UNKNOWN_CIRCLE"
  | "CIRCLE_ARCHIVED"
  | "EMPTY_NAME"
  | "INVALID_CAPACITY"
  | "TEACHER_OUT_OF_SCOPE"
  | "UNKNOWN_ENROLLMENT"
  | "ALREADY_LEFT"

export type CirclesError = {
  readonly code: CirclesErrorCode
  readonly detail?: string
}

export type CirclesOk<T> = { readonly ok: true; readonly value: T }
export type CirclesErr = { readonly ok: false; readonly error: CirclesError }
export type CirclesResult<T> = CirclesOk<T> | CirclesErr

export function circlesOk<T>(value: T): CirclesOk<T> {
  return { ok: true, value }
}

export function circlesErr(code: CirclesErrorCode, detail?: string): CirclesErr {
  return detail === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, detail } }
}
