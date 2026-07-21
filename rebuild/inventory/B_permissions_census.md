# إحصاء الصلاحيات — v1 كما هي فعلاً
> أُنجز بتاريخ: ٢٠٢٦-٠٧-٢٠ (مهمة T0-B) · النطاق: `app/src` كاملاً عدا `__tests__` و`routeTree.gen.ts` (مولَّد)
>
> **أنماط البحث المستعملة** (قابلة لإعادة التشغيل على `app/src`):
> 1. **الموجة الأولى** (سلاسل ثابتة، `grep -rn -F`): `hasCap(` · `effectiveCaps` · `roleEffective` · `role ===` · `role !==` · `roles.includes` · `.includes("admin")` · `isAdmin` · `CUSTODIAN_ROLES` · `PERSONAL_CAPS` · `requireUser` · `requireCap` · `no-access` · `canSee` · `SUPERVISORY_ABOVE_MOSQUE` — (`canSee`: صفر إصابة؛ `.includes("admin")` أصابت بالموجة الثانية في `routes/design-system.tsx:11`).
> 2. **الموجة الثانية** (تعبير موسّع بعد اكتشاف الدوال الحارسة الفعلية، `grep -rnE`):
>    `hasCap\(|effectiveCaps|roleEffective|role ===|role !==|roles\.includes|isAdmin|isGlobalAdmin|canAccessPath|canAccess\(|requireMosqueAccess|requireMosqueManage|isAmirOf|canLockWeek|canEditLockedWeek|canUnlockWeek|requireUser|requireCap|requirePermAdmin|PERSONAL_CAPS|CUSTODIAN_ROLES|SUPERVISORY_ABOVE_MOSQUE|ROLES\.|no-access|NO_ACCESS|assignments\.(some|filter|find|map)|caps\.includes|currentUser\(\)`
>    ⇒ **٥٤٨ إصابة** في ~٧٠ ملفاً (مستثنى منها `__tests__` و`routeTree.gen.ts`).
> 3. **قراءة كاملة ملفاً ملفاً**: كل `server/*.server.ts` (٣٤ ملفاً) وكل `server/services/` (٣٩) وكل `server/utils/` (١٦) وكل `routes/` (٢٣) و`lib/` الحارسة (`capabilities.ts`, `access.ts`, `mosque-tabs.ts`, `api/`) ومكوّنات `components/` ذات الإصابات — لأن الحصر النمطي وحده يفوّت الفرض الضمني (فلترة نتائج، شروط `u &&`، ملكية شخصية).
> 4. **طبقة قاعدة البيانات**: `grep` على `schema.ts` و`migrations/*.sql` و`seed*.sql` بأنماط `role|assign|override|policy|audience|approval`، مع استخراج قيم `role` من بذور `role_assignments` بـ`awk`.

## ملخص تنفيذي

**الأدوار:** ١٠ أدوار معرّفة في الكود (`ROLES`/`ROLE_LABEL` متطابقان)، لكن بذرة الإنتاج تُدخل **٦ أدوار إضافية بلا وجود في الكود** (deputy/secretary/treasurer/committee/member/participant — ٣٨٠ من ٥١٣ تكليفاً) تحصل على صفر قدرات وتهبط على /no-access. **القدرات:** ٤٤ قدرة مكتلجة في ١٦ وحدة؛ **١٦ فقط (٣٦٪) تُفحص فعلاً بنظام القدرات في الخادم، و٢٨ (٦٤٪) تُحرَس بفحص دور صريح موازٍ** — أي أن جدول تجاوزات المدير `permission_overrides` **بلا أثر عملي على أغلب النظام**.

**نقاط الفرض:** ~٥٤٠ في الخادم (٤٨٤ في `*.server.ts` + ٥٦ في utils/services)، ~٤٠ في المسارات، ~١٨٠ في المكونات (أغلبها إخفاء واجهة). الأسلوب المهيمن ليس فحص القدرة بل **فحص دور صريح + فلترة نطاق ببادئة مسار** (`isWithin`=startsWith). أربع طبقات مالية إضافية للفرض خارج الكتالوج: `approval_policies` (الاعتماد الثنائي)، `approvalRouting` (NESSA)، `role_assignments.approvalStatus`، وفلترة الهوية النشطة.

**أخطر ٥ تضاربات:**
1. 🔴 **search.server.ts fail-open (أ-١، أ-٢):** بحث الأشخاص/المعلّمين/الأماكن يستدعي `currentUser()` ويُهمله، و`currentUser` يعيد null ولا يرمي ⇒ **مجهول بلا جلسة يعدّد كل PII الشبكة**، وفلترة الشجرة تنعكس عند `u=null`.
2. 🔴 **نمط `u &&` fail-open (أ-٣، أ-٤):** `data.server.ts:209/282/755` تمنع المسجَّل خارج النطاق وتُمرّر المجهول — بما فيه **رولّ-أب الشبكة مع الإجمالي المالي**.
3. 🔴 **حارس /design-system معطوب (ت-١):** يفحص `caps.includes("admin")` وقدرات المدير `["*"]` ⇒ يفشل حتى للمدير؛ ومصادَق بلا قدرة يتسرّب إلى /home بدل /no-access.
4. 🔴 **الدفتر المركزي بلا نطاق (ح-١):** ٧٠ نقطة فرض بقدرات `finance.*` شبكية بالكامل — `payslipData` يكشف راتب أي شخص، `addBatchItem` يعدّل أي دفعة.
5. 🟠 **`permission_overrides` بلا أثر (ت-٢، ت-٣، ت-٤):** `permissions.manage` لا تُفحص قط (الحارس `isGlobalAdmin`)، و`audit.view` تُفحص في `requireAdminRead` لكنها لا تحرس سجل التدقيق نفسه (بالدور)، و٢٨ قدرة تُحرَس بالدور لا بـ`hasCap` — فمصفوفة التجاوزات تُحرِّر ما لا يُقرأ.

**الجرح الجوهري لـv1:** الحقيقة موزّعة على أربعة مصادر متنازعة، و**نظام القدرات (المصدر «الرسمي») هو الأضعف تأثيراً**: أغلب الفرض الفعلي يجري بقوائم أدوار مُصلَّبة منثورة نصاً في ٣٤ ملف خادم، لا عبر `hasCap`. النطاق (البُعد الثالث) يُفرض ببادئة مسار متسقة لكنها تنكسر fail-open في مواضع، وتغيب كلياً عن الدفتر المركزي.

**تصعيد مؤكَّد بالتدقيق (يحوّل fail-open إلى تسريبٍ فعليّ):** أغلفة `lib/api/*` تلفّ دوال الخادم بـ`createServerFn` **بلا أي `.middleware()` مصادقة**، و`start.ts` يسجّل middleware **معالجةَ أخطاءٍ فقط**. أي أن الحارس الوحيد هو `currentUser()` **داخل** كل دالة — فالدوال التي تُهمله (search) أو تفحصه بـ`u &&` (data) **مكشوفةٌ لمجهول بلا كوكي عبر نقطة RPC مباشرة**. هذا يرفع أ-١..٥ من «خلل منطقيّ» إلى «تسريب بيانات فعليّ» (أسماء أشخاص الشبكة، التقارير، الإجمالي المالي — بلا تسجيل دخول).

> **حالة التدقيق:** خضعت هذه الوثيقة لتدقيقٍ عدائيٍّ ثانٍ (٦ مدققين متوازين أعادوا قراءة الكود سطراً بسطر ومحاكمة كل تضارب) — التفصيل §٧. النتيجة: **كل ادعاءات `ملف:سطر` مؤكَّدة، والمصفوفة §٤ والأرقام الكمّية مُتحقَّقة بعدٍّ مستقلّ، والتضاربات الأربعة عشر البنيوية CONFIRMED**؛ مع تصحيحات طفيفة ونقطتين مضافتين (أ-٨، وتوسيع خ-٢) وتخفيف شدّة بندين (خ-٤، ح-٢) — كلها مطبَّقة أعلاه.

## ٠. المصادر الأربعة للحقيقة — الخريطة

| # | المصدر | ما فيه | من يقرؤه |
|---|---|---|---|
| ١ | [capabilities.ts](../../app/src/lib/capabilities.ts) | `CAP_CATALOG` (٤٤ قدرة في ١٦ وحدة، سطر 4–79) · `ROLE_LABEL` (١٠ أدوار، 85–96) · `ROLE_DEFAULTS` (148–182) · `effectiveCaps` (187–196) · `PERSONAL_CAPS` (201) · `hasCap` (206–209) · `roleEffective` (212–216) | مشترك خادم/عميل — الواجهة تفحص به الأبواب، والخادم يحسب به `caps` |
| ٢ | [rbac.ts](../../app/src/server/utils/rbac.ts) | `ROLES` (١٠ معرّفات، سطر 1–13) · `SECTIONS` (18) · `SUPERVISORY_ABOVE_MOSQUE` (22) · `ORG_TYPES` (26) · `SECTION_LEAF` (30) | خادم فقط — كل فحوصات الدور الصريحة `role === ROLES.X` تستورد منه |
| ٣ | قاعدة البيانات | `role_assignments` ([schema.ts:138](../../app/src/server/database/schema.ts)) · `permission_overrides` (schema.ts:1002، هجرة 0008، **بلا بذور**) · `approval_policies` (schema.ts:1113، هجرة 0070 **مع بذرة** `pol-fo-all`) · وجداول تمسّ الأدوار جانبياً: `resignations` (743)، `materials.audience` (168)، `announcements.audience` (368) | `context.ts:26–44` يحمّل التكليفات المعتمدة لكل طلب؛ `permissions.server.ts:9–17` يحمّل التجاوزات |
| ٤ | الفحوصات المبعثرة | سجلّ القسم ٣ أدناه — فحوص قدرة وفحوص دور صريحة وفلترة نطاق وإخفاء واجهة | — |

**سلسلة الهوية (تسري قبل أي فرض):** الكوكي `mishkat_token` (JWT، [auth.server.ts:22–24](../../app/src/server/auth.server.ts)) ← `userFromToken` ([context.ts:16–45](../../app/src/server/utils/context.ts)) يحمّل الشخص + حسابه + **تكليفاته المعتمدة فقط** (`endDate IS NULL AND approvalStatus='approved'`، context.ts:29–33) ويرفض الجلسة إن كان الشخص غير `active` (37) أو حِقبة الجلسة لا تطابق `session_epoch` (40). ثم `meUser` ([auth.server.ts:64–88](../../app/src/server/auth.server.ts)) يحسب `caps = effectiveCaps(roles, permission_overrides)` عبر `userCaps` ([permissions.server.ts:15–17](../../app/src/server/permissions.server.ts)) ويعيدها للواجهة.

## ١. الأدوار الفعلية

### ١.أ الأدوار المعرّفة في الكود (١٠ أدوار — المصدران متطابقان اليوم)

| الدور (المعرّف) | التسمية العربية | مصدر تعريفه | يُسنَد عبر | ملاحظات/تكرارات |
|---|---|---|---|---|
| `admin` | الإدارة العليا | capabilities.ts:86 + rbac.ts:2 | بذر (`ra-admin`) أو مدير آخر (admin.server.ts:161) | افتراضيه `"*"`؛ فحوص كثيرة تخصّه بالدور لا بالقدرة (§٥) |
| `section_head` | مشرف عام القسم (مجنَّسة: capabilities.ts:101) | capabilities.ts:87 + rbac.ts:3 | `user.manage` — لكن منحه حصر بالإدارة العليا (admin.server.ts:161، 306) | أُضيف لاحقاً لـrbac.ts «توحيداً للمصدرين» (تعليق rbac.ts:9) |
| `rabita` | مسؤول منطقة | capabilities.ts:88 + rbac.ts:4 | `user.manage` منطاق | في وثيقة 13 «رابطة = مسؤول المحافظة» — انزياح تسمية (§٥.٧) |
| `square` | مسؤول مربع | capabilities.ts:89 + rbac.ts:5 | `user.manage` منطاق | أدنى طبقة إشرافية — بلا `report.approve.override` |
| `amir` | أمير مسجد / مشرفة حلقة نسائية | capabilities.ts:90 + rbac.ts:6 | `user.manage` منطاق | النسائي بنفس المعرّف والتأنيث عرضي (`sectionRoleLabel`، capabilities.ts:115–118) |
| `teacher` | مدرّس/محفّظ | capabilities.ts:91 + rbac.ts:7 | `user.manage` منطاق | عزله بالملكية (حلقاته) لا بالنطاق |
| `committee_head` | مسؤول لجنة | capabilities.ts:92 + rbac.ts:10 | `user.manage` منطاق | كان ناقصاً من rbac.ts (تعليقها:9) |
| `media` | مسؤول إعلام | capabilities.ts:93 + rbac.ts:11 | `user.manage` منطاق | `media.post` قدرته الشخصية |
| `finance_officer` | مسؤول ماليّ | capabilities.ts:94 + rbac.ts:12 | بذر (`ra-finance`) أو مدير | كل أفعاله المالية عبر طابور الاعتماد الثنائي (approval_policies) |
| `student` | طالب | capabilities.ts:95 + rbac.ts:8 | تسجيل ذاتي ← اعتماد (registration.server.ts) | الدور الوحيد المُسنَد بلا `user.manage` |

**قوائم أدوار مشتقة تُستعمل في الفرض:** `SUPERVISORY_ABOVE_MOSQUE = [admin, section_head, rabita, square]` (rbac.ts:22) · `CUSTODIAN_ROLES = {section_head, rabita, square, amir}` (boxes.server.ts:16) · `LEADER_ROLES` (announcements.server.ts:10) · `STAFF_ROLES = ["amir"]` (auth.server.ts:62) · `SUPERVISOR_ROLES` (admin.server.ts:14) · `ROLE_PRECEDENCE` (access.ts:61).

### ١.ب أدوار موجودة في بيانات البذور ولا وجود لها في الكود (يتيمة القدرات)

