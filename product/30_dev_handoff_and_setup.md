# ٣٠ — دليلُ التسليم والإقلاع على جهازٍ جديد (Handoff & Setup)

> **الغرض:** نقلُ المشروع إلى جهازٍ آخر ومتابعةُ العمل (تصحيحُ أخطاءٍ إضافيّة) بلا احتكاك.
> **آخرُ حالةٍ منشورة (٢٠٢٦-٠٧-١٤):** Version **076f86d0** · الهجرات حتى **0072** · **٣١١/٣١١** اختبارًا · الرابط: https://mishkat.yghaibeh.workers.dev

---

## ٠) نظرةٌ سريعة (TL;DR)

المشروعُ تطبيقُ **مِشكاة** لإدارة شبكة المساجد على **Cloudflare Workers + D1 + R2** بإطار **TanStack Start (React 19) + Vite**. مجلدُ العمل الفعليّ هو **`app/`**. ليس مستودعَ git بعد (النقلُ = نسخُ المجلد). الأوامرُ كلُّها تُشغَّل من داخل `app/`.

```bash
cd app
npm install                 # يعيد بناء node_modules (لا يُنقَل)
# أنشئ app/.dev.vars (انظر §3) ثم:
npx wrangler d1 migrations apply influential-masjid --local --persist-to ./.wrangler-state
npm run gen:seed            # يولّد seed_big.sql
# حمّل البذور محليًّا (انظر §4)، ثم:
npx vitest run             # يجب أن تمرّ ٣١١/٣١١
npx wrangler dev --persist-to ./.wrangler-state --port 8789 --ip 127.0.0.1   # المعاينة على http://localhost:8789
```

الدخول: `admin` / `mishkat123`.

> **يُنصَح بشدّة: هيّئ git على الجهاز الجديد** (المشروعُ ليس مستودعًا بعد) — ليتيح التتبّعَ والتراجعَ أثناء تصحيح الأخطاء. ملفُّ [`app/.gitignore`](../app/.gitignore) جاهزٌ سلفًا (يستثني node_modules/dist/.dev.vars/.wrangler-state):
> ```bash
> cd influential_masjid && git init && cp app/.gitignore .gitignore && git add -A && git commit -m "لقطة النقل — Version 076f86d0"
> ```

---

## ١) ما الذي يُنقَل وما الذي يُعاد بناؤه

**انقل مجلدَ المشروع كلَّه** — لكن هذه المجلداتُ **لا تُنقَل** (تُعاد على الجهاز الجديد لتوفير المساحة وتفادي التلف):

| لا تنقل | لماذا | كيف تعيده |
|---|---|---|
| `app/node_modules/` (~٤٠٠MB) | تابعٌ للنظام | `npm install` |
| `app/dist/` | ناتجُ بناء | `npm run build` |
| `app/.wrangler-state/` | قاعدةُ D1 المحلّيّة | هجرة + بذر (§4) — أو انسخها إن أردت نفس البيانات |
| `app/.output`, `app/.vinxi`, `app/.tanstack` (إن وُجدت) | مخبّآتُ بناء | تُنشأ آليًّا |

**انقل بالتأكيد** (حسّاسة/ضروريّة): `app/.dev.vars` (أسرارُ التطوير — إن لم تنقلها أعِد إنشاءها §3)، و`product/` (كلُّ الوثائق)، و`app/src`، و`app/scripts`، و`app/package.json`، و`app/wrangler.toml`، و`.claude/`.

> **نصيحة:** أنشئ أرشيفًا نظيفًا:
> ```bash
> cd /Users/muhammad/agile/projects
> tar --exclude='influential_masjid/app/node_modules' \
>     --exclude='influential_masjid/app/dist' \
>     --exclude='influential_masjid/app/.wrangler-state' \
>     -czf mishkat.tgz influential_masjid
> ```

---

## ٢) متطلّباتُ الجهاز الجديد

