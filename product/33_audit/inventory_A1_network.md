# جرد A1 — لوحة الشبكة وصفحة المسجد (تدقيق UX مشكاة)

المصادر المفحوصة:
- `/Users/muhammad/alraqeem/projects/influential_masjid/app/src/components/network/NetworkPage.tsx` (لا يوجد مجلد unit-tree — الشجرة مطوية داخل هذا الملف الواحد)
- `/Users/muhammad/alraqeem/projects/influential_masjid/app/src/routes/network.tsx`, `network.index.tsx`, `network.$unitId.tsx`
- `/Users/muhammad/alraqeem/projects/influential_masjid/app/src/routes/mosque.$mosqueId.tsx` + `src/components/mosque/MosquePage.tsx` + `LessonsTab.tsx`
- `src/components/report/*` (ReportHeader, KpiCard, WeeklyTable, ActivityList, FormulaNote, ReportActions)
- `src/components/daily-log/DailyLogPage.tsx`
- المشتركة: `registration/RegistrationInbox.tsx`, `circles/CircleRankings.tsx`, `circles/WeeklyHalaqaPanel.tsx`, `mosque-finance/MosqueFinancePage.tsx (TxnPanel)`, `tahfeez/TahfeezDailyRegister.tsx`
- الخادم: `src/server/data.server.ts`, `supervision.server.ts`, `registration.server.ts`, `src/lib/api/network.ts`, `src/lib/mosque-tabs.ts`, `src/lib/access.ts`

شروط الدخول للمسارات:
- `/network`: حارس `canAccess("/network", caps)` أي قدرة `network.view` (وإلا تحويل لأول صفحة مسموحة).
- `/mosque/$mosqueId`: تسجيل دخول فقط في `beforeLoad`؛ **عزل النطاق يتم خادمياً** (`mosqueOverviewData`/`mosqueReportData` تعيد null لمن ليس المسجد ضمن `orgPath` تكليفه وليس مدير `*`).

---

## الشاشة ١ — لوحة الشبكة (متصفّح الوحدات) `NetworkPage → Browser`

