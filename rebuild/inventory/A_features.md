# جرد الميزات — v1
> أُنجز بتاريخ: ٢٠٢٦-٠٧-٢٠ · فحص الاكتمال: ✅ (انظر آخر الملف)

## ملخص تنفيذي

- شمل الجرد **٢٣ ملف مسار** (+`README.md` توثيقي) و**٣٤ ملف `*.server.ts`** و**٣٩ خدمة** في `services/` و**٢٢ مواصفة شاشة** في `product/ui/`، ونقاط الدخول خارج المسارات (`server.ts`: fetch/scheduled/webhook) وطبقة المنصّة (`public/sw.js`، `lib/offline/`).
- الحصيلة: **٢٣٠ ميزة مرقّمة** موزّعة على **٣٥ وحدة** (منها ١٠ ميزات بلا واجهة: مجدولات/ويبهوك/إيصال)؛ الغالبية العظمى (~٢٢٠) **تعمل** بدليل اختبار أو ربط حيّ، و٥ **جزئية** داخل الجداول (أبرزها زر «صرف» المالي وقراءة المسابقة)، و٣ **غير متحقق** مذكورة صراحة، إضافةً إلى **٣١ عنصراً ميتاً/مدفوناً** في قسم مستقل (تحقّق كل منها بـgrep).
- أبرز المفاجآت: **ملفا خدمات كاملان ميتان** — `services/governance.ts` (دورة الإدارة: مدد، شغور، استقالات — جدول `resignations` بلا واجهة إطلاقاً) و`services/meetings.ts` (النصاب والتصويت وصوت الأمير المرجِّح — واجهة الاجتماعات لا تسجّل حضوراً ولا أصواتاً).
- جدول `refresh_tokens` قائم في المخطط بلا كاتب ولا قارئ حيّ (المصادقة الفعلية JWT في cookie فقط).
- **تعارضات ربط أدوار/خادم**: المسابقة كلها (حتى القراءة) خلف `isGlobalAdmin` رغم منح `competition.view/manage` للمشرفين والأمير (يرون الصفحة فارغة/أزراراً تفشل)؛ زر «صرف» يظهر لـ`finance_officer` بقدرة `finance.payout` لكن الخادم يحصره بالمدير؛ `finance.entry/approve` ممنوحتان لـsection_head/rabita بلا أي سطح واجهة.
- **مساران متوازيان لتسجيل الأصول**: لوحة الأصول في المالية تغيّر الحالة وتُنشئ أصلاً بحائز دون كتابة حدث في سلسلة الحيازة `asset_custody`، بخلاف شاشة العُهد.
- **طبقة منصّة كاملة خارج `routes/`** كادت تسقط من أي جرد مبني على الشاشات: PWA قابل للتثبيت، عمل دون اتصال (Service Worker + Outbox + مزامنة)، استقبال Web Push، ترويسات أمنية، صفحة خطأ عربية.
- المنهجية: خمسة مسوح متوازية بنطاقات ملفات إلزامية + فحص بنيوي لنقاط الدخول؛ كل صف مسنود بـ`ملف:سطر`، والأدوار من فحوصات الكود (`hasCap`/`requireCap`/`role ===`) لا من الوثائق.

---

# القسم الأول: الوحدات التعليمية

ملاحظة تأسيسية (من `app/src/lib/capabilities.ts:148-182` و`app/src/lib/access.ts:5-34`): قدرات `alaBaseera.viewAll`/`tahfeez.view`/`circles.view`/`library.view` ضمن `SUPERVISOR_VIEW` (`capabilities.ts:131-146`) فيملكها section_head/rabita/square. **amir لا يملك `network.view`** فلا يصل مسار `/ala-baseera` (حارسه `network.view`، `access.ts:14`) بل يصل التعليم من تبويب مسجده. `circle.teach` قدرة شخصية (PERSONAL_CAPS، `capabilities.ts:201`) لا يمنحها الشمول `*` — المدير لا يرى `/my-circles`. `library.view` للجميع فـ`/library` و`/manhaj` مثبّتان للكل (`access.ts:18-20`).

## الوحدة: «على بصيرة» — التعليم الشبكي (`/ala-baseera`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 1 | لوحة مؤشّرات التعليم (KPIs النطاق) | عدّ الحلقات/المعلّمين/الطلاب وساعات الشهر + قيمتها الدولارية للمدير حصراً | admin, section_head, rabita, square (حارس `network.view`) | `routes/ala-baseera.tsx` + تبويب «الحلقات» في `components/ala-baseera/AlaBaseeraPage.tsx` | `alaBaseeraData()` | halaqat, enrollments, lesson_sessions, venues, org_units, rate_schemes | تعمل | `app/src/server/alaBaseera.server.ts:71`؛ عزل النطاق `:60-68`؛ القيمة للمدير `AlaBaseeraPage.tsx:155-166` |
| 2 | شجرة الحلقات الهيكلية (منطقة→مربع→مسجد) بتحميل كسول | عرض شجريّ للحلقات معزول بالقسم، مع وضعٍ كسولٍ فوق ٥٠٠ ورقة | نفس الأعلى | تبويب «الحلقات» | `halaqatTreeData()`, `unitHalaqatLeavesData()` | halaqat, venues, org_units, teachers, persons, enrollments, lesson_sessions | تعمل | `alaBaseera.server.ts:185,152`؛ العتبة `:147`؛ `AlaBaseeraPage.tsx:191-218` |
| 3 | مبدّل القسم (ذكور/نساء) للمدير | الإدارة العليا ترى القسمين بالتبديل؛ غيرها مُقيَّد بقسمه | admin فقط (`hasCap "*"`) | ترويسة الصفحة | `alaBaseeraData(section)` وأخواتها | — | تعمل | `AlaBaseeraPage.tsx:78-80,142-147`؛ `userScopePrefixes` `alaBaseera.server.ts:52-56` |
| 4 | إضافة مكان (venue) | إنشاء مسجد/معهد/بيت ضمن نطاق المُنشئ | admin أو amir (خادمياً)؛ الواجهة للمدير حصراً | تبويب «الإعداد» | `createVenueData()` → `services/alaBaseera.ts createVenue()` | venues, org_units | تعمل | `alaBaseera.server.ts:286-293`؛ `services/alaBaseera.ts:11`؛ `AlaBaseeraPage.tsx:247-254`؛ حصر «الإعداد» `:82,174` |
| 5 | إنشاء حلقة + توفير حساب معلّم جديد | إنشاء حلقة بمعلّم قائم أو حساب دخول جديد يديرها بنفسه | admin أو amir (`requireAlaBaseeraManage`) | تبويب «الإعداد» | `createHalaqaData()` → `provisionTeacher`, `createHalaqa` | halaqat, venues, teachers, persons, users | تعمل | `alaBaseera.server.ts:303-324`؛ التوفير `:315-318`؛ `AlaBaseeraPage.tsx:264-290` |
| 6 | تفصيل الحلقة للمشرف: تقرير عامّ + اعتماد/رفض الدروس + مصفوفة المنهج | اطّلاعٌ وإشرافٌ بلا إدخال (منعاً للغش) | إدخال: teacher المالك/amir؛ إشراف: admin/rabita/square المغطّي | مختار الحلقة في تبويب «الحلقات» | `halaqaAccessData()`, `circleGeneralReportData()`, `halaqaLessonsData()`, `setLessonStatusData()` | halaqat, lesson_sessions, lesson_attendance, lesson_attachments, enrollments, curriculum_progress | تعمل | `alaBaseera.server.ts:368-378,765,647,705`؛ الاعتماد للأقرب `halaqaLessonApprover:687-703`؛ `AlaBaseeraPage.tsx:310-359` |
| 7 | السجل الإشرافيّ (زيارات ميدانية) — وجهان | مطّلع (تقييم بحسب المنطقة) / مُكلَّف (لوحة تشغيلية + سجّل زيارة + اعتماد) | مطّلع: admin/section_head؛ مُكلَّف: square/rabita | تبويب «السجل الإشرافيّ» | `supervision.server.ts` (انظر وحدة الزيارات الإشرافية) | supervision_visits وما يتصل | تعمل | `components/ala-baseera/SupervisionRegister.tsx:10,46-52,70-160`؛ اختبار `supervision-visit.test.ts` |

## الوحدة: منهاج «على بصيرة» — القارئ العام (`/manhaj`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 8 | شجرة المنهاج (وحدات ودروس) | فهرسٌ خفيفٌ للمجالس/الدروس بلا محتوى | عام (زائر + كل مسجَّل؛ المسار عام بلا حارس) | `routes/manhaj.tsx` → `components/manhaj/ManhajPage.tsx` | `manhajTreeData()` | manhaj_units, manhaj_lessons | تعمل | `server/manhaj.server.ts:14`؛ المسار عام `routes/manhaj.tsx:5`؛ التثبيت `lib/access.ts:19-20` |
| 9 | قراءة درس المنهاج (كتل غنية) | محتوى درسٍ (آيات/أحاديث/جداول/صور) عند الطلب مع تخزين مؤقّت | عام | ManhajPage (قارئ) | `manhajLessonData()` | manhaj_lessons, manhaj_units | تعمل | `manhaj.server.ts:29-40`؛ العرض `components/manhaj/render.tsx`؛ الملاحة `ManhajPage.tsx:43-56` |
| 10 | القشرة الواحدة (شريط الدور للمسجّل/ترويسة للزائر) | يحتفظ المسجَّل بشريط تطبيقه داخل القارئ | مسجَّل مقابل زائر | ManhajPage | — | — | تعمل | `ManhajPage.tsx:57-91`؛ المواصفة `product/ui/manhaj.md:17` |

> لا يوجد اختبار خاص بالمنهاج؛ الحالة «تعمل» بدليل المسار المفعّل + العرض + `manhaj.md status: built`.

## الوحدة: حلقات المدرّس — «حلقاتي» (`/my-circles`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 11 | لوحة المدرّس (KPIs + قائمة حلقاتي) | حلقاتي وطلابي ودروسي وساعاتي | teacher حصراً (`circle.teach` قدرة شخصية) | `routes/my-circles.tsx` → `components/circles/MyCirclesPage.tsx` | `myCirclesData()` (`requireTeacher`) | halaqat, venues, enrollments, lesson_sessions, teachers | تعمل | `alaBaseera.server.ts:550,542`؛ حارس المسار `routes/my-circles.tsx:5-9`؛ اختبار `teacher-flow.test.ts` |
| 12 | تسجيل درس يوميّ + كشف حضور لكل طالب + مرفقات صور | مدة/عنوان/تقييم ذاتي + حاضر/غائب/مستأذن + رفع صور، بدعم أوفلاين idempotent | teacher المالك أو amir المكان (`halaqaInScope`) | «تسجيل درس» في MyCircles و«التعليم» بالمسجد | `recordLessonData()` | lesson_sessions, lesson_attendance | تعمل | `alaBaseera.server.ts:468-496,352-356`؛ `MyCirclesPage.tsx:311-426`؛ أوفلاين `lib/offline/outbox.ts:44` |
| 13 | إدارة طلاب الحلقة بأسماء نصّية حرّة | إضافة/حذف طلاب (خصوصية، بلا هوية) مع idempotency أوفلاين | teacher المالك/amir/admin | «الطلاب» | `halaqaStudentsData()`, `addHalaqaStudentData()`, `removeHalaqaStudentData()` | enrollments, persons | تعمل | `alaBaseera.server.ts:611,624,637`؛ `MyCirclesPage.tsx:247-302`؛ أوفلاين `outbox.ts:46` |
| 14 | قائمة الدروس المُسجّلة + اعتماد/رفض للمشرف | «ما درّسه» بحالته وأزرار الإشراف تظهر شرطياً | قراءة: أي صلة؛ اعتماد: الطبقة الأقرب/amir | LessonsList | `halaqaLessonsData()`, `setLessonStatusData()` | lesson_sessions, lesson_attendance, lesson_attachments, users, persons, curriculum_progress | تعمل | `alaBaseera.server.ts:647-679,705-729`؛ ظهور شرطي `MyCirclesPage.tsx:230-235` (`canSupervise`) |
| 15 | تعديل/أرشفة الحلقة | تعديل الاسم/المنهج/السعة وأرشفتها | teacher المالك/amir | EditHalaqa + زر الأرشفة | `updateMyHalaqaData()`, `archiveMyHalaqaData()` | halaqat | تعمل | `alaBaseera.server.ts:808,819`؛ `MyCirclesPage.tsx:139-170,121-133` |
| 16 | اللوحة الأسبوعية (ملاحظات + أنشطة جماعية + تقييم طلاب) | ملاحظات المشرف قراءةً فقط للمعلّم؛ حتى ٥ أنشطة؛ تقييم طلاب آخر درس ٠–١٠٠ | إدخال: teacher/amir؛ ملاحظات: admin/supervisor/amir (لا المعلّم) | `WeeklyHalaqaPanel` (MyCircles + المسجد) | `weeklyHalaqaData()`, `saveWeeklyNotesData()`, `addGroupActivityData()`, `removeGroupActivityData()`, `setStudentEvaluationData()` → `services/halaqaWeekly.ts` | weekly_halaqa_records, halaqa_group_activities, student_evaluations, lesson_sessions, enrollments | تعمل | `alaBaseera.server.ts:386,434-466`؛ حصر الملاحظات `:434-436`؛ `services/halaqaWeekly.ts:10,24,42`؛ `WeeklyHalaqaPanel.tsx:16,57-72` |
| 17 | مصفوفة تقدّم المنهج (طالبات × مجالس) | تُملأ آلياً عند اعتماد درسٍ له «مجلس» + تعديل يدويّ | قراءة: مشرف/مدير/معلّم؛ تعديل يدويّ: نفسهم | `CurriculumMatrix` | `halaqaCurriculumData()`, `setCurriculumProgressData()`؛ الملء الآليّ داخل `setLessonStatusData` | curriculum_progress, lesson_sessions, lesson_attendance, enrollments | تعمل | `alaBaseera.server.ts:732,756`؛ الملء الآليّ `:717-727`؛ `CurriculumMatrix.tsx:19-30` |
| 18 | كشف الحضور المجمّع (roster) للتسجيل | لكل طالب: عدد الحضور/الغياب/الاستئذان لتهيئة نموذج التسجيل | teacher/amir | داخل RecordLesson | `halaqaRosterData()` | enrollments, lesson_sessions, lesson_attendance, persons | تعمل | `alaBaseera.server.ts:499-517`؛ الاستدعاء `MyCirclesPage.tsx:325` |
| 19 | سجل الأنشطة الدعوية للنساء | عدّاد أنشطة (زيارات/توزيع…) بنقاط + إقرار الشورى، للوحدة النسائية | يظهر شرطياً لحلقةٍ `genderTrack==="female"` | داخل مختار الحلقة بـ`/ala-baseera` | `getDailyActivities`/`saveWomenActivity` (في data.server، أوفلاين) | activity_types وما يتصل | تعمل | `components/circles/WomenActivityLog.tsx:11-42`؛ الظهور الشرطي `AlaBaseeraPage.tsx:236-240`؛ أوفلاين `outbox.ts:43` |

## الوحدة: حلقات المسجد (سجلّ الأنواع) + جسر الطلاب

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 20 | إدارة حلقات المسجد بأنواعها (تحفيظ/رشيدي/على بصيرة/علمية) | إنشاء/تعديل/أرشفة حلقة + تعيين معلّم + فلترة بالنوع | عرض: `circles.view`؛ إدارة: `circles.manage` (amir) | فرع «الحلقات» في تبويب «التعليم» `MosquePage CirclesTab` | `circlesForMosque()`, `createCircle()`, `updateCircle()`, `archiveCircle()`, `mosqueTeacherOptionsData()` | circles, circle_students, persons, role_assignments, org_units | تعمل | `server/circles.server.ts:34,158,179,212,227`؛ الأدوار `requireCircleCap:15-22`؛ `MosquePage.tsx:161,565-698`؛ اختبار `circle-bridge.test.ts` |
| 21 | طلاب حلقة المسجد بأسماء نصّية | إضافة/حذف طلاب مع تدقيق (audit) | `circles.manage` (amir)/admin؛ عرض `circles.view` | داخل الحلقة | `studentsForCircle()`, `addCircleStudent()`, `removeCircleStudent()` | circle_students, persons | تعمل | `circles.server.ts:71,81,96`؛ التدقيق `:92,104`؛ `MosquePage.tsx:694` |
| 22 | جسر الطلاب/الحلقات الثنائيّ (bridge) | حلقة السجلّ تُنشئ توأمها في التحفيظ/«على بصيرة» فوراً؛ مرآة الطلاب حتميّة بلا ازدواج | آليّ (يُستدعى من create/update/archive/add/remove) | — (خدمة خلفية) | `bridgeCircle()` + `services/studentBridge.ts` (mirrorStudentToTahfeez/Registry, mirrorRemoval, syncCircleTwins, tahfeezTwin) | circles, circle_students, tahfeez_circles, tahfeez_students, halaqat, venues, teachers | تعمل | `circles.server.ts:111-156,175,205,220`؛ `services/studentBridge.ts:9-114`؛ اختبار `circle-bridge.test.ts` |

