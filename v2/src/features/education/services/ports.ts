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