| العنصر | ما يعرضه بالضبط | شرط الظهور | مصدر البيانات |
|---|---|---|---|
| مبدّل القسمين (MTabs) | «قسم الذكور» / «قسم النساء» | `hasCap(caps,"*")` **و** `scopeType === "root"` (الإدارة العليا على الجذر فقط) | `getNetwork({section})` → `networkData` |
| مسار التنقّل (Breadcrumbs) | «كل الشبكة › منطقة › مربع…» | دائماً | `networkData.breadcrumbs` |
| ترويسة النطاق | اسم النطاق + شارة النوع («لوحة الشبكة»/«منطقة»/«مربع») + «N وحدة · M مسجداً ضمن النطاق» | دائماً | `networkData.scopeName/childCount/kpis.mosques` |
| زرّا التصدير PDF / CSV (RollupExport) | «PDF» و«CSV» — يولّد تقريراً قيادياً | `hasCap(caps,"*")` **أو** `hasCap(caps,"report.approve")` | `exportNetworkRollup` → `networkRollupData/Html/Csv` |
| صندوق طلبات الانضمام (RegistrationInbox) | «طلبات الانضمام» + عدّاد + لكل طلب: الاسم، نوع الطلب، الوحدة/المسجد المقترح، هاتف، ملاحظة، زرّا «قبول»/«رفض» + حقل سبب الرفض الإلزامي + تحذير «الوحدة الهدف لم تعد نشطة» | وجود طلبات ضمن نطاق المستخدم (`canApprove` حسب الطبقة المغطّية) — يختفي إن كانت القائمة فارغة | `getPendingRegistrations` → `pendingRegistrationsData` |
| صندوق «بانتظار اعتمادك» (PendingApprovals) | لكل وحدة مُقدَّمة: الاسم، النوع، «N أسبوع · M نقطة — قُدِّم للاعتماد»، زر «اعتماد نهائيّ»، زر «لا يُعتمد» + تعليل إلزامي، رابط تفاصيل (مسجد ⇒ `/mosque?t=report`، طبقة ⇒ `/network/$unitId`) | مدير أو صاحب دور إشرافي (SQUARE/RABITA/SECTION_HEAD) **و** هو «الطبقة الأقرب» (`via === "nearest"`) لسجلات بحالة `amir_approved` — الإدارة لا ترى هذا الصندوق الروتيني | `getPendingApprovals` → `pendingApprovalsData` |
| صندوق «كسر الزجاج» (PendingApprovals breakGlass) | «بلا معتمِدٍ مُعيَّن (اعتمادٌ استثنائيّ)» بإطار أحمر + نفس أزرار الاعتماد/الرفض + تلميح «عيِّن مسؤولًا…» | `isGlobalAdmin` فقط، ووجود سجلات مُقدَّمة طبقتها الإشرافية شاغرة (`approverLayerFor → vacant`) | `getBreakGlassApprovals` → `pendingBreakGlassData` |
| بطاقة الإشراف الميداني (SupervisionDueCard) | «الإشراف الميدانيّ: N حلقةً تحتاج زيارتك» + «X لم تُزَر بعد · Y تجاوزت دورة الثلاثين يومًا» + زر «السجل الإشرافيّ ←» (يذهب `/ala-baseera?tab=supervision`) | وجود حلقات قابلة للإشراف للمستخدم و`never+overdue > 0` | `getSupervisionDashboard` → `supervisionDashboardData().summary` |
| بطاقة تقرير الطبقة (LayerReportAction) | «تقرير {مربع/منطقة} — {الاسم}» + «حصيلة نطاقك هذا الأسبوع: N نقطة» + زر «تقديم للاعتماد» أو شارة «مُقدَّم — بانتظار اعتماد الأعلى» أو «معتمَدٌ نهائيًّا» | وحدة من نوع rabita/square/section **و** المستخدم مالكها (تكليف على الوحدة نفسها) أو مدير — لا تظهر على الجذر | `getLayerReportStatus` / `submitLayerReport` → `layerReportStatusData` |
| بطاقة «نسبة الإدخال هذا الأسبوع» (خضراء كبيرة) | النسبة % + «X من Y مسجداً أدخلوا سجلهم هذا الأسبوع · انقر للتفاصيل» — النقر يرشّح القائمة على «الكل» ويهبط إليها | دائماً | `networkData.kpis.enteredPct/mosques` |
| شريط «توزيع حالة المساجد» | شريط مكدّس (أخضر/أصفر/أحمر) + «الهدف 70 نقطة» + ثلاث Legend قابلة للنقر: «مكتمل N» (→الأعلى) «دون الهدف N» (→الكل!) «متعثّر N» (→متعثرة) | دائماً | `networkData.kpis.done/below/struggling` |
| بطاقات المؤشرات ×3 (StatCard) | «المساجد N» / «متوسط النقاط N /70 (X% من الهدف)» / «مساجد متعثّرة N — يحتاج دعماً» — كلها أزرار ترشيح | دائماً | `networkData.kpis` |
| قسم «يحتاج انتباهك» ×3 (AttnItem) | «مساجد متعثّرة N» / «مساجد متأخرة N» / «طلبات منح أدوار N» (رابط `/admin`) | `attention != null` = **مدير عام على الجذر فقط** (`!unit && isGlobalAdmin`) | `networkData.attention` (يضم `roleAssignments.approvalStatus="pending"`) |
| قائمة الوحدات + الفلاتر | ترويسة {childLabel} + أزرار «الكل · N» / «متعثّرة» / «الأعلى» + لكل صف (ChildRow): أيقونة النوع، الاسم، (محافظة أو «نوع · N مسجداً»)، «N حلقة» بالأخضر، «N على بصيرة» بالذهبي، «N متعثّر» بالأحمر، شريط «الإدخال %»، «متوسط /70» | دائماً (حالة فارغة: «لا وحدات مطابقة.») | `networkData.children` |
| شريط «الحلقات حسب النوع» (CircleStatsStrip) | «الحلقات حسب النوع · N حلقة» + 4 بطاقات (أنواع CIRCLE_TYPES) بعدّاد لكل نوع — كل بطاقة رابط إلى `/ala-baseera` | `circlesTotal > 0` | `networkData.circleStats/circlesTotal` |
| قسم «ماذا في كل منطقة» (RegionsSection) | لكل محافظة: الاسم + «N مسجد» + «N حلقة» | `regions.length > 0` (تأتي دائماً من الخادم لأي نطاق) | `networkData.regions` |
| «لمحات الوحدات» ×4 (GlimpseCard) | «المالية $N — مستحقات آخر شهر» (→`/finance`) / «على بصيرة N حلقة» (→`/ala-baseera`) / «المسابقة N مشترك» (→`/competition`) / «المستخدمون N حساب» (→`/admin`) | `glimpses != null` = **مدير عام على الجذر فقط** | `networkData.glimpses` (عدّ كامل لجداول users/halaqat/participants/monthlyEntitlements) |

