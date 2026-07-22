/**
 * **منفذُ نموذج الحلقات** — نقطةُ التعلّق بـT16 (عقدُ الوحدة §١، ب-٢٨).
 *
 * الغرضُ منه واحد: أن تعرف هذه الوحدةُ **ما يخصّها** من الحلقة (موطنُها · نوعُها · معلّمُها ·
 * أرشفتُها · ملتحقوها) **بلا أن تعرف كيف تُبنى** — فلا تستورد خدماتِ T16 ولا مستودعَه، ولا
 * تحمل نسخةً من كيانه. وهو نظيرُ **منفذ القفل** الذي حفظ G22 في وحدة سجل اليوم (T10):
 * *تسأل عن حالٍ ولا تعرف من صنعه.*
 *
 * **والاتجاهُ واحدٌ صارم**: قراءةٌ فقط. لا مِقبضَ كتابةٍ في المنفذ أصلاً — فاستحال أن تكتب
 * هذه الوحدةُ في نموذج الحلقات ولو أرادت (نظيرُ «صفر مقبضٍ يُفتح به» في ب-٢٩).
 */

/** ما تعرفه هذه الوحدةُ عن الحلقة — **خمسةُ حقولٍ لا سادسَ لها**، وكلُّها قراءة. */
export type CircleRef = {
  readonly id: string
  /** موطنُها التنظيميّ — **منه يُشتقّ النطاق** في كل دالة خادم (§٥.٢ ثابت ٢). */
  readonly unitPath: string
  /** نوعُها **صفةٌ تُقرأ** (ب-٢٨) — لا نظامٌ يملكها. */
  readonly typeId: string
  /** الإسنادُ — ومنه يُبنى النطاقُ الشخصيّ للمعلّم (قب-٣٨). */
  readonly teacherPersonId: string | null
  /** الأرشفةُ وسمٌ — وبها **يموت رمزُ وليّ الأمر** بنيوياً (ق-٩٣). */
  readonly archived: boolean
}

/** الطالبُ **اسمٌ حرٌّ بلا هوية** (ق-٣١) — كما هو في سجلّ العضوية الواحد، لا نسخةً منه. */
export type EnrolledStudent = {
  readonly id: string
  readonly nameAr: string
}

export type CircleModelPort = {
  readonly circleOf: (circleId: string) => CircleRef | null
  readonly enrollmentsOf: (circleId: string) => readonly EnrolledStudent[]
  readonly circlesInScope: (unitPath: string) => readonly CircleRef[]
  readonly circlesOfTeacher: (personId: string) => readonly CircleRef[]
  /** ق-٨٩: معجمُ الأنواع **واحدٌ في النظام** — تُسأل عنه T16 ولا يُعاد سردُه هنا. */
  readonly hasType: (typeId: string) => boolean
  /** مسارُ وحدةٍ من إسقاطها — **قراءةٌ لاشتقاق النطاق** لا نسخةُ شجرةٍ ثانية (ADR-001 §٥). */
  readonly unitPathOf: (unitId: string) => string | null
}