بذرة الإنتاج الفعلية `seed_big.sql` (تُطبَّق بـ`cf:seed:remote`، [package.json:17](../../app/package.json)) مولَّدة من [scripts/gen-seed.mjs](../../app/scripts/gen-seed.mjs) وتُدخل في `role_assignments` **٥١٣ تكليفاً** منها **٣٨٠ بأدوار غير معرّفة** لا في `ROLES` ولا في `ROLE_DEFAULTS` ولا في `ROLE_LABEL`:

| الدور في البذرة | العدد | مصدر التوليد | أثره الفعلي |
|---|---|---|---|
| `member` | ١٧٩ | gen-seed.mjs:96 | `ROLE_DEFAULTS[role] ?? []` (capabilities.ts:189) ⇒ **صفر قدرات** ⇒ صاحبه يهبط على `/no-access`؛ وتسميته تسقط إلى المعرّف الخام (`ROLE_LABEL[role] ?? role`، capabilities.ts:117) |
| `participant` | ٦٩ | gen-seed.mjs:96 | كما فوق |
| `committee` | ٥٠ | gen-seed.mjs:95 | كما فوق — **وليس** `committee_head` المعرّف (انزياح تسمية بين البذرة والكود) |
| `secretary` | ٣٠ | gen-seed.mjs:95 | كما فوق |
| `deputy` | ٢٩ | gen-seed.mjs:95 | كما فوق |
| `treasurer` | ٢٣ | gen-seed.mjs:95 | كما فوق |

هذه الأدوار الستة هي أدوار «أسرة المسجد» في الوثيقتين 02/13 (R5–R10) — **الوثائق والبذرة تعرفانها والكود لا** (التفصيل §٥.٧). *(ملاحظة سياق: بذرة الإنتاج أُفرغت بالكوميت 584fe17 بتاريخ ٢٠٢٦-٠٧-٢٠؛ الملفات المحلية باقية كما هي مادةً للفحص.)*

### ١.ج شذوذات إسناد في البذور نفسها

- **تكليف على وحدة بمسار لا يطابقها**: `ra-admin` و`ra-finance` و`ra-media` تُسنَد بـ`org_unit_id='men'` لكن `org_path='/'` (gen-seed.mjs:52، 224، 231) بينما مسار وحدة `men` هو `/men/` — أي أن نطاق الفحص السريع (`orgPath` المنسوخ «للتحقق السريع من النطاق»، schema.ts:143) يمنحهم **الشبكة كلها بقسمَيها** لا قسم الرجال. للمدير `"*"` لا فرق عملياً؛ لمسؤول الإعلام والمالي فرقٌ جوهري: كل فحص `isWithin/startsWith` على تكليفهما يشمل القسم النسائي.
- **البذرة الصغيرة `seed.sql` فاسدة البنية أصلاً**: تُدخل `org_units` بنوع `bloc` غير الموجود في `ORG_TYPES` (rbac.ts:26) وبأعمدة الشجرة القديمة (جذر `rabita` بلا `section`؛ seed.sql:4–12 مقابل schema.ts تعريف `orgUnits`) — ليست في خط البذر الرسمي (`cf:seed:remote` لا يذكرها) لكنها باقية في المستودع مضلِّلةً.
- `seed_media_demo.sql:5–8` يُدخل تكليف `media` مرتين بنفس المعرّف `seed-ra-media` على وحدتين مختلفتين (`OR IGNORE` يُسقط الثاني صامتاً).

## ٢. كتالوج القدرات الحالي

٤٤ قدرة في ١٦ وحدة معرّفة في `CAP_CATALOG` (capabilities.ts:4–79؛ التحقّق: `ALL_CAPS.length`=٤٤ زمن التشغيل، والسطر ٤ مجرّد نوع). العمود الأخير هو **الاكتشاف الأهم**: أين تُفحص القدرة فعلاً بـ`hasCap`/`requireCap` في الخادم. الكثير من القدرات **معرَّفة في الكتالوج ومُوزَّعة في `ROLE_DEFAULTS` لكنها لا تُفحص في أي سطر خادم** — نطاقُها يُحرَس بفحص دور صريح بدلها، فلا أثر لتجاوزات المصفوفة عليها.

| القدرة | التسمية | الوحدة | في الكتالوج؟ | تُفحص بـhasCap في الخادم؟ (أين) |
|---|---|---|---|---|
| network.view | عرض الشبكة والتنقّل | الشبكة | ✓ | **لا** خادمياً — حارس مسار الواجهة فقط (access.ts:8)؛ الخادم يعزل بالنطاق (data.server.ts scopePrefix) |
| report.view | عرض التقرير الشهري | التقرير | ✓ | **لا** — الخادم يفحص عبر أعلام `reportRoleCaps` وقوائم أدوار (data.server.ts:216) |
| report.approve | اعتماد التقرير (الأقرب) | التقرير | ✓ | عبر `canApproveUnit`/`caps.includes` لا `hasCap` (data.server.ts:67؛ NetworkPage.tsx:405) |
| report.approve.override | التدخّل الفوقيّ ق1-د | التقرير | ✓ | **نعم** — `canOverrideApprove` (approvalRouting.ts:57، ثابت OVERRIDE_CAP:54) |
| dailyLog.view | عرض سجل اليوم | التقرير | ✓ | **لا** — تبويب مسجد (mosque-tabs.ts:12) + أعلام دور (media.server.ts:133) |
| dailyLog.edit | إدخال سجل اليوم | التقرير | ✓ | عبر أعلام واجهة (MosquePage.tsx:154) لا `hasCap` خادميّ مباشر؛ الخادم يفحص بالدور (data.server.ts:451) |
| finance.view | عرض الملف المالي | مالية مركزية | ✓ | **نعم** — `requireFinanceView` (ledger.server.ts:16؛ finance.server.ts:21) |
| box.view | الصندوق (عهدة الوحدة) | مالية مركزية | ✓ | **لا** — boxes.server.ts يحرس بأدوار العهدة و`isGlobalAdmin` لا بالقدرة |
| finance.entry | إدخال الحركات (مُدخِل) | مالية مركزية | ✓ | **نعم** — `requireFinanceEntry`/`requireFinanceActor` (ledger.server.ts:316، 227) |
| finance.approve | اعتماد الصرف (معتمِد) | مالية مركزية | ✓ | **نعم** — `requireFinanceApprove` (ledger.server.ts:216) |
| finance.payout | تسجيل الصرف | مالية مركزية | ✓ | **لا** — `payoutFinanceData` يحرس بـ`isGlobalAdmin` (finance.server.ts:208) لا بالقدرة |
| finance.supervise | الاعتماد الثنائيّ | مالية مركزية | ✓ | **نعم** — `requireFinanceSupervise` (ledger.server.ts:394، 403) |
| mosqueFinance.view | عرض مالية المسجد | مالية المسجد | ✓ | **لا** — mosqueFinance.server.ts يحرس بـamir/admin ونطاق (11، 27) |
| mosqueFinance.manage | تسجيل تبرعات/مصروفات | مالية المسجد | ✓ | **لا** — يحرس بأمير/admin (mosqueFinance.server.ts:63–64) |
| circles.view | عرض حلقات المسجد | حلقات المسجد | ✓ | **نعم** — `requireCircleCap("circles.view")` (circles.server.ts:35، 72، 228) |
| circles.manage | إضافة وتعديل الحلقات | حلقات المسجد | ✓ | **نعم** — (circles.server.ts:82، 162، 183، 213) |
| alaBaseera.viewAll | عرض على بصيرة (الشبكة) | على بصيرة | ✓ | **لا** — alaBaseera.server.ts يحرس بأدوار صريحة (21، 344–346) لا بالقدرة |
| alaBaseera.view | عرض حلقات المسجد | على بصيرة | ✓ | **لا** — نفس الملف، فحص دور (لا `hasCap` في أي سطر) |
| alaBaseera.manage | إدارة الحلقات والجلسات | على بصيرة | ✓ | **لا** — `requireAlaBaseeraManage` بفحص دور admin/amir (alaBaseera.server.ts:32–34) |
| tahfeez.view | عرض حلقات التحفيظ | التحفيظ | ✓ | **لا** — tahfeez.server.ts يحرس بـrequireMosqueAccess/الدور (21، 78) |
| tahfeez.manage | إدارة حلقات التحفيظ | التحفيظ | ✓ | **لا** — فحص دور (tahfeez.server.ts:52، 78–79) |
| meetings.view | عرض الاجتماعات والقرارات | الاجتماعات | ✓ | **لا** — `requireMosqueAccess` (meetings.server.ts:14) لا القدرة |
| meetings.manage | تسجيل الاجتماعات | الاجتماعات | ✓ | **لا** — `requireMosqueManage` (meetings.server.ts:57) |
| committees.view | عرض اللجان وخططها | اللجان | ✓ | **لا** — `requireMosqueAccess`/فحص دور (committees.server.ts:27) |
| committees.manage | تشكيل اللجان وإدارة خططها | اللجان | ✓ | **لا** — فحص دور admin/amir (committees.server.ts:69) |
| committee.own | لجنتي (مسؤول لجنة) | اللجان | ✓ | **لا** — يُحرَس بالملكية `headPersonId` (committees.server.ts:58، 136) |
| circle.teach | إدارة حلقاتي (مدرّس) | حلقات المدرّس | ✓ (شخصية) | **لا** — `requireTeacher` بفحص دور teacher (alaBaseera.server.ts:543–545) + ملكية |
| competition.view | عرض المسابقة | المسابقة | ✓ | **لا** — competition.server.ts كله `isGlobalAdmin` (21) — حتى القراءة |
| competition.manage | إدارة المسابقة | المسابقة | ✓ | **لا** — `isGlobalAdmin` (competition.server.ts:78) |
| assets.manage | عُهدُ نطاقي | العُهد | ✓ | **نعم** — `requireManage("assets.manage")` (custody.server.ts:36، 115، 139، 156) |
| custody.own | عُهدتي (شخصية) | العُهد | ✓ (شخصية) | **لا** — يُبنى على الهوية+personId (custody.server.ts:96–97) لا فحص القدرة |
| media.hub | مركز الإعلام | الإعلام | ✓ | **نعم** — `requireMediaHub` (mediaHub.server.ts:24، 80، 185) |
| media.post | نشر تغطية (شخصية) | الإعلام | ✓ (شخصية) | **نعم** — (mediaHub.server.ts:213؛ media.server.ts:112) |
| library.view | مكتبتي | المكتبة | ✓ | **لا** — materials.server.ts يحرس بالهوية/الجمهور بالدور (51، 53–54) |
| library.manage | إدارة الموادّ | المكتبة | ✓ | **لا** — `canManage` بفحص دور section_head/admin (materials.server.ts:38–39) |
| duties.view | «المطلوب منّي» | النشاطات | ✓ | **لا** — activities.server.ts بالهوية/الملكية لا القدرة |
| duties.manage | إنشاء النشاطات | النشاطات | ✓ | **لا** — `creatableScopes` بفحص دور (activities.server.ts:17–19) |
| admin.view | عرض التهيئة | التهيئة | ✓ | **نعم** — ضمن `ADMIN_READ_CAPS` في `requireAdminRead` (admin.server.ts:30، 35) |
| user.manage | إدارة المستخدمين | التهيئة | ✓ | **نعم** — `requireScopedCap("user.manage")` (admin.server.ts:159، 254، 305…) |
| orgUnit.manage | إدارة الوحدات التنظيمية | التهيئة | ✓ | **نعم** — `requireScopedCap("orgUnit.manage")` (admin.server.ts:74، 138) |
| permissions.manage | إدارة الصلاحيات | التهيئة | ✓ | **لا** — `requirePermAdmin` يفحص `isGlobalAdmin` (permissions.server.ts:19–23) لا القدرة! |
| settings.view | عرض المعدّلات المالية | التهيئة | ✓ | **نعم** — `requireCap("settings.view")` (settings.server.ts:55، 101) |
| settings.manage | تعديل المعدّلات المالية | التهيئة | ✓ | **نعم** — `requireCap("settings.manage")` (settings.server.ts:73، 116…) |
| audit.view | عرض سجلّ التدقيق | التهيئة | ✓ | ضمن `ADMIN_READ_CAPS` (admin.server.ts:35)؛ **لكن** `auditLogData` نفسه يحرس بقائمة أدوار لا بالقدرة (data.server.ts:837) |

### ٢.أ القدرات «المفحوصة وغير المكتلجة» (متوقَّع وجودها؛ غيابها مريب)

**النتيجة: صفر قدرة مفحوصة خارج الكتالوج.** كل مفتاح مُرِّر لـ`hasCap`/`requireCap`/`requireScopedCap`/`requireFinance*`/`requireCap` عبر `app/src` كله موجود في `CAP_CATALOG`. الرمز الوحيد خارج الكتالوج هو `"*"` (جامع المدير، اصطلاحيّ عمداً، تقيّده `PERSONAL_CAPS`).

**لكنّ صنفاً معاكساً وأخطر ظهر: «قيمة تُفحص كأنها قدرة وليست قدرة»** — `routes/design-system.tsx:11` يفحص `user.caps?.includes("admin")`، و`"admin"` اسم دور لا قدرة وليس في الكتالوج، وقدرات المدير هي `["*"]` لا `["admin"]` — فالشرط **يفشل حتى للمدير**، والصفحة غير قابلة للوصول لأحد (تفصيله §٥، ت-١).

### ٢.ب خلاصة تغطية الكتالوج

من ٤٤ قدرة: **١٦ فقط تُفحص فعلاً بنظام القدرات في الخادم** (`report.approve.override`, finance.view/entry/approve/supervise, circles.view/manage, assets.manage, media.hub/post, admin.view, user.manage, orgUnit.manage, settings.view/manage, audit.view ضمن ADMIN_READ_CAPS). **٢٨ قدرة (٦٤٪) لا تُفحص في أي سطر خادم بنظام القدرات** — نطاقُها إمّا يُحرَس بفحص دور صريح موازٍ (على بصيرة، التحفيظ، الاجتماعات، اللجان، المسابقة، مالية المسجد، الصندوق، المكتبة، النشاطات) أو يُحرَس في الواجهة فقط (network.view, box.view للتبويب). **الأثر المباشر**: جدول `permission_overrides` — واجهة المدير لتخصيص الصلاحيات — **لا أثر له عملياً على ٢٨ قدرة**، لأن العمليات لا تسأل `hasCap` بل تسأل `role === "..."`.