**عدد عناصر الشاشة: 17 عنصراً رئيسياً** (منها ~40 عنصراً فرعياً قابلاً للنقر).

### الشاشة ١-ب — ورقة المسجد داخل الشبكة (`MosqueLeaf`)

| العنصر | ما يعرضه | شرط الظهور | مصدر البيانات |
|---|---|---|---|
| Breadcrumbs + حالة فارغة | «{اسم المسجد} — لا سجلات لهذا المسجد بعد.» | `data.leaf === true` و`report == null` | `networkData` (leaf) |
| تقرير كامل (ReportHeader + 3 KPI + WeeklyTable + FormulaNote + ActivityList + ReportActions) | نفس تبويب «التقرير الشهري» في صفحة المسجد حرفياً | `report != null` — **لا يتحقق عملياً أبداً**: `network.$unitId` يعيد التوجيه لأي leaf إلى `/mosque/$mosqueId`، و`network.index` يمرّر `report: null` دائماً | لا شيء يمرَّر |

⚠️ **كود شبه ميت**: فرع التقرير في `MosqueLeaf` (NetworkPage.tsx:632-678) غير قابل للوصول — تكرار كامل لـ`ReportTab` في MosquePage بلا مستهلك.

---

## الشاشة ٢ — صفحة المسجد `/mosque/$mosqueId` (`MosquePage`)

التبويبات (من `mosqueTabs` في `src/lib/mosque-tabs.ts` — القدرة + مفتاح الميزة `features`):
`overview` (دائماً) · `daily` (dailyLog.view) · `report` (report.view) · `circles` (circles.view+feature) · `finance` (mosqueFinance.view) · `halaqat` (alaBaseera.view+feature) · `tahfeez` (tahfeez.view+feature) · `lessons` (dailyLog.view+feature lessons) · `meetings` (meetings.view+feature) · `committees` (committees.view+feature).
الهبوط الافتراضي: طاقم المسجد (`homeMosqueId === mosqueId`) ⇒ «سجل اليوم»؛ الزائر ⇒ «نظرة».