## الوحدة: التحفيظ

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 23 | لوحة حلقات التحفيظ للمسجد + إنشاء حلقة | KPIs + إضافة حلقة (تُنشئ صفّ السجلّ والتوأم) | عرض: `requireMosqueAccess`؛ إنشاء: `tahfeez.manage` (amir) | `MosquePage TahfeezTab` | `tahfeezData()`, `createTahfeezCircleData()` | tahfeez_circles, tahfeez_students, tahfeez_progress, circles, org_units, persons | تعمل | `server/tahfeez.server.ts:20,51-69`؛ `MosquePage.tsx:163,373-448`؛ اختبار `tahfeez-daily.test.ts` |
| 24 | طلاب التحفيظ + متابعة الحفظ | إضافة/حذف طلاب + سجلّ تقدّم (مقطع/آيات/تقييم) وحساب المحفوظ تقديراً | admin/amir/teacher الحلقة (`tahfeezCircleInScope`) | TahfeezStudents/TahfeezProgress | `tahfeezStudentsData()` وأخواتها الست | tahfeez_students, tahfeez_progress | تعمل | `tahfeez.server.ts:71-157`؛ النطاق `:71-85`؛ `MosquePage.tsx:452-562` |
| 25 | سجلّ التحفيظ اليوميّ المُهيكل | حضور + حفظ/مراجعة (سورة-آية أو صفحات) + تجويد + منهج مصاحب، upsert لكل طالب، أوفلاين + طباعة | admin/amir/teacher (`tahfeezTeachScope`) | `components/tahfeez/TahfeezDailyRegister.tsx` (المسجد + «حلقاتي») | `tahfeezSessionData()`, `saveTahfeezDailyData()`, `saveTahfeezDailyByCircleData()` | tahfeez_sessions, tahfeez_daily_records, tahfeez_students | تعمل | `tahfeez.server.ts:165-253,411-414`؛ `TahfeezDailyRegister.tsx:70-224`؛ أوفلاين `outbox.ts:45` |
| 26 | حلقات التحفيظ التي أعلّمها | منفذ المعلّم من «حلقاتي»: طلابي + سجلّ اليوم + رابط وليّ الأمر | teacher (`teacherPersonId===personId`) | `MyCirclesPage MyTahfeezSection` | `myTahfeezCirclesData()` | tahfeez_circles, tahfeez_students, org_units | تعمل | `tahfeez.server.ts:334-355`؛ `MyCirclesPage.tsx:431-516` |
| 27 | التقييم الدوريّ (ترتيب الحلقات) | ترتيبٌ بالحضور والإنجاز آخر ٣٠ يوماً (٦٠٪ حضور + ٤٠٪ علامات) | amir (مسجده) أو مشرف نطاقه أو admin | `components/circles/CircleRankings.tsx` | `circleRankingsData()` | tahfeez_circles, tahfeez_sessions, tahfeez_daily_records, org_units | تعمل | `tahfeez.server.ts:276-330`؛ فحص النطاق `:285-288`؛ `CircleRankings.tsx:10-21`؛ `MosquePage.tsx:400` |
| 28 | سجلّ الطالب التراكميّ | ملخّص أيام/حضور/غياب + صفوف مفصّلة | admin/amir/teacher | RPC `getTahfeezStudentHistory` | `tahfeezStudentHistoryData` | tahfeez_daily_records, tahfeez_sessions, tahfeez_students | غير متحقق (RPC مصدَّر بلا مكوّن يستدعيه) | `tahfeez.server.ts:256`؛ `lib/api/tahfeez.ts:86-91`؛ لا مستورد في `components/` |

## الوحدة: بوابة الطالب ووليّ الأمر

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 29 | توليد رابط وليّ الأمر السرّي | المعلّم/الأمير يولّد رمزاً يفتح متابعةً للقراءة فقط | admin/amir/teacher (`tahfeezTeachScope`) | زر «🔗» في MyTahfeezStudents | `guardianLinkData()` | tahfeez_students | تعمل | `tahfeez.server.ts:418-429`؛ `MyCirclesPage.tsx:500-508` |
| 30 | صفحة متابعة وليّ الأمر بالرمز | حضور وتقدّم وعلامات الطالب بلا حساب؛ تُميتها أرشفةُ الحلقة/إلغاء الرمز | عام برمز | `routes/student.$token.tsx` | `guardianViewData()` | tahfeez_students, tahfeez_circles, tahfeez_daily_records, tahfeez_sessions, org_units | تعمل | `tahfeez.server.ts:432-464`؛ إبطال الرمز `:436-438`؛ `routes/student.$token.tsx:20-94` |
| 31 | «تقدّمي في الحفظ» | الطالب يرى حضوره وتسميعه وعلاماته بنفسه عبر هويّته | student (عبر `person_id` في مرايا الجسر) | `DutiesPage MyHifzProgress` | `myStudentProgressData()` | tahfeez_students, tahfeez_circles, tahfeez_daily_records, tahfeez_sessions, org_units | تعمل | `tahfeez.server.ts:358-408`؛ `DutiesPage.tsx:299-330,55` |

## الوحدة: المكتبة التدريبيّة (`/library`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 32 | مكتبتي + ختم الاستلام/الفتح/الإنجاز | موادّ بحسب الجمهور، الإلزاميّ أولاً بعدّاد، وحالة لكل مادّة | كل الأدوار (`library.view`)؛ الجمهور من الأدوار | `routes/library.tsx` → تبويب «مكتبتي» | `myLibraryData()`, `markMaterialOpenedData()`, `markMaterialCompletedData()` | materials, material_progress | تعمل | `server/materials.server.ts:48-108`؛ اشتقاق الجمهور `:29-36`؛ `LibraryPage.tsx:71-150`؛ اختبار `materials.test.ts` |
| 33 | إدارة الموادّ | إضافة/تعديل/أرشفة مادّة (PDF/صوت/رابط) بجمهورٍ وإلزام | admin أو section_head (`library.manage`) | تبويب «إدارة الموادّ» (شرطي بـ`library.manage`) | `createMaterialData()`, `updateMaterialData()`, `listMaterialsAdminData()` | materials | تعمل | `materials.server.ts:38,111-161`؛ الظهور الشرطي `LibraryPage.tsx:34,50-64` |
| 34 | متابعة الإنجاز (مصفوفة أفراد × موادّ إلزامية) | مصفوفة بعزل النطاق + تصدير CSV | admin أو طبقة إشرافية | تبويب «متابعة الإنجاز» | `materialTrackingData()` | materials, material_progress, role_assignments, persons, org_units | تعمل | `materials.server.ts:170-232`؛ عزل النطاق `:175-178`؛ `LibraryPage.tsx:261-309` |

## الوحدة: الاختبارات والواجبات (مستضافة في `/duties`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 35 | بناء اختبار/واجب (MCQ/صح-خطأ) + نشر | إنشاء أسئلة دفعةً، نشرٌ يفتح التسليم ويُشعر الطلاب | منشئ ضمن نطاقه: teacher/amir/مشرف مغطٍّ/admin (`creatableScopes`) | تبويب «متابعة النشاطات» في `/duties` → `ManageExams` | `createExamData()`, `publishExamData()` | exams, exam_questions, notifications, circles | تعمل | `server/exams.server.ts:12-81`؛ النطاقات `activities.server.ts:14-41`؛ `ExamsSection.tsx:98-245`؛ اختبار `exams.test.ts` |
| 36 | تسليم الطالب بتصحيح آليّ فوريّ | تسليمٌ واحدٌ لكل طالب، درجة فورية، إشعار المنشئ | student (عضو الحلقة عبر `circle_students.personId`) | `StudentExams` في «المطلوب منّي» | `myExamsData()`, `examQuestionsData()`, `submitExamData()` | exams, exam_questions, exam_submissions, circle_students, circles, notifications | تعمل | `exams.server.ts:84-162`؛ منع الازدواج `:140-142`؛ `ExamsSection.tsx:14-93` |
| 37 | متابعة المنشئ + إغلاق | درجات الطلاب مرتّبةً + إغلاق الاختبار | نفس المنشئين (`canManageExam`) | `ManageExams` | `myCreatedExamsData()`, `closeExamData()` | exams, exam_submissions | تعمل | `exams.server.ts:165-201`؛ `ExamsSection.tsx:98-152`؛ `DutiesPage.tsx:248` |

## الوحدة: دروس/محاضرات المسجد

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|--------|---------|--------------------|----------|-----------|---------|--------|--------|
| 38 | جدولة درس + كشف تعارض المواعيد | عنوان/مكان/موعد/مدّة/مادّة مرتبطة، تحذير تعارضٍ غير مانع (force) | admin/amir المسجد/مشرف مغطٍّ (`canManageLessons`) | تبويب «الدروس» → `components/mosque/LessonsTab.tsx` | `saveLessonData()`, `lessonConflictData()`, `setLessonStatusData()` | mosque_lessons, materials, org_units | تعمل | `server/mosqueLessons.server.ts:12-85`؛ الأدوار `:12-22`؛ `MosquePage.tsx:171`؛ اختبار `mosque-lessons.test.ts` |
| 39 | جلسات اليوم/القادم/المُلقاة + الحضور | تقسيم زمنيّ + حضورٌ لكل درس مع اقتراحاتٍ من طلاب الحلقات + طباعة | نفس الأعلى | LessonsTab | `mosqueLessonsData()`, `lessonAttendanceData()`, `addLessonAttendeeData()`, `removeLessonAttendeeData()` | mosque_lessons, mosque_lesson_attendance, circles, circle_students, materials | تعمل | `mosqueLessons.server.ts:93-181`؛ الاقتراحات `:135-146` |

---

# القسم الثاني: الشبكة التنظيمية والإشراف والمسابقة واللجان

سياق القدرات (من `app/src/lib/capabilities.ts:131-182`): `SUPERVISOR_VIEW` يمنح `network.view`, `competition.view`, `committees.view`, `meetings.view`, `duties.view` لـsection_head/rabita/square. **amir** يملك `competition.view+manage`, `committees.view+manage`, `meetings.view+manage`, `duties.view+manage` لكن **لا** يملك `network.view`. admin = `["*"]` مع منع القدرات الشخصية.

## الوحدة: الشجرة التنظيمية والاستكشاف (`/network`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 40 | تصفّح الشبكة الهرمي الكسول | متصفّح شجري: قسم←منطقة←مربع←مسجد بمؤشرات الأداء والإدخال، تجميع خادمي بالمسار | `network.view` (admin, section_head, rabita, square) — حارس `canAccess("/network")` | `network.tsx` (Outlet+حارس), `network.index.tsx` (loader), `NetworkPage/Browser` | `networkData` (تجميع بـ`ROW_NUMBER() OVER` وLIKE بالمسار) | org_units, weekly_records, circles, halaqat, venues, monthly_entitlements, role_assignments, users, participants | تعمل (اختبارات `network-section.test.ts`, `section-isolation.test.ts`) | `app/src/routes/network.tsx:4`؛ `app/src/server/data.server.ts:620`؛ `NetworkPage.tsx:118` |
| 41 | مبدّل القسمين على الجذر | الإدارة العليا تبدّل بين قسمي الذكور والنساء (الفصل التام) | حصراً `hasCap(caps,"*")` و`scopeType==="root"` | `network.index.tsx` → Browser | `networkData(unitId, sectionParam)` — ورقة النساء=`halaqa` | org_units | تعمل | `NetworkPage.tsx:129,163`؛ `data.server.ts:633` |
| 42 | صفحة الوحدة + كتلة الجواب (نزول سؤالي) | «لماذا هذه الوحدة؟»: كم لم يُدخل + مَن مسؤولها (أو شاغرة) | `network.view`؛ الورقة (مسجد رجالي) تُحال لصفحة المسجد | `network.$unitId.tsx` (redirect عند الورقة), `NetworkPage/UnitDiagnosis` | `networkData(unitId)`, `unitDiagnosisData` (home.server) | org_units, weekly_records, role_assignments | تعمل | `routes/network.$unitId.tsx:13`؛ `NetworkPage.tsx:63` |
| 43 | تصدير التقرير القياديّ (roll-up PDF/CSV) | تصدير تجميع النطاق HTML (للطباعة→PDF) أو CSV مع تحييد حقن الصيغ | `hasCap(caps,"*")` أو `report.approve` | `NetworkPage/RollupExport` | `networkRollupData`, `networkRollupCsv`, `networkRollupHtml` (services/reportHtml) | org_units, weekly_records, circles, monthly_entitlements | تعمل (اختبار `leadership-reports.test.ts`) | `NetworkPage.tsx:402`؛ `lib/api/network.ts:77`؛ `data.server.ts:755,819` |
| 44 | صندوق «بانتظار اعتمادك» (الطبقة الأقرب NESSA) | التقارير المُقدَّمة التي هذا المستخدم أقربُ معتمِدٍ لها؛ اعتماد نهائي أو ردّ بتعليل | معتمِد NESSA فقط عبر `canApproveUnit ... via==="nearest"` | `NetworkPage/PendingApprovals` | `pendingApprovalsData`, `approveMonthForMosque`, `rejectUnitPendingData` | weekly_records, org_units, role_assignments, notifications, users, persons | تعمل (اختبارات `approval-inbox.test.ts`, `approval-flow.test.ts`) | `data.server.ts:83,307,358`؛ `NetworkPage.tsx:323` |
| 45 | صندوق «كسر الزجاج» للإدارة | وحدات بلا طبقة إشرافيّة مُكلَّفة — اعتماد استثنائي موثّق | `isGlobalAdmin` فقط | `NetworkPage/PendingApprovals breakGlass` | `pendingBreakGlassData` + `approverLayerFor` | weekly_records, org_units | تعمل (اختبار `approval-hierarchy-e2e.test.ts`) | `data.server.ts:128`؛ `NetworkPage.tsx:191` |
| 46 | تقرير الطبقة وتقديمه للاعتماد | حصيلة نطاق المشرف هذا الأسبوع + زر تقديم (يُمنع فوق صفر) | مالك تكليف الوحدة نفسه (`isOwner`) — لا للمدير | `NetworkPage/LayerReportAction` | `layerReportStatusData`, `submitLayerReportData`, `layerRollup` | weekly_records, org_units, notifications | تعمل (اختبار `layer-report.test.ts`) | `data.server.ts:164,182`؛ `NetworkPage.tsx:274` |
| 47 | سجلّ التدقيق معزولاً بالنطاق | الإدارة ترى الكل؛ المشرف يرى قيود مَن نطاقه ضمن نطاقه | `isGlobalAdmin` أو rabita/square/section_head بمساراتهم | يُستهلك في AdminPage (تبويب التدقيق) | `auditLogData` | audit_log, role_assignments, users, persons | تعمل | `data.server.ts:831`؛ `lib/api/network.ts:88`؛ `AuditPanel.tsx:39-52` |
| 48 | لوحة المحافظة (governorate board) | مساجد النطاق بآخر نقاط وتأخّر التحديث (هدف 70) | نطاق المستخدم عبر `scopePrefix` | RPC `getGovernorate` | `governorateData` | org_units, weekly_records | غير متحقق (لم يُعثر على مستورد للواجهة) | `data.server.ts:31`؛ `lib/api/functions.ts:7` |

## الوحدة: صفحة المسجد (`/mosque/$mosqueId`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 49 | مساحات المسجد المتبوّبة | تبويبات مُجمَّعة: نظرة/سجل/تقرير · تعليم · أسرة · صندوق — تُبنى بالقدرات | كل تبويب بقدرته: `dailyLog.view`, `report.view`, `circles/alaBaseera/tahfeez.view`, `meetings.view`, `committees.view`, `mosqueFinance.view` | `mosque.$mosqueId.tsx` (حارس مصادَق)، `MosquePage` | `mosqueOverviewData`, `mosqueReportData` (+عزل نطاق: null خارج النطاق) | org_units, weekly_records, circles, role_assignments | تعمل | `lib/mosque-tabs.ts:8`؛ `MosquePage.tsx:76`؛ `data.server.ts:277,204` |
| 50 | تبويب «نظرة» للزائر | حالة الأسبوع + روابط سريعة؛ الطاقم يهبط على «سجل اليوم» والزائر على «نظرة» | مشرف زائر (`!isOwn`) / أي حامل التبويبات | `MosquePage/Overview` | `mosqueOverviewData` | org_units, weekly_records, role_assignments, circles | تعمل | `MosquePage.tsx:87,152,179` |
| 51 | التقرير الشهري + اعتماد الأمير/الطبقة/الرفض | جدول أسابيع الشهر بحالتها + أزرار اعتماد بحسب `reportRoleCaps` | `isAmir` (اعتماد الأمير)، معتمِد NESSA (نهائي/رفض)، إدارة | `MosquePage/ReportTab` + `ReportActions` | `mosqueReportData`, `approveMonthForMosque`, `rejectWeekForMosque`, `reportRoleCaps→canApproveUnit` | weekly_records, org_units, users, persons | تعمل (اختبارات `approval-flow.test.ts`, `approvalRouting.test.ts`) | `data.server.ts:60,204,307,338` |
| 52 | سجل اليوم (النقاط اليومية) | إدخال أنشطة اليوم بنقاطها للأسبوع الجاري؛ مضمّن في رئيسية الأمير و«عرض» للزائر | طاقم المسجد (`dailyLog.view`)؛ الزائر قراءة (`readOnly`) | تبويب «سجل اليوم» في `MosquePage` + مضمّن في `AmirHome` | `syncEntries` (services/records) + دوال daily في data.server | weekly_records, daily_entries, activity_types | تعمل (اختبارا `approval-flow.test.ts`, `committee-entry.test.ts`) | `components/daily-log/DailyLogPage.tsx` (رفع الصور `:88`)؛ `MosquePage.tsx:154`؛ `AmirHome.tsx:89`؛ `services/records.ts:155` |