## ٣. سجل نقاط الفرض

**المجموع المرصود:** ~٥٤٠ نقطة فرض في الخادم + ~٤٠ في المسارات + ~١٨٠ في المكونات (أغلبها إخفاء واجهة/استهلاك أعلام). الأسلوب المهيمن في الخادم: **فحص دور صريح + فلترة نطاق ببادئة مسار**، لا فحص قدرة. جدول فهرس بالعدد لكل ملف أولاً، ثم الجداول التفصيلية.

### ٣.٠ فهرس العدّ لكل ملف (طبقة الخادم)

| الملف | نقاط الفرض | الطبقة | الأسلوب المهيمن |
|---|---|---|---|
| data.server.ts | 42 | خادم | فحص دور صريح + فلترة نطاق |
| admin.server.ts | 22 | خادم | **فحص قدرة** (requireScopedCap) + نطاق (assertScope) |
| announcements.server.ts | 7 | خادم | فحص دور صريح + نطاق |
| auth.server.ts | 7 | خادم | فحص هوية + دور (STAFF_ROLES) |
| activities.server.ts | 10 | خادم | فحص دور + ملكية + نطاق |
| assets.server.ts | 6 | خادم | فحص دور + نطاق (covers) |
| alaBaseera.server.ts | 60 | خادم | فحص دور صريح + ملكية معلّم |
| supervision.server.ts | 21 | خادم | توجيه اعتماد NESSA + دور |
| tahfeez.server.ts | 29 | خادم | فحص دور + ملكية معلّم |
| exams.server.ts | 17 | خادم | ملكية/دور/نطاق (creatableScopes) |
| circles.server.ts | 13 | خادم | **فحص قدرة** (circles.view/manage) + نطاق |
| mosqueLessons.server.ts | 11 | خادم | فحص دور + نطاق |
| manhaj.server.ts | 0 | خادم | **صفر — عام بلا تسجيل** |
| ledger.server.ts | 70 | خادم | **فحص قدرة** (finance.*) + سياسة اعتماد |
| boxes.server.ts | 19 | خادم | فحص دور صريح (CUSTODIAN_ROLES) + نطاق |
| mosqueFinance.server.ts | 10 | خادم | فحص دور (amir/admin) + نطاق |
| finance.server.ts | 12 | خادم | **فحص قدرة** (finance.view) + دور + نطاق |
| custody.server.ts | 12 | خادم | **فحص قدرة** (assets.manage) + نطاق |
| incentives.server.ts | 3 | خادم | فحص دور (isGlobalAdmin) |
| competition.server.ts | 12 | خادم | فحص دور (isGlobalAdmin) — حتى القراءة |
| settings.server.ts | 6 | خادم | **فحص قدرة** (settings.*) |
| registration.server.ts | 8 | خادم | فحص دور (ROLE_RANK) + نطاق |
| home.server.ts | 13 | خادم | فحص دور صريح (اختيار رئيسية) + ملكية |
| materials.server.ts | 9 | خادم | فحص دور (canManage/audience) |
| search.server.ts | 2 | خادم | **فلترة نطاق fail-open (ثغرة)** |
| mediaHub.server.ts | 15 | خادم | **فحص قدرة** (media.hub/post) + نطاق |
| media.server.ts | 13 | خادم | فحص دور + قدرة (media.post) + نطاق |
| permissions.server.ts | 3 | خادم | فحص دور (isGlobalAdmin) |
| scheduled.server.ts | 5 | خادم | فحص دور + توجيه إشعار بالنطاق |
| notifications.server.ts | 6 | خادم | فحص هوية + ملكية (personId) |
| meetings.server.ts | 5 | خادم | فحص نطاق (requireMosque*) |
| myTasks.server.ts | 3 | خادم | فحص دور صريح |
| committees.server.ts | 11 | خادم | فحص دور + ملكية (headPersonId) |
| telegram.server.ts | 2 | خادم | سرّ خدمة + رمز مؤقّت |
| utils/caps.ts | 5 (تعريفات) | خادم | تعريف حرّاس النطاق/الدور |
| utils/context.ts | 6 | خادم | فحص هوية + فلترة تكليفات |
| utils/scope.ts | 4 | خادم | فحص نطاق + دور (requireMosque*) |
| utils/auth.ts, totp.ts | 3 | خادم | بدائيات مصادقة |
| services/approvalRouting.ts | 7 | خادم | **محرك NESSA — توجيه اعتماد** |
| services/financeActions.ts | 6 | خادم | سياسات approval_policies + فصل مهام |
| services/notifications.ts | 5 | خادم | توجيه إشعار NESSA + دور |
| services/unitBox.ts | 4 | خادم | نطاق تسليم هابط + NESSA |
| services/records.ts | 4 | خادم | آلة حالات اعتماد (أعلام ممرّرة) |
| services/finance.ts | 3 | خادم | فحص دور (admin/amir) |
| services/{assetCustody,authTokens,expenseClaims,governance}.ts | 2+2+1+2 | خادم | ملكية/فصل مهام |
| باقي utils (10 ملف) + services (29 ملف) | 0 | خادم | **صفر صراحةً — محاسبة/أدوات نقية** |

### ٣.١ طبقة الخادم — المجموعة الأولى (البيانات والإدارة والهوية)

#### data.server.ts (42) — العمود الفقري: تقارير + اعتماد + سجل يوم + تدقيق

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق يُفحص؟ كيف |
|---|---|---|---|---|
| data.server.ts:22–23 | فحص نطاق (scopePrefix) | بادئة نطاق عرض الشبكة | isGlobalAdmin | بادئة `u.assignments[0]?.orgPath`؛ **المجهول = المدير نطاقاً (/men/)** |
| data.server.ts:28 | فحص دور صريح | تحديد مسجد المستخدم | role === AMIR | تطابق orgUnitId |
| data.server.ts:35–36 | فلترة نطاق | مساجد المحافظة ونقاطها | — | `like(path, prefix%)` |
| data.server.ts:61–63 | فحص هوية + دور | قدرات الاعتماد (reportRoleCaps) | isGlobalAdmin؛ AMIR على المسجد | تطابق `a.orgUnitId === mosqueId` |
| data.server.ts:67–70 | فحص قدرة + نطاق | كون المستخدم الطبقة المعتمِدة | canApproveUnit (من userCaps) | بادئة مسار على mosquePath |
| data.server.ts:87–89 | فحص دور صريح | صندوق «بانتظار اعتمادك» | isGlobalAdmin أو SQUARE/RABITA/SECTION_HEAD | لاحقاً |
| data.server.ts:100–102 | فلترة نطاق | حصر الصندوق بالطبقة الأقرب | canApproveUnit (via==="nearest") | بادئة على unitPath/mosquePath |
| data.server.ts:131 | فحص دور صريح | صندوق كسر الزجاج | `!isGlobalAdmin` ⇒ فارغ | يعرض اليتيم شبكياً |
| data.server.ts:172–173 | فحص ملكية | بطاقة تقديم تقرير الطبقة | تكليف على الوحدة | تطابق orgUnitId |
| data.server.ts:188–189 | فحص ملكية + دور | تقديم تقرير الطبقة | isGlobalAdmin أو تكليف على الوحدة | تطابق orgUnitId |
| data.server.ts:209 | فحص نطاق | قراءة تقرير المسجد | — | `mosque.path.startsWith(a.orgPath)` — **`u &&` يجعل المجهول يتجاوزه (fail-open)** |
| data.server.ts:240، 259 | فحص دور (أعلام) | أزرار اعتماد/رفض في التقرير | caps.isAmir/isLayer | موروث |
| data.server.ts:282 | فحص نطاق | نظرة المسجد | — | نفس نمط `u &&` fail-open |
| data.server.ts:316–317 | فحص دور/قدرة | اعتماد شهر المسجد | isAmir\|isLayer\|isAdmin | canApproveUnit |
| data.server.ts:348–349 | فحص دور/قدرة | رفض أسبوع | isLayer\|isAdmin | canApproveUnit |
| data.server.ts:366–370 | فحص قدرة + نطاق | رفض تقارير وحدة | canApproveUnit (g.ok) | بادئة على unit.path |
| data.server.ts:418 | فحص هوية | قراءة «طلاب الأسرة» | تسجيل دخول | **لا نطاق — أي مسجَّل يقرأ أي mosqueId** |
| data.server.ts:435–438 | فحص دور + نطاق | ضبط «طلاب الأسرة» | isGlobalAdmin\|AMIR\|section_head/rabita/square | تطابق orgUnitId / بادئة |
| data.server.ts:450–452 | فحص دور صريح | حفظ سجل اليوم | isGlobalAdmin أو AMIR | ضمني: مسجد المستخدم نفسه |
| data.server.ts:483–487 | فحص دور + نطاق | حفظ نشاط نسائي | AMIR/isGlobalAdmin/SQUARE/RABITA/SECTION_HEAD | تطابق orgUnitId / بادئة |
| data.server.ts:511–516 | فحص دور + نطاق (dailyAttachCaps) | قدرات توثيق اليوم: **الرفع** لـisGlobalAdmin/AMIR/SQUARE/RABITA؛ **الاطّلاع (canView, 516) أوسع**: أي مكلَّف مساره بادئةٌ لمسجد السجل (يشمل section_head وحتى teacher/student فوق المسجد) | canUpload=isAmir\|isLayer؛ canView=+`mosquePath.startsWith(a.orgPath)` | تطابق orgUnitId / بادئة |
| data.server.ts:527–528، 533 | فحص نطاق/قدرة | مرفقات اليوم (عرض/إنشاء) | caps.canView/canUpload | موروث |
| data.server.ts:555–556 | فحص نطاق | حذف مرفق يوم | caps.canUpload | dailyAttachCaps(rec.mosquePath) |
| data.server.ts:590–594 | فحص دور + نطاق (userScopeUnit) | أعلى وحدة نطاق | isGlobalAdmin/rabita/square/AMIR | أقصر orgPath إشرافي |
| data.server.ts:628، 763 | فحص نطاق | التنقل/الرولّ-أب لوحدة | scope.path | `found.path.startsWith(scope.path)` |
| data.server.ts:714 | فحص دور صريح | لمحات الإدارة (**إجمالي ماليّ**) + طلبات الأدوار | isGlobalAdmin على الجذر | لا شيء |
| data.server.ts:835–839 | فحص دور صريح | **سجل التدقيق** | isGlobalAdmin أو RABITA/SQUARE/SECTION_HEAD | بادئات orgPath — **لا يفحص `audit.view`** |
| data.server.ts:850–860 | فلترة نطاق | قصر قيود التدقيق على النطاق | — | `a.orgPath.startsWith(p)` |

**دوال بلا فحص هوية:** `dailyActivitiesData` (398، بيانات مرجعية). ودوال تخدم المجهول عبر `u &&`: governorateData (31)، mosqueReportData (209)، mosqueOverviewData (282)، networkData (620)، **networkRollupData (755، مع `financeTotal` المالي 802–806)**.

#### admin.server.ts (22) — الجزيرة الوحيدة التي تحرس بالقدرات + النطاق معاً

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق |
|---|---|---|---|---|
| admin.server.ts:19–24 | فحص هوية+قدرة+نطاق (requireScopedCap) | الحارس العام | hasCap(cap) الممرَّرة | بادئات SUPERVISOR_ROLES (14) أو null للمدير |
| admin.server.ts:33–38 | فحص قدرة (requireAdminRead) | بوابة القراءة | ADMIN_READ_CAPS = admin.view/orgUnit.manage/user.manage/audit.view | بادئات |
| admin.server.ts:44–45 (assertScope) | فحص نطاق | يرمي «خارج نطاقك» | — | `targetPath.startsWith(p)` |
| admin.server.ts:50–53 (assertPersonInScope) | فحص نطاق | الشخص ضمن النطاق | — | بادئة على كل تكاليف الشخص |
| admin.server.ts:64، 67 | قدرة + فلترة | قائمة الوحدات | requireAdminRead | `o.path.startsWith(p)` |
| admin.server.ts:74، 78 | قدرة + نطاق | تعديل وحدة | orgUnit.manage | assertScope(ou.path) |
| admin.server.ts:92، 99–100 | قدرة + نطاق | نقل وحدة | orgUnit.manage | assertScope مصدر+وجهة |
| admin.server.ts:121، 125 | قدرة + نطاق | أرشفة وحدة | orgUnit.manage | assertScope |
| admin.server.ts:138، 143–145 | قدرة + نطاق | إنشاء وحدة | orgUnit.manage | assertScope الأب + منع الجذرية لغير المدير |
| admin.server.ts:159، 161، 167 | قدرة + دور + نطاق | إنشاء مستخدم بدور | user.manage؛ **منح admin/section_head للإدارة فقط** (161) | assertScope |
| admin.server.ts:192، 200–203 | قدرة + فلترة | قائمة المستخدمين | requireAdminRead | `like(orgPath, p%)` |
| admin.server.ts:229، 233 | قدرة + نطاق | مستخدمو وحدة | requireAdminRead | assertScope |
| admin.server.ts:254–255، 274–275، 294–295 | قدرة + نطاق | تعديل/حالة حساب/كلمة مرور | user.manage | assertPersonInScope |
| admin.server.ts:305، 306، 310، 313 | قدرة + دور + نطاق | تعديل تكليف | user.manage؛ **admin/section_head للإدارة فقط** (306) | assertScope الحالي+الوجهة |
| admin.server.ts:320، 324 | قدرة + نطاق | **اعتماد تكليف معلّق** | user.manage | assertScope — **يفتقد حارس منح admin/section_head (306)!** |
| admin.server.ts:330، 334 | قدرة + نطاق | إنهاء تكليف | user.manage | assertScope |

