/**
 * قاموسُ نصوص السجلّ اليوميّ — **داخل الوحدة** (PARALLEL_WORK §٣-أ: المحتوى في وحدته،
 * وسطرُ الدمج وحده في الطبقة المركزية `ui/text/dictionary.ts` حيث يُفحص التصادمُ صراحةً).
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً** (SPEC_design_system §٥-٣، G20)، فـ`screens/` هو ما
 * يُصيَّر — والنصُّ هنا **كتالوجُ تدقيقٍ لغويّ** لا موضعُ عرض.
 *
 * و**مفرداتُ الميدان لا مفرداتُ النظام** (عدسةُ المعلّم §٢.٦): «حلقتي · طلابي · درسُ اليوم ·
 * الحفظ · المراجعة · التجويد». و**لا مفتاحَ لاسم سورةٍ ولا لنوعِ حلقة**: كلاهما **بياناتٌ**
 * تأتي من كتالوجها (ق-٨٩/قب-٢٢) — فلو وُجد مفتاحُ سورةٍ هنا لكانت قائمةً ثانيةً تتباعد.
 */

export const CIRCLE_LOG = {
  "circleLog.heading": "سجلُّ الحلقة اليوميّ",
  "circleLog.scopeNote": "سجلُّ هذه الحلقة وحدها",
  "circleLog.day": "اليوم",
  "circleLog.student": "الطالب",
  "circleLog.attendance": "الحضور",
  "circleLog.present": "حاضر",
  "circleLog.absent": "غائب",
  "circleLog.left": "تارك",
  "circleLog.excused": "مستأذن",
  "circleLog.notRecorded": "لم يُسجَّل بعد",
  "circleLog.memorization": "الحفظ",
  "circleLog.review": "المراجعة",
  "circleLog.tajweed": "التجويد",
  "circleLog.enrichment": "مادةٌ إثرائية",
  "circleLog.grade": "العلامة (من الحدّ المعتمد)",
  "circleLog.surah": "السورة",
  "circleLog.fromAyah": "من الآية",
  "circleLog.toAyah": "إلى الآية",
  "circleLog.record": "سجّل يومَ الحلقة",
  "circleLog.recordedBy": "سجّله",
  "circleLog.emptyOwner": "لم يُسجَّل يومُ حلقتك بعد — سجّل حضورَ طلابك وحفظَهم",
  "circleLog.emptyViewer": "لا سجلَّ لهذا اليوم في هذه الحلقة بعد",
  "circleLog.rankingHeading": "تقييمُ الحلقات الدوريّ",
  "circleLog.rankingSentence": "حلقاتُ نطاقك مرتّبةً بحضورها وعلاماتها",
  "circleLog.rankingScopeNote": "على هذا النطاق وحده وفي نافذته المعتمدة",
  "circleLog.rankingScore": "الدرجة",
  "circleLog.rankingAttendance": "نسبةُ الحضور",
  "circleLog.rankingGrades": "نسبةُ العلامات",
  "circleLog.rankingInactive": "حلقةٌ خاملةٌ في النافذة",
  "circleLog.rankingHidden": "لا ترتيبَ يُعرض: لم تُسجَّل جلساتٌ في النافذة",
  "circleLog.notesHeading": "ملاحظاتُ الإشراف على الحلقة",
  "circleLog.notesScopeNote": "ملاحظاتُ هذه الحلقة وحدها",
  "circleLog.noteBody": "نصُّ الملاحظة",
  "circleLog.noteAuthor": "كاتبُها",
  "circleLog.noteWrite": "أضِف ملاحظةً إشرافية",
  "circleLog.notesReadOnly": "ملاحظاتُ المشرف تُقرأ ولا تُحرَّر",
  "circleLog.notesEmptyOwner": "لا ملاحظةَ على هذه الحلقة بعد — أضِف أولَ ملاحظة",
  "circleLog.notesEmptyViewer": "لا ملاحظةَ إشرافٍ على هذه الحلقة بعد",
  "circleLog.guardianHeading": "روابطُ أولياء الأمور",
  "circleLog.guardianIssue": "أصدِر رابطاً لوليّ أمر الطالب",
  "circleLog.guardianRenew": "جدِّد الرابط",
  "circleLog.guardianRevoke": "ألغِ الرابط",
  "circleLog.guardianState": "حالةُ الرابط",
  "circleLog.guardianExpiry": "تنتهي صلاحيتُه",
  "circleLog.guardianNote": "رابطٌ للقراءة فقط لا يكشف إلا طالبَه",
  "circleLog.guardianEmptyOwner": "لا رابطَ لوليّ أمرٍ بعد — أصدِر أولَ رابط",
  "circleLog.mineHeading": "سجلُّ حلقاتي",
  "circleLog.mineSentence": "حلقاتُك اليومَ: حضورٌ وحفظٌ وتقييم",
  "circleLog.mineScopeNote": "ما أُسنِد إليك أنت وحدك",
  "circleLog.mineEmptyOwner": "لا حلقةَ أُسنِدت إليك — وما يُسنَد يظهر هنا بسجلّه",
  "circleLog.studentRecord": "سجلُّ الطالب التراكميّ",
  "circleLog.studentSessions": "الجلسات",
  "circleLog.studentAttendancePct": "نسبةُ حضوره",
  "circleLog.studentAverage": "متوسّطُ علاماته",
} as const