## الوحدة: الزيارات الإشرافية

المنطق في `supervision.server.ts`؛ الواجهة `SupervisionRegister.tsx` تُفتح من `/ala-baseera?tab=supervision` (`AlaBaseeraPage.tsx:46,175`).

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 53 | تسجيل زيارة إشرافية لحلقة | إنشاء زيارة (تحفيظ/بصيرة) بنتيجة وملاحظات؛ الزائر = الطبقة الأقرب المغطّية | `SUP_ROLES` (square/rabita/section_head) المُكلَّف بالطبقة الأقرب، أو الإدارة (كسر زجاج) | `/ala-baseera?tab=supervision` → `VisitForm` | `createSupervisionVisitData` + `approverLayerFor` | supervision_visits, tahfeez_circles, halaqat, venues, org_units | تعمل (اختبار `supervision-visit.test.ts`) | `supervision.server.ts:33`؛ `SupervisionRegister.tsx:160` |
| 54 | رفع الزيارة واعتمادها | رفع يُشعر الطبقة الأقرب فوق المشرف؛ اعتماد بمن هو NESSA فوقه (لا يعتمد المشرف زيارته) | رفع: `visitedBy` أو admin؛ اعتماد: `canApproveUnit(submitterPath)` | نفس المكوّن | `submitSupervisionVisitData`, `approveSupervisionVisitData` | supervision_visits, notifications, role_assignments | تعمل | `supervision.server.ts:69,96` |
| 55 | لوحة الإشراف الميدانيّ (حلقاتي/حالة الزيارة) | حلقات المشرف + حالة آخر زيارة (لم تُزَر/حديثة/متأخّرة، عتبة ٣٠ يوماً) | نطاق المشرف عبر `covers` | `SupervisionRegister` (dash) | `supervisionDashboardData`, `supervisableCirclesData` | supervision_visits, tahfeez_circles, halaqat, venues, org_units, role_assignments | تعمل | `supervision.server.ts:154,243` |
| 56 | تقييم الإشراف بحسب المنطقة (عرض المطّلع) | تجميع مجمَّع: تغطية/متأخر/متوسط النتائج/المسؤول | admin, section_head, rabita فقط (يعيد null للمربع) | `SupervisionRegister/overview` | `supervisionOverviewData` | org_units, supervision_visits, role_assignments, persons | تعمل | `supervision.server.ts:192,201`؛ `SupervisionRegister.tsx:76` |
| 57 | «زياراتي / بانتظار اعتمادي» | تقسيم الزيارات: زياراتي (لا للمدير) + المُقدَّمة التي أنا أقربُ معتمِدٍ لها | مشرف (المدير لا سجلَّ زيارات له) | `SupervisionRegister` | `supervisionVisitsData` | supervision_visits, role_assignments | تعمل | `supervision.server.ts:126,134`؛ `lib/api/supervision.ts:6` |

## الوحدة: محرك الاعتماد NESSA وآلة حالات السجلات (خدمات داخلية)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 58 | حساب «الطبقة الأقرب النشطة المُكلَّفة» | استعلام واحد على آباء المسار لأعمق سلَف إشرافيّ نشط | يُستهلَك من كل صناديق الاعتماد والزيارات | — (خدمة) | `approverLayerFor`, `isNearestApprover` | role_assignments | تعمل (اختبار `approvalRouting.test.ts`) | `services/approvalRouting.ts:23,46` |
| 59 | التدخّل الفوقيّ (override) | سلَف أعلى من NESSA يملك `report.approve.override` يعتمد عند تعذّر الأقرب | section_head/rabita بقدرة `report.approve.override` (لا المدير ولا المربع) | — | `canOverrideApprove` (OVERRIDE_CAP) | role_assignments | تعمل (اختبار `approval-hierarchy-e2e.test.ts`) | `services/approvalRouting.ts:55`؛ `capabilities.ts:152` |
| 60 | كسر الزجاج + الحارس الموحّد | الإدارة تعتمد وحدة شاغرة NESSA؛ `canApproveUnit` يوحّد nearest/override/breakglass | admin (breakglass) | — | `isBreakGlass`, `canApproveUnit` | role_assignments | تعمل | `services/approvalRouting.ts:66,72` |
| 61 | آلة حالات الاعتماد (records) | مسودة→إقرار الأمير→اعتماد الطبقة؛ إقرار قيود اللجان عند الاعتماد؛ رفض/قفل | يُستدعى من `approveMonthForMosque`/`syncEntries` | — | `approveRecord`, `rejectRecord`, `syncEntries`, `setLock` | weekly_records, daily_entries, activity_types, audit_log | تعمل (اختبارا `approval-flow.test.ts`, `committee-entry.test.ts`) | `services/records.ts:39,155` |

## الوحدة: المسابقة (`/competition`)

**كل** دوال الخادم (حتى القراءة) محروسة بـ`requireAdmin`=`isGlobalAdmin` (`competition.server.ts:9`).

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 62 | لوحة ترتيب المسابقة | ترتيب المشتركين (شهرية+اختبارات، الأعذار لا تُخصم) عبر SQL بترقيم وبحث | عرض: `competition.view` (admin, section_head, rabita, square, amir)؛ الخادم يفرض `requireAdmin` حتى للقراءة | `competition.tsx` (حارس `canAccess`), `CompetitionPage` tab board | `competitionData`, `leaderboardPage` | competitions, participants, participant_scores, central_exams, exam_results, persons, org_units, monthly_programs | جزئية (غير المدير يرى الصفحة فارغة رغم `competition.view`) | `competition.server.ts:20,38,9`؛ `routes/competition.tsx:11` |
| 63 | إنشاء مسابقة | نموذج إنشاء المسابقة الحالية (تصبح active فوراً) | الواجهة: `competition.manage`؛ الخادم: `requireAdmin` | `CompetitionPage/CreateCompetition` | `createCompetitionData` | competitions | تعمل (اختبار `competition.test.ts`) | `CompetitionPage.tsx:95,402`؛ `competition.server.ts:77` |
| 64 | تسجيل مشترك | تسجيل فرد (١٥–٤٠) مرتبط بمسجد نشط بلا تكرار | الواجهة: `competition.manage`؛ الخادم: `requireAdmin` | `CompetitionPage` tab register | `registerParticipantData`→`registerParticipant` | participants, org_units, audit_log | تعمل | `services/competition.ts:43`؛ `CompetitionPage.tsx:67` |
| 65 | الإدارة والرصد (برامج/اختبارات/شبكة رصد) | إضافة برنامج شهري واختبار مركزي ورصد نقاط كل مشترك | الواجهة: `competition.manage`؛ الخادم: `requireAdmin` | `CompetitionPage/ManagePanel, AddProgram, AddExam` | `competitionManageData`, `addProgramData`, `addExamData`, `recordScoreData`, `recordExamResultData` | monthly_programs, central_exams, participant_scores, exam_results, participants | تعمل | `competition.server.ts:104,124,134,143`؛ `CompetitionPage.tsx:251` |
| 66 | التأهيل واختيار الفائز | تأهيل أعلى N (→qualifying)، اختيار الفائز (→closed)، مُدوَّن في التدقيق | الواجهة: `competition.manage`؛ الخادم: `requireAdmin` | `CompetitionPage/ManagePanel` | `qualifyTopData`→`qualifyTop`, `selectWinnerData`→`selectWinner`, `leaderboard` | participants, competitions, audit_log, participant_scores, exam_results | تعمل | `services/competition.ts:112,123,93`؛ `CompetitionPage.tsx:281,287` |
| 67 | تغيير حالة المسابقة يدوياً | انتقالات أمامية فقط active→qualifying→closed | الخادم `requireAdmin` | **لا واجهة** — RPC بلا مستورِد | `setCompetitionStatusData` | competitions | جزئية (خادم+RPC+اختبار بلا زر وصول) | `competition.server.ts:91`؛ `lib/api/competition.ts:32`؛ `competition.test.ts:74` |

## الوحدة: اللجان

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 68 | عرض لجان المسجد وخططها | KPIs + بطاقات اللجان وبنود خططها | `committees.view` (amir, admin, المشرفون) عبر تبويب المسجد | `MosquePage` tab committees → `CommitteesTab` | `committeesData`+`requireMosqueAccess` | committees, committee_plans, org_units | تعمل (اختبار `committee-entry.test.ts`) | `committees.server.ts:26`؛ `MosquePage.tsx:760` |
| 69 | تشكيل لجنة وإسناد مسؤولها | إنشاء لجنة + إسناد بالاسم أو بإنشاء حساب دخول للمسؤول | `committees.manage` (الواجهة)؛ الخادم: `requireMosqueManage` (إنشاء)، admin/أمير المسجد (إسناد) | `MosquePage/CommitteeCard` | `createCommitteeData`, `assignCommitteeHeadData`→`provisionCommitteeHead` | committees, org_units, persons, users, role_assignments, audit_log | تعمل (اختبارا `committee-head.test.ts`, `provisioning.test.ts`) | `committees.server.ts:68,80`؛ `services/provisioning.ts:48` |
| 70 | إدارة خطة اللجنة (بنود) | إضافة بند (مستمر/شهري) وتبديل حالته | admin أو أمير المسجد أو مسؤول اللجنة نفسه (`canManageCommittee`) | `MosquePage/CommitteeCard` و`MyCommitteePage/CommitteeBlock` | `addCommitteePlanData`, `setCommitteePlanStatusData` | committees, committee_plans | تعمل | `committees.server.ts:16,101,117`؛ `MyCommitteePage.tsx:77` |
| 71 | «لجنتي» — صفحة مسؤول اللجنة | يرى لجنته (headPersonId=هو) ويدير خطتها | `committee.own` (قدرة شخصية، `*` لا يمنحها) | `my-committee.tsx` (حارس `canAccess`), `MyCommitteePage` | `myCommitteesData` | committees, committee_plans | تعمل (اختبار `committee-head.test.ts`) | `routes/my-committee.tsx:9`؛ `committees.server.ts:57` |
| 72 | إدخال أنشطة اللجنة في سجل المسجد | «أنشطتنا هذا الأسبوع»: نشاط منفَّذ يُحتسب بعد إقرار الأمير (enteredByCommittee) | مسؤول اللجنة المُسنَد (`myCommitteeOrThrow`) | `MyCommitteePage/CommitteeWeek` | `myCommitteeWeekData`, `submitCommitteeActivityData`→`syncEntries` | committees, daily_entries, activity_types, weekly_records, org_units | تعمل (اختبار `committee-entry.test.ts`) | `committees.server.ts:147,178`؛ `MyCommitteePage.tsx:24` |

## الوحدة: الاجتماعات

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 73 | عرض الاجتماعات وقراراتها | KPIs + قائمة اجتماعات مرقّمة مع قراراتها | `meetings.view` (amir, admin, المشرفون) | `MosquePage` tab meetings → `MeetingsTab` | `meetingsData`+`requireMosqueAccess` | meetings, decisions | تعمل (بلا اختبار مخصّص) | `meetings.server.ts:13`؛ `MosquePage.tsx:932` |
| 74 | تسجيل اجتماع + محضر + قرارات | إنشاء اجتماع (دورية/طارئة)، حفظ المحضر، إضافة/حذف قرار (ملزم/معلِم) | `meetings.manage` (الواجهة)؛ الخادم `requireMosqueManage` | `MosquePage/MeetingCard` | `createMeetingData`, `setMeetingMinutesData`, `addDecisionData`, `removeDecisionData` | meetings, decisions | تعمل (بلا اختبار مخصّص؛ `votesFor` يثبَّت صفراً — النصاب/التصويت في الخدمة الميتة) | `meetings.server.ts:56,68,77,90`؛ `MosquePage.tsx:1006,1026` |

## الوحدة: النشاطات والواجبات و«المطلوب اليوم» (`/duties`)

`/duties` مخفيّ من الشريط العلوي (`hidden:true`) ويُوصَل بالروابط والبطاقات فقط (`lib/access.ts:17`).

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 75 | «المطلوب منّي» + ردّ الطالب | الطالب يرى نشاطات حلقاته/مسجده ويردّ؛ إشعار المنشئ | `duties.view` (كل الأدوار)؛ العضوية عبر circle_students | `duties.tsx` (حارس), `DutiesPage/MyDuties` | `myDutiesData`, `respondActivityData` | activities, activity_responses, circles, circle_students, notifications | تعمل (اختبار `activities.test.ts`) | `routes/duties.tsx:11`؛ `activities.server.ts:100,136` |
| 76 | إنشاء نشاط ومتابعة الردود | إنشاء نشاط للنطاق (حلقة/مسجد) + قبول/اطّلاع + إغلاق | الواجهة: `*` أو `duties.manage` (amir, teacher)؛ النطاق خادمياً `creatableScopes` | `DutiesPage/FollowUp, NewActivityForm` | `activityScopesData`, `createActivityData`, `myActivitiesData`, `reviewResponseData`, `closeActivityData`, `creatableScopes`, `scopeStudentPersons` | activities, activity_responses, circles, circle_students, org_units, notifications | تعمل | `DutiesPage.tsx:22,173`؛ `activities.server.ts:14,43,50,167,196,211` |
| 77 | «مهامّي» — شريط بطاقات العدّادات | تجميع كل المطلوب عبر الوحدات (اعتمادات/تسجيلات/زيارات/مكتبة/نشاطات/اختبارات) بروابط إنجاز | كل مستخدم — حسب الدور (المدير لا تُدفع له «تحتاج زيارتك») | `DutiesPage/MyTasksStrip` + بطاقات الرئيسية | `myTasksSummaryData` (استيراد ديناميكي من data/registration/supervision/materials/activities/exams) | org_units + غير مباشر | تعمل | `myTasks.server.ts:10`؛ `DutiesPage.tsx:69`؛ `lib/api/activities.ts:57` |

## الوحدة: التهيئة البنيوية (وحدات تنظيمية + توفير حسابات — خدمات)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 78 | إنشاء وحدة تنظيمية (خدمة) | إنشاء وحدة بمسار مادّي مشتق من الأب مع توريث القسم وتناسق النوع/القسم | يُستدعى من registration.server وadmin.server | — (خدمة) | `createOrgUnit` | org_units, audit_log | تعمل (اختبارا `section-isolation.test.ts`, `gap-audit-3.test.ts`) | `services/orgUnits.ts:26`؛ `registration.server.ts:284` |
| 79 | توفير الحسابات المُنطاقة | نواة إنشاء شخص+مستخدم+تكليف دور مُنطاق؛ فوقها معلّم الحلقة ومسؤول اللجنة | admin/أمير (عبر مستدعيها) | — (خدمة) | `provisionUser`, `provisionTeacher`, `provisionCommitteeHead` | persons, users, role_assignments, org_units, teachers, committees, audit_log | تعمل (اختبار `provisioning.test.ts`) | `services/provisioning.ts:13,40,48`؛ مستدعوها `alaBaseera.server.ts:315`، `committees.server.ts:89` |

---

# القسم الثالث: إدارة النظام والهوية والقشرة

مرجع: نظام الأدوار مصدره ملفّان — `app/src/lib/capabilities.ts` (القدرات والافتراضات والتسميات المُجنَّسة) و`app/src/server/utils/rbac.ts` (ثوابت أدوار أقدم `ROLES`/`SECTIONS`/`SECTION_LEAF` ما تزال مستوردة في `scheduled.server.ts:7`، `registration.server.ts:13`، `services/notifications.ts:3`، `utils/context.ts:6`).

## الوحدة: القدرات والصلاحيات (capabilities / RBAC)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 80 | كتالوج القدرات (`CAP_CATALOG`) | ٣٩ قدرة موزّعة على ١٦ وحدة، مصدر واحد للخادم والعميل | الجميع (بنية) | بلا واجهة مباشرة | `lib/capabilities.ts` `CAP_CATALOG`/`ALL_CAPS`/`CAP_LABEL` | — | تعمل | `app/src/lib/capabilities.ts:4-82` |
| 81 | الأدوار الافتراضية (`ROLE_DEFAULTS`) | لكل دور قدرات افتراضية، `admin=["*"]`، والمشرفون عبر `SUPERVISOR_VIEW` | الجميع (بنية) | بلا واجهة | `ROLE_DEFAULTS`/`effectiveCaps` | — | تعمل | `capabilities.ts:131-196` |
| 82 | القدرات الشخصية (`PERSONAL_CAPS`) | `circle.teach`/`committee.own`/`media.post`/`custody.own` — «*» يمنح الاطّلاع لا العمل | admin (مقيّد)، أصحاب الأدوار | بلا واجهة | `isPersonalCap`/`hasCap` | — | تعمل | `capabilities.ts:201-209` |
| 83 | التسمية المُجنَّسة حسب القسم | تحويل تسمية الدور حسب men/women (أمير مسجد ↔ مشرفة حلقة) | الجميع (عرض) | في الواجهات | `sectionRoleLabel`/`SECTION_ROLE_LABEL` | — | تعمل | `capabilities.ts:99-118` |
| 84 | حساب القدرات الفعلية للمستخدم | اتحاد افتراضيات الأدوار ± التجاوزات، يُستدعى من `meUser` | النظام | بلا واجهة | `permissions.server.ts` `userCaps`/`loadOverrides`؛ `effectiveCaps` | permission_overrides | تعمل | `permissions.server.ts:9-17`؛ `auth.server.ts:74-76` |
| 85 | مصفوفة التجاوزات (منح/حجب/افتراضي) | المدير يعدّل قدرة دورٍ فوق الافتراضي (grant/revoke) أو يعيدها | admin فقط (`isGlobalAdmin` عبر `requirePermAdmin`) | `routes/admin.tsx` تبويب «الصلاحيات» | `permissionMatrixData`/`setPermissionData` | permission_overrides | تعمل | `permissions.server.ts:19-40`؛ `PermissionsPanel.tsx:24-46` |
| 86 | عرض المصفوفة بالتبديل الحيّ | لوحة تبديل لكل قدرة×دور مع «إرجاع للافتراضي» وتحديث متفائل؛ الإدارة العليا لا تُقيَّد | admin (`permissions.manage`) | تبويب الصلاحيات | يقرأ `getPermissionMatrix`/`setPermission` | permission_overrides | تعمل | `PermissionsPanel.tsx:75-108,68-73`؛ `AdminPage.tsx:138` |

