/**
 * **منافذُ الوحدة المُعلَنة** — عقدُ الوحدة §١: ما تحتاجه هذه الوحدةُ من غيرها **تعلنه سؤالاً
 * ولا تستورده كياناً**.
 *
 * ولماذا منفذٌ لا استيرادٌ مباشر؟ لثلاثة أسباب مقيسة:
 *  ١. **صفر كيانِ حلقةٍ ثانٍ** (ب-٢٨): الوحدةُ لا تملك حلقةً ولا طالباً — تسألُ عنهما. ولو
 *     ملكتهما لعاد مرضُ v1 («ثلاثةُ أنظمةٍ يخيطها جسر») في ثوبٍ جديد.
 *  ٢. **صفر منطقِ اعتماد** (G22): «أهذا الدرسُ معتمَد؟» سؤالٌ عن **حالٍ** — والوحدةُ لا تعرف
 *     مَن يعتمد ولا بأيّ سلسلة، والمُنفِّذُ يعيش **داخل مجلد المحرّك** (نظيرُ منفذ القفل في T10).
 *  ٣. **اتجاهُ الاعتماد منعكس**: المُركِّبُ يصل المنفذَ بالمصدر الواحد، فيبقى استبدالُ طبقة
 *     البيانات (D1 بدل الذاكرة — ADR-001 §٥) **تغييرَ تركيبٍ لا تغييرَ منطق**.
 */

import type { EducationResult } from "../types.js"

/** الحلقةُ كما تحتاجها هذه الوحدة — قراءةٌ لا نسخةُ حقيقة (موطنُها `features/circles`). */
export type TeachingCircle = {
  readonly id: string
  readonly unitPath: string
  readonly typeId: string
  readonly teacherPersonId: string | null
  readonly archivedAt: Date | null
}

/** ملتحقٌ بالحلقة — اسمٌ حرٌّ بلا هوية (ق-٣١)، يُقرأ من سجلٍّ واحد لا من سجلٍّ ثانٍ هنا. */
export type RosterMember = {
  readonly id: string
  readonly nameAr: string
}

export type CircleReader = (circleId: string) => TeachingCircle | null
export type RosterReader = (circleId: string) => readonly RosterMember[]
/** معجمُ أنواع الحلقات المسجَّل — **يُشتقّ ولا يُسرد** (CR-014/قب-٤٠). */
export type CircleTypeReader = () => readonly string[]

/**
 * «أهذا الدرسُ معتمَد؟» — **سؤالٌ عن حالٍ لا عن سلسلة** (G22).
 * افتراضُه في كل سياقٍ **لا**: فالاعتمادُ **فعلٌ يقع** لا حالةٌ ضمنية.
 */
export type LessonApprovalCheck = (lessonId: string) => boolean

// ── CR-016: الجلسةُ اليومية كيانٌ **موطنُه وحدةٌ أخرى** — تُقرأ ولا تُبنى ──────────
// (نوعُ الحصيلة من هذه الوحدة نفسِها — فالمنفذُ يعِد بمفرداتنا لا بمفردات غيرنا.)

/**
 * **الجلسةُ اليومية بشكل المنهاج** كما تحتاجها هذه الوحدة (IA ك-٣) — **قراءةٌ لا نسخةُ
 * حقيقة**: موطنُ الكيان وحدةُ السجل اليوميّ، وهذه الوحدةُ **طبقةُ قواعدَ فوقه** (ق-٨٥/ق-٨٦/ق-٩٢).
 *
 * ولماذا لا يُبنى هنا؟ لأنّ CR-016 كشف أنّ بناءه هنا **أعاد انشطارَ v1 في طبقة السجل**:
 * كيانٌ واحدٌ في IA تعدّدت تجسيداتُه بتعدّد من يكتبه. **فصار يُسأل عنه كما تُسأل الحلقة.**
 */
export type CircleDay = {
  readonly id: string
  readonly circleId: string
  readonly dayKey: string
  readonly heldAt: Date
  /** المجلسُ من كتالوج **هذه الوحدة** — مرجعٌ في الجلسة، وكتالوجُه هنا (قب-٢٢). */
  readonly curriculumSessionId: string
  readonly durationMinutes: number
  readonly venueAr: string | null
  readonly photoKeys: readonly string[]
  /** الحاضرون — **مشتقّون من أسطر الجلسة**، ولا سجلَّ حضورٍ ثانٍ في هذه الوحدة. */
  readonly presentEnrollmentIds: readonly string[]
  readonly rosterEnrollmentIds: readonly string[]
  /** مَن أدخل (المعلّمُ المالك أو أميرُ المكان — ق-٨٤): تدقيقٌ ظاهرٌ لا نيّة. */
  readonly recordedBy: string
}

/** مدخلُ تسجيلِ يومٍ بشكل المنهاج — تُملأ قواعدُ هذه الوحدة عليه ثم **يُكتب في موطنه**. */
export type RecordCircleDayInput = {
  readonly circleId: string
  readonly heldAt: Date
  readonly curriculumSessionId: string
  readonly durationMinutes: number
  readonly venueAr?: string
  readonly presentEnrollmentIds: readonly string[]
  readonly photoKeys?: readonly string[]
}

/**
 * **منفذُ الجلسة اليومية** — أربعةُ أسئلةٍ لا خامسَ لها؛ ثلاثةٌ للقراءة وواحدٌ **يكتب في
 * موطن الكيان لا في مستودعٍ ثانٍ هنا** (فالكاتبُ يبقى واحداً في وحدته).
 */
export type CircleDayPort = {
  readonly ofCircle: (circleId: string) => readonly CircleDay[]
  readonly ofTeacher: (personId: string) => readonly CircleDay[]
  readonly byId: (sessionId: string) => CircleDay | null
  /**
   * الحصيلةُ **بمفردات هذه الوحدة المعلنة** (§١١): صاحبُ الكيان يشخّص بمفرداته،
   * و**ملفُّ الوصل وحده** يترجمها — فلا تتسرّب مفرداتُ غيرنا إلى خدماتنا ولا إلى شاشاتنا.
   */
  readonly record: (input: RecordCircleDayInput) => EducationResult<CircleDay>
}

/** قراءةٌ محضة — ما يحتاجه مجلدُ المحرّك لبناء حمولةٍ ومِرساة (بلا مِقبض كتابة). */
export type CircleDayReadPort = Omit<CircleDayPort, "record">
