/**
 * قاموسُ وحدة الإشراف — SPEC_design_system §٥-٢ («نصوصُ كل مجالٍ في موضعها، لا مِلفٌّ عملاق»)
 * و`PARALLEL_WORK` §٣ («نصوصه وشاشاته **داخل وحدته**»).
 *
 * يُدمج في **طبقة النصوص المركزية** (`ui/text/dictionary.ts`) بسطرٍ واحد، فيبقى المستخدَمُ
 * لكل حرفٍ **مفتاحاً** (المادة ٢/٦) ويُدقَّق الحرفُ في موضعٍ واحد — والتصادمُ يُرفض هناك صراحةً.
 *
 * **مفرداتُ الميدان لا مفرداتُ النظام** (SPEC_role_lenses): «مَن أزور اليوم» و«بانتظار اعتمادك»
 * و«كيف تقوم وحداتي» — لا «كيان» ولا «سجلّ» ولا «حالة».
 */

export const SUPERVISION = {
  // ── لوحةُ المكلَّف (ق-٩٩/ق-١٠١) ────────────────────────────────────────────
  "supervision.boardHeading": "لوحةُ زياراتي",
  "supervision.scopeNote": "الأرقامُ على نطاقك وحدَه",
  "supervision.dueNow": "ما يستحقّ زيارةً الآن",
  "supervision.targets": "حلقاتُ نطاقك",
  "supervision.target": "الحلقة",
  "supervision.curriculum": "المنهاج",
  "supervision.status": "الحالة",
  "supervision.statusNotVisited": "لم تُزَر",
  "supervision.statusLate": "متأخرة",
  "supervision.statusRecent": "حديثة",
  "supervision.lastVisit": "آخرُ زيارة",
  "supervision.cadence": "دورةُ الزيارة بالأيام",
  "supervision.record": "سجّل زيارةً",
  "supervision.attendees": "عددُ الحاضرين",
  "supervision.rating": "التقييمُ من مئة",
  "supervision.note": "ما رأيتَه في الزيارة",
  "supervision.emptyTargets": "لا حلقةَ في نطاقك بعد",
  "supervision.emptyOwner": "ابدأ بأقدم حلقةٍ لم تُزَر — الترتيبُ بالحاجة لا بالاسم",
  "supervision.emptyTargetsViewer": "لم تُسنَد حلقاتٌ إلى هذا النطاق بعد",

  // ── صندوقُ الاعتماد (ق-١٦) ────────────────────────────────────────────────
  "supervision.pending": "زياراتٌ بانتظار اعتمادك",
  "supervision.pendingSupervisor": "مَن زار",
  "supervision.pendingDate": "يومُ الزيارة",
  "supervision.approve": "اعتمد الزيارة",
  "supervision.noPending": "لا زيارةَ تنتظر اعتمادَك الآن",
  "supervision.pendingViewer": "ما يصلك هنا زياراتُ الطبقة التي تليك مباشرةً",

  // ── العرضُ القياديّ (ق-١٠١) ───────────────────────────────────────────────
  "supervision.overviewHeading": "كيف تقوم وحداتي",
  "supervision.weakestUnit": "أضعفُ وحدةٍ تغطيةً في نطاقك",
  "supervision.openUnit": "افتح تفصيلَ الوحدة",
  "supervision.unit": "الوحدة",
  "supervision.responsible": "المسؤول",
  "supervision.visitedInCycle": "زار مشرفوها ضمن الدورة",
  "supervision.targetCount": "عددُ حلقاتها",
  "supervision.coverage": "نسبةُ التغطية",
  "supervision.vacant": "شاغرةٌ بلا مسؤول",
  "supervision.emptyOverview": "لا وحدةَ تحت نطاقك تُقاس تغطيتُها",
  "supervision.emptyOverviewViewer": "التغطيةُ تُحسب حين تُسنَد حلقاتٌ إلى وحدات نطاقك",

  // ── زياراتُ مسجدي (ق-١٠٢، عدسة الأمير) ────────────────────────────────────
  "supervision.mosqueHeading": "زياراتُ مسجدي",
  "supervision.visitDate": "تاريخُ الزيارة",
  "supervision.visitRating": "تقييمُ الزيارة",
  "supervision.approvedBy": "اعتمدها",
  "supervision.notApproved": "لم تُعتمد بعد",
  "supervision.emptyMosqueVisits": "لم يزُر مسجدَك مشرفٌ بعد",
  "supervision.emptyMosqueViewer": "الزياراتُ تظهر هنا حين يسجّلها مشرفُ نطاقك",
} as const
