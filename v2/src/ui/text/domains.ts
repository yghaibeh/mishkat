/**
 * القواميس المجالية — SPEC_design_system §٥-٢: نصوصُ كل مجالٍ في موضعها، لا مِلفٌّ عملاق.
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً**: فلا نصٌّ عربيٌّ مبعثرٌ في مكوّن (يُفشله G20)، ويُدقَّق
 * كلُّ حرفٍ يراه المستخدم في موضعٍ واحد. أسماءُ الأدوار وأنواعُ الوحدات **ليست هنا**: لها
 * معاجمُها في `lexicons.ts` بمصدرٍ واحد (§٥-٢) فلا تتكرّر صياغةٌ فتتسرّب.
 */

/** المشترك: أفعالٌ وتسمياتٌ تتكرّر في كل مجال. */
export const COMMON = {
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.confirm": "تأكيد",
  "common.submit": "إرسال",
  "common.retry": "إعادة المحاولة",
  "common.close": "إغلاق",
  "common.loading": "جارٍ التحميل…",
  "common.error": "تعذّر إتمام الطلب",
  "common.offlineQueued": "سيُرسَل عند عودة الاتصال",
  "common.required": "حقلٌ مطلوب",
  "common.search": "بحث",
  "common.more": "المزيد",
  "common.details": "التفاصيل",
  "common.sending": "جارٍ الإرسال…",
} as const

/** القشرة والتنقّل (ق-١١٤/ق-١١٥ + معجم السطوح في IA §٢.٢). */
export const SHELL = {
  "shell.skipToContent": "تخطَّ إلى المحتوى",
  "shell.mainNav": "التنقّل الرئيسي",
  "shell.notifications": "إشعاراتي",
  "shell.searchPlaceholder": "ابحث في نطاقك",
  "shell.scopeLabel": "نطاقك الحالي",
  "shell.themeToggle": "تبديل الوضع الفاتح والداكن",
  "nav.home": "الرئيسية",
  "nav.bayan": "البيان",
  "nav.education": "التعليم",
  "nav.activities": "النشاطات",
  "nav.library": "المكتبة",
  "nav.manhaj": "المنهاج",
  "nav.competition": "المسابقة",
  "nav.family": "أسرة المسجد",
  "nav.box": "الصندوق",
  "nav.centralFinance": "المالية المركزية",
  "nav.custody": "العُهد",
  "nav.media": "الإعلام",
  "nav.admin": "الإدارة",
  "nav.personal": "حسابي",
  "nav.myMosque": "مسجدي",
  "nav.myCircles": "حلقاتي",
  "nav.myCommittee": "لجنتي",
} as const

/** الحالات المشتركة: التحميل والخطأ والفراغ المُشخِّص (§٣-١/§٣-٣). */
export const STATES = {
  "state.loadingSkeleton": "جارٍ تحضير البيانات",
  "state.errorTitle": "تعذّر عرض هذه الكتلة",
  "state.errorHint": "أعد المحاولة، فإن تكرّر فأبلغ مسؤولك",
  "state.emptyOwnerTitle": "لم تُدخِل شيئاً بعد",
  "state.emptyOwnerAction": "ابدأ من هنا",
  "state.emptyViewerVacant": "الموقع شاغرٌ بلا مسؤول",
  "state.emptyViewerIdle": "المسؤول معيَّنٌ ولم يُدخِل بعد",
  "state.emptyViewerAsk": "المسؤول عن هذا ويُسأل",
  "state.deniedTitle": "لا صلاحية عرضٍ على هذا النطاق",
  "state.deniedHint": "راجع مسؤولك إن كنت تحتاجها لعملك",
  "state.newVersion": "نسخةٌ جديدة متوفرة — أعد التحميل",
  "state.offline": "أنت خارج الاتصال — يعمل التطبيق بما لديك",
} as const