## الوحدة: المصادقة والدخول

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 87 | تسجيل الدخول (اسم + كلمة مرور) | تحقّق كلمة المرور، إصدار JWT في cookie `mishkat_token` سبعة أيام | عام (زائر) | `routes/login.tsx` → `LoginPage.tsx` | `auth.server.ts` `loginUser`/`signToken` | users, persons | تعمل | `auth.server.ts:26-55`؛ اختبار `auth-suspension.test.ts:47-53` |
| 88 | حدّ محاولات الدخول (rate limit) | نافذة ١٥ دقيقة/٥ محاولات فاشلة — ضدّ التخمين | النظام | بلا واجهة (داخل loginUser) | `services/authTokens.ts` `isRateLimited`/`recordFailedAttempt`/`resetAttempts` | auth_attempts | تعمل | `services/authTokens.ts:48-71`؛ اختبار `gap-audit-6.test.ts:20-32` |
| 89 | التحقق الثنائي (TOTP/MFA) | إن كان `mfaEnabled` يُطلب رمز `totp` ويُتحقّق | مستخدمون مُفعّلو MFA | حقل رمز التحقق في LoginPage | `loginUser` + `verifyTotp` (utils/totp) | users (`mfaEnabled`/`mfaSecret`) | تعمل (كود مفعّل؛ لا اختبار مباشر) | `auth.server.ts:46-50`؛ `LoginPage.tsx:85-95` |
| 90 | منع الدخول حسب حالة الحساب | أي حالة غير `active` تمنع الدخول برسالة والسبب | النظام | بلا واجهة | `loginUser` (فحص `p0.status`) | persons | تعمل | `auth.server.ts:41-45`؛ اختبار `auth-suspension.test.ts:60-74` |
| 91 | هوية المستخدم الحالي (`meUser`) | يحمّل الأدوار والقدرات و`homeMosqueId` والأعلام والعلامة لكل صفحة | الجميع | `__root.tsx beforeLoad` عبر `me()` | `meUser`/`currentUser`؛ `utils/context.ts userFromToken` | users, persons, org_units, role_assignments | تعمل | `auth.server.ts:64-88`؛ `routes/__root.tsx:76-79` |
| 92 | إبطال لحظي للجلسة (`session_epoch`) | رفع الحقبة عند التجميد/تغيير كلمة المرور يُلغي كل الرموز فوراً | النظام | بلا واجهة | `userFromToken` (فحص `ep`)؛ يُرفع في admin.server | users (`sessionEpoch`) | تعمل | `utils/context.ts:38-40`؛ اختبار `auth-suspension.test.ts:108-` |
| 93 | تسجيل الخروج | حذف الكوكي والتحويل إلى `/login` | الجميع | زر الخروج في TopTabs؛ NoAccessPage | `logoutUser` | — | تعمل | `auth.server.ts:57-60`؛ `TopTabs.tsx:47-50` |
| 94 | فرض سرّ التوقيع (fail-closed) | غياب `JWT_SECRET` يوقف التوقيع بدل الرجوع لثابت معروف | النظام | بلا واجهة | `jwtSecret()` | — | تعمل | `auth.server.ts:16-20` |
| 95 | ترويسات الحماية على SSR | `X-Frame-Options`/`nosniff`/`HSTS`/`Referrer-Policy`/`Permissions-Policy` على كل استجابة | النظام | نقطة الدخول (fetch) | `server.ts withSecurityHeaders` | — | تعمل | `app/src/server.ts:43-51,68` |

## الوحدة: القشرة والتنقّل والبوابة

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 96 | قشرة التطبيق الجذرية | HTML `dir=rtl lang=ar`، الخطوط والـmanifest، تحميل الهوية لكل صفحة | الجميع | `routes/__root.tsx` | يقرأ `me()` | — | تعمل | `routes/__root.tsx:74-141` |
| 97 | الشريط العلوي (تبويبات حسب الدور) | تبويبات مرتّبة بأولوية الدور + جرس + اسم + خروج + علامة | الجميع (يُبوَّب بالقدرات) | `components/nav/TopTabs.tsx` عبر MishkatShell | `lib/access.ts orderedNav/allowedNav` | — | تعمل | `TopTabs.tsx:22,77-86`؛ `access.ts:42-83` |
| 98 | خريطة التبويبات وحُرّاس المسارات | مصدر واحد (`NAV`) للتبويبات وحُرّاس الوصول (`canAccess`/`firstAllowed`) | الجميع | `lib/access.ts` | — | — | تعمل | `access.ts:5-57` |
| 99 | ترتيب التبويبات بأهمية الدور | `ROLE_PRECEDENCE`/`ROLE_NAV_ORDER` (المدير: الإدارة أولاً؛ المالي: الصندوق؛ الطالب: المنهاج) | الجميع | TopTabs | `orderedNav` | — | تعمل | `access.ts:59-83`؛ `TopTabs.tsx:22` |
| 100 | البوابة/الهبوط للزائر | شعار + جملة + بابان (دخول/انضمام) + ٣ خطوات + سطر المنهاج؛ المسجَّل يُحوَّل لرئيسيته | زائر غير مسجَّل | `routes/index.tsx` → `LandingPage.tsx` | `beforeLoad` يحوّل المسجَّل إلى `/home` | — | تعمل | `routes/index.tsx:5-17`؛ `LandingPage.tsx:16-80` |
| 101 | صفحة «لا صلاحيات» الطرفية | مُصادَق بلا أدوار: رسالة هادئة + خروج، بلا حلقة تحويل | مُصادَق بلا قدرات | `routes/no-access.tsx` → `NoAccessPage.tsx` | حارس `firstAllowed`/`NO_ACCESS` | — | تعمل (مربوطة) | `routes/no-access.tsx:6-15`؛ `access.ts:52-57` |
| 102 | التوجيه بعد الدخول | `firstAllowed(caps)` — أول صفحة مسموحة أو `/no-access`، دالّة كليّة لا تُحلّق | الجميع | `login.tsx`/`admin.tsx`/`no-access.tsx` beforeLoad | `firstAllowed` | — | تعمل | `routes/login.tsx:8-9`؛ `access.ts:55-57` |
| 103 | شارة العمل دون اتصال (SyncBadge) | تظهر عند فقد الاتصال أو وجود عمليات بانتظار المزامنة | الجميع | `components/nav/SyncBadge.tsx` في `__root` | عميل فقط (offline/outbox) | — | تعمل | `SyncBadge.tsx:7-28`؛ `__root.tsx:136-138` |
| 104 | حاجز تبويبات المسجد داخل القشرة | تبويبات المسجد لطاقمه فقط؛ الزائر يبقى بقشرته العامّة | طاقم المسجد مقابل الزائر | TopTabs (`onMosque`/`isOwnMosque`) | `lib/mosque-tabs.ts mosqueTabs` | — | تعمل | `TopTabs.tsx:28-33,63-76` |
| 105 | النظام التصميمي الداخلي | مرجع بصري، محجوب بـ`caps.includes("admin")`، خارج شريط التطبيق | admin فقط | `routes/design-system.tsx` → DesignSystemPage | حارس beforeLoad | — | تعمل (مربوطة عبر routeTree) | `routes/design-system.tsx:8-20`؛ `routeTree.gen.ts:401-404` |
| 106 | دليل المسارات (README) | يوثّق اصطلاح file-based routing لـ TanStack Start | مطوّرون (توثيق) | `routes/README.md` | — | — | وثيقة (ليست ميزة) | `routes/README.md:1-21` |

## الوحدة: الإدارة — الهيكلية والمستخدمون (`/admin`)

بوّابة قراءة موسّعة: أيُّ قدرة من `admin.view`/`orgUnit.manage`/`user.manage`/`audit.view` تفتح الباب (`access.ts:29`)، والخادم يعزل بالنطاق (`requireAdminRead`/`requireScopedCap`).

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 107 | صفحة الإدارة (تبويبات) | هيكلية/مستخدمون/صلاحيات/عامة/معدّلات/إعلانات/تدقيق — بابٌ واحد يُبوَّب بالقدرات | admin, section_head, rabita | `routes/admin.tsx` → `AdminPage.tsx` | `adminListOrgUnits` | org_units | تعمل | `routes/admin.tsx:10-11`؛ `AdminPage.tsx:132-143`؛ `access.ts:29` |
| 108 | إنشاء وحدة تنظيمية | منطقة/مربع/مسجد/حلقة نسائية؛ القسم يُورَّث من الأب ويُمنع الخلط | `orgUnit.manage` (admin/section_head/rabita) | تبويب «الهيكلية» | `adminCreateOrgUnit` → `services/orgUnits.createOrgUnit` | org_units | تعمل | `admin.server.ts:135-153`؛ اختبار `section-isolation.test.ts:76-89` |
| 109 | تعديل وحدة | الاسم/المحافظة/البلدة؛ المسار يُشتق من القسم دوماً | `orgUnit.manage` (مقيّد بالنطاق) | `OrgUnitEditor.tsx` | `adminUpdateOrgUnit` | org_units | تعمل | `admin.server.ts:73-88`؛ `OrgUnitEditor.tsx:56-59` |
| 110 | نقل وحدة (re-parent) | تحديث المسار المادّي للوحدة وفروعها + المراجع المنسوخة | `orgUnit.manage` | قسم النقل في OrgUnitEditor | `adminMoveOrgUnit` | org_units, role_assignments, weekly_records, assets, supervision_visits | تعمل | `admin.server.ts:91-118`؛ `OrgUnitEditor.tsx:67-71` |
| 111 | أرشفة وحدة (حذف ناعم) | تُخفى من الشبكة والإدارة؛ يلزم نقل/أرشفة التابعين أولاً؛ تُنهي تكاليفها | `orgUnit.manage` | منطقة الخطر في OrgUnitEditor | `adminArchiveOrgUnit` | org_units, role_assignments | تعمل | `admin.server.ts:120-133`؛ `OrgUnitEditor.tsx:85-87` |
| 112 | شجرة الهيكلية القابلة للطي | عرض هرمي بعدّ المساجد تحت كل وحدة | قرّاء الإدارة | `AdminPage OrgTreeNode` | يقرأ `listOrgUnits` | org_units | تعمل | `AdminPage.tsx:53-70,287-337` |
| 113 | إنشاء مستخدم ومنحه دوراً مباشرة | شخص+حساب+تكليف معتمَد ضمن النطاق؛ منع منح admin/section_head لغير المدير | `user.manage` | تبويب «المستخدمون» | `adminCreateUserWithRole` | persons, users, role_assignments | تعمل | `admin.server.ts:155-186`؛ `AdminPage.tsx:222-254` |
| 114 | لوحة المستخدمين (قائمة + بحث + شجرة) | تصفّح بالهرمية (تحميل كسول) أو بحث بالاسم/الدخول، معزول بالنطاق | `user.manage`/قرّاء الإدارة | `UsersPanel.tsx` | `adminListUsers`/`adminUnitUsers` | users, persons, role_assignments, org_units | تعمل | `admin.server.ts:191-251`؛ `UsersPanel.tsx:36-185` |
| 115 | تعديل بيانات المستخدم | الاسم/الدخول/الجنس مع فحص فرادة الدخول | `user.manage` | UserDrawer | `adminUpdateUser` | persons, users | تعمل | `admin.server.ts:253-269`؛ `UsersPanel.tsx:213-216` |
| 116 | دورة حياة الحساب (تجميد/إلغاء/تفعيل) | disabled/deleted/active؛ غير active يرفع `session_epoch`؛ الإلغاء يُنهي التكاليف | `user.manage` | حالة الحساب في UsersPanel | `adminSetUserStatus` | persons, users, role_assignments | تعمل | `admin.server.ts:271-291`؛ `UsersPanel.tsx:275-289` |
| 117 | إعادة تعيين كلمة المرور | تُبطل الجلسات القائمة (رفع الحقبة) | `user.manage` | قسم الأمان | `adminResetPassword` | users | تعمل | `admin.server.ts:293-302`؛ `UsersPanel.tsx:233-237` |
| 118 | تعديل/اعتماد/إنهاء تكليف دور | تغيير الدور والنطاق، اعتماد المعلّق، إنهاء بتاريخ | `user.manage` (منع الأدوار العليا لغير المدير) | RoleRow | `adminUpdateRole`/`adminApproveRole`/`adminRemoveRole` | role_assignments, org_units | تعمل | `admin.server.ts:304-338`؛ `UsersPanel.tsx:314-332` |

> كتابة التدقيق `writeAudit` تُستدعى من كل الأفعال الحسّاسة: `admin.server.ts:86,116,131,267,289,300,315,336`؛ `settings.server.ts:92,127,138,153`؛ `registration.server.ts:344,367`. عارض التدقيق = الصف 47.

## الوحدة: الإعدادات

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 119 | المعدّلات المالية (نسخ مؤرّخة) | معدّل النقاط/الساعة/الراتب المقطوع — التعديل يُلغي النسخة الحالية ويضيف جديدة | `settings.view` (عرض) / `settings.manage` (تعديل) — افتراضياً admin فقط | تبويب «المعدّلات» → `RatesPanel.tsx` | `listRatesData`/`setRateData` | rate_schemes | تعمل | `settings.server.ts:54-97`؛ `RatesPanel.tsx:14-45` |
| 120 | الهدف الأسبوعي للنقاط (لكل مسار) | هدف الرجال/النساء المستخدَم في نسبة تحقيق التقرير | `settings.manage` | تبويب «عامة» | `generalSettingsData`/`setWeeklyTargetData` | points_schemes | تعمل | `settings.server.ts:100-143`؛ `GeneralSettingsPanel.tsx:44-48` |
| 121 | تفعيل/تعطيل الوحدات (feature flags) | تشغيل/إيقاف: على بصيرة/التحفيظ/الاجتماعات/اللجان (الغياب=مُفعَّل) | `settings.manage` | تبويب «عامة» | `FEATURE_CATALOG`/`loadFeatures`/`setFeatureData` | app_settings (`feature.*`) | تعمل | `settings.server.ts:11-24,145-155`؛ `GeneralSettingsPanel.tsx:157-179` |
| 122 | العلامة والهوية (brand) | اسم المنظومة + حرف الشعار + العملة الافتراضية، تظهر في الشريط العلوي | `settings.manage` | BrandSection | `loadBrand`/`setBrandData`/`BRAND_DEFAULTS` | app_settings (`brand.*`) | تعمل | `settings.server.ts:27-36,115-129`؛ `GeneralSettingsPanel.tsx:92-128` |
| 123 | تشغيل المهام المجدولة يدوياً | زر «تشغيل الآن» لنفس منطق الكرون | admin (`isGlobalAdmin`) | ScheduledTasksSection | `runScheduledTasksManual` → `runDueTasksData` | (انظر المجدولات) | تعمل | `scheduled.server.ts:14-18`؛ `GeneralSettingsPanel.tsx:67-90` |

## الوحدة: التسجيل الذاتي الهرمي (`/register`)