#### announcements.server.ts (7) · auth.server.ts (7) · activities.server.ts (10) · assets.server.ts (6)

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق |
|---|---|---|---|---|
| announcements.server.ts:17–21 | دور + نطاق | إنشاء إعلان | isGlobalAdmin أو section_head/rabita/square/amir | `scopePath.startsWith(p)` |
| announcements.server.ts:26–28 | فلترة نطاق | استهداف المتلقين | LEADER_ROLES/student | `a.orgPath.startsWith(scopePath)` |
| announcements.server.ts:58 | فحص هوية | قائمة الإعلانات | تسجيل دخول | **لا فلترة نطاق — كل مسجَّل يرى كل إعلانات المنصة** |
| announcements.server.ts:68، 76 | دور صريح | نطاقات الإعلان المتاحة | isGlobalAdmin / الطبقات | orgPath التكليف |
| auth.server.ts:22–49 | فحص هوية | currentUser/login (كلمة مرور، حالة حساب، MFA، حدّ محاولات) | — | — |
| auth.server.ts:68–71 | فحص هوية | meUser: جلسة ملغاة ⇒ null | — | — |
| auth.server.ts:79 | دور صريح | مسجد الهبوط | STAFF_ROLES=["amir"] | orgUnitId |
| activities.server.ts:17–38 (creatableScopes) | دور + ملكية + نطاق | نطاقات إنشاء النشاط | amir/isGlobalAdmin/section_head/rabita/square؛ ملكية teacherPersonId | بادئة/تطابق mosqueId |
| activities.server.ts:55–58 | هوية + نطاق | إنشاء نشاط | creatableScopes | تطابق kind+id |
| activities.server.ts:82 | **لا فحص** | `scopeStudentPersons` مُصدَّرة | — | **تُرجع personIds لطلاب أي نطاق بلا فحص** |
| activities.server.ts:103–219 | هوية + ملكية/نطاق | «المطلوب مني»/ردودي/نشاطاتي/مراجعة/إغلاق | — | `personId`/`createdBy`/creatableScopes |
| assets.server.ts:20–27 (manageScopes/covers) | دور + نطاق | نطاقات إدارة الأصول | isGlobalAdmin/section_head/rabita/square/amir | جمع orgPath؛ `path.startsWith(p)` |
| assets.server.ts:35–58 | هوية + دور + نطاق | إنشاء/تعديل أصل | غير المسؤول يُرفض | covers على orgPath الجديد والقائم |
| assets.server.ts:81–84، 94–98، 133–138 | هوية + نطاق | حالة/قائمة/مصروف أصل | manageScopes | covers |

### ٣.٢ طبقة الخادم — المجموعة الثانية (التعليم والإشراف)

#### alaBaseera.server.ts (60) — أكثف ملف؛ فحوص دور صريحة مكرّرة + ملكية معلّم

حرّاس مفتاحية: `requireUser` (14)؛ `inAlaBaseeraScope` (21–25: admin يتجاوز، وإلا `ou.path.startsWith(a.orgPath)`)؛ `requireAlaBaseeraManage` (32–34: admin/amir)؛ `userScopePrefixes` (53–55: القسم كامل للمدير)؛ `halaqaRoles` (336–347: isAdmin/isAmir(orgUnitId)/isSupervisor(rabita/square بمسار)/isOwnerTeacher(personId))؛ `halaqaInScope` (354: معلّم مالك أو أمير — يستثني الإدارة والمشرف)؛ `halaqaReadable` (376: أي صلة)؛ `halaqaLessonApprover` (689–702: NESSA — أمير ثم طبقة أقرب ثم كسر زجاج admin).

نقاط بارزة (القائمة الكاملة في تقرير المسح): إنشاء مكان/معلّم/حلقة (287–309، **createTeacher بلا نطاق 296**)، لوحة الأسبوع (387)، حفظ ملاحظات الإشراف (435: للمشرف/الأمير لا المعلّم)، تقييم طالب (460)، تسجيل درس (469)، اعتماد درس (689–709)، مصفوفة المنهج (733–766)، «حلقاتي» (543–551)، createMyHalaqa (593)، مرفقات (789–800).

**ثغرات موثّقة:** setStudentEvaluation (459–465) الحارس على halaqaId والكتابة على enrollmentId غير مُتحقَّق؛ setCurriculumProgress (756–761) يستعمل حارس القراءة halaqaReadable لكتابة؛ **removeLessonAttachment (800) الفحص داخل `if (l)` — درس محذوف ⇒ حذف بلا أي فحص هوية**؛ halaqaSupervise (359) كود ميت.

#### supervision.server.ts (21) · tahfeez.server.ts (29) · exams.server.ts (17) · circles.server.ts (13) · mosqueLessons.server.ts (11)

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق |
|---|---|---|---|---|
| supervision.server.ts:50–52 | نطاق NESSA | الزائر = الطبقة الأقرب | SUP_ROLES=square/rabita/section_head | `a.orgUnitId === layer.unitId` |
| supervision.server.ts:103–110 | ملكية + قدرة + نطاق | اعتماد الزيارة (لا يعتمد زيارته) | canApproveUnit (report.approve.override) | submitterPath |
| supervision.server.ts:130–145 | دور + فلترة | «زياراتي»/«بانتظار اعتمادي» (المدير لا يزور) | isGlobalAdmin | visitedBy/canApproveUnit |
| supervision.server.ts:196–201 | دور صريح | العرض المجمَّع للمدير/رأس القسم/المنطقة (المربع ⇒ null) | admin/section_head/rabita | — |
| supervision.server.ts:254–263 (covers) | نطاق | حلقات مغطّاة (scope/tasking NESSA) | SUP_ROLES | `path.startsWith(a.orgPath)`/myUnits |
| supervision.server.ts:286–318 | **لا فحص** | overdueCirclesForReminders (للكرون) | — | — |
| tahfeez.server.ts:21، 52 | نطاق/دور | لوحة/إنشاء حلقة تحفيظ | requireMosqueAccess/Manage | canAccessPath/orgUnitId |
| tahfeez.server.ts:78–83 (circleInScope) | دور + ملكية | إدارة الحلقة | admin/amir/معلّم | orgUnitId/teacherPersonId |
| tahfeez.server.ts:166–175 (teachScope) | دور + ملكية | نطاق التدريس | admin/amir/معلّم | orgUnitId/personId |
| tahfeez.server.ts:234 | ملكية/دور | حفظ سجل يومي | teachScope | **studentId غير مُتحقَّق انتماؤه** |
| tahfeez.server.ts:285–288 | نطاق | ترتيب الحلقات | isGlobalAdmin أو **أي تكليف** على المسجد | `orgUnitId===mosqueId` |
| tahfeez.server.ts:434–438 | رمز سرّي | صفحة وليّ الأمر (بلا جلسة عمداً) | token≥16 | ملكية الطالب |
| exams.server.ts:12–15 (canManageExam) | ملكية/دور/نطاق | إدارة الاختبار | معلّم/amir/طبقات/admin | creatableScopes |
| exams.server.ts:88–142 | ملكية (عضوية) | «اختباراتي»/الأسئلة/التسليم | members.includes(personId) | scopeStudentPersons |
| circles.server.ts:16–20 (requireCircleCap) | **فحص قدرة** | بوابة السجل | hasCap(cap) | لاحقاً |
| circles.server.ts:29 (mosqueInScope) | نطاق | — | — | canAccessPath(m.path) |
| circles.server.ts:35–228 | **قدرة** + نطاق | قراءة/إضافة/تعديل/أرشفة | circles.view/circles.manage | mosqueInScope/circleInScope |
| mosqueLessons.server.ts:14–20 (canManageLessons) | دور + نطاق | إدارة الدروس | isGlobalAdmin/amir/section_head/rabita/square | orgUnitId/بادئة |
| mosqueLessons.server.ts:25–37 | **لا فحص** | lessonConflictData (داخلية) | — | — |
| mosqueLessons.server.ts:175–177 | دور + نطاق **مشروط** | حذف حاضر | canManageLessons داخل `if (l)` | **درس محذوف ⇒ حذف بلا فحص** |

#### manhaj.server.ts (0)
`manhajTreeData` (14) و`manhajLessonData` (29) معروضتان للعميل **بلا أي فحص** — عام بلا تسجيل دخول عمداً (محتوى منهاج ثابت، معلَّق رأسياً).

### ٣.٣ طبقة الخادم — المجموعة الثالثة (المالية والعُهد والإعدادات)

#### ledger.server.ts (70) — الدفتر المركزي: فحص قدرة نقيّ + سياسة اعتماد ثنائي، **بلا أي بُعد نطاقي**

حرّاس: `requireFinanceView`→finance.view (11–18)؛ `requireFinanceApprove`→finance.approve (211)؛ `requireFinanceActor`→approve\|entry (222)؛ `requireFinanceEntry`→entry\|approve (311)؛ `requireFinanceSupervise`→finance.supervise (389)؛ `dualControl`→guardFinanceAction (231).

كل الـ70 نقطة «النطاق: لا شيء» — قدرات `finance.*` **شبكية بالكامل**. القراءات بـfinance.view (22، 45، 64، 93، 110، 140، 147، …، 470، 511)، والكتابات بـactor (100، 158، 187، 238، 276، 320، …)، و18 موضعاً تمرّ بـ`dualControl` (سياسة اعتماد). البتّ في المقترحات بـfinance.supervise (403، 409). ترحيل تاريخي بـisGlobalAdmin (37–38). **لافت:** payslipData (175) يكشف راتب أي personId لأي حامل finance.view؛ addBatchItem (326) أي حامل entry يعدّل أي دفعة.

#### boxes.server.ts (19) · mosqueFinance.server.ts (10) · finance.server.ts (12) · custody.server.ts (12) · incentives.server.ts (3) · competition.server.ts (12) · settings.server.ts (6)

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق |
|---|---|---|---|---|
| boxes.server.ts:16–26 | دور + نطاق | CUSTODIAN_ROLES{section_head,rabita,square,amir}؛ canView | admin/أمين | `path.startsWith`/orgUnitId |
| boxes.server.ts:81، 90، 99، 139 | دور + نطاق | قبض/صرف/تسليم/إقفال | CUSTODIAN_ROLES/admin | تطابق orgUnitId |
| boxes.server.ts:107، 159 | هوية فقط | إقرار استلام/اعتماد إقفال (مفوّض للخدمة) | تسجيل دخول | NESSA في الخدمة |
| boxes.server.ts:116، 129 | دور صريح | خطة/توزيع رواتب | isGlobalAdmin | — |
| mosqueFinance.server.ts:27، 45 | نطاق | إجماليات/حركات (إخفاء صامت) | isGlobalAdmin أو canAccessPath | `mosque.path` |
| mosqueFinance.server.ts:63–64 | دور + نطاق | إدارة مالية المسجد | isGlobalAdmin/amir | orgUnitId |
| mosqueFinance.server.ts:73–102 | سياسة اعتماد | تبرع/مصروف | guardFinanceAction | — |
| finance.server.ts:18–33 (requireFinanceView) | **قدرة** + نطاق | المستحقات | finance.view + isGlobalAdmin/SUPERVISOR_ROLES | بادئات؛ **نطاق فارغ ⇒ `1=0` (يُقفل)** |
| finance.server.ts:46 (requireFinanceAdmin) | دور صريح | — | isGlobalAdmin | — |
| finance.server.ts:178، 201، 208 | دور صريح | احتساب/اعتماد/صرف مستحق | isGlobalAdmin | — |
| custody.server.ts:17–40 | **قدرة** + نطاق | scopes (CUSTODY_SCOPE_ROLES)؛ requireManage | assets.manage | covers؛ نطاق فارغ ⇒ throw |
| custody.server.ts:44–156 | قدرة/ملكية + نطاق | عُهد نطاقي/عُهدتي/تسليم/استرداد/بلاغ | assets.manage / personId | covers |
| custody.server.ts:165–181 | **لا فحص** | openCustodyOf/myCustodyBadge (تصدير ميت) | — | **عُهد أي شخص بلا مصادقة** |
| incentives.server.ts:11–42 | دور صريح | قراءة/إضافة/حذف حافز | isGlobalAdmin | — |
| competition.server.ts:9–158 | دور صريح | **كل العمليات حتى القراءة** | isGlobalAdmin | — |
| settings.server.ts:45–146 (requireCap) | **قدرة** | قراءة/تعديل المعدّلات والإعدادات | settings.view/settings.manage | — |

### ٣.٤ طبقة الخادم — المجموعة الرابعة (التسجيل والرئيسيات والإعلام والإشعارات)

