# دمج التصميم بالـbackend — منصة «مشكاة» / المسجد المؤثر

التصميم (TanStack Start + React) صار **التطبيق الكامل**: نفس الصفحات والتصميم تماماً،
مع backend مدمج (Nitro + Cloudflare D1) — استُبدلت البيانات الوهمية ببيانات حقيقية دون أي تغيير بصري.

## كيف رُبط (بإيجاز)

| الطبقة | المكان |
|---|---|
| خدمات/مخطط/هجرات الـbackend (منقولة كما هي) | `src/server/{database,services,utils}` |
| منطق بيانات الصفحات (خادم فقط) | `src/server/data.server.ts` |
| أغلفة RPC للعميل (`createServerFn`) | `src/lib/api/functions.ts` |
| حقن ربط Cloudflare (D1) عند مدخل الـWorker | `src/server.ts` → `setCloudflareEnv` |
| جسر D1 | `src/server/utils/db.ts` (`useDb()` يقرأ env المحقون) |

كل صفحة بيانات لها `loader` يستدعي دالة الخادم ويعيد البيانات الحقيقية؛ وعند غياب D1
(تطوير محلي بـ`vite dev`) يعود `null` فتُعرض **بيانات احتياطية** — فالتصميم يظهر دائماً.

| الصفحة | المسار | الدالة |
|---|---|---|
| التقرير الشهري | `src/routes/index.tsx` | `getMonthlyReport` |
| لوحة المحافظة | `src/routes/governorate.tsx` | `getGovernorate` |
| سجل اليوم (عرض+حفظ) | `src/routes/daily-log.tsx` | `getDailyActivities` + `saveDailyLog` |
| النظام التصميمي | `src/routes/design-system.tsx` | (كما هو، بلا بيانات) |

## التشغيل محلياً على بيئة Cloudflare الحقيقية (workerd + D1)

> Node ≥ 22 (مُختبَر على 26). كل البيانات التجريبية في `seed_demo.sql` — لا «موك» في الكود.

```bash
npm install
# هجرات + بذور (المخططات/المعدّلات + بيانات إدلب التجريبية والمستخدمين)
npx wrangler d1 migrations apply influential-masjid --local --persist-to ./.wrangler-state
npx wrangler d1 execute influential-masjid --local --persist-to ./.wrangler-state --file ./src/server/database/seed_points.sql
npx wrangler d1 execute influential-masjid --local --persist-to ./.wrangler-state --file ./src/server/database/seed_demo.sql

npm run build
npx wrangler dev --persist-to ./.wrangler-state --port 8789   # workerd + D1 + الأصول
```

`npm run dev` (vite) يعرض الهيكل دون بيانات (لا D1). للبيانات الحقيقية استخدم البناء + wrangler.

## الدخول (مستخدمو البذرة، كلمة المرور `mishkat123`)
- `admin` → إدارة عليا (يرى كل مساجد إدلب في لوحة المحافظة).
- `amir` → أمير مسجد الفاروق (يرى مسجده فقط — عزل النطاق RBAC).

الجلسة عبر **cookie آمن httpOnly**؛ صفحات البيانات تُحدِّد سياقها من هوية المستخدم
(`currentUser` → `userFromToken`)، ومع عدم الدخول تعرض سياق إدلب التجريبي.

## المصادقة والهوية
| الطبقة | المكان |
|---|---|
| الدخول/الخروج/الحالي (cookie + JWT) | `src/server/auth.server.ts` |
| أغلفة RPC للمصادقة | `src/lib/api/auth.ts` |
| شاشة الدخول (بلغة التصميم) | `src/components/auth/LoginPage.tsx` + `src/routes/login.tsx` |
| سرّ JWT | `wrangler.toml [vars] JWT_SECRET` محلياً؛ `wrangler secret put JWT_SECRET` إنتاجاً |

## مُتحقَّق منه فعلياً (هذه الجلسة)
بُني التطبيق على Node 26 وشُغّل على workerd + D1، وتأكّد:
- شاشة الدخول بلغة التصميم تماماً، والدخول كـ`admin` يضبط cookie ويوجّه للتقرير (لقطة شاشة).
- التقرير: مسجد الفاروق، 1447-06 (هجري آلي)، 257/280، ‎$45.89، 92% — بنفس التصميم.
- المحافظة: 11 مسجداً ونقاطها والمتأخرون من D1 (وعزل النطاق حسب هوية المستخدم).
- سجل اليوم: الأنشطة من مخطط النقاط (مساري الرجال/النساء)، والحفظ يكتب في D1.

## النشر
`wrangler d1 create` → `database_id` في `wrangler.toml` → هجرات `--remote` + بذور →
`npm run build` → `npx wrangler deploy`. السرّ: `npx wrangler secret put JWT_SECRET`
(تفاصيل في [platform/DEPLOY.md](../platform/DEPLOY.md)).

## ملاحظات
- **السياق التجريبي:** الصفحات تعرض حالياً سياقاً ثابتاً (محافظة إدلب / مسجد الفاروق) دون شاشة دخول
  (حفاظاً على «نفس الصفحات»). ربط هوية المستخدم والصلاحيات النطاقية = الخطوة التالية
  (الـbackend يفرضها أصلاً عبر `userFromToken`/`caps`، ويُفعَّل بإضافة شاشة دخول — ميزة جديدة).
- المجلد القديم `platform/` كان لبناء وتوثيق واختبار الـbackend (54 اختباراً)؛ المنطق نفسه منقول هنا.
