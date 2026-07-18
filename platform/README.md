# منصة المسجد المؤثر — هيكل المشروع (S1 + نواة النقاط)

Nuxt 3 + Cloudflare D1 + Drizzle ORM. يغطي هذا الهيكل **أساس المرحلة 0** (المصادقة، التسجيل الذاتي، الشجرة بالمسار المادّي، RBAC نطاقي) **ونواة المرحلة 1** (الأنشطة بمساري الجنسين، السجل الأسبوعي، الإدخال اليومي بالمزامنة، سلسلة الاعتماد، قفل الأسبوع، لوحة المتابعة).

> **القرارات المرجعية:** انظر [خطة البناء](../product/08_tech_build_plan.md) و[الأدوار والصلاحيات](../product/02_roles_permissions.md) و[سجل القرارات](../product/05_decisions_log.md).

## ما هو منجَز في هذا الهيكل

| المكوّن | الملف |
|---|---|
| مخطط قاعدة البيانات | `server/database/schema.ts` |
| الهجرة الأولية | `server/database/migrations/0000_init.sql` |
| بذور إدلب التجريبية | `server/database/seed.sql` |
| تجزئة كلمات المرور + JWT (متوافق Workers) | `server/utils/auth.ts` |
| أدوات المسار المادّي للشجرة | `server/utils/orgPath.ts` |
| الأدوار والصلاحيات | `server/utils/rbac.ts` |
| تحميل المستخدم + التحقق النطاقي | `server/utils/context.ts` |
| قرارات الصلاحيات (نقية، تستخدمها الـhandlers) | `server/utils/caps.ts` |
| «أعلى طبقة مفعّلة» (اعتماد السجل، ق1) | `server/utils/approval.ts` |
| وسيط قراءة الرمز | `server/middleware/auth.ts` |
| التسجيل/الدخول/أنا | `server/api/auth/*` |
| الوحدات ضمن النطاق | `server/api/org-units/index.get.ts` |
| منح/اعتماد دور | `server/api/role-assignments/*` |
| الأنشطة/النقاط/المخططات + المعدّل المالي | `server/database/schema.ts`, `seed_points.sql` |
| حساب النقاط/القيمة المالية (نقي) | `server/utils/points.ts` |
| الأسبوع يبدأ السبت + التقويم الهجري (أم القرى عبر Intl) | `server/utils/week.ts` |
| المخطط الساري + المعدّل | `server/utils/scheme.ts` |
| السجل الأسبوعي (إنشاء/إعادة حساب) | `server/utils/records.ts` |
| السجل اليومي/الاعتماد/القفل/اللوحة | `server/api/records/*`, `server/api/dashboard/*` |
| طبقة الخدمة (منطق مختبَر) | `server/services/{records,orgUnits,finance}.ts` |
| إنشاء الوحدات + استيراد المساجد CSV | `server/api/org-units/*`, `server/utils/csv.ts` |
| المالية: المستحق الشهري/الاعتماد/الصرف | `server/services/finance.ts`, `server/api/finance/*` |
| «على بصيرة»: حلقات/معلّمون/دروس بالساعة | `server/services/alaBaseera.ts`, `server/api/ala-baseera/*` |
| المسابقة: مشتركون/برنامج/اختبارات/ترتيب | `server/services/competition.ts`, `server/api/competition/*` |
| التقرير الشهري المولّد للمسجد | `server/services/reports.ts`, `server/api/reports/monthly.get.ts` |
| قالب التقرير HTML (RTL، جاهز للطباعة/PDF) | `server/services/reportHtml.ts`, `server/api/reports/monthly-html.get.ts` |
| الحوكمة: دورة الإدارة/الشواغر/الاستقالات | `server/services/governance.ts`, `server/api/governance/*` |
| المالية الداخلية للمسجد (تبرعات/مصروفات) | `server/services/mosqueFinance.ts`, `server/api/mosque-finance/*` |
| الاجتماعات والقرارات (نصاب/ترجيح) | `server/services/meetings.ts`, `server/api/meetings/*` |
| خطط اللجان السنوية | `server/services/plans.ts`, `server/api/plans/*` |
| حلقات التحفيظ | `server/services/tahfeez.ts`, `server/api/tahfeez/*` |
| حلقات «على بصيرة» الأسبوعية (أنشطة/تقييم) | `server/services/halaqaWeekly.ts`, `server/api/ala-baseera/weekly.post.ts` |
| الإشعارات (تذكير الإدخال + تيليغرام) | `server/services/notifications.ts`, `server/api/notifications/*` |
| تصلّب المصادقة (refresh + حدّ المحاولات) | `server/services/authTokens.ts`, `server/api/auth/refresh.post.ts` |
| المصادقة الثنائية MFA (TOTP/RFC 6238) | `server/utils/totp.ts`, `server/api/auth/mfa/*` |
| تصدير PDF عبر Browser Rendering | `server/api/reports/monthly-pdf.get.ts` (يتطلب ربط BROWSER) |
| عرض سجل التدقيق | `server/api/audit/index.get.ts` |
| اختبارات (نقية + تكامل ضد SQLite) | `test/*.test.ts` — 54 اختباراً |
| واجهة مبدئية (دخول + لوحة) | `pages/*`, `composables/useAuth.ts` |

