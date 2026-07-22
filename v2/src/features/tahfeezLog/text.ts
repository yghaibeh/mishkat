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

export const TAHFEEZ_LOG = {
  "tahfeezLog.heading": "سجلُّ الحلقة اليوميّ",
  "tahfeezLog.scopeNote": "سجلُّ هذه الحلقة وحدها",
  "tahfeezLog.day": "اليوم",
  "tahfeezLog.student": "الطالب",
  "tahfeezLog.attendance": "الحضور",
  "tahfeezLog.present": "حاضر",
  "tahfeezLog.absent": "غائب",
  "tahfeezLog.left": "تارك",
  "tahfeezLog.excused": "مستأذن",
  "tahfeezLog.notRecorded": "لم يُسجَّل بعد",
  "tahfeezLog.memorization": "الحفظ",
  "tahfeezLog.review": "المراجعة",
  "tahfeezLog.tajweed": "التجويد",
  "tahfeezLog.enrichment": "مادةٌ إثرائية",
  "tahfeezLog.grade": "العلامة (من الحدّ المعتمد)",
  "tahfeezLog.surah": "السورة",
  "tahfeezLog.fromAyah": "من الآية",
  "tahfeezLog.toAyah": "إلى الآية",
  "tahfeezLog.record": "سجّل يومَ الحلقة",
  "tahfeezLog.recordedBy": "سجّله",
  "tahfeezLog.emptyOwner": "لم يُسجَّل يومُ حلقتك بعد — سجّل حضورَ طلابك وحفظَهم",
  "tahfeezLog.emptyViewer": "لا سجلَّ لهذا اليوم في هذه الحلقة بعد",
  "tahfeezLog.rankingHeading": "تقييمُ الحلقات الدوريّ",
  "tahfeezLog.rankingSentence": "حلقاتُ نطاقك مرتّبةً بحضورها وعلاماتها",
  "tahfeezLog.rankingScopeNote": "على هذا النطاق وحده وفي نافذته المعتمدة",
  "tahfeezLog.rankingScore": "الدرجة",
  "tahfeezLog.rankingAttendance": "نسبةُ الحضور",
  "tahfeezLog.rankingGrades": "نسبةُ العلامات",
  "tahfeezLog.rankingInactive": "حلقةٌ خاملةٌ في النافذة",
  "tahfeezLog.rankingHidden": "لا ترتيبَ يُعرض: لم تُسجَّل جلساتٌ في النافذة",
  "tahfeezLog.notesHeading": "ملاحظاتُ الإشراف على الحلقة",
  "tahfeezLog.notesScopeNote": "ملاحظاتُ هذه الحلقة وحدها",
  "tahfeezLog.noteBody": "نصُّ الملاحظة",
  "tahfeezLog.noteAuthor": "كاتبُها",
  "tahfeezLog.noteWrite": "أضِف ملاحظةً إشرافية",
  "tahfeezLog.notesReadOnly": "ملاحظاتُ المشرف تُقرأ ولا تُحرَّر",
  "tahfeezLog.notesEmptyOwner": "لا ملاحظةَ على هذه الحلقة بعد — أضِف أولَ ملاحظة",
  "tahfeezLog.notesEmptyViewer": "لا ملاحظةَ إشرافٍ على هذه الحلقة بعد",
  "tahfeezLog.guardianHeading": "روابطُ أولياء الأمور",
  "tahfeezLog.guardianIssue": "أصدِر رابطاً لوليّ أمر الطالب",
  "tahfeezLog.guardianRenew": "جدِّد الرابط",
  "tahfeezLog.guardianRevoke": "ألغِ الرابط",
  "tahfeezLog.guardianState": "حالةُ الرابط",
  "tahfeezLog.guardianExpiry": "تنتهي صلاحيتُه",
  "tahfeezLog.guardianNote": "رابطٌ للقراءة فقط لا يكشف إلا طالبَه",
  "tahfeezLog.guardianEmptyOwner": "لا رابطَ لوليّ أمرٍ بعد — أصدِر أولَ رابط",
  "tahfeezLog.mineHeading": "سجلُّ حلقاتي",
  "tahfeezLog.mineSentence": "حلقاتُك اليومَ: حضورٌ وحفظٌ وتقييم",
  "tahfeezLog.mineScopeNote": "ما أُسنِد إليك أنت وحدك",
  "tahfeezLog.mineEmptyOwner": "لا حلقةَ أُسنِدت إليك — وما يُسنَد يظهر هنا بسجلّه",
  "tahfeezLog.studentRecord": "سجلُّ الطالب التراكميّ",
  "tahfeezLog.studentSessions": "الجلسات",
  "tahfeezLog.studentAttendancePct": "نسبةُ حضوره",
  "tahfeezLog.studentAverage": "متوسّطُ علاماته",
} as const