نموذج NESSA: الطلب يُوجَّه للطبقة الأقرب المؤهَّلة فوق الدور المطلوب (`KIND_RANK`/`ROLE_RANK`)؛ الأدوار المتاحة `["student","teacher","amir","square","rabita"]` (لا admin/section_head).

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 124 | الشجرة العامّة المختصرة | أسماء الوحدات النشطة + حلقات المساجد (بلا جلسة، بلا أشخاص) لاختيار الموقع | عام (زائر) | `register.tsx` → `RegisterPage.tsx` | `publicOrgTreeData` | org_units, circles | تعمل | `registration.server.ts:33-47`؛ اختبار `registration.test.ts:51-56` |
| 125 | تقديم طلب انضمام | نموذج ٣ خطوات (دور/موقع/بيانات) مع honeypot وفحوص فرادة وجنس/مسار | عام (زائر) | RegisterPage | `submitRegistrationData` | registration_requests, org_units, circles, users | تعمل | `registration.server.ts:50-128`؛ `RegisterPage.tsx:84-101` |
| 126 | «المسجد يُضاف حين الاعتماد» | مسؤول مسجد غير مدرج يقترح اسماً تحت مربع/منطقة، تُنشأ الهيكلية عند القبول | عام (زائر) kind=amir | خانة «مسجدي غير مدرج» | `submitRegistrationData`/`finalizeApproval` | registration_requests, org_units | تعمل | `registration.server.ts:89-95,280-288`؛ اختبار `registration.test.ts:88-` |
| 127 | حالة الطلب بالرمز | استعلام بحالة الطلب (pending/approved/rejected) عبر رابط المتابعة | عام (زائر) | `register.tsx?status=<token>` → StatusCard | `registrationStatusData` | registration_requests | تعمل | `registration.server.ts:153-162`؛ `RegisterPage.tsx:22-38` |
| 128 | إشعار الطبقة الأقرب بطلب جديد | عند التقديم يُشعَر أقرب مؤهَّل (والأمير مباشرة لطلبات طلابه) عبر تيليغرام+الجرس | النظام | بلا واجهة (داخل التقديم) | `notifyApprovers` | role_assignments, notifications | تعمل | `registration.server.ts:130-150`؛ اختبار `registration.test.ts:201-` |
| 129 | صندوق طلبات الانضمام | يعرض الطلبات لصاحب الطبقة الأقرب المؤهَّلة فقط؛ الإدارة ترى ما لا مالك له | admin, section_head, rabita, square, amir (حسب `canApprove`/`nearestOwnerUnit`) | `RegistrationInbox.tsx` داخل NetworkPage وDutiesPage | `pendingRegistrationsData` | registration_requests, org_units, circles | تعمل | `registration.server.ts:185-237`؛ `RegistrationInbox.tsx:20-22`؛ `DutiesPage.tsx:53` |
| 130 | اعتماد الطلب (إنشاء ذرّي) | يُنشئ الوحدة (إن اقترحت) + شخص+حساب+تكليف دفعةً + جسور الحلقة + إشعار ترحيب | صاحب الطبقة المغطّية | زر قبول | `approveRegistrationData`/`finalizeApproval` | registration_requests, persons, users, role_assignments, circle_students, circles, notifications | تعمل | `registration.server.ts:240-353`؛ اختبار `registration.test.ts:70-` |
| 131 | رفض الطلب بسبب إلزامي | رفض بسببٍ يظهر للمتقدّم بالاستعلام | صاحب الطبقة المغطّية | زر رفض | `rejectRegistrationData` | registration_requests | تعمل | `registration.server.ts:356-369` |
| 132 | حجز اسم الدخول ذرّياً (مانع سباق) | حالة انتقالية `approving` بشرط `pending` — اعتمادان متزامنان: الأول يحجز والثاني يُصدّ | النظام | بلا واجهة | `approveRegistrationData` | registration_requests | تعمل | `registration.server.ts:252-266`؛ اختبار `registration.test.ts:132-` |

## الوحدة: الرئيسيات حسب الدور (`/home`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 133 | موزّع الرئيسية | يختار عدسة الدور ويحوّل عند اللزوم (المعلّم→`/my-circles`، اللجنة→`/my-committee`، الإعلام→`/media-hub`) | الجميع | `routes/home.tsx` loader | `homeData` | حسب العدسة | تعمل | `routes/home.tsx:27-59`؛ `home.server.ts:378-394`؛ اختبار `home.test.ts:165-` |
| 134 | رئيسية المدير العام | صحة الشبكة والاتجاه، «ينتظر قراري» (كسر الزجاج+مقترحات مالية)، استثناءات، نبض | admin (`isGlobalAdmin`) | `AdminHome.tsx` | `adminHomeData` | org_units, weekly_records, finance_actions, role_assignments, persons, halaqat | تعمل | `home.server.ts:30-107`؛ `AdminHome.tsx:12-123`؛ اختبار `home.test.ts:48-91` |
| 135 | رئيسية أمير المسجد | هدف الأسبوع الحقيقي، «بقي عليّ»، سجل اليوم مضمّناً، حال المسجد والاستحقاق | amir | `AmirHome.tsx` | `amirHomeData` | weekly_records, points_schemes, monthly_entitlements, venues, halaqat, lesson_sessions | تعمل | `home.server.ts:124-185`؛ `AmirHome.tsx:20-129`؛ اختبار `home.test.ts:92-135` |
| 136 | رئيسية المشرف | قائمة عمل: بانتظار اعتمادي، حالة وحداتي، زياراتي، طلباتي، تقرير نطاقي | square, rabita, section_head | `SupervisorHome.tsx` | `supervisorHomeData` | org_units, weekly_records | تعمل | `home.server.ts:217-281`؛ `SupervisorHome.tsx:17-118`؛ اختبار `home.test.ts:137-164` |
| 137 | رئيسية المسؤول المالي | مقترحاتي المالية بحالتها + عدّاد المنتظر + شارة سلامة الدفتر (بلا اعتماد) | finance_officer | `FinanceHome.tsx` | `financeOfficerHomeData` | finance_actions | تعمل | `home.server.ts:291-308`؛ `FinanceHome.tsx:16-65` |
| 138 | رئيسية الطالب | مطلوباتي + حلقتي ومعلمي وتقدّمي + آخر درجاتي | student | `StudentHome.tsx` | `studentHomeData` | enrollments, halaqat, teachers, persons, curriculum_progress, exam_submissions | تعمل | `home.server.ts:319-349`؛ `StudentHome.tsx:13-76` |
| 139 | الرئيسية العامّة (بقية الأدوار) | «المطلوب مني الآن» من بطاقات مهامّي حتى تُبنى عدسة الدور | أي دور بلا عدسة | `GenericHome.tsx` | `homeData` (`role:"generic"`) → `myTasksSummaryData` | حسب البطاقات | تعمل | `home.server.ts:391-393`؛ `GenericHome.tsx:15-44` |
| 140 | تشخيص وحدة (النزول السؤالي) | «مَن قائد هذه الوحدة (أو شاغر)؟» للمطّلعين من فوق | مُصادَق | يُفترض من صفحات النزول | `unitDiagnosisData` | role_assignments, persons | غير متحقق (لم يُعثر على مستورِد مؤكَّد) | `home.server.ts:353-365` |
| 141 | ثابت «المدير اطّلاع لا تشغيل» | لا تُدفع للمدير بطاقات اعتماد/زيارات/تقديم؛ يرى فقط ما لا مالك أقرب له | admin | ينعكس في كل الرئيسيات والمهامّ | `myTasks.server.ts`/`home.server.ts` | — | تعمل (ثابت محروس باختبار) | `myTasks.server.ts:44-45`؛ اختبار `admin-not-tasked.test.ts:49-80` |

## الوحدة: الإشعارات — واجهة المستخدم (الجرس والقنوات)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 142 | جرس الإشعارات داخل الموقع | عدّاد غير مقروء، تحديث كل ٦٠ ثانية، النقر يُقرأ ويُفضي لمكان الإنجاز | الجميع (`currentUser`) | TopTabs → `NotificationBell.tsx` | `myNotificationsData`/`markNotificationsReadData` | notifications | تعمل | `notifications.server.ts:130-180`؛ `NotificationBell.tsx:34-102` |
| 143 | توجيه الإشعار لوجهته (`toOf`) | خريطة نوع→مسار داخل الموقع (تقرير/إشراف/مكتبة/حلقاتي/مالية/duties…) | الجميع | داخل الجرس | `myNotificationsData.toOf` | notifications | تعمل | `notifications.server.ts:140-152` |
| 144 | نصوص الإشعارات العربية | صياغة نصّ لكل نوع (١٩ نوعاً) من حمولته | الجميع | داخل الجرس | `notifText` | notifications | تعمل | `notifications.server.ts:59-128` |
| 145 | ربط تيليغرام (deep-link) | توليد رمز مؤقّت (١٥ دقيقة) + رابط `t.me?start=<token>` لالتقاط chat_id | الجميع | «ربط تيليغرام» في الجرس | `linkTelegramData`/`telegramStatusData` | person_contacts | تعمل | `notifications.server.ts:37-56`؛ `NotificationBell.tsx:52-59` |
| 146 | تفعيل Web Push من الجرس | مفتاح عمومي + حفظ/حذف اشتراك الجهاز + تفعيل/إيقاف | الجميع | «إشعارات المتصفّح» في الجرس؛ `lib/push.ts` | `pushPublicKeyData`/`savePushSubscriptionData`/`deletePushSubscriptionData` | push_subscriptions | تعمل | `notifications.server.ts:9-34`؛ `NotificationBell.tsx:61-71`؛ اختبار `webpush.test.ts:31-86` |

## الوحدة: البحث (type-ahead)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 147 | الشجرة التنظيمية المُنطاقة | قائمة مسطّحة بـparentId ضمن نطاق المستخدم لمنتقي الشجرة | مُصادَق (منتقو الشجرة في الإدارة) | `MTreeSelect` (AdminPage/UsersPanel/OrgUnitEditor) | `search.server.ts orgTree` | org_units | تعمل | `search.server.ts:11-22`؛ `lib/api/search.ts:34-36` |
| 148 | بحث الأشخاص/المعلّمين/الأماكن | type-ahead يُرجع أعلى ٢٠ نتيجة | مُصادَق | AlaBaseeraPage/CompetitionPage | `searchPersons`/`searchTeachers`/`searchVenues` | persons, teachers, venues | تعمل | `search.server.ts:24-51`؛ `AlaBaseeraPage.tsx:39-41` |
| 149 | بحث الوحدات المُنطاق | بحث وحدات ضمن النطاق مع ترشيح النوع | مُصادَق | CompetitionPage | `searchOrgUnits` | org_units | تعمل | `search.server.ts:54-65`؛ `CompetitionPage.tsx:34` |

---

# القسم الرابع: الوحدة المالية

خريطة القدرات المالية (من `app/src/lib/capabilities.ts:148-182`): `finance.view`: finance_officer + المدير فقط (`:179`) · `box.view`: section_head, rabita, square, amir, finance_officer + المدير (`:152-155,179`) · `finance.entry`: section_head, finance_officer + المدير (`:152,179`) · `finance.approve`: section_head, rabita + المدير (`:152-153`) · `finance.payout`: finance_officer + المدير (`:179`) · `finance.supervise`: المدير وحده (`:19`) · `mosqueFinance.view`: amir + المشرفون + المدير؛ `mosqueFinance.manage`: amir + المدير (`:136,161-162`).
المسار `/finance` محروس بـ`box.view` (`routes/finance.tsx:11` → `lib/access.ts:9,49`)؛ من يملك `box.view` بلا `finance.view` يرى «الصندوق» وحده (`FinancePage.tsx:77,150` — فرع `boxOnly`).

## الوحدة: الصندوق الهرمي وسلسلة العهدة المالية (الوثيقة ٣٩)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 150 | عرض «كم بقي معي؟» بالعملات + صناديق ما تحتي + آخر الحركات | بطاقة رصيد الوحدة بعملاتها الأصلية وتجميع الأبناء بالدولار | كل صاحب تكليف نشط على الوحدة (أمين) + المدير للمركز؛ اطّلاع نزولاً لكل سلَف | `/finance` تبويب «الصندوق» | `unitBoxData` (boxes.server.ts:29) → `boxBalances`,`subtreeBoxSummary` (unitBox.ts:114,132) | journal_lines, journal_entries, org_units, handovers, box_closings, expense_categories | تعمل | `boxes.server.ts:29-75`؛ اختبار `unitBox-e2e.test.ts`؛ `BoxPanel.tsx:85-92` |
| 151 | قبض متعدد العملات في الصندوق | تبرّع/استلام مالٍ بأسطر عملات (دولار+سوري+تركي) في عملية واحدة | أمين الصندوق حصراً (`isCustodian`) | «الصندوق» زر «قبض» | `boxReceiveData` (boxes.server.ts:77) → `receiveToBox` (unitBox.ts:30) | journal_entries, journal_lines, currencies, fx_rates | تعمل | `boxes.server.ts:77-84`؛ `unitBox.ts:30-44`؛ `BoxPanel.tsx:113,135` |
| 152 | الصرف من الصندوق بفئة مغلقة + ربط استحقاق | صرفٌ بأسطر عملات بفئةٍ من القاموس، ويمنع دفع الاستحقاق مرتين | أمين الصندوق حصراً | «الصندوق» زر «دفع» | `boxSpendData` (boxes.server.ts:86) → `spendFromBox` (unitBox.ts:47) | journal_*, expense_categories, monthly_entitlements | تعمل | `boxes.server.ts:86-93`؛ `unitBox.ts:47-71`؛ `BoxPanel.tsx:114,136` |
| 153 | تسليم عهدة ماليّة لوحدة أدنى | دفعٌ من الأعلى وقبضٌ آليٌّ عند الأدنى بقيدٍ واحد، ضمن الشجرة فقط | أمين الوحدة المُسلِّمة حصراً | «الصندوق» زر «تسليم عهدة» | `boxHandoverData` (boxes.server.ts:95) → `handoverDown` (unitBox.ts:74) | handovers, journal_* | تعمل | `boxes.server.ts:95-102`؛ `unitBox.ts:74-97`؛ `BoxPanel.tsx:115,138` |
| 154 | إقرار استلام العهدة الماليّة (بصمة الطرف الثاني) | أمين الوحدة المستلمة يقرّ الاستلام فيُغلق التسليم | أمين الوحدة المستلمة حصراً | بطاقة «عهدةٌ سُلِّمت إليك» | `boxAcknowledgeData` (boxes.server.ts:104) → `acknowledgeHandover` (unitBox.ts:100) | handovers, users, role_assignments | تعمل | `boxes.server.ts:104-110`؛ `unitBox.ts:100-111`؛ `BoxPanel.tsx:94-107` |
| 155 | توزيع رواتب الشهر هرمياً + خريطة التوزيع | خطة الرواتب مجمّعة بالمناطق، تسليم من المركز لكلٍّ بمبلغها ومتابعة الخريطة | أمين المركز (المدير) حصراً (`isGlobalAdmin`) | «الصندوق» (unitId=root) | `salariesPlanData`,`distributeSalariesData` (boxes.server.ts:113,126) → unitBox.ts:175,194,160 | monthly_entitlements, persons, org_units, handovers | تعمل | `boxes.server.ts:113-132`؛ `unitBox.ts:175-205`؛ `BoxPanel.tsx:147-181` |
| 156 | الإقفال الدوري (رفع «استلمتُ/صرفتُ/بقي») | أمين الوحدة يقفل شهره ويرفعه ملخّصاً بالعملات | أمين الوحدة حصراً (غير المركز) | زر «أقفل هذا الشهر» | `submitClosingData` (boxes.server.ts:135) → `submitBoxClosing` (unitBox.ts:214) | box_closings, handovers, journal_* | تعمل | `boxes.server.ts:135-146`؛ `unitBox.ts:214-248`؛ `BoxPanel.tsx:202-214` |
| 157 | اعتماد الإقفال (الطبقة الأقرب/NESSA) | الطبقة الأقرب فوق الوحدة تعتمد الإقفال، والمدير عند الشغور | صاحب الطبقة الأقرب (`approverLayerFor`) أو المدير عند الشاغر | بطاقة «إقفالاتٌ تنتظر اعتمادك» | `pendingClosingsData`,`approveClosingData` (boxes.server.ts:148,156) → unitBox.ts:272,251 | box_closings, org_units, role_assignments, users | تعمل | `boxes.server.ts:148-162`؛ `unitBox.ts:251-285`؛ `BoxPanel.tsx:216-232` |