## التشغيل محلياً (مُتحقَّق منه فعلياً على workerd + D1)

```bash
npm install
printf 'NUXT_JWT_SECRET=change-me\n' > .dev.vars

# هجرات + بذور على D1 محلي (نفس persist الذي يقرؤه pages dev)
npx wrangler d1 migrations apply influential-masjid --local --persist-to ./.wrangler-state
npx wrangler d1 execute influential-masjid --local --persist-to ./.wrangler-state --file ./server/database/seed.sql
npx wrangler d1 execute influential-masjid --local --persist-to ./.wrangler-state --file ./server/database/seed_points.sql

npm run build                          # nuxt build (cloudflare-pages) → dist/
npx wrangler pages dev dist --persist-to ./.wrangler-state --port 8788
# ملاحظة: لا تمرّر --d1 على CLI؛ يقرأ الربط من wrangler.toml (نفس database_id)

npm run test                           # 54 اختباراً (vitest)
```

> **تحقّق end-to-end فعلي (هذه الجلسة):** بُني المشروع وشُغّل على **بيئة Workers الحقيقية (workerd) + D1** محلياً، واختُبرت المسارات: تسجيل/دخول (PBKDF2+JWT)، `me` بالأدوار النطاقية، `activity-types`، **عزل النطاق** (العضو يرى مسجده فقط)، مزامنة سجل يومي + **idempotency**، **حساب الشهر الهجري آلياً** (إدخال 2025-12-06 ظهر تحت 1447-06 بقيمة 0.71$)، والتقرير HTML الجاهز للطباعة. النشر السحابي يتطلب `wrangler login` + `wrangler d1 create` ووضع `database_id` الحقيقي.

## النشر على Cloudflare

```bash
npm run db:migrate:remote             # طبّق الهجرة على D1 السحابية
# اضبط السرّ NUXT_JWT_SECRET في إعدادات Cloudflare Pages
npm run deploy
```

## تهيئة أول مدير (Bootstrap)

1. سجّل حساباً عبر `POST /api/auth/register` (مثلاً `homeOrgUnitId = "m-farouq"`).
2. امنح هذا الشخص دور الإدارة العليا يدوياً مرة واحدة:

```bash
npx wrangler d1 execute influential-masjid --local --command \
 "INSERT INTO role_assignments (id, person_id, role, org_unit_id, org_path, term_number, approval_status, created_at) \
  VALUES ('seed-admin', '<PERSON_ID>', 'admin', 'idlib', '/idlib/', 1, 'approved', 0)"
```

بعدها يملك هذا المستخدم منح بقية الأدوار من داخل المنصة.