- **Node ٢٠.x** (المطوَّرُ عليه: 20.19.3) + **npm ١٠.x**. (تفادَ Node 22+ ما لم تختبر.)
- **حساب Cloudflare** لصاحب المشروع (`yghaibeh@hotmail.com`) — للنشر وهجرات remote. أوّلَ أمرِ `wrangler` سيطلب تسجيلَ الدخول عبر المتصفّح (`npx wrangler login`).
- لا حاجةَ لتثبيت wrangler عالميًّا — يُستدعى عبر `npx wrangler` (النسخةُ مثبّتةٌ ضمن devDependencies).

---

## ٣) الأسرار — `app/.dev.vars`

ملفٌّ محلّيٌّ يقرؤه `wrangler dev` تلقائيًّا (لا يُرفَع لأيّ خدمة). إن نقلتَ المجلدَ فهو موجود. إن لم يكن، أنشئه:

```
# app/.dev.vars
JWT_SECRET=<أيّ سلسلة عشوائيّة طويلة للتطوير المحلّي>
TELEGRAM_WEBHOOK_SECRET=<اختياريّ للتطوير — أيّ قيمة>
```

- **محليًّا:** `.dev.vars` يكفي.
- **إنتاجيًّا:** الأسرارُ مضبوطةٌ على Cloudflare مسبقًا عبر `wrangler secret put JWT_SECRET`. **لا تضع السرَّ في `wrangler.toml`** (يُشحن نصًّا ظاهرًا فتُزوَّر الجلسات). إن غيّرتَ الحسابَ الإنتاجيَّ أعِد ضبطَ السرّ:
  ```bash
  npx wrangler secret put JWT_SECRET
  ```

**البنيةُ الإنتاجيّة** (موجودةٌ سلفًا على حساب المالك — لا تُعِد إنشاءها إلا لبيئةٍ جديدة): worker `mishkat`، D1 `influential-masjid`، R2 `mishkat-media`، cron كلَّ ساعة. المعرّفاتُ في [`app/wrangler.toml`](../app/wrangler.toml).

---

## ٤) بذرُ قاعدة البيانات المحلّيّة (بياناتُ تجربةٍ كاملة)

بعد تطبيق الهجرات محليًّا، حمّل البذورَ بالترتيب (الترتيبُ مهمّ — points قبل big):

```bash
cd app
npm run gen:seed   # يولّد src/server/database/seed_big.sql (حتميّ)
for f in seed_points seed_big seed_manhaj_01 seed_manhaj_02 seed_manhaj_03 seed_manhaj_04; do
  npx wrangler d1 execute influential-masjid --local --persist-to ./.wrangler-state --file=./src/server/database/$f.sql
done
```

> البذورُ تستعمل `INSERT OR IGNORE` فإعادةُ التحميل آمنة. البذرةُ حتميّةٌ (PRNG ببذرةٍ ثابتة) فالمعرّفاتُ ثابتةٌ عبر الأجهزة.

**حسابات التجربة (كلمة السر للجميع: `mishkat123`):**

| الدخول | الدور | يُظهر |
|---|---|---|
| `admin` | الإدارة العليا | كلُّ شيء — **بلا صندوق اعتمادٍ روتينيّ** (اطّلاعٌ فقط + كسرُ الزجاج) |
| `head_men` / `head_women` | مشرف/ة عام القسم | يعتمد المناطقَ التي هو أقربُ طبقةٍ لها |
| `region_men` / `region_women` | مسؤول/ة منطقة | يعتمد المربّعات/المساجد الأقرب |
| `square_men` / `square_women` | مسؤول/ة مربع | **«بانتظار اعتمادك»** بمساجده المباشرة |
| `amir` | أمير مسجد | إدخالُ سجلّه وإقرارُه |
| `teacher_w` | معلّمة على بصيرة | «حلقاتي» |
| `mushrifa` | مشرفة حلقة نسائيّة | القسم النسائيّ |
| `finance` | المسؤول الماليّ | «مقترحاتي الماليّة» (كلُّ فعلٍ يعتمده المدير) |

