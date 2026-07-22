/**
 * قاموسُ نصوص الحلقات — **داخل الوحدة** (قب-٣١ §٣: نصوصُ الوكيل في وحدته لا في ملفٍّ مشترك)،
 * ويُدمج في الطبقة المركزية الواحدة (`ui/text/dictionary.ts`) حيث يُفحص التصادمُ صراحةً.
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً** (SPEC_design_system §٥-٣، G20)، و`screens/` هو ما
 * يُصيَّر — فالنصُّ هنا **كتالوجُ تدقيقٍ لغويّ** لا موضعُ عرض (نظيرُ `ui/text/domains.ts`).
 *
 * و**مفرداتُ الميدان لا مفرداتُ النظام**: «حلقات مسجدي · حلقاتي · المعلّم · الطلاب» —
 * ولا كلمةَ «قسم» في هذا القاموس إطلاقاً: **الأنواعُ صفةٌ لا أقسامٌ تُفعَّل** (ب-٢٨/ع-٨).
 * وأسماءُ الأنواع نفسُها **بياناتٌ** تأتي من الكتالوج، فلا مفتاحَ نصٍّ لنوعٍ بعينه هنا.
 */

export const CIRCLES = {
  "circles.heading": "حلقاتُ مسجدي",
  "circles.scopeNote": "حلقاتُ هذه الوحدة وما تحتها — لا غيرها",
  "circles.nameLabel": "اسمُ الحلقة",
  "circles.typeLabel": "نوعُ الحلقة",
  "circles.typeFilter": "اعرض نوعاً",
  "circles.capacity": "السعة",
  "circles.enrolled": "الملتحقون",
  "circles.remaining": "المتبقّي",
  "circles.teacher": "المعلّم",
  "circles.unitHome": "وحدةُ الحلقة",
  "circles.create": "أضِف حلقة",
  "circles.update": "عدِّل الحلقة",
  "circles.archive": "أرشِف الحلقة",
  "circles.assignTeacher": "أسنِد معلّماً",
  "circles.enroll": "أضِف طالباً",
  "circles.endEnrollment": "أنهِ عضويةَ طالب",
  "circles.studentName": "اسمُ الطالب",
  "circles.statsSentence": "حلقاتُ نطاقك بأنواعها كلِّها",
  "circles.statsScopeNote": "العددُ على هذا النطاق وحده",
  "circles.full": "بلغت السعة",
  "circles.teacherNone": "بلا معلّمٍ بعد",
  "circles.mineHeading": "حلقاتي",
  "circles.mineScopeNote": "ما أُسنِد إليك أنت وحدك",
  "circles.mineSentence": "حلقاتُك التي تُعلّمها",
  "circles.students": "طلابُ الحلقة",
  "circles.emptyOwner": "لا حلقةَ في مسجدك بعد — أضِف أولَ حلقةٍ من أيّ نوع",
  "circles.emptyScope": "لا حلقةَ في هذا النطاق بعد",
  "circles.emptyMine": "لا حلقةَ أُسنِدت إليك — وما يُسنَد يظهر هنا",
} as const