| العنصر | ما يعرضه بالضبط | شرط الظهور | مصدر البيانات |
|---|---|---|---|
| مسار التنقّل | سلسلة الشبكة حتى المسجد | **الزائر المشرف فقط** (`!isOwn`) | `getMosqueOverview.breadcrumbs` |
| ترويسة المسجد | اسم المسجد + سطر («أسرة المسجد»/«مسجد نساء» للطاقم؛ مسار الوحدات للزائر) + شارة حالة الأسبوع («معتمد نهائياً»/«اعتمده الأمير»/«مسودة») | الشارة إن وُجد سجل أسبوعي | `mosqueOverviewData.week.status` |
| **تبويب نظرة** — 3 بطاقات | «نقاط الأسبوع الأخير N/70 + %» / «أعضاء أسرة المسجد N» / «آخر إدخال (اليوم/قبل N يوم/—)» | دائماً | `mosqueOverviewData` |
| نظرة — روابط سريعة | «عرض التقرير الشهري» / «إدخال سجل اليوم» / «المالية الداخلية» | حسب وجود التبويب المقابل للمستخدم | — |
| **تبويب التقرير الشهري** — سطر الشهر + شارة التصنيف | «الشهر: {هجري}» + شارة `influenceTier`: «مسجد مؤثر — متميّز» (≥100%) / «دون الهدف» (50-99) / «متعثّر — يحتاج دعماً» (<50) | `report != null` (وإلا «لا سجلات لهذا المسجد بعد.») | `getMosqueReport` → `mosqueReportData` |
| التقرير — ReportActions | زر «تصدير PDF» (window.print) + زر «اعتماد التقرير»/«الاعتماد النهائي»/«معتمد نهائياً» | زر الاعتماد فعّال إذا `canAmirApprove` (أمير المسجد وفيه مسودات) أو `canLayerApprove` (طبقة مغطّية وفيه draft/amir_approved)؛ الزر يظهر معطّلاً رمادياً للبقية | `mosqueReportData.approval` / `approveMosqueMonth` |
| التقرير — 3 بطاقات KPI | KpiProgressCard «مجموع نقاط الشهر N/الهدف + شريط» · KpiPercentCard «نسبة تحقيق الهدف % — مقارنةً بالهدف الشهري» · KpiAmountCard «القيمة المستحقة (تقديرية) $N — تُصرف بعد الاعتماد النهائي.» | مع التقرير | `mosqueReportData.kpis` |
| التقرير — WeeklyTable | «سجل النقاط الأسبوعي» + **«آخر تحديث: منذ ساعتين» (نص ثابت مزيّف!)** + صفوف الأسابيع (نقاط/هدف، شارة مكتمل/دون الهدف، ملاحظة اعتماد/رفض) + زر «رفض» لكل أسبوع + نموذج سبب الرفض | زر الرفض: `canLayerReject` = طبقة مغطّية والأسبوع `amir_approved` | `mosqueReportData.weeklyRows` / `rejectMosqueWeek` |
| التقرير — FormulaNote | «معادلة احتساب النقاط: 280 نقطة = 50$ · تُصفَّر النقاط تلقائياً…» (ثابت في الكود) | مع التقرير | ثابت |
| التقرير — ActivityList | «تفصيل الأنشطة»: اسم، «N مرة · X/Y نقطة»، نسبة % وشريط — **لكن target = points نفسها** (السطر 263 في data.server.ts) فتظهر كل الأنشطة 100% دائماً | مع التقرير | `mosqueReportData.activities` |
| **تبويب سجل اليوم** | `DailyLogPage` مضمّنة (انظر الشاشة ٣) — قراءة فقط إن لم يكن `isOwn && dailyLog.edit` | `dailyLog.view` | `getDailyActivities` |
| **تبويب الحلقات** — 4 بطاقات KpiTile | عدّاد لكل نوع حلقة (CIRCLE_TYPES) | `circles.view` | `getMosqueCircles` |
| الحلقات — رقائق ترشيح + نموذج إضافة | نوع/مسار رجال-نساء/اسم/سعة/معلّم + زر «إضافة» | النموذج: `circles.manage` | `createCircle`, `getMosqueTeacherOptions` |
| الحلقات — صفوف | اسم + «نساء» + نوع + معلّم أو تحذير «بلا معلّم» + زر «N/سعة طالب» (يفتح الطلاب) + زر أرشفة + محدد تعيين المعلّم مع تنبيه «التعيينُ يُكمل ربطَها…» | الأرشفة/التعيين: `circles.manage` | `updateCircle`, `archiveCircle`, `getCircleStudents`, `addCircleStudent`, `removeCircleStudent` |
| **تبويب المالية الداخلية** — 3 بطاقات | «إجمالي التبرّعات $» / «إجمالي المصروفات $» / «الرصيد (تبرّعات − مصروفات) $» (بطاقة خضراء) | `mosqueFinance.view` | `getMosqueFinance` |
| المالية — TxnPanel ×2 | لوحتا «التبرّعات» و«المصروفات» مع **نماذج إدخال معاملات ظاهرة لكل من يملك view** (لا حراسة canManage في الواجهة) | `mosqueFinance.view` | `getMosqueTxns`, `addDonation`, `addExpense` |
| **تبويب على بصيرة** — 3 KpiTile + قائمة | «حلقات المسجد» / «طلاب مسجّلون» / «إجمالي ساعات الدروس» + صفوف الحلقات (معلّم · مكان) + «تحميل المزيد (N)» | `alaBaseera.view` | `getMosqueHalaqat` |
| على بصيرة — «التقييم الأسبوعي» (WeeklyHalaqaPanel) | زر لكل حلقة يفتح لوحة التقييم | `alaBaseera.manage`؛ غير المدير يرى «N/سعة طالب» بدلاً منه | `alaBaseera` weekly APIs |
| **تبويب التحفيظ** — CircleRankings | «ترتيب حلقات المسجد» 🥇🥈🥉 «حضور % · متوسّط العلامات · N جلسة» + شارة «خاملة» + score/100 | حلقتان فأكثر في الترتيب (`items.length >= 2`) | `getCircleRankings` |
| التحفيظ — 3 KpiTile + إضافة حلقة + صفوف | «حلقات التحفيظ/طلاب التحفيظ/سجلّات المتابعة» + نموذج «اسم حلقة جديدة» + لكل حلقة زرّا «سجلّ اليوم» (TahfeezDaily: حضور/حفظ/مراجعة/تجويد) و«N طالب» (قائمة الطلاب + متابعة المحفوظ «المحفوظ تقديراً N آية» + نموذج مقطع/من/إلى/تقييم) | الإضافة/الحذف: `tahfeez.manage` | `getTahfeez`, `createTahfeezCircle`, `getTahfeezStudents`, `getTahfeezProgress`, `getTahfeezSession`, `saveTahfeezDaily` |
| **تبويب الدروس** (LessonsTab) | ثلاثة أقسام «جلسات اليوم» (مُبرزة) / «الجدول القادم» / «الدروس المُلقاة» + شارات مجدول/مؤكَّد/أُلقي + «N حاضر» + زر «الحضور» + زر «طباعة الجدول» + «درسٌ جديد» + أزرار تأكيد/أُلقي/إلغاء + كشف تعارض المواعيد | الإدارة: للطاقم `dailyLog.edit`، **وللزائر `hasCap(caps,"*")`** | `getMosqueLessons`, `saveLesson`, `setLessonStatus`, `getLessonAttendance` |
| **تبويب الاجتماعات** — 3 KpiTile | «عدد الاجتماعات» / «قرارات الشورى» / «آخر اجتماع (تاريخ هجري)» | `meetings.view` | `getMeetings` |
| الاجتماعات — نموذج + بطاقات | نوع دورية/طارئة + تاريخ + حضور + محضر + زر «تسجيل الاجتماع»؛ لكل اجتماع: محضر (تحرير/عرض) + قرارات (ملزمة/معلِمة) + إضافة/حذف قرار | التحرير: `meetings.manage` | `createMeeting`, `setMeetingMinutes`, `addDecision`, `removeDecision` |
| **تبويب اللجان** — 3 KpiTile | «عدد اللجان» / «لجان مُسنَدة لمسؤول» / «بنود الخطة» | `committees.view` | `getCommittees` |
| اللجان — تشكيل + بطاقات | نموذج «تشكيل لجنة (اسمٌ حرّ)» + اقتراحات 8 أسماء + لكل لجنة: شارة رئيسية/فرعية، «المسؤول: X»/«بلا مسؤول»، «N بند»، **تعيين مسؤول بإنشاء حساب دخول (اسم دخول + كلمة مرور)**، بنود الخطة (مستمر/شهر هجري) مع تبديل الحالة | الإدارة: `committees.manage`؛ نموذج التعيين يظهر إن لم يكن للجنة حساب مسؤول | `createCommittee`, `assignCommitteeHead`, `addCommitteePlan`, `setCommitteePlanStatus` |