---

## ٥) الأوامرُ اليوميّة (كلُّها من داخل `app/`)

| المهمّة | الأمر |
|---|---|
| تشغيلُ كلّ الاختبارات | `npx vitest run` (المتوقَّع: **٣١١/٣١١**) |
| اختبارُ ملفٍّ واحد | `npx vitest run src/server/__tests__/<file>.test.ts` |
| فحصُ الأنواع | `npx tsc --noEmit` (تجاهَل ٣ أخطاءَ محيطيّةً معروفة: `utils/auth.ts`, `utils/records.ts`, `utils/totp.ts`) |
| بناء | `npm run build` |
| **حارسُ النشر (ns=0 إلزاميّ)** | `grep -c "schema as" dist/server/server.js` — **يجب أن يكون `0`** |
| معاينةٌ محلّيّة | `npx wrangler dev --persist-to ./.wrangler-state --port 8789` |
| هجرة محلّيّة | `npx wrangler d1 migrations apply influential-masjid --local --persist-to ./.wrangler-state` |
| هجرة إنتاج | `npx wrangler d1 migrations apply influential-masjid --remote` |
| نشر | `npx wrangler deploy` |
| بذرُ الإنتاج (حذر) | `npm run cf:seed:remote` أو ملفٌّ واحد عبر `--remote --file=...` |

> **حارسُ ns الحرج:** لا تستعمل `await import("./database/schema")` (استيرادٌ ديناميكيٌّ للمخطّط) في ملفّات الخادم — يكسر النشر. استورد الجداولَ استيرادًا ساكنًا في رأس الملفّ. تحقّق دائمًا بعد البناء أنّ `grep -c "schema as" dist/server/server.js` = `0`.

---

## ٦) قواعدُ حرِجة تعلّمناها (اقرأها قبل التعديل)

1. **مقاطعُ المسار = معرّفاتُ الوحدات.** المسارُ المادّيّ `/men/r1/sq1/m1/` مقاطعُه هي **معرّفاتُ الوحدات** (`buildChildPath`). محرّكُ توجيه الاعتماد (NESSA في [`services/approvalRouting.ts`](../app/src/server/services/approvalRouting.ts)) يعتمد على هذا. **أيُّ fixture اختبارٍ يجب أن يجعل `id` = مقطعَ المسار** وإلا يفشل التوجيه (تعلّمناها بالخطأ في ك٧).
2. **wrangler يعمل بجلسة OAuth للمالك.** أوامرُ remote/deploy تتطلّب `npx wrangler login` بحساب المالك. في بيئةٍ آليّةٍ تُمرَّر `dangerouslyDisableSandbox: true` (خاصٌّ بأداة Bash هنا).
3. **اسمُ قاعدة D1 = `influential-masjid`** (لا «mishkat»). الـ binding في الكود اسمه `DB`.
4. **٣ أخطاء tsc محيطيّة معروفةٌ ومقبولة** (auth/records/totp) — لا توقفِ العملَ لأجلها.
5. **أثناء التحقّق البصريّ:** service worker/PWA قد يخدم بناءً قديمًا. امسحه قبل الفحص:
   ```js
   (async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
     for (const k of await caches.keys()) await caches.delete(k); })()
   ```
6. **الحلولُ الترقيعيّة ممنوعة** (ثابتُ المشروع): «الحلُّ العالميُّ الأمثل، ليس Workarounds إطلاقًا» + «وثّق كلَّ شيء».

---

## ٧) خريطةُ المشروع (أين تجد ماذا)