| الملف:السطر | الأسلوب | ماذا يحرس | الدور/القدرة | النطاق |
|---|---|---|---|---|
| registration.server.ts:21 (ROLE_RANK) | دور (رتبة) | أهلية البتّ | admin=0…teacher=5 | — |
| registration.server.ts:133–212 (canApprove) | دور + نطاق | توجيه/عرض/بتّ طلبات الانضمام | رتبة أدنى من الطلب/admin/amir | `targetPath.startsWith`/orgUnitId |
| registration.server.ts:62 (SELF_REG_KINDS) | دور | منع تسجيل ذاتي بأدوار admin/section_head | — | تطابق الجنس مع المسار (87، 93، 105) |
| home.server.ts:33، 127، 220، 294، 322 | دور صريح | اختيار الرئيسية (admin/amir/طبقة/مالي/طالب) | isGlobalAdmin/amir/square/rabita/section_head/finance_officer | orgUnitId ضمني |
| home.server.ts:161، 296، 326، 345 | ملكية | استحقاق/مقترحات/التحاق/درجات | — | personId/userId |
| home.server.ts:355–356 | فحص هوية | **unitDiagnosisData** | تسجيل دخول فقط | **لا نطاق — أي مسجَّل يستعلم عن قائد أي unitId** |
| home.server.ts:381–390 | دور صريح | موزّع الرئيسية | كل الأدوار العشرة نصاً | — |
| materials.server.ts:29–39 (audiencesOf/canManage) | دور | جمهور/إدارة الموادّ | amir/teacher/supervisor/admin؛ section_head | — |
| materials.server.ts:118–190 | دور + فلترة | إنشاء/تعديل/متابعة | canManage | **شبكي بلا نطاق** (رأس قسم يعدّل موادّ القسم الآخر) |
| search.server.ts:16–18، 61–63 | فلترة نطاق | شجرة/بحث الوحدات | isGlobalAdmin يعفي | **`u &&` fail-open — u=null ⇒ تسقط الفلترة** |
| search.server.ts:24–45 | **لا فحص فعلي** | searchPersons/Teachers/Venues | `currentUser()` يُهمل ناتجه | **مجهول يعدّد كل أشخاص/معلّمي/أماكن الشبكة** |
| mediaHub.server.ts:20–26 (requireMediaHub) | **قدرة** | بوابة المركز | media.hub | لاحقاً |
| mediaHub.server.ts:80–128 | قدرة + فلترة نطاق | معرض الصور | media.hub | `orgPath LIKE prefix%` |
| mediaHub.server.ts:190، 212–220 | نطاق + **قدرة** | فتح/إنشاء تغطية | media.post (شخصية) | `path.startsWith(p)` |
| mediaHub.server.ts:239 | ملكية | حذف تغطية | createdBy===userId | **حتى المدير لا يحذف تغطية غيره** |
| media.server.ts:37–44 (canReadMediaKey) | هوية + دور | قراءة ملفات الوسائط | admin/section_head؛ AUDIENCE_ROLES | **غير materials/ = جلسة فقط بلا نطاق** |
| media.server.ts:96–171 | دور + قدرة + نطاق | رفع (مادّة/تغطية/سجل يوم/درس) | admin/section_head؛ media.post؛ amir/طبقة | orgUnitId/بادئة/ملكية |
| permissions.server.ts:19–31 (requirePermAdmin) | دور صريح | إدارة الصلاحيات | **isGlobalAdmin لا permissions.manage** | — |
| scheduled.server.ts:15–16 | دور صريح | التشغيل اليدوي | isGlobalAdmin | — |
| scheduled.server.ts:22 | **لا فحص** | runDueTasksData (للكرون) | — | يكتب إشعارات ويرسل خارجياً |
| scheduled.server.ts:60–188 | فلترة نطاق (توجيه) | تذكيرات/تصعيد | AMIR/square/rabita/section_head | orgUnitId/بادئة/الأعمق |
| notifications.server.ts:16–177 | هوية + ملكية | Push/تيليغرام/إشعاراتي | تسجيل دخول | personId |
| notifications.server.ts:19–23 | ملكية (ثغرة) | تحديث Push بنفس endpoint | — | **ينقل الملكية للمستخدم الحالي (استيلاء)** |
| meetings.server.ts:14–95 | نطاق + دور | قراءة/إنشاء/قرارات | requireMosqueAccess/Manage | canAccessPath/orgUnitId |
| myTasks.server.ts:34–45 | دور صريح | بطاقات المهام (المدير تُحجب عنه بطاقات — فرض سالب) | amir/admin | orgUnitId |
| committees.server.ts:9–142 | هوية + دور + ملكية | إدارة/لجنتي | admin/amir؛ headPersonId | orgUnitId/personId |
| telegram.server.ts:15–33 | سرّ خدمة + رمز | ويبهوك/ربط | x-telegram-secret؛ linkToken | personId صاحب الرمز |

### ٣.٥ طبقة الخادم — الأدوات والخدمات المشتركة

**utils الحارسة:** caps.ts (isAdmin 7؛ canAccess 12؛ isAmirOf 16؛ **canEditLockedWeek 21: RABITA وadmin فقط — لا section_head**؛ canLockWeek 28)؛ context.ts (userFromToken 20؛ **فلترة التكليفات المعتمدة النشطة 29–33**؛ حالة الحساب 37؛ session_epoch 40؛ isGlobalAdmin 47؛ canAccessPath 51)؛ scope.ts (requireMosqueAccess 11–16؛ requireMosqueManage 23–29)؛ orgPath.ts (`isWithin`=startsWith 25 — أساس كل النطاق)؛ auth.ts/totp.ts (بدائيات). **rbac.ts:22 `SUPERVISORY_ABOVE_MOSQUE` معرَّف وغير مُستعمل (كود ميت).**

**services — محرك NESSA (approvalRouting.ts، 7 نقاط):** `SUPERVISORY_LAYERS=[square,rabita,section_head]` (13، admin مستبعَد)؛ `approverLayerFor(unitPath)` (23–43: `ancestorIds`→استعلام على الآباء بالأدوار الثلاثة المعتمدة النشطة→الأعمق مساراً؛ لا صفوف ⇒ vacant)؛ `canOverrideApprove` (55–63: admin=false، يشترط `*`\|report.approve.override + سلَف أعلى من NESSA)؛ `isBreakGlass` (66: admin + طبقة شاغرة)؛ `canApproveUnit` (72: nearest→override→breakglass).

**services أخرى:** financeActions.ts (`requiresApproval` من `approval_policies` بالدور 199–206؛ `guardFinanceAction` نقطة الاختناق 209–228؛ فصل مهام 235؛ **notifySupervisors: `"admin"` حرفية بلا `endDate IS NULL` 420–421**)؛ notifications.ts (توجيه NESSA 48–59؛ كسر زجاج admin 62–73؛ **`'amir'` حرفية بلا `approvalStatus` 78–94**)؛ unitBox.ts (تسليم هابط `to.path.startsWith(from.path)` 79؛ **إقرار استلام يقبل أي دور على الوحدة 104–108**؛ اعتماد إقفال NESSA 259–266)؛ records.ts (آلة حالات بأعلام ممرّرة 174–188)؛ finance.ts (admin مقطوع 31/amir نقاط 37)؛ assetCustody.ts (ملكية الإقرار 61)؛ expenseClaims.ts (فصل مهام 29)؛ governance.ts (حدّ الدورتين 41). **٢٩ ملف خدمة + ١٠ ملفات utils = صفر فرض** (محاسبة/أدوات نقية).

### ٣.٦ طبقة الواجهة — حرّاس المسارات (routes/)

كل حرّاس القدرات في المسارات تسع تشترك في `canAccess(path, caps)` من access.ts (مصدر واحد مع NAV)، ووجهة الفشل موحّدة `firstAllowed(caps)` (دالة كلّية تنتهي بـ/no-access). الفرض في الواجهة **إخفاء/توجيه فقط** — لا يحمي الخادم.

| المسار | الحارس وقدرته | قدرة تبويب NAV | تطابق؟ |
|---|---|---|---|
| /home | **جلسة فقط بلا قدرة** (home.tsx:19) + redirect خادمي (30) | duties.view (access.ts:7) | **لا** — صفريّ القدرات يفتحها |
| /network (layout) | canAccess (network.tsx:8) | network.view | نعم |
| /finance | canAccess (finance.tsx:11) | box.view | نعم |
| /ala-baseera | canAccess (ala-baseera.tsx:11) | network.view (عمداً لا alaBaseera.*) | نعم |
| /competition | canAccess (competition.tsx:11) | competition.view | نعم |
| /duties | canAccess (duties.tsx:11) | duties.view (hidden) | نعم (وصول مباشر متاح) |
| /library | canAccess (library.tsx:11) | library.view | نعم |
| /manhaj | **لا حارس إطلاقاً** — عام | library.view (access.ts:20) | **لا** — مفتوح للعالم |
| /media-hub | canAccess (media-hub.tsx:9) | media.hub | نعم |
| /custody | canAccess anyOf (custody.tsx:9) | assets.manage∨custody.own | نعم |
| /admin | canAccess anyOf (admin.tsx:11) | admin.view∨orgUnit.manage∨user.manage∨audit.view | نعم |
| /my-circles | canAccess (my-circles.tsx:9) | circle.teach (شخصية) | نعم |
| /my-committee | canAccess (my-committee.tsx:9) | committee.own (شخصية) | نعم |
| /mosque/$mosqueId | **جلسة فقط بلا قدرة ولا نطاق** (mosque.$mosqueId.tsx:11) | — | العزل كله خادمي |
| /design-system | جلسة + `caps.includes("admin")` (design-system.tsx:11) | — | **معطوب: يفشل حتى للمدير** |
| /register, /student/$token | بلا حارس جلسة (عام/رمز سرّي) | — | — |

**home.tsx (8 نقاط):** حارسان (19، 30) + فحص دور loader (33) + ٥ فروع عرض بالدور `home.role` (51–58: admin/amir/supervisor/finance/student/generic) — الدور محسوب خادمياً. **بقية المسارات:** حارس هوية (`!user ⇒ /login`) + `canAccess` عبر NAV.

### ٣.٧ طبقة الواجهة — المكونات (components/) — إخفاء UI بالقدرات

النمط السائد: حساب أعلام `hasCap(caps, X)` في أعلى المكوّن ثم `{flag && <...>}` أو `disabled={!flag}` أو تمريرها خاصيةً للأبناء. **كلها إخفاء لا حماية.** ملخص بالمجلد:

| المجلد | نقاط فرض | أبرز ما يُحرَس |
|---|---|---|
| admin | ~27 | AdminPage: تبويبات بـuser.manage/permissions.manage/settings.view/audit.view (137–141)، نموذج الوحدة بـorgUnit.manage (147)؛ **PermissionsPanel:21،68 `role==="admin"`** (الدور المُحرَّر لا المستخدم)؛ **AdminPage:45 `caps.includes("*")`** (يتجاوز hasCap)؛ AdminPage:243 ترشيح دور admin بـ`*` |
| finance | ~26 قرار | FinancePage: **early return وجه «الصندوق» لغير finance.view (150)**؛ canApprove/canPayout/canEntry/canSupervise (71–75)؛ ApprovalInbox بـfinance.supervise (294)؛ ~15 قسم تمرّر أعلام لأبنائها |
| mosque | ~14 قرار | MosquePage: canManage للتحفيظ/الاجتماعات/اللجان/الحلقات/بصيرة (77–81)؛ readOnly لسجل اليوم بـ`isOwn && dailyLog.edit` (154)؛ **428–439 أزرار تحفيظ بلا canManage** |
| ala-baseera | 9 | AlaBaseeraPage: `*` لإخفاء الإعداد/مبدّل القسمين/بطاقة المال (79–155)؛ **311 نموذجا الإدخال بعلم خادم getHalaqaAccess** |
| network | 4 | NetworkPage: مبدّل القسمين/أزرار التصدير بـ`*`∨report.approve (129–407) |
| custody/competition/media/duties/library | 3–4 لكلّ | canManage بـassets.manage/competition.manage/media.post/duties.manage∨`*`/library.manage∨`*` |
| nav | 5 | TopTabs: orderedNav (قدرات+ترتيب بالدور)؛ تبويبات المسجد؛ isOwnMosque |
| **home** | **0** | **كل رئيسيات الأدوار الست خالية من الفحص — الاختيار في routes/home.tsx بالدور الخادمي** |
| daily-log, report, circles, mosque(LessonsTab) | استهلاك أعلام | readOnly/canManage/canSupervise ممرّرة من الآباء أو محسوبة خادمياً (ReportActions نمط جيد) |
| ui (55 ملف), landing, committee, registration, tahfeez, mosque-finance | 0 | لا فحص ذاتي |