/** رئيسية أمير المسجد — أسئلة صباحه الثلاثة (SPEC_role_lenses §٢.٥). */
export const AMIR_HOME = {
  "amirHome.title": "مسجدي",
  "amirHome.question.weekTarget": "أين أنا من هدف الأسبوع؟",
  "amirHome.question.todayTodo": "ماذا بقي عليّ اليوم؟",
  "amirHome.question.circlesHealth": "كيف حال حلقات مسجدي ولجانه؟",
  "amirHome.weekProgress": "نقاط أسبوعي من الهدف",
  "amirHome.weekRemaining": "بقي لهدف الأسبوع",
  "amirHome.enterDailyLog": "إدخال سجل اليوم",
  "amirHome.submitReport": "تقديم سجل المسجد",
  "amirHome.retractReport": "سحب الإقرار قبل الاعتماد",
  "amirHome.pendingMyApproval": "بانتظار إقراري",
  "amirHome.manageCircles": "حلقات مسجدي",
  "amirHome.committees": "لجان مسجدي",
  "amirHome.boxBalance": "رصيد صندوق المسجد",
  "amirHome.provisionAccount": "تمكين حسابٍ لعاملٍ في مسجدي",
  "amirHome.custodyGrant": "تسليم عهدة",
  "amirHome.emptyLog": "لم يُدخَل سجل اليوم بعد",
  "amirHome.scopeNote": "الأرقام على مسجدك وحده",
} as const

/**
 * نواةُ الدفتر المحاسبيّ — `SPEC_finance_ledger` §٦.٤ (قب-٨).
 * **الوجهُ يتبسّط**: مفرداتُ المالي البسيط («قبضتُ/دفعتُ/سلّمتُ»، «هل الدفتر سليم؟»)
 * لا مصطلحاتُ المحاسبة (مدين/دائن/يومية) — وهي خلف مدخلٍ هادئٍ واحد.
 */
export const LEDGER = {
  "ledger.heading": "الدفتر",
  "ledger.scopeNote": "الأرقام على نطاقك وحده",
  "ledger.healthQuestion": "هل الدفتر سليم؟",
  "ledger.healthBalanced": "متوازنٌ قرشاً بقرش",
  "ledger.healthBroken": "غيرُ متوازن — راجع مسؤولك فوراً",
  "ledger.balances": "أرصدةُ نطاقك بالعملات",
  "ledger.movements": "حركاتُ الدفتر",
  "ledger.voucherNo": "رقم السند",
  "ledger.amount": "المبلغ",
  "ledger.recordOperation": "تسجيلُ عملية: قبضتُ · دفعتُ · سلّمتُ",
  "ledger.proposeJournal": "اقتراحُ قيدٍ محاسبيّ",
  "ledger.deductions": "الخصومات",
  "ledger.emptyOwner": "لم تُسجَّل حركةٌ بعد — ابدأ بتسجيل عملية",
  "ledger.approvalsHeading": "مقترحاتٌ بانتظار بتّك",
  "ledger.approvalRequester": "مَن اقترحها",
  "ledger.approve": "اعتماد",
  "ledger.reject": "رفضٌ بسببٍ يصل المقترِح",
  "ledger.emptyApprovals": "لا مقترحَ ينتظر بتَّك — لا شيء عليك الآن",
} as const

/**
 * شاشةُ اقتراح العملية / القيد المزدوج (`SPEC_finance_ledger` §٩) — **مفاتيحُ نصٍّ لا شاشة**.
 *
 * أُضيفت لمهمة T27 (قياسُ إطار الواجهة على أثقل شاشةٍ تفاعلاً): المكوّنُ يستقبل **مفتاحاً
 * لا حرفاً** (§٥)، فقياسُ الشاشة بحمولةِ نصوصها الحقيقية يوجب وجودَ مفاتيحها هنا — وإلا
 * قِيست شاشةٌ بلا نصٍّ فانحرفت البايتات. **والشاشةُ نفسُها لم تُبنَ في `src/`** (قب-٢٦:
 * تُعرَّف ولا تُبنى) — هذه مفاتيحُها وحدها، وهي أثرٌ إضافيٌّ محضٌ لا ينقض قراراً.
 *
 * ومفرداتُها **مصطلحُ المحاسبة** (مدين/دائن/يوميّة) عن قصد: هذا هو الوجهُ المتقدّم خلف
 * المدخل الهادئ (قب-٨) لا وجهُ الماليّ البسيط — و«أثقلُ شاشةٍ تفاعلاً» هي هذه لا تلك.
 */
