/**
 * قاموسُ نصوص المسابقة — **داخل الوحدة** (قب-٣١ §٣: نصوصُ الوكيل في وحدته لا في ملفٍّ مشترك)،
 * ويُدمج في الطبقة المركزية الواحدة (`ui/text/dictionary.ts`) حيث يُفحص التصادمُ صراحةً.
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً** (SPEC_design_system §٥-٣، G20)، فالنصُّ هنا **كتالوجُ
 * تدقيقٍ لغويّ** لا موضعُ عرض.
 *
 * و**مفرداتُ الميدان لا مفرداتُ النظام**: «المسابقة · المتبارِي · صندوقُ الالتحاق · لوحةُ
 * الترتيب». ولا كلمةَ «صرف» ولا «مستحق» في هذا القاموس إطلاقاً: **الجائزةُ تُعلَن ولا تُصرف**
 * (قب-٤٥)، والمالُ لسانُه وحدةٌ أخرى. وأسماءُ أنواع التنقيط والفئات **بياناتٌ** يدخلها
 * المستخدم — فلا مفتاحَ نصٍّ لنوعٍ بعينه هنا.
 */

export const COMPETITION = {
  "competition.heading": "المسابقة",
  "competition.scopeNote": "مسابقاتُ نطاقك وما فوقه وما تحته — لا مسابقاتِ الجيران",
  "competition.titleLabel": "اسمُ المسابقة",
  "competition.scopeLabel": "نطاقُ المسابقة",
  "competition.statusLabel": "الحالة",
  "competition.startMonth": "شهرُ البدء (هجريّ)",
  "competition.endMonth": "شهرُ الانتهاء (هجريّ)",
  "competition.windowOpens": "يفتحُ التسجيل",
  "competition.windowCloses": "يُغلقُ التسجيل",
  "competition.create": "أنشِئ مسابقة",
  "competition.advance": "انقُل إلى الحالة التالية",
  "competition.cancel": "ألغِ المسابقة",
  "competition.cancelReason": "سببُ الإلغاء",
  "competition.categoryLabel": "الفئة",
  "competition.categoryDefine": "أضِف فئة",
  "competition.ageMin": "أدنى سنّ",
  "competition.ageMax": "أقصى سنّ",
  "competition.scoringTypeLabel": "نوعُ التنقيط",
  "competition.scoringTypeDefine": "أضِف نوعَ تنقيط",
  "competition.weightLabel": "الوزن",
  "competition.reweigh": "أعِد التوزين بأثرٍ قادم",
  "competition.stageDefine": "أضِف مرحلةً بمعيارها",
  "competition.awardDeclare": "أعلِن جائزة",
  "competition.awardNote": "الجائزةُ تُعلَن هنا، وصرفُها بمسار المال وحده",
  "competition.contestants": "المتبارون",
  "competition.pending": "طلباتٌ معلّقة",
  "competition.leaderboard": "لوحةُ الترتيب",
  "competition.rank": "الرتبة",
  "competition.points": "الرصيد",
  "competition.statsSentence": "مسابقاتُ نطاقك القائمة",
  "competition.statsScopeNote": "العددُ على هذا النطاق وحده",
  "competition.resultDeclare": "أعلِن الفائزين",
  "competition.resultAdvance": "نفِّذ معيارَ الصعود",
  "competition.resultNote": "الإعلانُ فعلٌ لا رجعة فيه، ويُجمِّد جدولَ الفائزين",
  "competition.inboxHeading": "صندوقُ التحاق مسجدي",
  "competition.inboxScopeNote": "طلباتُ مسجدك وحدَه — لا طلباتِ مسجدٍ آخر",
  "competition.inboxSentence": "طلباتٌ تنتظر بتَّك",
  "competition.applicantName": "اسمُ المتقدّم",
  "competition.applicantPhone": "هاتفُ المتقدّم",
  "competition.approve": "اقبَل الطلب",
  "competition.reject": "ارفُض الطلب",
  "competition.rejectReason": "سببُ الرفض (يراه المتقدّم)",
  "competition.addByLeader": "أضِف ملتحقاً مباشرةً",
  "competition.inviteIssue": "أصدِر رابطَ دعوة",
  "competition.inviteRevoke": "أبطِل رابطَ الدعوة",
  "competition.inviteExpires": "تنتهي صلاحيةُ الرابط",
  "competition.inviteNote": "الرمزُ هويةُ حاملِه، ويُستعمل مرّةً واحدة",
  "competition.scoreRecord": "ارصُد حدثَ تنقيط",
  "competition.scorePeriod": "الفترة (هجريّة)",
  "competition.scoreValue": "القيمة",
  "competition.excuse": "عذرٌ مقبول",
  "competition.excuseReason": "سببُ العذر",
  "competition.excuseNote": "العذرُ يُسجَّل ولا يُنقص الرصيد",
  "competition.emptyOwner": "لا مسابقةَ في نطاقك بعد — أنشِئ أولَ مسابقة",
  "competition.emptyScope": "لا مسابقةَ تخصُّ هذا النطاق بعد",
  "competition.emptyInbox": "لا طلبَ ينتظر بتَّك — وما يَرِد يظهر هنا",
} as const