**أعلام محسوبة خادمياً (نمط أسلم):** ReportActions (canAmirApprove/canLayerApprove)، MyCirclesPage (canSupervise)، AlaBaseeraPage:313، SupervisionRegister:104، home/*.

## ٤. المصفوفة الفعلية دور×قدرة

### ٤.أ من `ROLE_DEFAULTS` (المصدر: تنفيذ `roleDefaultHas` نفسه — الجدول مولَّد آلياً من `capabilities.ts` عبر `node --experimental-strip-types`، لا نقلاً يدوياً)

الرموز: ✓ = يملكها افتراضاً · «·» = لا يملكها. **تنبيه قراءة عمود `admin`**: افتراضيه `["*"]` (capabilities.ts:149) والشمول يمنح كل شيء **عدا القدرات الشخصية الأربع** (`hasCap`، capabilities.ts:206–209) — لذلك خلاياه ✓ في كل شيء إلا `circle.teach` و`committee.own` و`media.post` و`custody.own`.

| القدرة | admin | section_head | rabita | square | amir | teacher | committee_head | media | finance_officer | student |
|---|---|---|---|---|---|---|---|---|---|---|
| network.view | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| report.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| report.approve | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| report.approve.override | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| dailyLog.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| dailyLog.edit | ✓ | · | · | · | ✓ | · | · | · | · | · |
| finance.view | ✓ | · | · | · | · | · | · | · | ✓ | · |
| box.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · |
| finance.entry | ✓ | ✓ | · | · | · | · | · | · | ✓ | · |
| finance.approve | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| finance.payout | ✓ | · | · | · | · | · | · | · | ✓ | · |
| finance.supervise | ✓ | · | · | · | · | · | · | · | · | · |
| mosqueFinance.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| mosqueFinance.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| circles.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| circles.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| alaBaseera.viewAll | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| alaBaseera.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| alaBaseera.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| tahfeez.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| tahfeez.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| meetings.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| meetings.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| committees.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| committees.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| committee.own | · | · | · | · | · | · | ✓ | · | · | · |
| circle.teach | · | · | · | · | · | ✓ | · | · | · | · |
| competition.view | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| competition.manage | ✓ | · | · | · | ✓ | · | · | · | · | · |
| assets.manage | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |
| custody.own | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| media.hub | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · |
| media.post | · | · | · | · | · | · | · | ✓ | · | · |
| library.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| library.manage | ✓ | ✓ | · | · | · | · | · | · | · | · |
| duties.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| duties.manage | ✓ | · | · | · | ✓ | ✓ | · | · | · | · |
| admin.view | ✓ | · | · | · | · | · | · | · | · | · |
| user.manage | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| orgUnit.manage | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| permissions.manage | ✓ | · | · | · | · | · | · | · | · | · |
| settings.view | ✓ | · | · | · | · | · | · | · | · | · |
| settings.manage | ✓ | · | · | · | · | · | · | · | · | · |
| audit.view | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |

(عدد القدرات المصرّحة نصاً: section_head ٢٥ · amir ٢٤ · rabita ٢٣ · square ١٨ · finance_officer ٧ · teacher ٥ · media ٥ · committee_head ٤ · student ٢ · admin `"*"`)

### ٤.ب أثر قاعدة البيانات على المصفوفة

| الجدول | البذور/الهجرات | الأثر الفعلي على المصفوفة |
|---|---|---|
| `permission_overrides` (schema.ts:1002) | هجرة 0008 تنشئ الجدول فقط؛ **لا بذور ولا هجرة تُدخل صفوفاً** — المحتوى الإنتاجي يُحرَّر حصراً من مصفوفة المدير (`setPermissionData`، permissions.server.ts:30–40) | محلياً وفي البذور: **صفر تجاوزات** ⇒ المصفوفة الفعلية = ٤.أ حرفياً. إنتاجياً: غير قابل للفحص من هنا (الاتصال محظور بالمهمة) — أي توثيق للمصفوفة الإنتاجية يلزمه تفريغ الجدول وقت النقل |
| `approval_policies` (schema.ts:1113) | هجرة 0070:41–42 تبذر `('pol-fo-all','finance_officer','*','approve',0)` | طبقة فرضٍ رابعة فوق المصفوفة: كل فعل ماليّ يقترحه `finance_officer` يدخل طابور `finance_actions` ولا يُنفَّذ إلا باعتماد — أي أن ✓ في خلايا `finance.entry/payout` للمسؤول المالي تعني عملياً «اقتراح» لا «تنفيذ» |
| `role_assignments.approvalStatus` (schema.ts:148) | افتراضه `'approved'` | التكليف المعلّق (`pending`) لا يظهر في الجلسة أصلاً (context.ts:32) — فرضٌ في طبقة تحميل الهوية |

## ٥. التضاربات والفجوات (لبّ الوثيقة)

مرتّبة بالصنف كما طلبت المهمة. كل بند مسنود بموضعين `ملف:سطر` وأثره العملي. التصنيف: 🔴 ثغرة أمنية · 🟠 تضارب مصادر · 🟡 فرق عن الوثائق · ⚪ اتساق/كود ميت.

### أ. محروس في الواجهة (إخفاء زر) دون حراسة الخادم — أخطر صنف

| # | الوصف | الموضعان المتضاربان | الأثر العملي |
|---|---|---|---|
| أ-١ 🔴 | **بحث الأشخاص/المعلّمين/الأماكن بلا مصادقة** | `search.server.ts:24–25،34–35،44–45` (تستدعي `currentUser()` وتُهمل ناتجه) × `auth.server.ts:22–24` (`currentUser` يعيد null ولا يرمي) | **مجهول بلا جلسة** يعدّد أسماء كل أشخاص الشبكة ومعلّميها وأماكنها. الواجهة لا تعرض البحث لغير مخوَّل، لكن الدالة الخادمية مكشوفة. تسريب PII شبكي كامل. |
| أ-٢ 🔴 | **شجرة/وحدات الشبكة fail-open** | `search.server.ts:16–18` و`61–63` (`u && !isGlobalAdmin(u) ? filter : all`) × نمط الهوية | إن كان `u=null` **تسقط الفلترة كلها** فيعود كامل الشجرة/الوحدات للمجهول. العزل ينعكس عند غياب الجلسة بدل أن ينغلق. |
| أ-٣ 🔴 | **قراءة تقرير/نظرة المسجد للمجهول** | `data.server.ts:209` و`282` (`if (u && !isGlobalAdmin(u) && !...startsWith) return null`) | المسجَّل خارج النطاق يُمنع، **والمجهول يمرّ** (الشرط مشروط بـ`u &&`). fail-open: غياب الهوية أرخى من وجودها. |
| أ-٤ 🔴 | **رولّ-أب الشبكة مع الإجمالي المالي للمجهول** | `data.server.ts:755` و`802–806` (المجهول scope=null، وfinanceTotal من `monthlyEntitlements.all()` بلا بادئة) × `lib/api/network.ts:77–85` (`exportNetworkRollup` بلا حارس) | `networkRollupData` تعيد للمجهول رولّ-أب الشبكة **مع `financeTotal`** كـCSV/HTML. تسريب مالي مجمّع بلا تسجيل دخول. **مؤكَّد بتتبّع الغلاف: لا `.middleware()`.** |
| أ-٨ 🔴 | **`weekProgressData` بلا أي مصادقة، مكشوفة لمجهول** (نقطة فاتت المسح الأول) | `home.server.ts:188` (لا `currentUser()` إطلاقاً، `mosqueId` حرّ) × `lib/api/functions.ts:29–33` (`getWeekProgress` GET بلا حارس) | أي مجهول يستعلم عن `{points, target, weekStart}` لأي مسجد. صنف أ-٣/أ-٤ (تسريب تشغيليّ لا PII). أضافها التدقيق العدائي. |
| أ-٥ 🔴 | **قراءة صور التوثيق/الدروس/التغطيات بلا نطاق** | `media.server.ts:37–38` (`canReadMediaKey`: غير `materials/` تكفيه الجلسة) × لا فحص نطاق | أي مسجَّل يعرف `r2Key` يقرأ صور أي قسم — **بما فيه عبور حاجز القسمين الرجالي/النسائي**. الحماية سرّية الرابط لا الفرض (معلَّق تصميماً). |
| أ-٦ 🟠 | **صفحة المسجد بلا فحص قدرة/نطاق في الواجهة** | `mosque.$mosqueId.tsx:11` (جلسة فقط) × `lib/mosque-tabs.ts` (إخفاء تبويبات فقط) | أي مسجَّل (طالب) يطلب `/mosque/:id` لأي مسجد؛ الإخفاء في الواجهة تجميلي وكل العزل الحقيقي متروك لدوال الـloader الخادمية (تُفحص فرادى). |
| أ-٧ 🟠 | **مالية المسجد: نماذج الإدخال تُعرض بـmosqueFinance.view لكن بلا فحص manage في الواجهة** | `components/mosque-finance/MosqueFinancePage.tsx` (يستورد addDonation/addExpense سطر 12 بلا حارس قدرة واجهة) × `mosqueFinance.server.ts:65` (الخادم يرمي: `if (!isAdmin && !isAmir)`؛ 63–64 يحسبان الدور) | الأزرار تظهر لحامل view فقط، والخادم يرفض — «يظهر ما لا يعمل». *(تصحيح تدقيق: لا يوجد ملف `TxnPanel`؛ والقدرتان `mosqueFinance.view/manage` ميتتا الفحص خادمياً — يُحرَس بالدور amir/admin.)* |

### ب. محروس في الخادم ويظهر في الواجهة لدور لا يملكه («يظهر ما لا يجب»)

| # | الوصف | الموضعان | الأثر |
|---|---|---|---|
| ب-١ 🟠 | **أزرار تحفيظ في صفحة المسجد بلا فحص canManage** | `components/mosque/MosquePage.tsx:428–439` (زرّا سجل اليوم وقائمة الطلاب يظهران لكل من يرى التبويب) × الحارس داخل النماذج الفرعية فقط | يرى المطّلع أزراراً تفشل عند الضغط (الفرض الحقيقي أعمق). إرباك، لا تسريب. |
| ب-٢ ⚪ | **/duties المخفيّ يبقى قابلاً للوصول المباشر** | `access.ts:43` (`allowedNav` يسقط hidden) × `access.ts:46–49` (`canAccess` لا يستثني hidden) | حامل duties.view يصل /duties مباشرة رغم إخفائه من الشريط (سلوك مقصود غالباً). |

### ت. فحص دور صريح يتجاوز نظام القدرات (أوسع صنف — بنيويّ)

| # | الوصف | الموضعان | الأثر |
|---|---|---|---|
| ت-١ 🔴 | **حارس /design-system يفحص قدرة غير موجودة فيفشل للجميع** | `routes/design-system.tsx:11` (`caps.includes("admin")`) × `capabilities.ts:149` (قدرات المدير = `["*"]` لا `["admin"]`) | الشرط يفشل **حتى للمدير**؛ الصفحة غير قابلة للوصول لأحد. ومصادَق بلا قدرة يُقذف إلى "/" ثم /home (لا /no-access). فحص يتجاوز `hasCap` (لا يكرّم `*`). |
| ت-٢ 🔴 | **إدارة الصلاحيات تُحرَس بالدور لا بقدرتها المكتلجة** | `permissions.server.ts:19–23` (`requirePermAdmin`=isGlobalAdmin) × `capabilities.ts:74` (قدرة `permissions.manage` مكتلجة) | القدرة `permissions.manage` معرّفة ومسنَدة للمدير في ROLE_DEFAULTS، **لكن لا تُفحص قط**؛ منحها بتجاوز لدور آخر لا أثر له. الباب مقفول على `admin` نصاً. |
| ت-٣ 🔴 | **سجل التدقيق يُحرَس بقائمة أدوار لا بـaudit.view** | `data.server.ts:835–839` (isGlobalAdmin أو RABITA/SQUARE/SECTION_HEAD) × `capabilities.ts:77` (قدرة `audit.view` مكتلجة، ومسنَدة لـsection_head/rabita في ROLE_DEFAULTS) | حجب `audit.view` بتجاوز عن rabita **لا يمنعه** من السجل (الفحص بالدور)؛ وSQUARE يصل السجل رغم أنه لا يملك `audit.view` في المصفوفة (§٤.أ: square بلا audit.view). تناقض مباشر بين الفحص والمصفوفة. |
| ت-٤ 🟠 | **٢٨ قدرة من ٤٤ لا تُفحص خادمياً بنظام القدرات** | §٢.ب (القائمة) × جداول §٣ | على بصيرة/التحفيظ/الاجتماعات/اللجان/المسابقة/مالية المسجد/الصندوق/المكتبة/النشاطات تُحرَس كلها بفحص دور صريح. **جدول `permission_overrides` بلا أثر عملي على أغلب النظام.** |
| ت-٥ 🟠 | **فحص «الإدارة» غير موحّد: `isGlobalAdmin` مقابل `role==="admin"` حرفية** | `context.ts:47` (`isGlobalAdmin`) × committees.server.ts:17،85؛ media.server.ts:40،134؛ myTasks.server.ts:44؛ financeActions.ts:421؛ unitBox.ts:264 (`"admin"` حرفية) | مصدرا حقيقة منفصلان لمعنى «المدير». سيّان اليوم، لكن أي تغيير في تعريف المدير يلزم تعديل مواضع متفرقة. |
| ت-٦ ⚪ | **PermissionsPanel يفحص `role==="admin"` (الدور المُحرَّر)** | `components/admin/PermissionsPanel.tsx:21،68` × `AdminPage.tsx:45` (`caps.includes("*")` للمستخدم) | فحصان مختلفان لكلمة «admin»: أحدهما الدور في المصفوفة، الآخر جامع المستخدم — يعمّق ازدواج المعنى. |

### ث. تعارض rbac.ts القديم مع capabilities.ts

| # | الوصف | الموضعان | الأثر |
|---|---|---|---|
| ث-١ ⚪ | **مصدرا تعريف الأدوار متطابقان اليوم لكن منفصلان** | `rbac.ts:1–13` (`ROLES` ١٠) × `capabilities.ts:85–96` (`ROLE_LABEL` ١٠) | لا تعارض في القيم حالياً (تعليق rbac.ts:9 يوثّق التوحيد اليدوي)، لكنهما ملفان يجب أن يُحدَّثا معاً. لا آلية تمنع انحرافهما. |
| ث-٢ ⚪ | **ازدواج تعريف دوال النطاق/الدور** | `caps.ts:12 canAccess` × `context.ts:51 canAccessPath` (متطابقتان)؛ `caps.ts:7 isAdmin` × `context.ts:47 isGlobalAdmin` (متطابقتان) | مصدران للحقيقة نفسها؛ استيراد أحدهما دون الآخر يبدو اعتباطياً عبر الملفات (١٢ ملفاً يستورد من rbac). |
| ث-٣ ⚪ | **`SUPERVISORY_ABOVE_MOSQUE` (rbac.ts:22) كود ميت** | `rbac.ts:22` (التعريف) × grep كامل (لا مستهلك) | ثابت أدوار إشرافية معرَّف ولا يُستعمل في أي سطر — تضليل: قارئ v2 قد يبني عليه. |

### ج. تعارض قاعدة البيانات (بذور/تجاوزات) مع ROLE_DEFAULTS

| # | الوصف | الموضعان | الأثر |
|---|---|---|---|
| ج-١ 🟠 | **٦ أدوار في بذرة الإنتاج بلا وجود في الكود** | `scripts/gen-seed.mjs:95–96` (deputy/secretary/treasurer/committee/member/participant) × `capabilities.ts:148–182` (ROLE_DEFAULTS بلا أيٍّ منها) | ٣٨٠ تكليفاً (من ٥١٣) بأدوار تعطي **صفر قدرات** (`ROLE_DEFAULTS[role] ?? []`) وتسمية خام (`ROLE_LABEL[role] ?? role`). أصحابها يهبطون على /no-access. الوثيقتان 02/13 تعرّفانها (R5–R10) والكود لا. |
| ج-٢ 🟠 | **انزياح تسمية: `committee` (بذرة) مقابل `committee_head` (كود)** | `gen-seed.mjs:95` (`committee`) × `capabilities.ts:92` (`committee_head`) | دور اللجنة المبذور لا يطابق الدور المعرّف — حتى لو أُضيف `committee` للكود لاختلف عن `committee_head`. |
| ج-٣ 🟠 | **تكليفات admin/finance/media بمسار `/` بدل مسار وحدتها** | `gen-seed.mjs:52،224،231` (`org_unit_id='men'` مع `org_path='/'`) × schema.ts:143 (orgPath «للتحقق السريع من النطاق») | نطاق فحص `isWithin` لمسؤول الإعلام والمالي يصبح **الشبكة كلها بقسمَيها** لا قسم الرجال. للمدير `*` لا فرق. |
| ج-٤ ⚪ | **`permission_overrides` بلا بذور — المصفوفة الفعلية = الافتراضيات حرفياً** | هجرة 0008 (إنشاء الجدول فقط) × لا INSERT في أي بذرة/هجرة | محلياً: صفر تجاوزات. المحتوى الإنتاجي غير قابل للفحص من هنا (الاتصال محظور) — أي نقل لـv2 يلزمه تفريغ الجدول وقت القطع. |
| ج-٥ ⚪ | **`seed.sql` الصغيرة فاسدة بنيوياً (نوع `bloc` والشجرة القديمة)** | `seed.sql:6` (`type='bloc'`) × `rbac.ts:26` (`ORG_TYPES` بلا bloc) | ليست في خط البذر الرسمي (`cf:seed:remote`) لكنها باقية مضلِّلةً؛ `bloc` مصطلح الوثيقتين 02/13 لطبقة «الكتلة» المحذوفة من الكود. |