export const LEDGER_JOURNAL = {
  "journal.title": "اقتراحُ قيدٍ محاسبيّ جديد",
  "journal.scopeNote": "القيدُ على وحدتك، والاعتمادُ عند مسؤولك",
  "journal.date": "تاريخُ العملية",
  "journal.memo": "بيانُ العملية",
  "journal.sourceType": "مصدرُ الحدث",
  "journal.lines": "أسطرُ القيد",
  "journal.account": "الحساب",
  "journal.unit": "الوحدةُ التنظيمية",
  "journal.currency": "العملة",
  "journal.side": "الطرف",
  "journal.debit": "مدين",
  "journal.credit": "دائن",
  "journal.amount": "مبلغُ السطر",
  "journal.fund": "الصندوقُ الشرعيّ",
  "journal.addLine": "إضافةُ سطرٍ إلى القيد",
  "journal.removeLine": "حذفُ هذا السطر",
  "journal.balanceQuestion": "هل يوازن القيدُ في كل عملة؟",
  "journal.balanced": "موازنٌ في كل عملةٍ على حدة",
  "journal.unbalanced": "لم يوازن بعدُ — الفرقُ مبيَّنٌ لكل عملة",
  "journal.difference": "فرقُ العملة",
  "journal.submit": "اقتراحُ القيد للاعتماد",
  "journal.queued": "مقترحُك محفوظٌ ويُرسَل عند عودة الاتصال",
  "journal.errCurrencyNotEnabled": "عملةٌ غيرُ مسموحةٍ على نطاقك",
  "journal.errPeriodLocked": "التاريخُ داخل مدةٍ مقفلة — راجع مسؤولك",
  "journal.errRestrictedOverspend": "لا يجوز صرفُ المقيَّد فيما يتجاوزه",
  "journal.errPenalDeduction": "الخصمُ العقابيُّ ممنوع — الاستحقاقُ دالةُ المنجَز",
  "journal.errTooFewLines": "القيدُ لا يقلّ عن سطرين",
  "journal.errZeroLine": "سطرٌ بمبلغٍ صفريّ لا يُقترح",
} as const

/**
 * الصندوقُ الهرميّ ومالية المسجد — عقدُ وحدة `box` (ب-٧/ب-٩، قب-٨).
 * **الوجهُ يتبسّط**: «قبضتُ · صرفتُ · سلّمتُ» و«رصيدُ صندوقي» — لا مدينَ ولا دائنَ ولا يوميّة؛
 * والقيدُ المزدوجُ يجري تحتها لا أمامها.
 */
export const BOX = {
  "box.heading": "الصندوق",
  "box.scopeNote": "الأرقام على صندوق وحدتك وما تحتها",
  "box.derivedNote": "كلُّ رقمٍ هنا مشتقٌّ من الدفتر لحظتَه",
  "box.balance": "رصيدُ الصندوق",
  "box.incoming": "الوارد",
  "box.outgoing": "الصادر",
  "box.movements": "آخرُ حركات الصندوق",
  "box.voucherNo": "رقمُ السند",
  "box.amount": "المبلغ",
  "box.currency": "العملة",
  "box.receive": "قبضتُ",
  "box.spend": "صرفتُ",
  "box.handover": "سلّمتُ نازلاً",
  "box.category": "فئةُ الصرف",
  "box.destinationUnit": "الوحدةُ المستلِمة",
  "box.recipientCustodian": "أمينُ الوحدة المستلِمة",
  "box.childBoxes": "صناديقُ الوحدات تحتك",
  "box.handoversHeading": "التسليماتُ وإقرارُها",
  "box.handoverFrom": "من",
  "box.acknowledge": "أقرُّ استلامي",
  "box.acknowledged": "أُقرَّ الاستلام",
  "box.pendingAck": "تسليمٌ ينتظر إقرارك",
  "box.emptyOwner": "لم تُسجَّل حركةٌ في صندوقك بعد — ابدأ بتسجيل قبض",
  "box.emptyChildBoxes": "لا وحدةَ تحتك بصندوق",
  "box.emptyHandovers": "لا تسليمَ ينتظر إقرارك — لا شيءَ عليك الآن",
  "box.emptyMovements": "لم تُسجَّل حركةٌ بعد",
  "mosqueFinance.heading": "ماليةُ مسجدي",
  "mosqueFinance.scopeNote": "الأرقام على مسجدك وحده",
  "mosqueFinance.balance": "رصيدُ مسجدي",
  "mosqueFinance.record": "تسجيلُ عملية: قبضتُ · صرفتُ",
  "mosqueFinance.emptyOwner": "لم تُسجَّل حركةٌ في مسجدك بعد — سجّل قبضاً أو صرفاً",
} as const