**عدد العناصر: ترويسة + 10 تبويبات ≈ 26 عنصراً رئيسياً** (وأكثر من 60 عنصراً فرعياً تفاعلياً).

---

## الشاشة ٣ — سجل اليوم (`DailyLogPage` — تُعرض فقط مضمّنة في تبويب المسجد)

| العنصر | ما يعرضه بالضبط | شرط الظهور | مصدر البيانات |
|---|---|---|---|
| شريط الحالة | شارة «مسودة — بانتظار الاعتماد» + «يعمل دون اتصال» + أزرار حفظ سطح المكتب | `!readOnly` (embedded)؛ في الوضع المستقل ترويسة كاملة بتاريخ هجري | — |
| شارة/تنويه «عرض فقط» | «عرض أنشطة هذا المسجد المعتمَدة وأوزانها (للاطّلاع الإشرافي)…» | `readOnly` (زائر بلا `dailyLog.edit` أو ليس مسجده) | — |
| بطاقة «نقاط اليوم» | مجموع نقاط الإدخالات الحالية + «N عملية مُدخلة في M نشاطاً» | دائماً | حساب محلي |
| بطاقة «مجموع الأسبوع» | **`PRIOR_WEEK = 41` ثابت في الكود + نقاط اليوم** / الهدف الأسبوعي + % + شريط | دائماً | **رقم وهمي — ليس من الخادم** |
| بطاقة «القيمة التقديرية للأسبوع» | `$ (weekPts × 50/280)` + «تُحتسب بعد اعتماد التقرير الشهري من الأمير العام.» | دائماً | حساب محلي (RATE ثابت) |
| «طلاب الأسرة المسجّلون» + شارة «قاعدة ٧٠٪ معطّلة — حدّد العدد» | حقل رقم يضبط مرجع عتبة التزام الصلوات | الشارة: `familySize == null && !readOnly` | `getFamilyStudents` / `setFamilyStudents` |
| قائمة الأنشطة | لكل نشاط: الاسم، «N نقطة للمرة»، «بحدّ N في اليوم»، «تُحسب إن شارك ≥X٪…»، تحذير أحمر «لن تُحسب حتى تحدّد عدد طلاب الأسرة»، +Earned، عدّاد +/− وحقل كتابة، وعند count>0 عدّاد «عدد المشاركين من الطلاب» | الأنشطة من قاعدة البيانات حسب المسار (رجال/نساء من `genderTrack`)؛ العدّادات معطّلة في `readOnly` | `getDailyActivities` (loader المسجد) |
| ملاحظة المعادلة | «الهدف الأسبوعي N نقطة · المعدّل الشهري 280 نقطة = 50$ · يُنسب الاستحقاق لأمير المسجد بعد اعتماد الشورى.» | دائماً | weekTarget من الخادم + ثوابت |
| إقرار الشورى | Checkbox «أُقرّ أنّ هذه الأنشطة تمّت بإشراك أسرة المسجد وبالشورى.» + «ملاحظات اليوم» + تحذير «دون الإقرار يُحفظ السجل كمسودة ولا تُحتسب النقاط.» | التحذير عند `!shura` | حفظ عبر outbox (`enqueue("daily_entry")`) |
| توثيق أنشطة اليوم (صور) | «N صورة» + شبكة صور + حذف + منطقة رفع «إضافة صور · حتى ٥ ميغابايت» | `att != null` (canView خادمياً)؛ الرفع/الحذف: `att.canUpload` | `getDailyAttachments`, `/api/media/upload`, `deleteDailyAttachment` |
| أزرار الحفظ | «حفظ مسودة» + «اعتماد السجل» (معطّل دون إقرار الشورى)؛ نسخة لاصقة سفلية للجوال | `!readOnly` | outbox |