### ح. مواضع بلا فحص نطاق (قدرة تعمل على كل الشبكة وكان يجب حصرها بوحدة)

| # | الوصف | الموضع | الأثر |
|---|---|---|---|
| ح-١ 🔴 | **الدفتر المركزي بلا أي بُعد نطاقي (70 نقطة)** | `ledger.server.ts` كامل (كل النقاط «النطاق: لا شيء») | قدرات `finance.*` شبكية: `payslipData:175` يكشف راتب أي شخص لأي حامل finance.view؛ `addBatchItem:326` أي حامل entry يعدّل أي دفعة لأي أحد. لا عزل بوحدة إطلاقاً. |
| ح-٢ 🟠 | **قراءة «طلاب الأسرة» لأي مسجد** | `data.server.ts:418` (هوية فقط، `mosqueId` حرّ) × `functions.ts:88–93` (`getFamilyStudents` بلا حارس نطاق) | أي مسجَّل يقرأ `familyStudents` لأي مسجد. *(خُفِّض من 🔴 بعد التدقيق: يشترط جلسة (ليس fail-open)، ويسرّب عدّاداً صحيحاً واحداً لا PII؛ الكتابة مُحكَمة نطاقاً — فالعيب عدمُ تناظرٍ قراءة/كتابة.)* |
| ح-٣ 🔴 | **`unitDiagnosisData` يكشف قائد أي وحدة لأي مسجَّل** | `home.server.ts:355–356` (هوية فقط) | طالب يستعلم عن اسم قائد/شغور أي منطقة/مربع/مسجد. المعلَّق «للمطّلعين من فوق» غير مفروض كوداً. |
| ح-٤ 🔴 | **`openCustodyOf`/`myCustodyBadge` بلا أي فحص** | `custody.server.ts:165–181` (تصدير بلا مصادقة) | تُرجع عُهد/عدّادات أي شخص. تصدير ميت اليوم (لا غلاف RPC)، لكن أول من يصلها يفتح تسريباً. |
| ح-٥ 🟠 | **قائمة الإعلانات بلا فلترة نطاق** | `announcements.server.ts:58` (كل مسجَّل يرى آخر ٣٠ إعلاناً) × الإنشاء منطاق (17–21) | إعلانات نطاقات لا تخص المستخدم تظهر له، رغم أن الاستهداف عند الإنشاء منطاق. |
| ح-٦ 🟠 | **الموادّ التدريبية شبكية بلا نطاق** | `materials.server.ts:118–153` (canManage بلا بُعد نطاقي) | رأس قسم واحد يعدّل موادّ كل الأقسام بما فيها القسم النسائي الآخر. |
| ح-٧ 🟠 | **`financeWorkbook` يعيد بيانات الشبكة كلها بلا نطاق** | `services/financeWorkbook.ts` (الحراسة على المستدعي) | أي مستدعٍ جديد في v2 يستهلكها دون حارس أعلى = تسريب مالي شبكي. |

### خ. ثغرات فرض إضافية (نطاق ناقص / كتابة بلا تحقّق انتماء)

| # | الوصف | الموضع | الأثر |
|---|---|---|---|
| خ-١ 🔴 | **حذف صف يتيم بلا فحص هوية** | `alaBaseera.server.ts:800` و`mosqueLessons.server.ts:175–177` (`if (l) await guard`) | إن كان الكيان الأب (الدرس) محذوفاً يمضي حذف المرفق/الحاضر **بلا أي فحص** — قابل للاستدعاء من مجهول بمعرّف صف. |
| خ-٢ 🔴 | **كتابة تقييم/تقدّم/حضور على معرّف غير مُتحقَّق انتماؤه** | `alaBaseera.server.ts:459–465` (enrollmentId **و lessonSessionId** غير مُتحقَّقَين)، `756–761` (setCurriculumProgress)، **`490–493` (recordLesson — أضافها التدقيق)**؛ `tahfeez.server.ts:234` (الحارس على circleId، studentId غير مُتحقَّق) | معلّم حلقة يكتب/يمسح تقييم/حضور طالب حلقة أخرى بتمرير enrollmentId من غير حلقته. **الأخطر (recordLesson): الحضور المُلفَّق يتسلسل عند اعتماد الدرس (alaBaseera:718–726) إلى كتابة `curriculumProgress=completed` آلياً لطالب حلقة أخرى.** الثلاث مكشوفة عبر lib/api. |
| خ-٣ 🔴 | **استيلاء على قناة إشعارات بـendpoint** | `notifications.server.ts:19–23` (`set({personId: u.personId})` على endpoint قائم) | مستخدم يقدّم endpoint مستخدم آخر فينقل ملكية قناته لنفسه أو يقطعها (لا إثبات ملكية للـendpoint). |
| خ-٤ 🟠 | **اعتماد تكليف معلّق يفتقد حارس منح admin/section_head** | `admin.server.ts:320–324` (`adminApproveRole` بـuser.manage+assertScope) × `admin.server.ts:306` (تعديل التكليف يحرس المنح للإدارة فقط) | تفاوت حارس مؤكَّد: حامل `user.manage` منطاق (rabita) لو اعتمد تكليفاً معلّقاً بدور admin/section_head داخل نطاقه لتصعّد. *(تدقيق عدائي: الاستغلال **كامنٌ لا فعليّ اليوم** — `grep approvalStatus:"pending"` = صفر؛ كل مسارات الإدراج تضع `approved`؛ التسجيل الذاتي يحجب admin/section_head. فالفجوة defense-in-depth تُسدّ في v2، والتصنيف 🟠 لا 🔴 متّسق.)* `adminResetPassword` (293–302) نقطة مستقلة موازية (لا «لا تمسّ الأعلى»). |
| خ-٥ 🟠 | **`createTeacherData` بلا أي بعد نطاقي** | `alaBaseera.server.ts:296` (فحص دور admin/amir فقط) | أي أمير ينشئ كيان معلّم لأي شخص (personId حرّ). |
| خ-٦ 🟠 | **`تحفيظ circleRankings` بأي تكليف على المسجد** | `tahfeez.server.ts:285–288` (`orgUnitId===mosqueId` بلا شرط دور) | أي مكلَّف على المسجد (ولو member) يرى ترتيب حلقاته — أوسع من بقية حرّاس الملف. |
| خ-٧ 🟠 | **إقرار استلام العهدة يقبل أي دور على الوحدة** | `services/unitBox.ts:104–108` (أي تكليف نشط على toUnitId) × رسالة الخطأ «أمين الوحدة حصراً» | الكود أوسع من رسالته: أي مكلَّف على الوحدة المستلمة يُقرّ الاستلام، لا الأمين وحده. |

### د. توجيه اعتماد/إشعار بقوائم أدوار مضمّنة (hardcoded)

| # | الوصف | الموضع | الأثر |
|---|---|---|---|
| د-١ 🟠 | **section_head لا يعدّل أسبوعاً مقفلاً رغم أنه أعلى من rabita** | `caps.ts:21–24` (`canEditLockedWeek`: admin أو RABITA حصراً) × NESSA (يعدّ section_head طبقة أعلى) | تنافر مع سلّم الطبقات: أعلى طبقة داخل القسم لا تملك ما تملكه المنطقة. |
| د-٢ 🟠 | **إشعار المالية يستهدف `"admin"` بلا فلتر `endDate`** | `financeActions.ts:420–421` (`role="admin"` + approved، بلا `endDate IS NULL`) × context.ts:29 (الهوية تفلتر endDate) | مدير انتهى تكليفه يظل يُشعَر بالمقترحات المالية. |
| د-٣ 🟠 | **إشعار الأمير بلا فلتر `approvalStatus`** | `services/notifications.ts:79` (`queueFinalApproved`) و`93` (`queueRejectionNotice`) (`'amir'` + `isNull(endDate)`، بلا approvalStatus) × `services/notifications.ts:30` (`queueEntryReminders` الصحيحة بالفلترين) | أمير تكليفه غير معتمَد (pending) قد يُشعَر بالاعتماد/الرفض النهائي. *(تصحيح تدقيق: الملف `services/notifications.ts` لا `notifications.server.ts` — الأخير عند 78–94 أفرعُ نصِّ إشعارٍ لا علاقة لها بالأمير؛ §٣.٥ عزَتها بصواب.)* |
| د-٤ ⚪ | **`SUPERVISORY_LAYERS` تُقصي admin من طبقات الاعتماد عمداً** | `approvalRouting.ts:13` (`[square,rabita,section_head]`) | قرار معماري موثّق (المدير اطّلاع + كسر زجاج فقط) — يُذكَر للتوثيق لا كعيب. |

### ذ. فروق الكود عن الوثائق الرسمية (02/13/34)

| # | الوصف | الموضعان | الأثر |
|---|---|---|---|
| ذ-١ 🟡 | **طبقة «الكتلة/bloc» (R2) في الوثائق محذوفة من الكود** | 02 §2 (R2) و13 §2 (`bloc`) و`seed.sql:6` × `rbac.ts:26` (ORG_TYPES بلا bloc) و`ROLE_DEFAULTS` (بلا bloc) | السلّم الوثائقي ٦ طبقات، الكود ٥ (section→rabita→square→mosque). عدسة 34 أيضاً بلا كتلة. |
| ذ-٢ 🟡 | **أدوار أسرة المسجد الست (نائب/سرّ/صندوق/لجنة/عضو/مشترك) في 02/13 بلا قدرات في الكود** | 02 §2 (R5–R10) و13 §6 × `capabilities.ts` (غير معرّفة) | البذرة تولّدها (ج-١)؛ الكود يعاملها صفر قدرات. الوثيقتان تفصّلان مصفوفتها والكود لا ينفّذها. |
| ذ-٣ 🟡 | **`finance_officer` و`media` و`teacher` و`student` في الكود/34 بلا مقابل في 02/13** | `capabilities.ts:91–95` وعدسات 34 (ع٦/ع٨/ع٩/ع١٠) × 02/13 (لا وجود لها؛ الإعلام نوع لجنة، الصندوق مالية مسجد) | مصفوفتا 02/13 تجعلان `finance.payout` تنفيذاً للعليا نفسها، بينما الكود يفرد دور `finance_officer` مركزياً باعتماد ثنائي (وثيقة 28/34). تعارض جوهري في مَن يملك المالية. |
| ذ-٤ 🟡 | **«الطبقة الأقرب» (الكود) مقابل «أعلى طبقة مفعّلة» (13، و02 متناقضة داخلياً)** | `approvalRouting.ts:37` (الأعمق مساراً = الأقرب) × `13:10` §1 مبدأ ٤ («أعلى طبقة مفعّلة») × **02 تحمل الصياغتين**: `02:85` §3.ب («الأقرب») و`02:95` §4.0 («أعلى طبقة مفعّلة») | الكود ينفّذ «الأقرب» (NESSA). *(تصحيح تدقيق: إسناد «الأقرب» إلى 02 مطلقاً غير دقيق — 02 §3.ب تقولها و02 §4.0 تناقضها؛ 13 تقول «الأعلى» صراحةً.)* |
| ذ-٥ 🟡 | **حالة تنفيذ 13 توهم اكتمالاً؛ لكنها تتّسق مع الإحصاء لا تناقضه** | `13:256` (تدّعي اكتمال **§4.4/§4.11 فقط** = المالية+التهيئة المفحوصتان بالقدرات) و`13:249` (تنسب بقية الوحدات صراحةً إلى `requireMosqueAccess` حارسِ نطاق) × §٢.ب | *(تصحيح تدقيق: الصياغة السابقة «13 تدّعي اكتمال فرض المصفوفة بالقدرات» حمّلت الوثيقة أكثر مما تقول. الحقيقة أدقّ وأخفّ: 13 تعترف أن الوحدات الثماني تُحرَس بحارس نطاق لا بـhasCap — موافِقةً نتيجة الإحصاء — وتدّعي الاكتمال للوحدتين المفحوصتين أصلاً فقط.)* |
| ذ-٦ 🟡 | **المسار النسائي: دور مستقل (02 R11) مقابل «بالنطاق لا بدور» (13/الكود)** | 02 §2 (R11 دور) × 13 §2 والكود (`amir` بتأنيث عرضي، `sectionRoleLabel` capabilities.ts:115) | الكود يطبّق رأي 13 (نفس الدور، تمييز بالقسم/النطاق) خلافاً لـ02. |

### ر. ملاحظات فرض «سالب» ونمط لافت (توثيق لا حكم)