## الوحدة: المحاسبة المركزية والدفتر المزدوج

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 158 | نظرة الدفتر (أرصدة الصناديق + ميزان المراجعة + برهان التوازن) | قراءة من الدفتر المزدوج الخفيّ بلغةٍ بسيطة | `finance.view` | «الدفتر والقوائم» | `ledgerOverviewData` (ledger.server.ts:21) → `trialBalance`,`fundBalances` (ledger.ts:120,141) | accounts, journal_entries, journal_lines, funds | تعمل | `ledger.server.ts:21-33`؛ `ledger.ts:120-159`؛ `FinancePage.tsx:393,445`؛ اختبار `ledger.test.ts` |
| 159 | دفتر اليوميّة (القيود بسطورها للمدقّق) | أحدث القيود بسطورها المدينة/الدائنة | `finance.view` | زر عرض اليومية | `journalData` (ledger.server.ts:44) | journal_entries, journal_lines, accounts | تعمل | `ledger.server.ts:44-60`؛ `FinancePage.tsx:464` |
| 160 | ردم الدفتر من الحركات التاريخية (backfill) | ترحيل التبرّعات/المصروفات/الرواتب/المحروقات السابقة idempotent | المدير حصراً (`isGlobalAdmin`) | زر backfill | `backfillLedgerData` (ledger.server.ts:36) → `backfillLedger` (ledgerBackfill.ts:7) | donations, expenses, payouts, asset_expenses, journal_* | تعمل | `ledger.server.ts:36-41`؛ `ledgerBackfill.ts:7-29`؛ اختبار `ledger-backfill.test.ts` |
| 161 | محرّك الدفتر المزدوج (postJournal/عكس القيد) | ترحيل قيدٍ متوازنٍ ذرّياً، والتصحيح بعكسٍ لا حذف | داخليّ (تستدعيه كل الخدمات) | — | `postJournal`,`reverseJournal`,`reverseByRef`,`hasActivePosting` (ledger.ts:31,81,110,102) | journal_entries, journal_lines, accounts, funds, fiscal_periods | تعمل | `ledger.ts:31-117`؛ اختبار `ledger.test.ts`؛ `reverseByRef` من `assets.server.ts:157-158` |
| 162 | مولّد القيود من الأحداث | postDonation/postExpense/postPayout/postFuel — كل حدثٍ ماليٍّ قيدٌ متوازن idempotent | داخليّ | — | ledgerPost.ts:19,37,48,59,30 | journal_* | تعمل | `ledgerPost.ts:19-67`؛ اختبار `ledger-posting.test.ts` |
| 163 | القوائم المالية الثلاث (نشاط/مركز/تدفّق نقديّ) | قائمة نشاط بالصندوق + مركز ماليّ متوازن + تدفّق مباشر | `finance.view` | «الدفتر والقوائم» + طباعة/CSV | `financialStatementsData` (ledger.server.ts:146) → statements.ts:27,123,74 | journal_*, accounts, funds | تعمل | `ledger.server.ts:146-154`؛ `FinancePage.tsx:409,791-905`؛ اختبار `statements.test.ts` |
| 164 | الموازنة (ضبط + تقرير مخطّط/فعليّ + تحذير) | موازنة صندوق/فترة، والفعليّ من الدفتر، وتنبيه بشريّ عند التجاوز | ضبط: فاعل ماليّ (`finance.entry`/`approve`)؛ عرض: `finance.view` | قسم الموازنة | ledger.server.ts:99,109 → budgets.ts:12,55,90 | budgets, funds, accounts, journal_* | تعمل | `ledger.server.ts:99-113`؛ `FinancePage.tsx:403,653`؛ اختبار `budgets.test.ts` |
| 165 | مطالبات الصرف (فصل المهامّ) | المطالبة المعلّقة لا تحرّك مالاً؛ الاعتماد يُنشئ المصروف ويرحّله | تقديم: `finance.entry`/`approve`؛ بتّ: فاعل ماليّ | قسم المطالبات | ledger.server.ts:116,127,139 → expenseClaims.ts:12,25,44,53 | expense_claims, funds, expenses, journal_* | تعمل | `ledger.server.ts:116-143`؛ `FinancePage.tsx:406,710` |
| 166 | الصناديق النثريّة (سلفة مستديمة) | سقفٌ ثابت يُصرف منه ويُزوَّد ليعود للسقف | إدارة: فاعل ماليّ؛ عرض: `finance.view` | قسم النثريّة | ledger.server.ts:237-268 → pettyCash.ts:15,42,62,88,97 | petty_cash_boxes, petty_cash_txns, journal_* | تعمل | `ledger.server.ts:237-272`؛ `FinancePage.tsx:415,1059`؛ اختبار `pettyCash.test.ts` |
| 167 | الأصول الثابتة والإهلاك | رسملة/إهلاك شهريّ بالقسط الثابت/استبعاد بقيود مكسب/خسارة | إدارة: فاعل ماليّ؛ عرض: `finance.view` | قسم الأصول الثابتة | ledger.server.ts:275-300 → depreciation.ts:14,70,114,90 | fixed_assets, depreciation_runs, journal_* | تعمل | `ledger.server.ts:275-308`؛ `FinancePage.tsx:418,1151`؛ اختبار `depreciation.test.ts` |
| 168 | المطابقة البنكيّة/النقديّة | كل قيدٍ يمسّ حساب نقدٍ يُوسَم «طُوبِق»؛ التقرير يقابل رصيد الدفتر | وسم: `finance.approve`؛ عرض: `finance.view` | قسم المطابقة | ledger.server.ts:454,461 → reconciliation.ts:11,27,37 | reconciliations, journal_* | تعمل | `ledger.server.ts:454-466`؛ `FinancePage.tsx:424,1574`؛ اختبار `reconciliation.test.ts` |
| 169 | تعدّد العملات (أسعار/أرصدة/تصريف) | العملة الوظيفية بالدولار، أسعار مؤرّخة، وتصريفٌ يثبّت فروق العملة | ضبط/تصريف: فاعل ماليّ؛ عرض: `finance.view` | قسم العملات | ledger.server.ts:361,368,377 → currencies.ts | currencies, fx_rates, journal_* | تعمل | `ledger.server.ts:361-386`؛ `FinancePage.tsx:396,1622`؛ اختبار `currencies.test.ts` |
| 170 | المانحون وكشوفهم | قائمة المانحين بإجمالياتهم + كشفٌ كاملٌ للمانح | `finance.view` | تبويب «المانحون» | ledger.server.ts:63,68 → donorsReport.ts:9,23 | donors, donations | تعمل | `ledger.server.ts:63-72`؛ `FinancePage.tsx:399,558`؛ اختبار `donors-report.test.ts` |
| 171 | التعهّدات المفتوحة | تعهّدُ مانحٍ بمبلغ، ويُطبَّق آلياً على تبرّعاته لنفس الصندوق | تسجيل: `finance.entry`/`approve`؛ عرض: `finance.view` | تبويب «المانحون» | ledger.server.ts:75,92 → pledges.ts:10,21,40 | pledges, donors | تعمل | `ledger.server.ts:75-96`؛ `FinancePage.tsx:400,601`؛ اختبار `pledges.test.ts` |
| 172 | دفعات الصرف المجمّعة | دفعة تجمع بنود صرفٍ تُصرَف بقيدٍ واحدٍ متوازن + كشف طباعة | إنشاء/بنود: `finance.entry`/`approve`؛ صرف: فاعل ماليّ | تبويب «الاستحقاقات» | ledger.server.ts:319-358 → paymentBatches.ts | payment_batches, payment_batch_items, journal_* | تعمل | `ledger.server.ts:319-358`؛ `FinancePage.tsx:421,1716`؛ اختبار `paymentBatches.test.ts` |
| 173 | المصنّف الشامل (تصدير Excel ١٩ ورقة) | دالّةٌ مجمِّعةٌ تُخرج JSON لـ١٩ ورقة، والمتصفّح يصوغ الملف | `finance.view` | زر «تصدير Excel» | `financeWorkbookData` (ledger.server.ts:469) → `collectFinanceWorkbook` (financeWorkbook.ts:40) | كل جداول المالية | تعمل | `ledger.server.ts:469-474`؛ `FinancePage.tsx:202,1246`؛ اختبار `financeWorkbook.test.ts` |
| 174 | الاستيراد بالقوالب (٩ أنواع) | تحقّق «الكلّ أو لا شيء» صفّاً صفّاً، دفعةٌ ببصمة محتوى، تنفيذٌ مستأنَف | فاعل ماليّ (يمرّ بالاعتماد لمن عليه سياسة) | قسم الاستيراد | ledger.server.ts:478-519 → financeImport.ts:53-365 | import_batches, import_rows, funds, currencies, org_units, persons, payment_batches, donors | تعمل | `ledger.server.ts:478-532`؛ `FinancePage.tsx:427,1295`؛ اختبار `financeImport.test.ts` |
| 175 | محرّك الاعتماد الثنائيّ | صندوق الاعتماد/مقترحاتي/معاينة الدفتر/قرار/إلغاء/إعادة — أفعال من عليه سياسة تُقترَح والمدير يعتمد فتُنفَّذ | قرار: `finance.supervise` (المدير)؛ الباقي: فاعل ماليّ/`finance.view` | تبويب «القرارات» | ledger.server.ts:397-428 → financeActions.ts:19-441 | finance_actions, approval_policies, notifications, accounts, funds + جداول المنفّذين | تعمل | `ledger.server.ts:388-428`؛ `FinancePage.tsx:218,293-296,1442,1519`؛ اختبارات `financeActions.test.ts`, `dualControl-wiring.test.ts`, `approval-inbox.test.ts` |

## الوحدة: مالية المسجد الداخلية

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 176 | عرض مالية المسجد (تبرّعات/مصروفات/رصيد) | إجماليات المسجد ورصيده مع عزل النطاق | `mosqueFinance.view` (أمير+مشرفون+مدير) | `/mosque/$mosqueId` تبويب «المالية الداخلية» | `mosqueFinanceData`,`mosqueTxns` (mosqueFinance.server.ts:19,40) | donations, expenses, org_units | تعمل | `mosqueFinance.server.ts:19-55`؛ `MosquePage.tsx:169,277`؛ `mosque-tabs.ts:18` |
| 177 | تسجيل تبرّع (سند مرقّم + صندوق + عملة + تعهّدات) | مانحٌ + صندوقٌ + سند قبضٍ مرقّم + ترحيلٌ للدفتر بعملته | `mosqueFinance.manage` (أمير+مدير)؛ يمرّ بالاعتماد الثنائي لمن عليه سياسة | `TxnPanel` | `addDonationData` (mosqueFinance.server.ts:69) → `guardFinanceAction` + `recordDonation` (donorsFinance.ts:30) | donations, donors, counters, pledges, journal_* | تعمل | `mosqueFinance.server.ts:69-85`؛ `donorsFinance.ts:30-53`؛ اختبار `donors-funds.test.ts` |
| 178 | تسجيل مصروف (عملة + تحذير موازنة) | تحويل العملة للدولار، ضبط المقيّد، ترحيل، وتحذير موازنة غير مانع | `mosqueFinance.manage`؛ يمرّ بالاعتماد الثنائي | `TxnPanel` | `addExpenseData` (mosqueFinance.server.ts:87) → `guardFinanceAction` + `enterExpense` (financeEntry.ts:10) | expenses, funds, journal_* | تعمل | `mosqueFinance.server.ts:87-109`؛ `financeEntry.ts:10-21` |
| 179 | سجل حركات المسجد (مصفّح) | قائمةٌ مصفّحة بالحركات لكل نوع | `mosqueFinance.view` | تبويب المالية الداخلية | `mosqueTxns` (mosqueFinance.server.ts:40) | donations, expenses | تعمل | `mosqueFinance.server.ts:40-55`؛ `MosqueFinancePage.tsx:113-118` |

## الوحدة: الرواتب والحوافز والاستحقاقات

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 180 | احتساب المستحقّات الشهرية (مقطوع/نقاط/ساعات) | المستحق = جمع مسارات الشخص (إدارة عليا مقطوع، أمير نقاط، معلّم ساعات) | المدير حصراً (`requireFinanceAdmin`) | تبويب «الاستحقاقات» زر «احتساب» | `computeFinanceData` (finance.server.ts:177) → finance.ts:26,62 | role_assignments, weekly_records, monthly_entitlements, entitlement_tracks, teachers, lesson_sessions | تعمل | `finance.server.ts:177-198`؛ `FinancePage.tsx:203-212`؛ اختبار `finance-e2e.test.ts` |
| 181 | اعتماد المستحق | ترقية الترشيح من proposed→approved | المدير حصراً (`requireFinanceAdmin`)؛ الزر بالواجهة لـ`finance.approve` | زر «اعتماد» | `approveFinanceData` (finance.server.ts:200) → finance.ts:96 | monthly_entitlements | تعمل | `finance.server.ts:200-205`؛ `FinancePage.tsx:1931-1944` |
| 182 | تسجيل صرف المستحق (payout) | تسجيل الصرف وترحيله للدفتر (مدين رواتب/دائن نقد) | الخادم: المدير حصراً؛ الزر بالواجهة لـ`finance.payout` (يملكه finance_officer!) | زر «صرف» | `payoutFinanceData` (finance.server.ts:207) → `recordPayout` (finance.ts:106) | payouts, monthly_entitlements, journal_* | جزئية (تعارض دور/خادم: الزر يظهر للمالي ويفشل خادمياً) | `finance.server.ts:44,207-212`؛ `FinancePage.tsx:1959-1966`؛ `capabilities.ts:179` |
| 183 | عرض الاستحقاقات في شجرة الهيكلية + بحث | مستحقّات الشهر مصنّفة بالوحدات مع عزل النطاق | `finance.view`؛ عزل: المدير=الكل، غيره=نطاقه | شجرة المستفيدين | `financeData`,`financeTreeData` (finance.server.ts:72,143) | monthly_entitlements, entitlement_tracks, payouts, persons, org_units, role_assignments, rate_schemes | تعمل | `finance.server.ts:72-174`؛ `FinancePage.tsx:102,342-388` |
| 184 | كشف الراتب (بدلات/خصومات/سُلَف/صافٍ) | كشفٌ بالإجماليّ والبدلات والخصومات وقسط السلفة والصافي | تعديلات: فاعل ماليّ؛ عرض: `finance.view` | modal كشف الراتب | ledger.server.ts:157,166,179 → payroll.ts:11-56 | payroll_adjustments, monthly_entitlements, persons, staff_advances | تعمل | `ledger.server.ts:157-183`؛ `FinancePage.tsx:429,923`؛ اختبار `payroll.test.ts` |
| 185 | سُلَف الموظّفين (منح/استرداد أقساطاً) | النقد يصير ذمّةً مدينةً ثم يُستردّ من الراتب أقساطاً | فاعل ماليّ؛ عرض: `finance.view` | قسم السُلَف + كشف الراتب | ledger.server.ts:186,196,204 → advances.ts | staff_advances, persons, journal_* | تعمل | `ledger.server.ts:186-208`؛ `FinancePage.tsx:412,936,1005`؛ اختبار `advances.test.ts` |
| 186 | الحوافز التشغيليّة | مبالغ تحفيزية اختيارية لمستفيدين شهرياً | المدير حصراً (`requireFinanceAdmin`)؛ يظهر إذا `canApprove` | قسم الحوافز | `incentivesData/addIncentiveData/removeIncentiveData` (incentives.server.ts:16,30,41) | incentives | تعمل | `incentives.server.ts:9-46`؛ `FinancePage.tsx:390,1836` |

## الوحدة: التقارير (الشهري + القياديّ)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 187 | التقرير الشهري للمسجد + قيمته المالية | يولّد نقاط الشهر وقيمتها المالية (بمعدّل النقطة) وحالة الاعتماد | عبر تقرير المسجد (الصف 51) | `/mosque/$mosqueId` تبويب التقرير | `monthlyMosqueReport` (reports.ts:10) — من data.server.ts:214 | org_units, weekly_records, daily_entries, rate_schemes | تعمل | `reports.ts:10-61`؛ `data.server.ts:7,214` |
| 188 | قالب HTML للتقرير القياديّ مع إجمالي مستحقات الشهر | صفحة HTML للطباعة تعرض `financeTotal` | عبر تصدير الشبكة (الصف 43) | `/network` (تصدير HTML) | `networkRollupHtml` (reportHtml.ts:38) — من lib/api/network.ts:83 | (تجميع الشبكة) | تعمل | `reportHtml.ts:38-115`؛ `lib/api/network.ts:83-84` |

**ملاحظات ربط مالية (توثيق لا حكم):**
- `finance.entry`/`finance.approve` ممنوحتان لـsection_head/rabita (`capabilities.ts:152-153`) لكن `FinancePage` يحجب مساحات العمل خلف `finance.view` عبر فرع `boxOnly` (`FinancePage.tsx:77,150-157`) — القدرتان تعملان خادمياً بلا أي مدخل واجهي.
- «القيد اليدوي» و«الرصيد الافتتاحي» نقطتا خادم بمنفّذين في محرّك الاعتماد بلا أي واجهة (انظر الميتة/المدفونة).

---

# القسم الخامس: العُهد والأصول والإعلام والمنصّة

سياق: `assets.manage` قدرة نطاقية (admin عبر `*`، rabita/square/section_head عبر `SUPERVISOR_VIEW`، amir صراحةً). `custody.own` و`media.post` قدرتان شخصيّتان — `*` لا يمنحهما، فالمدير لا يقرّ عهدة ولا ينشر تغطية. `media.hub` نطاقية: admin وmedia وsection_head/rabita/square (`capabilities.ts:131-182,198-209`).