**عدد العناصر: 11 عنصراً رئيسياً.**

---

## المكونات المشتركة وأين تتكرر

| المكوّن | يظهر في | ملاحظة |
|---|---|---|
| RegistrationInbox | لوحة الشبكة + «المطلوب اليوم» (DutiesPage) | مقصود (ليصل الأمير الذي لا يدخل الشبكة) لكنه ازدواج للمشرف الذي يرى الاثنتين |
| PendingApprovals (روتيني + كسر زجاج) | لوحة الشبكة فقط؛ لكن `myTasks.server.ts` يدفع عدّادات مماثلة في «المطلوب اليوم» | نفس المعلومة بقناتين |
| SupervisionDueCard | لوحة الشبكة؛ التفصيل الكامل في `/ala-baseera?tab=supervision` (SupervisionRegister)؛ و«المطلوب اليوم» يدفع بندها أيضاً | ثلاث نوافذ لنفس الرقم |
| كتلة التقرير الشهري (3 KPI + WeeklyTable + ActivityList + FormulaNote + ReportActions) | تبويب «التقرير» في MosquePage + `MosqueLeaf` داخل NetworkPage (ميت) + `/duties`؟ (monthlyReportData للأمير عبر مسار آخر) | التكرار الحي الوحيد المقلق هو MosqueLeaf الميت |
| CircleRankings | تبويب التحفيظ في المسجد + (بنطاق أوسع) شاشات المشرف | العنوان يتغيّر بالخاصية `title` |
| DailyLogPage | تبويب «سجل اليوم» فقط (لا مسار مستقل حالياً رغم دعم الوضع المستقل في الكود) | كود الوضع المستقل (MishkatShell + ترويسة) بلا مستهلك |

