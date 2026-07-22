/**
 * أنواعُ وحدة «على بصيرة» — عقدُ الوحدة `features/education/SPEC.md`.
 *
 * **أربعةُ ثوابتٍ تُفرَض هنا بالنوع قبل أيّ سطرِ منطق**:
 *  ١. **صفر كيانِ حلقةٍ وصفر سجلِّ طلابٍ** (ب-٢٨/T16): ليس في هذا الملفّ `Circle` ولا
 *     `Enrollment` ولا `CircleType` — الحلقةُ **تُقرأ بمنفذ** (`services/ports.ts`). فـ«ثلاثةُ
 *     الأنظمة» تستحيل **بغياب الكيان الثاني** لا بالامتناع عن كتابته.
 *  ٢. **صفر حالةِ اعتمادٍ مخزَّنة** (G22): ليس على الدرس حقلُ «معتمَد» ولا «مقدَّم» ولا «مقفل» —
 *     الحالُ يصل **منفذاً محقوناً** يسأل عن حالٍ ولا يعرف سلسلة. فلا يوجد ما يتباعد عن المحرّك.
 *  ٣. **صفر عدّادٍ مخزَّن** (ق-٩٢): لا حقلَ يحفظ عدداً ولا نسبةً — تقدّمُ المنهج **اشتقاقٌ
 *     لحظةَ السؤال**، والتصحيحُ اليدويُّ **بصمةٌ فوقه** (مَن/ماذا/متى/لماذا) لا رقمٌ يحلّ محلّه.
 *  ٤. **صفوفُ المنهاج بلا مفتاح تفعيل** (قب-٢٢/ع-٨): لا `active` ولا `enabled` في أيٍّ منها —
 *     فلا بابَ ثانيَ للمنع فوق الصلاحية، ومنهاجٌ ثانٍ **يُضاف صفوفاً فيعمل بلا سطر كود**.
 */

// ── ١) المنهاجُ: أربعةُ صفوفٍ مرجعية (قب-٢٢) ──────────────────────────────────

/**
 * **المنهاج** (IA ك-٩) — مربوطٌ **بنوع الحلقة** لا باسمٍ مُصلَّبٍ في الكود: فاسمُ المنهاج
 * ونوعُه **قيمتا صفٍّ**، ولذلك لا تظهر تسميةُ منهاجٍ بعينه في أيّ ملفٍّ من هذه الوحدة.
 */
export type Curriculum = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  /** معرّفُ نوع الحلقة من كتالوج T16 — **قائمةٌ مغلقة لا كتابةٌ حرّة** (ق-٨٩). */
  readonly circleTypeId: string
}

/** المستوى — ترتيبُه `ordinal` (بيانٌ يُضبط، لا ترتيبُ إدخالٍ يتقلّب). */
export type CurriculumLevel = {
  readonly tenantId: string
  readonly id: string
  readonly curriculumId: string
  readonly ar: string
  readonly ordinal: number
}

/** الكتاب — ابنُ المستوى. */
export type CurriculumBook = {
  readonly tenantId: string
  readonly id: string
  readonly levelId: string
  readonly ar: string
  readonly ordinal: number
}

/** **المجلس** — ابنُ الكتاب، و**وحدةُ التقدّم** التي يقيس عليها ق-٩٢. */
export type CurriculumSession = {
  readonly tenantId: string
  readonly id: string
  readonly bookId: string
  readonly ar: string
  readonly ordinal: number
}

// ── ٢) الدرسُ: **كيانٌ موطنُه وحدةُ السجل اليوميّ** (CR-016) ─────────────────
//
// كان هنا `Lesson` و`LessonAttendance` و`LessonPhoto` — فكشفت **بوابةُ الموطن الواحد**
// (G20) عند التقاء الوحدتين أنّ «الدرس/الجلسة اليومية» (IA ك-٣) **كيانٌ واحدٌ له موطنان**:
// انشطارُ v1 عائداً في طبقة السجل بعد أن قتله ب-٢٨ في طبقة الحلقة.
//
// **فالعلاجُ في النموذج لا في الحارس**: الكيانُ واحدٌ صاحبُه وحدةُ السجل اليوميّ، و**شكلُ
// حقوله يتبع نوعَ الحلقة**؛ وهذه الوحدةُ **تقرؤه وتضيف قواعدَها** (ق-٨٥/ق-٨٦/ق-٩٢) عبر
// منفذٍ معلن (`services/ports.ts`) وملفِّ وصلٍ واحد (`services/dayLogPort.ts`).
// **ولا جسرَ ولا مزامنةَ ولا نسخةَ ثانية** — الغيابُ هنا هو الدليل.

// ── ٣) التصحيحُ اليدويّ لخليّة تقدّم (ق-٩٢ ذيلاً · قب-٩) ──────────────────────

/**
 * **بصمةُ تصحيحٍ فوق الاشتقاق** — لا عدّادٌ ولا نسخةٌ ثانيةٌ للحقيقة: تقول «هذه الخليّةُ
 * أُكملت/لم تُكمل» بمَن ومتى ولماذا، وحذفُها يُعيد الاشتقاقَ الخام كما هو.
 */
export type ProgressCorrection = {
  readonly tenantId: string
  readonly id: string
  readonly circleId: string
  readonly enrollmentId: string
  readonly sessionId: string
  readonly completed: boolean
  readonly at: Date
  readonly byPersonId: string
  readonly reasonAr: string
}

// ── ٤) أخطاءُ العمل: قيمٌ معلنةٌ مصنَّفة (المادة ٣/٤) ─────────────────────────

export type EducationErrorCode =
  | "UNKNOWN_CIRCLE"
  | "CIRCLE_ARCHIVED"
  | "UNKNOWN_CIRCLE_TYPE"
  | "NO_CURRICULUM_FOR_TYPE"
  | "UNKNOWN_CURRICULUM"
  | "UNKNOWN_LEVEL"
  | "UNKNOWN_BOOK"
  | "UNKNOWN_SESSION"
  | "SESSION_TYPE_MISMATCH"
  | "UNKNOWN_LESSON"
  /** الدرسُ المعتمَد **لا يُعاد تسجيلُه** (ق-٨) — قفلُ الجلسة عند صاحبها، بمفردتنا نحن. */
  | "LESSON_LOCKED"
  /** CR-016 — **شكلُ الجلسة يتبع نوعَ الحلقة**: درسُ منهاجٍ على حلقةِ نوعٍ بلا منهاج. */
  | "SESSION_SHAPE_MISMATCH"
  /** ب-٣٩د — نافذةُ التأريخ عند صاحب الكيان: لا يومَ في المستقبل إلا بإعدادٍ يسمح. */
  | "FUTURE_DATING_BLOCKED"
  | "NOT_ENROLLED"
  | "DUPLICATE_ATTENDANCE"
  | "EMPTY_ATTENDANCE"
  | "INVALID_DURATION"
  | "INVALID_ORDINAL"
  | "EMPTY_NAME"
  | "EMPTY_PHOTO_KEY"
  | "DUPLICATE_PHOTO_KEY"
  | "EMPTY_REASON"
  | "UNKNOWN_PAID_CURRICULUM"

export type EducationError = {
  readonly code: EducationErrorCode
  readonly detail?: string
}

export type EducationOk<T> = { readonly ok: true; readonly value: T }
export type EducationErr = { readonly ok: false; readonly error: EducationError }
export type EducationResult<T> = EducationOk<T> | EducationErr

export function educationOk<T>(value: T): EducationOk<T> {
  return { ok: true, value }
}

export function educationErr(code: EducationErrorCode, detail?: string): EducationErr {
  return detail === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, detail } }
}