## الوحدة: سلسلة حيازة العُهد (`/custody`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 189 | عرض «عُهدُ نطاقي» | كل عهد الشجرة بحائزها وحالها ومنذ متى، وما ينتظر إقراراً أولاً + مرشّحو التسليم | `assets.manage` + أحد `CUSTODY_SCOPE_ROLES` (section_head, rabita, square, amir)؛ admin عبر `*` | `routes/custody.tsx` ← تبويب «عُهدُ نطاقي» | `scopeCustodyData` (`requireManage`, `scopePeople`) | assets, asset_custody, org_units, role_assignments, persons | تعمل | `custody.server.ts:33-92`؛ `CustodyPage.tsx:184-240`؛ اختبار `custody.test.ts:114-123` |
| 190 | تسليم/نقل عهدة لشخص | أول تسليم `assign` وما بعده `transfer`؛ يبقى «بانتظار إقرار المستلم» | نفس أدوار 189 (+عزل `covers`) | حوار «تسليم» | `assignCustodyData` ← `assignCustody` | assets, asset_custody, persons, audit_log | تعمل | `custody.server.ts:113-125`؛ `services/assetCustody.ts:31-55`؛ اختبار `custody.test.ts:50-97` |
| 191 | إقرار المستلم بالاستلام | «استلمتُ» يضبط `ackAt/ackBy`؛ لا يقرّ عنه المسلِّم ولا المدير رغم `*` | أي مُصادَق هو `toPersonId` | تبويب «عُهدتي» زر «استلمتُ» | `acknowledgeCustodyData` ← `acknowledgeCustody` | asset_custody, audit_log | تعمل | `custody.server.ts:127-135`؛ `assetCustody.ts:58-65`؛ اختبار `custody.test.ts:70-85` |
| 192 | إعادة العهدة إلى الوحدة | تُفرَّغ اليد ويبقى الأصل في سجل وحدته (`status=returned`)، مُقرّة بمستلمها | نفس أدوار 189 | زر «إعادة إلى الوحدة» | `returnCustodyData` ← `returnCustody` | assets, asset_custody, audit_log | تعمل | `custody.server.ts:137-148`؛ `assetCustody.ts:68-85` |
| 193 | بلاغ تلف/فقد/إخراج من الخدمة | حالة صريحة (`damaged`/`lost`/`retired`) حدثاً في السلسلة لا حذفاً صامتاً | نفس أدوار 189 | زر «بلاغ تلف» | `reportCustodyData` ← `reportCustody` | assets, asset_custody, audit_log | تعمل | `custody.server.ts:150-161`؛ `assetCustody.ts:88-103` |
| 194 | عرض سلسلة حيازة أصل | كل الحركات الأحدث أولاً (من/إلى/متى/الحال/أقرّ؟) | مسؤول النطاق (`covers`) أو الحائز نفسه | نافذة Timeline | `custodyTimelineData` ← `custodyTimeline` | assets, asset_custody | تعمل | `custody.server.ts:100-110`؛ `assetCustody.ts:106-115`؛ اختبار `custody.test.ts:87-97,125-133` |
| 195 | عرض «عُهدتي» (ما بيدي + ما ينتظر إقراري) | الأصول النشطة باسمي + قائمة انتظار الإقرار | أي مُصادَق؛ التبويب مبوّب بـ`custody.own` | تبويب «عُهدتي» | `myCustodyData` ← `myCustody` | assets, asset_custody | تعمل | `custody.server.ts:95-98`؛ `assetCustody.ts:118-135` |
| 196 | كشف عهد شخص قبل طيّ صفحته (تكامل الاستقالة) | تُعيد الأصول النشطة/المتضرّرة بيد شخص — «الجواب قبل القرار» | دالة داخلية بلا حارس؛ لا مستدعي في أي مسار | — | `openCustodyOf` (مصدَّرة) | assets | جزئية (جاهزة/مختبَرة بلا ربط) | `custody.server.ts:163-170`؛ مستدعاة فقط في `custody.test.ts:142,151,153` |

## الوحدة: الأصول والمركبات ومصروفات المحروقات

(مساحة «الصندوق ← الأصول» — سجل الإنشاء والمحاسبة، منفصلة عن سلسلة الحيازة رغم كتابتهما في جدول `assets`.)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 197 | إنشاء/تعديل أصل (عهدة شخصية/مركبة/آليّة) | «اختر نوع العهدة»، مع تدوين تبديل الحائز في التدقيق | admin(`*`) أو section_head/rabita/square/amir (`manageScopes`) | `routes/finance.tsx` ← `AssetsPanel`/`NewAssetForm` | `saveAssetData` | assets, org_units, persons, audit_log | تعمل | `assets.server.ts:29-76`؛ `AssetsPanel.tsx:131-163`؛ `FinancePage.tsx:432`؛ اختبار `assets.test.ts:20-46` |
| 198 | قائمة الأصول + مصروف آخر ١٢ شهراً لكل مركبة | معزولة بالنطاق، مجموع محروقات لكل مركبة | نفس أدوار 197 (وإلا خطأ «عرض الأصول للمسؤولين») | `AssetsPanel` | `assetsData` | assets, asset_expenses, org_units | تعمل | `assets.server.ts:91-127`؛ اختبار `assets.test.ts:29-33,44` |
| 199 | تسجيل مصروف محروقات/صيانة شهري + ترحيله للدفتر | upsert بالشهر + ترحيل `postFuel` مع عكس القيد القديم عند التحديث | نفس أدوار 197 | `AssetDetails` (للمركبات/الآليّات) | `saveAssetExpenseData` (`postFuel`, `reverseByRef`) | asset_expenses, assets + الدفتر | تعمل | `assets.server.ts:130-162`؛ `AssetsPanel.tsx:80-109` |
| 200 | تغيير حالة الأصل (نشط/مُعاد/خارج الخدمة) | تحديث مباشر على الصف مع تدقيق | نفس أدوار 197 | أزرار الحالة في AssetDetails | `setAssetStatusData` | assets, audit_log | تعمل | `assets.server.ts:78-88`؛ `AssetsPanel.tsx:112-126`؛ اختبار `gap-audit-4.test.ts:151-154` |

**ملاحظتا توثيق:** (أ) `AssetsPanel` معروض على تبويبَي المالية لكن `assetsData` يشترط دور إدارة نطاق — `finance_officer` يرى التبويب فارغاً بخطأ (`assets.server.ts:96`؛ `AssetsPanel.tsx:25`). (ب) «أُعيدت العُهدة» هنا يضبط `status=returned` مباشرة **دون** كتابة حدث في `asset_custody`، وإنشاء أصل بحائز لا يكتب حدث حيازة/انتظار إقرار (`assets.server.ts:59-74`) — بخلاف مسار شاشة العُهد (الصف 192).

## الوحدة: مركز الإعلام — المعرض (`/media-hub`)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 201 | معرض صور الشبكة (ثلاثة روافد) | دمج تغطيات + صور سجلّات اليوم + صور دروس الحلقات، الأحدث أولاً بتاريخ الحدث، معزول بالنطاق، كل صورة منسوبة (ماذا/أين/متى/مَن) | `media.hub` (`requireMediaHub`): admin، media، section_head/rabita/square | تبويب «معرض الصور» | `mediaGalleryData` | media_coverages, attachments, weekly_records, lesson_attachments, lesson_sessions, halaqat, venues, org_units, role_assignments, users, persons, teachers | تعمل | `mediaHub.server.ts:20-181`؛ `MediaHubPage.tsx:165-278`؛ اختبار `mediaHub.test.ts:57-94` |
| 202 | تشخيص فراغ المعرض (عدّاد مسؤولي الإعلام) | يميّز «لا صور» عن «لا مسؤول إعلام معيَّن» | نفس أدوار 201 | الحالة الفارغة | `mediaGalleryData` (فرع officers) | role_assignments (role=media) | تعمل | `mediaHub.server.ts:175-180`؛ `MediaHubPage.tsx:199-217`؛ اختبار `mediaHub.test.ts:180-188` |
| 203 | «عُهدتي» داخل الإعلام | الأصول النشطة باسم صاحب الشاشة (كاميرته)؛ التبويب لا يظهر لمن لا عهدة له | `media.hub` ثم عزل `holderPersonId === u.personId` | تبويب «عُهدتي» | `mediaAssetsData` | assets, org_units | تعمل | `mediaHub.server.ts:250-268`؛ `MediaHubPage.tsx:280-312` |

## الوحدة: التغطية الإعلامية ككيان حدث بألبوم

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 204 | إنشاء تغطية (عنوان/نوع/وحدة/تاريخ وقوع/نص) | كيان حدث يُنشأ أولاً ثم تُرفع صوره إليه؛ نوع من معجم `media-kinds` | `media.post` (شخصية): media وحده أو من مُنح تجاوزاً؛ المدير يُرفض رغم `*` | نافذة Composer | `createCoverageData` | media_coverages, org_units, audit_log | تعمل | `mediaHub.server.ts:204-230`؛ `MediaHubPage.tsx:45-117`؛ اختبار `mediaHub.test.ts:114-165` |
| 205 | صفحة التغطية/الألبوم + نسبتها | النص + كل الصور + من/أين/متى، وعلامة `mine` للناشر | `media.hub` + عزل بالنطاق | نافذة CoverageView | `coverageDetailData` | media_coverages, attachments, org_units, users, persons | تعمل | `mediaHub.server.ts:184-202`؛ `MediaHubPage.tsx:119-163` |
| 206 | حذف تغطية (مع صورها) | لناشرها وحده | `createdBy === u.userId` فقط | زر الحذف (يظهر إن `mine`) | `deleteCoverageData` | media_coverages, attachments, audit_log | تعمل | `mediaHub.server.ts:233-244`؛ `MediaHubPage.tsx:123-127,146`؛ اختبار `mediaHub.test.ts:167-177` |

## الوحدة: رفع الوسائط وخدمتها من R2

نقطتا دخول HTTP خارج مسارات TanStack، مركّبتان في `server.ts:59-60`: GET `/media/*` وPOST `/api/media/upload`.

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 207 | خدمة ملف من R2 بجلسة وجمهور | جلسة شرط، وملفات المكتبة تُفحص بجمهور مادّتها، وحماية `nosniff` | أي مُصادَق؛ ملفات `materials/` بجمهورها (amir/teacher/supervisor؛ admin/section_head دائماً) | `/media/*` | `handleMediaRequest`, `canReadMediaKey` | materials | تعمل | `media.server.ts:32-66`؛ `server.ts:59-60`؛ اختبار `gap-audit-3.test.ts:162-170` |
| 208 | رفع صورة تغطية | scope=`media_post`: يشترط `media.post` وأن التغطية للناشر نفسه | `media.post` + `cov.createdBy === user.userId` | `/api/media/upload` ← Composer | فرع media_post | media_coverages, attachments | تعمل | `media.server.ts:110-127`؛ `MediaHubPage.tsx:62-68` |
| 209 | رفع صورة توثيق سجل اليوم | scope=`daily_record`: لأمير المسجد أو طبقة أعلى تغطّيه؛ idempotency بـ`clientUuid` | amir المسجد، أو admin/square/rabita مغطٍّ | `/api/media/upload` ← DailyLogPage/outbox | فرع daily_record | weekly_records, attachments | تعمل | `media.server.ts:129-150`؛ `DailyLogPage.tsx:88` |
| 210 | رفع مرفق درس حلقة | لأمير مكان الحلقة أو المعلّم المالك؛ حلّ المعرف عبر `lessonClientUuid` عند الأوفلاين | amir لـ`venue.orgUnitId` أو المعلّم المالك | `/api/media/upload` ← MyCirclesPage/outbox | الفرع الأخير | lesson_sessions, halaqat, venues, teachers, lesson_attachments | تعمل | `media.server.ts:152-179`؛ `MyCirclesPage.tsx:307` |
| 211 | رفع مادة مكتبة تدريبية (PDF/صوت، حتى ٣٠م.ب) | scope=`training_material` للإدارة العليا/رأس القسم | admin أو section_head | `/api/media/upload` ← LibraryPage | فرع training_material | R2 فقط (يُعاد `r2Key`) | تعمل | `media.server.ts:95-105`؛ `LibraryPage.tsx:213` |

**ملاحظتا توثيق:** فروع الرفع غير مغطّاة باختبارات وحدة مباشرة (المُختبَر `canReadMediaKey` فقط). وفرع `media_post` يُدرِج `sizeBytes` عبر `as never` وجدول `attachments` لا يحوي العمود — يُسقَط صامتاً (`media.server.ts:121-125` مقابل `schema.ts:626-638`).

## الوحدة: الإعلانات

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 212 | إنشاء إعلان منصّة + توزيعه على الجرس | إعلان ضمن نطاق بجمهور (all/leaders/students)، يُنشئ إشعاراً لكل ذي حساب في النطاق | admin (`isGlobalAdmin`) أو section_head/rabita/square/amir على نطاقه؛ فحص دور مباشر لا `hasCap` | `routes/admin.tsx` تبويب «الإعلانات» | `createAnnouncementData` | announcements, role_assignments, users, notifications, audit_log | تعمل (بلا اختبار مخصّص؛ مذكورة في «الحالة الحالية» `06:1949`) | `announcements.server.ts:12-53`؛ `AnnouncementsPanel.tsx:28-36`؛ `AdminPage.tsx:140,273-274` |
| 213 | قائمة آخر الإعلانات | آخر ٣٠ إعلاناً زمنياً | أي مُصادَق | العمود الأيمن | `announcementsListData` | announcements | تعمل | `announcements.server.ts:55-61`؛ `AnnouncementsPanel.tsx:23` |
| 214 | نطاقات الإعلان المتاحة للمستخدم | «المنصّة كلها» + الأقسام/المناطق للمدير، أو مسارات تكاليف المشرف | admin أو حامل دور هرمي | منتقي النطاق | `announceScopesData` | org_units | تعمل | `announcements.server.ts:64-82`؛ `AnnouncementsPanel.tsx:24` |

## الوحدة: المنصّة (PWA / أوفلاين / أمن القشرة)

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 215 | تطبيق PWA قابل للتثبيت | manifest عربي RTL بوضع standalone وأيقونة | الجميع | `public/manifest.webmanifest` (يُحمَّل من `__root.tsx`) | — | — | تعمل | `app/public/manifest.webmanifest:1-17` |
| 216 | العمل دون اتصال — تخبئة زمن التشغيل | Service Worker يدويّ (Cache API) بصفحة سقوط عربية مضمّنة؛ لا يُخبّئ الكتابات | الجميع | `public/sw.js` | — | — | تعمل | `app/public/sw.js:1-40` |
| 217 | العمل دون اتصال — طبقة Outbox للكتابات | حفظ العمليات محلياً (IndexedDB) ومزامنة تلقائية عند عودة الشبكة، بمفاتيح idempotency | الجميع (الدرس/سجل التحفيظ/الطلاب/أنشطة النساء/الصور) | `src/lib/offline/` (db/outbox/sync) + `useOfflineStatus` | عبر RPCات idempotent | — | تعمل | `app/src/lib/offline/outbox.ts:43-46`؛ `app/src/lib/offline/sync.ts`؛ الشارة الصف 103 |
| 218 | استقبال Web Push في عامل الخدمة | معالجا `push` و`notificationclick` يعرضان الإشعار ويفتحان وجهته | الجميع (من فعّل Push) | `public/sw.js` | (الإرسال من الخادم — الصف 224) | — | تعمل | `app/public/sw.js:63,78` |
| 219 | صفحة الخطأ الكارثي العربية | التقاط أخطاء SSR المبتلعة وعرض صفحة خطأ مهذّبة بدل JSON | النظام | نقطة الدخول | `server.ts normalizeCatastrophicSsrResponse` + `lib/error-capture`/`error-page` | — | تعمل | `app/src/server.ts:1-4,24-39,69-74` |
| 220 | حقن ربط Cloudflare (D1/R2) لكل طلب | `setCloudflareEnv` قبل أي معالجة ليقرأه `useDb()` | النظام | نقطة الدخول | `server.ts:57` + `utils/db.ts` | — | تعمل | `app/src/server.ts:53-61` |

---

## ميزات بلا واجهة (مجدولات/بوتات/إشعارات)

نقطة الدخول: `server.ts scheduled()` عبر Cloudflare Cron **كل ساعة** (`app/wrangler.toml [triggers] crons=["0 * * * *"]`؛ `app/src/server.ts:78-89`). الإدراج idempotent بمفتاح `personId|kind|weekStart|refId`.

| # | الميزة | وصف بسطر | من يستخدمها (أدوار) | المسارات | كود الخادم | الجداول | الحالة | الدليل |
|---|---|---|---|---|---|---|---|---|
| 221 | ويبهوك تيليغرام | يعالج `/start <token>` بتحقّق سرّي، يخزّن chat_id ويؤكّد للمستخدم؛ يبطل حقن HTML | النظام | POST `/api/telegram/webhook` (من server.ts:63-65) | `telegram.server.ts handleTelegramRequest` | person_contacts | تعمل | `telegram.server.ts:10-40`؛ اختبار `telegram-webhook.test.ts:28-48` |
| 222 | تذكير الإدخال المتأخّر | مساجد لم تُدخل/تأخّرت ≥ يومين ⇒ تذكير للأمير الحالي (لا المؤرشف) | النظام (يستهدف amir) | cron | `runDueTasksData` خطوة ١ | org_units, weekly_records, role_assignments, notifications | تعمل | `scheduled.server.ts:50-66`؛ اختبار `scheduled-flow.test.ts:38-` |
| 223 | تصعيد الاعتماد المتأخّر (> ٧ أيام) | سجلّ «اعتمده الأمير» وتأخّرت الطبقة ⇒ إشعار للمربع ثم المنطقة | النظام (square/rabita) | cron | خطوة ٢ | weekly_records, role_assignments, notifications | تعمل | `scheduled.server.ts:68-84` |
| 224 | تذكير الإشراف الميدانيّ | حلقات لم تُزَر/تجاوزت الدورة ⇒ إشعار أقرب مشرف مغطٍّ | النظام (square/rabita/section_head) | cron | خطوة ٣ + `supervision.server.overdueCirclesForReminders` | role_assignments, notifications, supervision_visits, tahfeez_circles, halaqat, venues | تعمل | `scheduled.server.ts:86-116`؛ `supervision.server.ts:286` |
| 225 | تذكير المكتبة التدريبيّة | مادّة إلزامية استُلمت منذ ≥ ١٤ يوماً بلا إنجاز ⇒ تذكير أسبوعيّ | النظام | cron | خطوة ٤ | materials, material_progress, notifications | تعمل | `scheduled.server.ts:118-140` |
| 226 | التذكيرات النسبيّة | درس خلال ≤ ٣ ساعات · نشاط/اختبار يستحقّ خلال ≤ ٢٤ ساعة ولم يُجَب | النظام (طلاب/أمير) | cron | خطوة ٥ أ/ب/ج | mosque_lessons, activities, activity_responses, exams, exam_submissions, circles, circle_students, notifications | تعمل | `scheduled.server.ts:142-209` |
| 227 | تذكير سجلّ اليوم للتحفيظ | حلقة بطلاب ومعلّم بلا جلسة اليوم ⇒ تذكير يوميّ واحد للمعلّم | النظام (المعلّم) | cron | خطوة ٥-د | tahfeez_circles, tahfeez_students, tahfeez_sessions, notifications | تعمل | `scheduled.server.ts:211-225`؛ اختبار `scheduled-flow.test.ts:127-` |
| 228 | الإيصال عبر القناتين (dispatch) | معالجة الطابور: تيليغرام + Web Push لكل من ربط؛ النجاح إن وصلت إحداهما؛ تنظيف الاشتراك المنتهي (410) | النظام | cron خطوة ٦ | `services/notifications.ts dispatchQueued/buildMessage/sendTelegram` | notifications, person_contacts, push_subscriptions | تعمل | `services/notifications.ts:173-212`؛ `scheduled.server.ts:231-243`؛ اختبار `webpush.test.ts:86-` |
| 229 | إشعارات سلسلة الاعتماد | «يحتاج اعتمادكم» / «اعتُمد نهائياً» / «رُفض»؛ وعند شغور الطبقات «كسر الزجاج» للإدارة | النظام | تُنتَج من data.server | `queueLayerApprovalNeeded/queueFinalApproved/queueRejectionNotice` | notifications, role_assignments | تعمل | `services/notifications.ts:48-103`؛ `data.server.ts:199,328-352` |
| 230 | صلابة الكرون (عدّادات معزولة) | فشل خطوة توليد لا يوقف الإيصال؛ عزل لكل إشعار في الإرسال | النظام | cron | try/catch حول كل خطوة | notifications | تعمل | `scheduled.server.ts:46-48,227-229` |