- **فرض سالب (الدور يحجب لا يمنح):** `myTasks.server.ts:44–45` (admin تُحجب عنه بطاقات الزيارات)؛ `supervision.server.ts:130` («زياراتي» تُفرَّغ للمدير) — تطبيق «المدير يطّلع لا يعمل» (قاعدة 34 ع١).
- **حسن صنعة (النطاق الفارغ يُقفل لا يُفتح):** `finance.server.ts:29` (`1=0`)، `custody.server.ts:38` (throw)، `alaBaseera.server.ts:54` (`/__none__/`)، `mediaHub.server.ts:33` (`/__none__/`) — عكس نمط search fail-open المعيب.
- **`meetings`/`committees` يستخرجان `mosqueId` من الكيان المخزَّن لا من مدخل العميل قبل الفحص** (نمط سليم يمنع تمرير معرّف مزوَّر).
- **كود ميت:** `halaqaSupervise` (alaBaseera.server.ts:359)، `requireUser` (tahfeez.server.ts:11)، `SUPERVISORY_ABOVE_MOSQUE` (rbac.ts:22).

## ٦. فحص الاكتمال (إلزامي)

### [✓] كل ملف `*.server.ts` فُحص (٣٤ ملفاً) — القائمة مع عدد نقاط الفرض

| # | الملف | نقاط الفرض | # | الملف | نقاط الفرض |
|---|---|---|---|---|---|
| 1 | activities.server.ts | 10 | 18 | manhaj.server.ts | **0** |
| 2 | admin.server.ts | 22 | 19 | materials.server.ts | 9 |
| 3 | alaBaseera.server.ts | 60 | 20 | media.server.ts | 13 |
| 4 | announcements.server.ts | 7 | 21 | mediaHub.server.ts | 15 |
| 5 | assets.server.ts | 6 | 22 | meetings.server.ts | 5 |
| 6 | auth.server.ts | 7 | 23 | mosqueFinance.server.ts | 10 |
| 7 | boxes.server.ts | 19 | 24 | mosqueLessons.server.ts | 11 |
| 8 | circles.server.ts | 13 | 25 | myTasks.server.ts | 3 |
| 9 | committees.server.ts | 11 | 26 | notifications.server.ts | 6 |
| 10 | competition.server.ts | 12 | 27 | permissions.server.ts | 3 |
| 11 | custody.server.ts | 12 | 28 | registration.server.ts | 8 |
| 12 | data.server.ts | 42 | 29 | scheduled.server.ts | 5 |
| 13 | exams.server.ts | 17 | 30 | search.server.ts | 2 (fail-open) |
| 14 | finance.server.ts | 12 | 31 | settings.server.ts | 6 |
| 15 | home.server.ts | 13 | 32 | supervision.server.ts | 21 |
| 16 | incentives.server.ts | 3 | 33 | tahfeez.server.ts | 29 |
| 17 | ledger.server.ts | 70 | 34 | telegram.server.ts | 2 |

**مجموع `*.server.ts` = ٤٨٤ نقطة.** لا ملف صفر عدا `manhaj.server.ts` (عام بلا تسجيل، مذكور صراحةً §٣.٢).

### [✓] كل ملف `server/utils/` (١٦) و`server/services/` (٣٩) فُحص

- **utils بها فرض (٦):** caps.ts (5)، context.ts (6)، scope.ts (4)، auth.ts (2)، totp.ts (1)، orgPath.ts (بدائيتا النطاق المرجعيتان). **utils صفر صراحةً (١٠):** audit، chunks، csv، db، points، rbac (ثوابت)، records، scheme، webpush، week.
- **services بها فرض (١٠):** approvalRouting (7)، financeActions (6)، notifications (5)، unitBox (4)، records (4)، finance (3)، assetCustody (2)، authTokens (2)، governance (2)، expenseClaims (1). **services صفر صراحةً (٢٩):** advances، alaBaseera، budgets، competition، currencies، depreciation، donorsFinance، donorsReport، financeEntry، financeImport، financeWorkbook، halaqaWeekly، ledger، ledgerBackfill، ledgerPost، meetings، mosqueFinance، orgUnits، paymentBatches، payroll، pettyCash، pledges، provisioning، reconciliation، records(الخدمة مذكورة أعلاه)، reportHtml، reports، statements، studentBridge، tahfeez. (ملاحظة: بعضها «صفر فرضِ هوية» لكن به فرض بنيوي لعزل القسمين مثل orgUnits.ts، وبعضها يعيد بيانات شبكية بلا نطاق فالحراسة على المستدعي مثل financeWorkbook.ts — موثّق §٥.ح-٧).

### [✓] كل ملف في `routes/` (٢٣) فُحص — القائمة

admin(2)، ala-baseera(2)، competition(2)، custody(2)، design-system(2، الثانية معطوبة)، duties(2)، finance(2)، home(8)، index(1)، library(2)، login(1)، manhaj(**0 — لا حارس**)، media-hub(2)، mosque.$mosqueId(1، بلا قدرة/نطاق)، my-circles(2)، my-committee(2)، network(2)، network.index(0، بالوراثة)، network.$unitId(0، بالوراثة)، no-access(2)، register(**0 — عام**)، student.$token(**0 — رمز سرّي**)، __root(1، تمرير قدرات). **مسارات بلا حارس إطلاقاً:** manhaj، register، student.$token (الثلاثة مقصودة)، و**home ضعيف (جلسة بلا قدرة)** و**mosque.$mosqueId ضعيف (بلا نطاق)**.

### [✓] كل مجلدات `components/` (٢٤ مجلداً) فُحصت — ملخّص §٣.٧

المجلدات ذات الفرض: admin، finance، mosque، ala-baseera، network، custody، competition، media، duties، library، nav، circles، report، daily-log، mosque(LessonsTab). صفر فرض: **home (٦ ملفات — الاختيار خارجها)**، ui (٥٥ ملف)، landing، committee، registration، tahfeez، mosque-finance، auth، manhaj، design-system.

### [✓] أنماط البحث موثّقة أعلى الوثيقة (قابلة لإعادة التشغيل)

الموجتان النمطيتان + القراءة الكاملة ملفاً ملفاً موثّقة في ترويسة الوثيقة. المصفوفة (§٤.أ) مولَّدة آلياً من `capabilities.ts` عبر `node --experimental-strip-types` (لا نقلاً يدوياً) فهي قابلة لإعادة الاشتقاق حرفياً.

### حدود هذا الإحصاء (شفافية)

1. **قاعدة الإنتاج غير مفحوصة** (الاتصال محظور بالمهمة): `permission_overrides` الإنتاجي و`role_assignments` الإنتاجي غير معلومَين — المصفوفة §٤ مبنية على `ROLE_DEFAULTS` + البذور المحلية. أي تجاوزات حيّة في الإنتاج ستغيّر المصفوفة الفعلية.
2. **الفرض المفوَّض للخدمات** (§٥.خ، §٣.٥): عدة دوال خادم تفحص الهوية/القدرة فقط وتفوّض الملكية/الطبقة لخدمة (`acknowledgeHandover`، `approveBoxClosing`، `acknowledgeCustody`…) — وُثّقت الخدمة نفسها في §٣.٥.
3. **التصديرات الميتة** (`openCustodyOf`، `scopeStudentPersons`، `lessonConflictData`، `overdueCirclesForReminders`، `runDueTasksData`): غير موصولة بأغلفة RPC اليوم، فخطرها كامن؛ صُنّفت «لا فحص» لأنها قابلة للتغليف في v2.
4. لم تُفحص ملفات `__tests__` (خارج نطاق الحصر عمداً)، لكن حرّاس الثوابت فيها (`rbac-policy.test.ts`: معجم `CAP_DOORS`، ثابت PERSONAL_CAPS، «المدير لا يُكلَّف») ذُكرت حيث تسند تصميماً.

## ٧. سجل التدقيق والتحقّق (تدقيق عدائيّ ثانٍ على الكود)

بعد الحصر الأوّل، خضعت كل ادعاءات الوثيقة لتدقيقٍ تحقّقيٍّ ثانٍ: **٦ مدققين متوازين، كلٌّ أعاد قراءة ملفاته من الكود** (لا من الوثيقة)، واقتبس السطر الفعلي لكل ادعاء `ملف:سطر`، وأصدر حكماً (مؤكَّد/مصحَّح/مرفوض)، وحاكم كل تضاربٍ محاكمةً عدائية (محاولة دحض + تتبّع الكشف عبر أغلفة `lib/api/*`)، واصطاد نقاط الفرض المفقودة. المصفوفة §٤ والأرقام الكمّية تحقّقتُ منها بنفسي بتنفيذ `capabilities.ts` وعدّ البذور.

### ٧.أ ما تأكّد (لا تغيير)

- **المصفوفة §٤.أ**: مولَّدة آلياً من `ROLE_DEFAULTS`؛ قُورنت خليّةً خليّة لخمسة أدوار (admin/section_head/finance_officer/media/student) وأُعيد عدّ كل الأدوار العشرة — **صفر انحراف**.
- **الكتالوج**: ٤٤ قدرة في ١٦ وحدة (تأكّد بـ`ALL_CAPS.length`=٤٤؛ الرمز الوحيد خارج الكتالوج `"*"`).
- **توزيع البذرة ٣٨٠/٥١٣**: عُدّ استقلالاً من `seed_big.sql` بترشيح `org_path` (لإسقاط ٤ إيجابيات كاذبة من `users.login`/`materials.audience`) — طابق تماماً.
- **محرك NESSA** (`approverLayerFor` سطراً بسطر)، **بذرة `pol-fo-all` الوحيدة**، **`permission_overrides` بلا بذور**، **التضاربات الأربعة عشر البنيوية** (ث-١..٣، ج-١..٥، د-١..٤): كلها CONFIRMED.
- **كشف الثغرات عبر RPC**: تُتبّعت أغلفة `lib/api/{search,network,functions}.ts` — بلا `.middleware()`؛ فأ-١..٥ و أ-٨ **مكشوفة لمجهول فعلاً** (تصعيد مثبَت، لا نظريّ).

### ٧.ب تصحيحات مطبَّقة (أُدمجت أعلاه)

| الموضع | كان | صار (الصحيح) |
|---|---|---|
| §٥ د-٣ | `notifications.server.ts:78–94` | `services/notifications.ts:79، 93` (الأول أفرعُ نصٍّ لا علاقة لها) |
| §٥ أ-٧ | `components/mosque-finance/TxnPanel` | `MosqueFinancePage.tsx`؛ سطر الرفض `mosqueFinance.server.ts:65` |
| §٥ أ-٤ | لا حارس مذكور | `lib/api/network.ts:77–85` بلا middleware (تأكيد الكشف) |
| §٥ ح-٢ | 🔴 | 🟠 (يشترط جلسة؛ عدّاد لا PII) |
| §٥ خ-٤ | «تصعيد امتياز» 🔴-النبرة | 🟠 كامنٌ لا فعليّ (صفر تكليفات pending في المستودع) |
| §٥ ذ-٤/ذ-٥ | مبالَغتان | ذ-٤: 02 متناقضة داخلياً (§3.ب vs §4.0)؛ ذ-٥: 13 تتّسق مع الإحصاء لا تناقضه |
| §٣.١ data:511–516 | canView محصور بالطبقات | canView أوسع: أي مكلَّف بادئةُ مساره تغطّي المسجد (يشمل section_head/teacher/student فوقه) |
| فرق أسطر طفيفة (±1، غير جوهرية) | — | حفظ ملاحظات الإشراف الرمي 436 لا 435؛ `userFromToken` يبدأ 16 لا 20؛ حارس finance.server.ts 16–23 (`1=0` عند 29) |

### ٧.ج نقاط فرض/ثغرات أضافها التدقيق (فاتت المسح الأول)

| الرمز | النقطة | الخطورة | الدليل |
|---|---|---|---|
| **أ-٨** | `weekProgressData` (home.server.ts:188) بلا مصادقة، مكشوفة لمجهول عبر `getWeekProgress` (functions.ts:29–33) | 🔴 (تشغيليّ) | لا `currentUser()` إطلاقاً؛ غلاف GET بلا حارس |
| **خ-٢ موسَّع** | `recordLessonData` (alaBaseera.server.ts:490–493): حضورٌ بـenrollmentId غير مُتحقَّق، يتسلسل عند اعتماد الدرس إلى كتابة `curriculumProgress=completed` لطالب حلقة أخرى | 🔴 | مكشوفة عبر `recordLesson` (lib/api/alaBaseera.ts) |
| **خ-٢ موسَّع** | `setStudentEvaluationData`: **lessonSessionId** أيضاً غير مُتحقَّق (لا enrollmentId وحده) | 🔴 | 462–464 |
| ملاحظة اكتمال | `adminResetPassword` (admin.server.ts:293–302): نقطة مستقلة موازية لخ-٤ (لا «لا تمسّ الأعلى») | 🟠 | ذُكرت عرضاً، تُرفَّع لنقطة قائمة |
| نقص حصرٍ (لا فرض) | قائمة `circles.manage` أسقطت `circles.server.ts:97` (`removeCircleStudent`) — الدالة محروسة، والنقص في التعداد لا الفرض | — | 97 |

### ٧.د أحكام الشدّة بعد المحاكمة العدائية

- **الأخطر عملياً (🔴 مؤكَّد الكشف لمجهول):** أ-١، أ-٢ (search — تعداد كل PII الشبكة)؛ أ-٣، أ-٤، أ-٨ (data/home fail-open عبر RPC بلا middleware)؛ ت-١ (design-system معطوب)؛ ح-١ (الدفتر بلا نطاق)؛ خ-١، خ-٢ (حذف/كتابة عبر معرّف غير مُتحقَّق).
- **كامنٌ (فجوة حقيقية، استغلالٌ غير متحقّق اليوم):** خ-٤ (لا تكليفات pending)، ح-٤ (تصديرات ميتة بلا غلاف RPC)، خ-٣ (يشترط معرفة endpoint عالي العشوائية).
- **مُخفَّض عن التصنيف الأوّل:** ح-٢ (عدّاد بجلسة لا PII بمجهول).
- **صفر ادعاءٍ مرفوض**: لم يدحض أيُّ مدقّقٍ أيَّ تضاربٍ على مستوى حقيقة الكود؛ التعديلات كلها على **الشدّة** أو **اسم الملف/رقم السطر**، لا على وجود العيب.