## واجهات API الحالية

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل ذاتي (ق4) |
| POST | `/api/auth/login` | دخول |
| GET | `/api/auth/me` | المستخدم وأدواره |
| GET | `/api/org-units` | الوحدات ضمن نطاق المستخدم |
| POST | `/api/role-assignments` | منح دور (الأمير → pending إن لم يمنحه إداري أعلى) |
| POST | `/api/role-assignments/approve` | اعتماد تكليف معلّق |
| GET | `/api/activity-types?track=male\|female` | أنشطة المسار وأوزانها (ق6) |
| GET | `/api/records/week?mosqueId=&weekStart=` | سجل أسبوع + الإدخالات + القيمة المالية |
| POST | `/api/records/entries` | مزامنة الإدخالات اليومية (idempotent، آخر كتابة تكسب، قفل ق5) |
| POST | `/api/records/approve` | سلسلة الاعتماد: الأمير ثم أعلى طبقة مفعّلة (ق1) |
| POST | `/api/records/lock` | قفل/فتح الأسبوع (ق5) |
| GET | `/api/dashboard?weekStart=` | لوحة المتابعة: مساجد النطاق + النقاط + المتأخرون |
| POST | `/api/org-units` | إنشاء وحدة تنظيمية (مسار مادّي تلقائي) |
| POST | `/api/org-units/import` | استيراد مساجد دفعةً من CSV تحت أب |
| POST | `/api/finance/compute` | ترشيح المستحق الشهري لشخص (مقطوع+نقاط، تُجمع — ق8) |
| POST | `/api/finance/approve` | اعتماد المستحق (ق7) |
| POST | `/api/finance/payout` | تسجيل المبلغ المصروف فعلاً (ق7) |
| GET | `/api/finance/report?month=` | تقرير مالي للشهر + المجاميع |
| POST | `/api/ala-baseera/setup` | إنشاء مكان/معلّم/حلقة أو تسجيل طالب (entity) |
| POST | `/api/ala-baseera/lessons` | تسجيل جلسة درس بالساعة (أساس المحاسبة) |
| POST | `/api/competition/setup` | إنشاء مسابقة/برنامج شهري/اختبار (entity) |
| POST | `/api/competition/register` | تسجيل مشترك (السن 15–40 + مسجد) |
| POST | `/api/competition/score` | رصد نقاط نشاط شهري (بنظام الأعذار) |
| POST | `/api/competition/exam-result` | رصد نتيجة اختبار مركزي |
| GET | `/api/competition/leaderboard?competitionId=` | الترتيب العام |
| GET | `/api/reports/monthly?mosqueId=&month=` | التقرير الشهري المولّد (JSON) |
| GET | `/api/reports/monthly-html?mosqueId=&month=` | التقرير كصفحة HTML عربية RTL جاهزة للطباعة/PDF |
| POST | `/api/governance/assign` | تكليف بدورة (سنتان، بحدّ دورتين) |
| POST | `/api/governance/resign` | طلب استقالة (مهلة بتّ شهر) |
| POST | `/api/governance/decide-resignation` | البتّ في الاستقالة (قبول يُنهي التكليف) |
| GET | `/api/governance/alerts` | دورات تنتهي قريباً + شواغر أمراء + استقالات متأخرة |
| POST | `/api/mosque-finance` · GET `/balance` | تبرع/مصروف للمسجد + الميزان |
| POST | `/api/meetings` · GET `/quorum` | إنشاء اجتماع/حضور/قرار + النصاب |
| POST | `/api/plans` · GET `/progress` | خطة لجنة/بند/حالة + نسبة الإنجاز |
| POST | `/api/tahfeez` | حلقة تحفيظ/طالب/تقدّم |
| POST | `/api/ala-baseera/weekly` | نشاط جماعي/سجل أسبوعي/تقييم طالب |
| POST | `/api/competition/finalize` | التأهيل/اختيار الفائز |
| POST | `/api/auth/refresh` | تجديد رمز الوصول (تدوير) |
| POST | `/api/auth/mfa/enroll` · `/verify` | تفعيل المصادقة الثنائية (TOTP) |
| GET | `/api/reports/monthly-pdf` | تقرير PDF عبر Browser Rendering (يتطلب الربط) |
| POST | `/api/notifications/run` | تشغيل تذكيرات الإدخال + إرسال تيليغرام |
| GET | `/api/audit` | سجل التدقيق (إدارة) |

## ملاحظات

- **المنطق الأساسي مُختبَر بالتنفيذ:** `npm run test` = **51 اختباراً** (يشمل أيضاً: المالية الداخلية، نصاب الاجتماعات وترجيح صوت الأمير، نسبة إنجاز الخطط، التحفيظ، حدّ الأنشطة الجماعية، تأهيل/فائز المسابقة، تذكير الإدخال، وتدوير رموز التحديث وحدّ المحاولات)
- **التقويم الهجري (أم القرى):** يُحسب آلياً عبر `Intl` (بلا تبعيات) ويُملأ في السجل الأسبوعي عند الإدخال؛ المالية والتقارير تجمع بالشهر الهجري. (نقية + تكامل ضد SQLite حقيقية): الصلاحيات النطاقية (كلٌّ يرى نطاقه، قفل ق5، اعتماد ق1)، النقاط واستثناء بلا شورى، القيمة المالية (280=50$، 70=12.5$)، بداية الأسبوع، مزامنة idempotent + آخر كتابة تكسب، رفض نشاط المسار الآخر (ق6)، سلسلة الاعتماد ومنع التخطّي، المسار المادّي وتحليل CSV، المالية (نقاط/مقطوع، جمع الأوصاف ق8، اعتماد→صرف، منع إعادة حساب المصروف)، «على بصيرة» (منع ازدواج التسجيل والسعة، الساعات×السعر، تكامل أمير+معلّم=70$)، والمسابقة (شروط السن/المسجد/التكرار، والأعذار لا تؤثر في الترتيب). تحذير `.nuxt/tsconfig.json` غير ضار ويزول بعد أول `npm run dev`.
- **الصلاحيات مصدرها واحد:** كل قرارات RBAC في `server/utils/caps.ts` (نقية ومختبَرة)، والـhandlers تستدعيها — فالمنطق المُختبَر هو نفسه منطق الإنتاج.
- **PDF التقرير:** يُولَّد القالب HTML عربي RTL (`reports/monthly-html`)؛ التحويل إلى PDF عبر طباعة المتصفح (على الجوال: مشاركة ← PDF ← تيليغرام). عيّنة جاهزة: `../product/prototypes/sample_monthly_report.html`. لملف PDF مولّد خادمياً مستقبلاً يُمرَّر هذا القالب لـCloudflare Browser Rendering (نفس HTML).
- **متبقٍّ:** اختبارات RBAC على مستوى الـHTTP، وربط الواجهة.
- **الواجهة مبدئية** (login/لوحة) — تنتظر نظام التصميم لإكمال شاشة «سجل اليوم» وبقية الشاشات.
- كل وصول للبيانات معزول في طبقة Drizzle لتسهيل أي تبديل مستقبلي لقاعدة البيانات.