(إشعارات أخرى مضمّنة في وحداتها: إشعار طلب التسجيل — الصف 128؛ إشعار الترحيب عند الاعتماد — الصف 130؛ إشعارات الاختبارات والنشاطات — الصفوف 35-37، 75-76؛ توزيع الإعلانات — الصف 212.)

---

## الميزات الميتة أو المهجورة

تحقّق كل حكم بـgrep عبر `app/src` كاملاً عن اسم الدالة/الملف، ثم فحص المستدعين.

| الميزة | أين كودها | لماذا حكمت بأنها ميتة/مدفونة |
|---|---|---|
| **دورة الإدارة كاملة**: مدد سنتان، حدّ دورتين، شغور الأمراء، طلب/بتّ الاستقالة | `services/governance.ts` (الملف كاملاً: `assignTerm`, `termsEndingSoon`, `amirVacancies`, `requestResignation`, `decideResignation`, `overdueResignations`, `priorTermsCount`) | **ميتة** — صفر مستهلكين لأي دالة؛ جدول `resignations` لا يُشار إليه إلا في `schema.ts:741` والهجرة `0005_governance.sql` والبذرة وهذا الملف |
| **النصاب والتصويت في الاجتماعات**: حضور، نصاب ٥٠٪+١، صوت الأمير المرجِّح | `services/meetings.ts` (الملف كاملاً: `quorumMet`, `decisionResult`, `createMeeting`, `setAttendance`, `meetingQuorum`, `recordDecision`) | **ميتة** — لا يستورد الملفَ أحد؛ `meetings.server.ts` أعاد التنفيذ داخلياً ويثبّت `votesFor:0` (`meetings.server.ts:77`)؛ جدول `meeting_attendance` لا يُقرأ إلا هنا |
| **رموز التحديث (refresh tokens)** | `services/authTokens.ts:24-46` (`issueRefreshToken`/`rotateRefreshToken`/`revokeRefreshToken`) + جدول `refresh_tokens` (`schema.ts:953`) | **ميتة** — لا مستدعٍ خارج الملف؛ المصادقة الفعلية JWT في cookie فقط (`auth.server.ts:51-52`) |
| تذكير الإدخال (النسخة الخدمية) | `services/notifications.ts:14-42` (`queueEntryReminders`, `mosquesNeedingReminder`) | **ميتة/مُستبدَلة** — المجدول أعاد كتابة المنطق داخلياً (`scheduled.server.ts:50-66`)؛ لا مستورد خارجي |
| كامل خدمة التحفيظ القديمة | `services/tahfeez.ts` (`createCircle`, `addStudent`, `addProgress`, `studentMemorizedAyahs`) | **ميتة** — لا ملف يستورد `services/tahfeez` إطلاقاً؛ المنطق الحيّ في `tahfeez.server.ts` |
| شارة «بانتظار إقراري» للعُهد في الرئيسية | `custody.server.ts:172-181` (`myCustodyBadge`) | **ميتة** — grep: المرجع الوحيد تعريفها؛ لا ذكر في home/myTasks/notifications |
| كشف عهد شخص لتدفق الاستقالة | `custody.server.ts:163-170` (`openCustodyOf`) | **مدفونة** — مختبَرة (`custody.test.ts:142,151,153`) بلا أي مستدعٍ حيّ؛ تدفق الاستقالة نفسه ميت (governance) |
| قائمة الاستحقاقات المصفّحة | `finance.server.ts:114` (`financeRows`) + `lib/api/finance.ts:13` | **ميتة** — لا مكوّن يستورد `getFinanceRows`؛ الواجهة تستعمل `getFinanceTree` (`FinancePage.tsx:17,102`) |
| كشف الراتب بالمعرّف القديم | `ledger.server.ts:174` (`payslipData`) + `lib/api/ledger.ts:100` | **ميتة** — الواجهة تستعمل `getPayslipByEntitlement` حصراً (`FinancePage.tsx:927`) |
| القيد اليدويّ | `ledger.server.ts:430` (`manualJournalData`) + منفّذ `manual_journal` | **مدفونة** — نقطة خادم ومنفّذ اعتماد بلا نموذج ولا زر ولا اختبار (grep `postManualJournal` خارج api = صفر) |
| الرصيد الافتتاحي المباشر | `ledger.server.ts:443` (`openingBalanceData`) | **مدفونة** — بلا واجهة؛ الوظيفة تُنجَز عبر الاستيراد (`financeImport.ts:106`)؛ مختبرة `dualControl-wiring.test.ts:67` |
| غلاف صفحة مالية المسجد | `components/mosque-finance/MosqueFinancePage.tsx:29` | **ميتة (غلاف يتيم)** — لا مسار يركّبه؛ يُستعمل تصديره `TxnPanel` وحده (`MosquePage.tsx:19`) |
| ميزان المسجد الخدميّ | `services/mosqueFinance.ts:35` (`mosqueBalance`) | **ميتة** — صفر مراجع حتى في الاختبارات |
| عدّاد المقترحات المالية المعلّقة | `services/financeActions.ts:438` (`pendingFinanceActionsCount`) | **ميتة** — صفر مراجع |
| كشف المانح القديم | `services/donorsFinance.ts:67` (`donorStatement`) | **مدفونة (اختبار فقط)** — استُبدلت بـ`donorFullStatement`؛ مرجعها الوحيد `donors-funds.test.ts:8,68` |
| حالة الصندوق النثري | `services/pettyCash.ts:80` (`boxStatus`) | **مدفونة (اختبار فقط)** — الواجهة تستعمل `listBoxes` |
| قالب HTML للتقرير الشهري | `services/reportHtml.ts:117` (`monthlyReportHtml`) | **ميتة** — لا مرجع خارج ملفه؛ المستعمَل `networkRollupHtml` وحده |
| إنشاء حلقتي (منفذ المعلّم القديم) | `alaBaseera.server.ts:592` (`createMyHalaqaData`) | **مدفونة** — غلاف RPC أُزيل عمداً (تعليق `lib/api/alaBaseera.ts:175-176`)؛ تبقى للاختبارات/الجسر |
| تسجيل طالب بالهوية | `alaBaseera.server.ts:326` (`enrollStudentData`) + `services/alaBaseera.ts:40` (`enrollStudent`) | **مدفونة** — RPC مصدَّر بلا استدعاء في components/routes؛ استُبدل بالأسماء الحرّة (`addHalaqaStudentData`) |
| قائمة الحلقات المسطّحة | `alaBaseera.server.ts:101` (`listHalaqat`) + `lib/api/alaBaseera.ts:13-18` | **مدفونة** — استُبدلت بالعرض الشجريّ (`halaqatTreeData`)؛ grep `getHalaqat(` في components = صفر |
| حضور درس الحلقة المنفرد | `alaBaseera.server.ts:520` (`lessonAttendanceData`) | **ميتة** — لا غلاف RPC ولا مستدعٍ (يوجد نظير مختلف مربوط في `mosqueLessons.server.ts:128`) |
| إرفاق ملف درس عبر RPC | `alaBaseera.server.ts:785` (`addLessonAttachmentData`) | **ميتة** — الرفع الفعلي عبر `/api/media/upload` (`media.server.ts:177`) |
| تسجيل درس (النسخة الخدمية) | `services/alaBaseera.ts:64` (`recordLesson`) | **ميتة** — `recordLessonData` في الخادم يُدرج بنفسه؛ لا مستدعٍ للخدمة |
| إنشاء مسابقة (النسخة الخدمية) | `services/competition.ts:14` (`createCompetition`) | **ميتة** — `createCompetitionData` يُدخل مباشرة؛ استيراد الخدمات في `competition.server.ts:7,81` لا يشملها |
| استيراد دفعة مساجد | `services/orgUnits.ts:51` (`importMosques`) | **ميتة** — صفر مراجع خارج الملف |
| تغيير حالة المسابقة يدوياً | `competition.server.ts:91` + `lib/api/competition.ts:32` | **مدفونة** — خادم+RPC+اختبار بلا زر واجهة (الصف 67) |
| سجلّ الطالب التراكمي (تحفيظ) | `tahfeez.server.ts:256` + `lib/api/tahfeez.ts:86-91` | **غير متحقق/مدفونة** — RPC مصدَّر بلا مكوّن يستدعيه (الصف 28) |
| لوحة المحافظة | `data.server.ts:31` (`governorateData`) + `lib/api/functions.ts:7` | **غير متحقق** — لم يُعثر على مستهلك واجهة (الصف 48) |
| تشخيص الوحدة | `home.server.ts:353-365` (`unitDiagnosisData`) | **غير متحقق** — لم يُعثر على مستورِد مؤكَّد (الصف 140) |
| أثر تطوير | `app/src/server/__tests__/admin-not-tasked.test.ts.tmp` | ملف مؤقّت **فارغ** (حجم صفر) بجانب الاختبار الفعليّ |

**تعارضات ربط ظاهرة (ليست ميتة لكنها موثَّقة):** حراسة المسابقة كلها (حتى القراءة) بـ`isGlobalAdmin` رغم منح `competition.view/manage` للمشرفين وamir (`competition.server.ts:9` مقابل `capabilities.ts:167` و`CompetitionPage.tsx:39,95,116`) · زر «صرف» للمالي يفشل خادمياً (الصف 182) · `finance.entry/approve` بلا سطح واجهة (ملاحظات القسم الرابع) · تبويب الأصول فارغ للمالي (ملاحظة الوحدة 197-200) · ترويسة `media-hub.md` roles أضيق من الكود (الكود يضيف المشرفين عبر `SUPERVISOR_VIEW`، `capabilities.ts:144`).

---

## فحص الاكتمال (إلزامي)

- [x] **كل ملف في `app/src/routes/` ظهر أعلاه** — القائمة (٢٣ مساراً + README):
  `__root.tsx` (96) · `admin.tsx` (85-86, 107-123, 212-214) · `ala-baseera.tsx` (1-7, 53-57) · `competition.tsx` (62-67) · `custody.tsx` (189-196) · `design-system.tsx` (105) · `duties.tsx` (35-37, 75-77, 129) · `finance.tsx` (150-186, 197-200) · `home.tsx` (133-141) · `index.tsx` (100) · `library.tsx` (32-34) · `login.tsx` (87, 102) · `manhaj.tsx` (8-10) · `media-hub.tsx` (201-206) · `mosque.$mosqueId.tsx` (49-52, 20-27, 38-39, 68-74, 176-179) · `my-circles.tsx` (11-19, 26, 29) · `my-committee.tsx` (71-72) · `network.tsx` (40) · `network.index.tsx` (40-41) · `network.$unitId.tsx` (42) · `no-access.tsx` (101) · `register.tsx` (124-127) · `student.$token.tsx` (30) · `README.md` (106 — وثيقة اصطلاح لا صفحة).
- [x] **كل ملف `*.server.ts` ظهر أعلاه** — القائمة (٣٤ ملفاً):
  `activities` (75-77) · `admin` (107-118) · `alaBaseera` (1-6, 11-18 + ٦ مدفونات) · `announcements` (212-214) · `assets` (197-200) · `auth` (87-94) · `boxes` (150-157) · `circles` (20-22) · `committees` (68-72) · `competition` (62-67) · `custody` (189-196 + ميتة `myCustodyBadge`) · `data` (40-48, 51-52, 187, 229) · `exams` (35-37) · `finance` (180-183 + ميتة `financeRows`) · `home` (133-141) · `incentives` (186) · `ledger` (158-175, 184-185 + ميتة/مدفونات) · `manhaj` (8-9) · `materials` (32-34) · `media` (207-211) · `mediaHub` (201-206) · `meetings` (73-74) · `mosqueFinance` (176-179) · `mosqueLessons` (38-39) · `myTasks` (77, 141) · `notifications` (142-146, 228) · `permissions` (84-85) · `registration` (124-132) · `scheduled` (123, 222-230) · `search` (147-149) · `settings` (119-123) · `supervision` (53-57, 224) · `tahfeez` (23-31) · `telegram` (221).
- [x] **كل ملف في `services/` ظهر أعلاه** — القائمة (٣٩ خدمة):
  `advances` (185) · `alaBaseera` (4-5 + مدفونات) · `approvalRouting` (58-60) · `assetCustody` (189-195) · `authTokens` (88 + ميتة refresh) · `budgets` (164) · `competition` (64-66 + ميتة `createCompetition`) · `currencies` (169) · `depreciation` (167) · `donorsFinance` (177 + مدفونة `donorStatement`) · `donorsReport` (170) · `expenseClaims` (165) · `finance` (180-182) · `financeActions` (175 + ميتة العدّاد) · `financeEntry` (178) · `financeImport` (174) · `financeWorkbook` (173) · `governance` (**ميتة كاملاً**) · `halaqaWeekly` (16) · `ledger` (161) · `ledgerBackfill` (160) · `ledgerPost` (162) · `meetings` (**ميتة كاملاً**) · `mosqueFinance` (176-179 + ميتة `mosqueBalance`) · `notifications` (228-229 + ميتة `queueEntryReminders`) · `orgUnits` (78 + ميتة `importMosques`) · `paymentBatches` (172) · `payroll` (184) · `pettyCash` (166 + مدفونة `boxStatus`) · `pledges` (171) · `provisioning` (79) · `reconciliation` (168) · `records` (61) · `reportHtml` (188 + ميتة `monthlyReportHtml`) · `reports` (187) · `statements` (163) · `studentBridge` (22) · `tahfeez` (**ميتة كاملاً**) · `unitBox` (150-157).
- [x] **قارنت مع `product/ui/*.md` (٢٢ ملفاً) ولم تبقَ شاشة موصوفة غير مجرودة**: admin · competition · custody · duties · education · finance · home-admin · home-amir · home-finance-student · home-supervisor · landing · library · login · manhaj · media-hub · mosque · my-circles · my-committee · network · network-unit · register · student-token — كلها فُحصت مقابل الكود. **الفجوات المرصودة (موصوف وغير موجود):** بطاقة «طلبات أدوار عليا» في «ينتظر قراري» للمدير (`home-admin.md` مقابل `home.server.ts:103`) · «دائرة تقدم» للأمير (الكود شريط أفقي، `AmirHome.tsx:51-53`) · بطاقة «بيانات لجنة تنتظر إقراري» للأمير (`AmirHome.tsx:24`) · «زر تذكير جماعي» للمشرف (نصّ فقط) · جملة حصر `/finance` بالمدير والمالي في `finance.md` أضيق من الحارس الفعلي `box.view` · ترويسة `media-hub.md` roles أضيق من الكود · `education.md` تدرج amir في roles ولا يصل المسار (يصل من مسجده). **زيادات (موجود وغير موصوف):** تشدّد حراسة المسابقة خادمياً · منطق النصاب/التصويت الميت · دورة الإدارة الميتة · honeypot التسجيل · حقل MFA.
- **ملفات لم أستطع تصنيفها**: لا يوجد ملف بلا تصنيف. عناصر بقيت **غير متحقق** (مذكورة صراحة بدل الجزم): `tahfeezStudentHistoryData` (الصف 28) · `governorateData` (الصف 48) · `unitDiagnosisData` (الصف 140) · بذرة `scripts/seed-media/*` المذكورة في `media-hub.md:36-37` (لم يُفحص مجلد `scripts/`) · ملف فارغ `admin-not-tasked.test.ts.tmp` (أثر تطوير). كذلك `app/src/server/utils/` (١٦ ملف أدوات: audit/auth/caps/chunks/context/csv/db/orgPath/points/rbac/records/scheme/scope/totp/webpush/week) و`app/src/lib/api/` (أغلفة RPC) بنية تحتية مستهلَكة من الوحدات أعلاه لا ميزات مستقلة، وظهر منها بالاسم: `context.ts` (91-92)، `audit.ts` (ملاحظة الوحدة الإدارية)، `totp.ts` (89)، `webpush.ts` (228)، `rbac.ts` (مقدمة القسم الثالث).