---

## ملاحظات التدقيق

### أ) عناصر تشغيلية لمستوى أدنى تظهر لأدوار عليا
1. **نماذج إدخال المالية الداخلية (TxnPanel)**: تظهر لكل حامل `mosqueFinance.view` بما فيهم المشرف الزائر والإدارة — إدخال تبرعات/مصروفات مسجدٍ ليس مسجدهم دون أي حراسة واجهة.
2. **تبويب الدروس**: الزائر بقدرة `*` (الإدارة) يحصل على إدارة كاملة (إضافة درس، أُلقي، إلغاء) في أي مسجد — `canManage={isOwn ? dailyLog.edit : hasCap(caps,"*")}`.
3. **الحلقات/التحفيظ/الاجتماعات/اللجان**: الحراسة بقدرات `*.manage` العامة لا بملكية المسجد؛ المدير `*` يرى نماذج الإضافة والأرشفة والحذف في كل مسجد يزوره — عمل تشغيلي يومي لأمير المسجد معروض للقيادة.
4. **تعيين مسؤول لجنة بإنشاء حساب دخول (اسم دخول + كلمة مرور)** داخل بطاقة اللجنة — عملية إدارة حسابات (شأن «التهيئة») مدفونة في تبويب تشغيلي.

### ب) أرقام بلا تعريف أو هدف أو مزيّفة
1. **«آخر تحديث: منذ ساعتين»** في WeeklyTable — نص ثابت في الكود لا علاقة له بالبيانات (`WeeklyTable.tsx:77`).
2. **«مجموع الأسبوع» في سجل اليوم = 41 + نقاط اليوم** — `PRIOR_WEEK = 41` ثابت مكودٌ (`DailyLogPage.tsx:34`)، فالرقم والنسبة والقيمة المالية `$` المشتقة منه كلها وهمية.
3. **«تفصيل الأنشطة» يعرض 100% دائماً** — الخادم يرسل `target: a.points` (نفس النقاط هدفاً — `data.server.ts:263`) فالنسبة والشريط بلا معنى.
4. **لمحات الوحدات**: «المستخدمون N حساب» و«المسابقة N مشترك» عدّ خام لكامل الجداول بلا نطاق زمني أو هدف؛ «المالية $N مستحقات آخر شهر» لا تعرض أي شهر تحديداً (`financeMonth` يُجلب ولا يُعرض).
5. أهداف مكودة متناثرة: 70 نقطة (أسبوعي) و280=50$ تظهر نصوصاً ثابتة في FormulaNote وNetworkPage وDailyLogPage — لا مصدر واحد.
6. **Legend «دون الهدف» و«مساجد متأخرة»**: النقر يرشّح على «الكل» لا على الفئة المنقورة (لا يوجد فلتر late/below) — وعد «انقر للتفاصيل» غير مُوفى.

### ج) تكرار/كود ميت
1. `MosqueLeaf` في NetworkPage يكرّر تبويب التقرير كاملاً وفرع التقرير فيه غير قابل للوصول (التوجيه إلى `/mosque` يسبقه دائماً).
2. صندوق الاعتماد يظهر مرتين (روتيني + كسر زجاج) بنفس الأزرار — تمييزهما بالألوان فقط.
3. FormulaNote مكرَّرة نصاً داخل DailyLogPage (نسخة مضمّنة) وكمكوّن مستقل في التقرير.
4. عدّادات الطلاب/الإضافة/الحذف مكررة ثلاث مرات بنفس البنية (TahfeezStudents وCircleStudents وحضور الدروس) — فرصة توحيد.