```
influential_masjid/
├─ product/                    ← كلُّ الوثائق (اقرأ 06 أولًا)
│  ├─ 06_implementation_log.md ← سجلُّ كلّ ما نُفِّذ (الأحدث في الأعلى) + «الحالة الحاليّة»
│  ├─ 05_decisions_log.md      ← القرارات (ق1-د أحدثُها: هرمُ الاعتماد بالطبقة الأقرب)
│  ├─ 28_finance_officer_and_excel_plan.md  ← خطّةُ المال/Excel المنجَزة
│  ├─ 29_approval_hierarchy_and_icons_plan.md ← خطّةُ NESSA + الأيقونات (منفَّذة)
│  └─ 30_dev_handoff_and_setup.md ← هذا الملفّ
└─ app/
   ├─ src/server/              ← منطقُ الخادم (*.server.ts) + services/ + database/
   │  ├─ services/approvalRouting.ts  ← نواةُ NESSA (توجيهُ الاعتماد/الزيارات)
   │  ├─ services/financeActions.ts   ← محرّكُ الاعتماد الثنائيّ الماليّ
   │  ├─ database/schema.ts + migrations/ (حتى 0072)
   │  └─ __tests__/            ← ٥٩ ملفَّ اختبار
   ├─ src/components/          ← الواجهة (NetworkPage, finance/, admin/…)
   ├─ src/lib/                 ← capabilities.ts, role-icons.ts, api/…
   └─ scripts/gen-seed.mjs     ← مولّدُ البذرة الضخمة
```

**الذاكرةُ الدائمة** (سياقُ القرارات): `~/.claude/projects/-Users-muhammad-agile-projects-influential-masjid/memory/` — لكنّها خاصّةٌ بجهازك الحاليّ وقد لا تُنقَل؛ المصدرُ الرسميُّ للسياق هو **`product/`**.

---

## ٨) كيف تبدأ لتصحيح الأخطاء الإضافيّة (سير العمل)

على الجهاز الجديد، لكلِّ خطأٍ تريد تصحيحه:

1. **أقلِع** (§0): `npm install` → هجرة محليّة → بذر → `npx vitest run` (تأكّد أنّ ٣١١/٣١١ تمرّ قبل أيّ تعديل — خطُّ الأساس).
2. **شغّل المعاينة** `npx wrangler dev --persist-to ./.wrangler-state --port 8789` وأعِد إنتاجَ الخطأ في المتصفّح (امسح SW أولًا §6.5).
3. **اكتب اختبارًا فاشلًا** يثبّت الخطأ (TDD)، ثمّ أصلِح، ثمّ اجعله أخضرَ + شغّل كلَّ الاختبارات.
4. **تحقّق:** `tsc` نظيف (عدا الثلاثة) + `npm run build` + `grep -c "schema as" dist/server/server.js` = 0 + تحقّقٌ بصريّ في المعاينة.
5. **انشر ووثّق:** إن كانت هجرةٌ جديدة طبّقها remote أولًا، ثمّ `npx wrangler deploy`، ثمّ أضِف فقرةً في `product/06_implementation_log.md` وحدِّث «الحالة الحاليّة» (الإصدار/عدد الاختبارات/آخر هجرة).

> عند البدء، أرسِل لي (المساعد) قائمةَ الأخطاء الإضافيّة — سأتّبع هذا السير: إعادةُ إنتاج → اختبارٌ فاشل → إصلاحٌ عالميٌّ لا ترقيعيّ → تحقّق → نشر → توثيق.

---

## ٩) اختبارُ سلامةِ الإقلاع (Smoke)

بعد الإقلاع، هذه العلاماتُ تؤكّد أنّ كلَّ شيءٍ سليم:

- `npx vitest run` ⇒ **٣١١ passed**.
- الدخولُ `admin/mishkat123` ثمّ `/network` ⇒ **لا يظهر** صندوقُ «بانتظار اعتمادك» (الإدارةُ اطّلاعٌ فقط).
- الدخولُ `square_men` ثمّ `/network` ⇒ **يظهر** صندوقُ «بانتظار اعتمادك» بمساجده.
- الدخولُ `finance` ثمّ `/finance` ⇒ «مقترحاتي الماليّة» + لا صندوقَ اعتماد.
- `/admin` ← منسدلةُ الأدوار ⇒ كلُّ دورٍ له أيقونة (يحرسه `role-icons.test`).
