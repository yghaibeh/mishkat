# دليل النشر السحابي — منصة المسجد المؤثر (Cloudflare)

أوامر تُنفّذها **بنفسك** على جهازك (بعضها تفاعلي: تسجيل دخول/دفع). كلها من داخل مجلد `platform/`.

> الحالة: المشروع بُني وشُغّل ونُجح اختباره على workerd + D1 **محلياً**. هذا الدليل ينقله إلى **السحابة**.

---

## 0) المتطلبات (مرة واحدة)
- حساب Cloudflare (مجاني للبدء).
- Node 20+ و`npm`.
- داخل `platform/`: `npm install` (إن لم يكن منفّذاً).

## 1) تسجيل الدخول إلى Cloudflare
```bash
npx wrangler login
```
يفتح المتصفح للموافقة. (تحقّق: `npx wrangler whoami`.)

## 2) إنشاء قاعدة D1 السحابية
```bash
npx wrangler d1 create influential-masjid
```
انسخ `database_id` الناتج وضعه في `wrangler.toml` مكان الأصفار:
```toml
[[d1_databases]]
binding = "DB"
database_name = "influential-masjid"
database_id = "ضع-المعرّف-الحقيقي-هنا"
migrations_dir = "server/database/migrations"
```

## 3) تطبيق الهجرات والبذور على D1 **السحابية** (لاحظ `--remote`)
```bash
npx wrangler d1 migrations apply influential-masjid --remote
npx wrangler d1 execute influential-masjid --remote --file ./server/database/seed.sql
npx wrangler d1 execute influential-masjid --remote --file ./server/database/seed_points.sql
```
> استبدل بذرة `seed.sql` التجريبية لاحقاً ببيانات إدلب الحقيقية (أو استورد عبر `POST /api/org-units/import`).

## 4) ضبط الأسرار (لا تُكتب في الكود)
```bash
npx wrangler pages secret put NUXT_JWT_SECRET        # ألصق قيمة عشوائية طويلة
# اختياري لاحقاً:
npx wrangler pages secret put NUXT_TELEGRAM_BOT_TOKEN # لتذكيرات تيليغرام
```
توليد سرّ قوي: `openssl rand -base64 48`

## 5) البناء والنشر
```bash
npm run build                          # ينتج dist/
npx wrangler pages deploy dist
```
أول نشر يطلب اسم مشروع Pages (مثلاً `influential-masjid`) ويعطيك رابط `https://....pages.dev` مع HTTPS تلقائي.

## 6) تهيئة أول مدير (Bootstrap)
1. سجّل حساباً عبر `POST /api/auth/register` (مثلاً `homeOrgUnitId` من البذور).
2. امنحه دور الإدارة العليا مرة واحدة على D1 السحابية:
```bash
npx wrangler d1 execute influential-masjid --remote --command \
 "INSERT INTO role_assignments (id,person_id,role,org_unit_id,org_path,term_number,approval_status,created_at) \
  VALUES ('seed-admin','<PERSON_ID>','admin','idlib','/idlib/',1,'approved',0)"
```
بعدها يمنح بقية الأدوار من داخل المنصة.

## 7) الدومين (اختياري)
من لوحة Cloudflare → Pages → المشروع → Custom domains. اربط دوماً تملكه (أو اشترِ من Cloudflare).

---

## إضافات اختيارية (تحتاج باقة/إعداد)
- **PDF (Browser Rendering):** فعّل الميزة في حسابك، ثم في `wrangler.toml` أزل التعليق عن:
  ```toml
  [browser]
  binding = "BROWSER"
  ```
  وأعد النشر؛ يعمل `GET /api/reports/monthly-pdf`.
- **تذكيرات الإشعارات (Cron):** Pages لا تدعم cron. الخيار العملي: مجدول خارجي (GitHub Action / cron-job.org) يستدعي يوم السبت:
  `POST https://<موقعك>/api/notifications/run` بترويسة مدير (Bearer). أو انشر Worker مرافقاً بـ`[triggers] crontab`.

## ملاحظات تشغيلية
- **النسخ الاحتياطي:** `npx wrangler d1 export influential-masjid --remote --output backup.sql` دورياً.
- **سيادة البيانات:** D1 على Cloudflare. عند الحاجة للانتقال لخادم خاص (Postgres)، الوصول معزول في طبقة Drizzle لتسهيل التبديل.
- **تحديثات لاحقة:** أي هجرة جديدة → `wrangler d1 migrations apply --remote` ثم `wrangler pages deploy dist`.