/**
 * سجلُّ اليوم والنقاط وكتالوج الأنشطة — عقدُ وحدة `dailyLog` (ب-٦/ب-٣٩ج، ق-٤٠…ق-٤٦).
 * **مفرداتُ المُدخِل لا مفرداتُ المحاسب**: «أدخلتُ · بقي لهدفي · عددُ أسرتي» — والقواعدُ
 * (السقفُ والعتبةُ والتصنيف) تجري تحتها لا أمامها.
 */
export const DAILY_LOG = {
  "dailyLog.heading": "سجلُّ اليوم",
  "dailyLog.scopeNote": "الأرقام على وحدتك وحدها",
  "dailyLog.weekPoints": "نقاطُ الأسبوع من الهدف",
  "dailyLog.target": "هدفُ الفترة",
  "dailyLog.tier": "تصنيفُ المسجد",
  "dailyLog.tierExcellent": "متميّز",
  "dailyLog.tierBelow": "دون الهدف",
  "dailyLog.tierStruggling": "متعثّر",
  "dailyLog.entries": "قيودُ الأسبوع",
  "dailyLog.activity": "النشاط",
  "dailyLog.count": "العدد",
  "dailyLog.points": "النقاط",
  "dailyLog.record": "أدخلتُ نشاطاً",
  "dailyLog.attendees": "عددُ الحاضرين",
  "dailyLog.freeActivity": "نشاطٌ خارج القائمة",
  "dailyLog.freeActivityNote": "يُوثَّق بلا نقاطٍ آلية، ويراه معتمِدُ السجل فيقرّر",
  "dailyLog.familyRoster": "عددُ طلاب أسرة المسجد",
  "dailyLog.setFamilyRoster": "اضبط عدد طلاب الأسرة",
  "dailyLog.rosterUnset": "لم يُضبط عددُ طلاب الأسرة — الأنشطةُ المشروطة بلا نقاطٍ حتى يُضبط",
  "dailyLog.submit": "تقديمُ سجل الأسبوع للاعتماد",
  "dailyLog.retract": "سحبُ الإقرار قبل الاعتماد",
  "dailyLog.zeroHarvest": "لا إدخالَ في نطاقك بعد — ذكّر مساجدك ثم قدِّم",
  "dailyLog.emptyOwner": "لم يُدخَل سجلُ اليوم بعد — ابدأ بتسجيل نشاط",
  "dailyLog.emptyEntries": "لا قيدَ في هذا الأسبوع بعد",
  "catalog.heading": "كتالوجُ الأنشطة",
  "catalog.scopeNote": "الكتالوجُ مرجعٌ مركزيٌّ على الشبكة كلِّها",
  "catalog.scheme": "المخطّط",
  "catalog.activity": "النشاط",
  "catalog.weight": "الوزنُ بالنقاط",
  "catalog.maxPerDay": "السقفُ اليوميّ",
  "catalog.requiresParticipation": "يشترط عتبةَ الحضور",
  "catalog.active": "مُفعَّل",
  "catalog.validFrom": "يسري من",
  "catalog.upsert": "أضف نشاطاً أو عدّل وزنَه",
  "catalog.emptyOwner": "لا نشاطَ في الكتالوج بعد — أضف أوّلَ نشاط",
} as const

/** الشجرة والحسابات (وحدة org القائمة). */
export const ORG = {
  "org.treeHeading": "الشجرة التنظيمية",
  "org.createUnit": "إنشاء وحدة",
  "org.archiveUnit": "أرشفة وحدة",
  "org.createAccount": "إنشاء حساب عاملٍ في وحدتك",
  "org.assignments": "الإسنادات في نطاقك",
  "org.endAssignment": "إنهاء تكليف",
  "org.suspendedLayer": "طبقةٌ موقوفةٌ بمفتاح تفعيل",
  "org.username": "اسم المستخدم",
  "org.password": "كلمة المرور",
} as const
