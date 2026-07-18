# إعداد بوت تيليغرام لإيصال إشعارات مِشكاة

> ✅ **مُنجَز (٢٠٢٦-٠٧-١١):** البوت **@MishkatNotifyBot** أنشأه المالك، والأسرار الثلاثة مضبوطةٌ على الإنتاج، والويبهوك مسجَّلٌ ومتحقَّقٌ منه (`getWebhookInfo` سليم، الحارس يرفض بلا سرّ بـ403، وزرّ «ربط تيليغرام» يولّد رابط `t.me/MishkatNotifyBot?start=…`). نُظّفت قيم تيليغرام الوهميّة من بذور العرض (113 صفًّا) ليعمل الربط الحقيقيّ. **لا خطوات متبقّية** — هذا الملف مرجعٌ للتشغيل والتدوير والتشخيص.

> **الغرض:** تفعيل **إرسال** إشعارات مِشكاة إلى تيليغرام (تذكيرات الإدخال، تصعيد الاعتماد، الاعتماد النهائي).

الحالة الحيّة: **https://mishkat.yghaibeh.workers.dev** · اسم الـWorker: `mishkat` · الكرون: `0 * * * *` (كلّ ساعة).

---

## كيف يعمل النظام (نظرة سريعة)

1. **الربط:** المستخدم يفتح جرس الإشعارات في التطبيق ويضغط **«ربط تيليغرام»** ⇐ يُولَّد رمزٌ مؤقّت (ساعة صلاحية) ويُفتح رابط `https://t.me/<BOT_USERNAME>?start=<token>`.
2. **الالتقاط:** عند ضغط المستخدم **Start** في تيليغرام، يرسل تيليغرام `POST /api/telegram/webhook` إلى الـWorker. يتحقّق الـWorker من السرّ، ثمّ يخزّن `chat.id` في `person_contacts.telegram` ويمسح الرمز، ويردّ برسالة تأكيد.
3. **الإرسال:** الكرون الساعيّ يستدعي `dispatchQueued(TELEGRAM_BOT_TOKEN)` فيرسل الإشعارات المُتراكمة في الطابور إلى `chat.id` لكلّ مستخدمٍ مربوط.

> **مهمّ:** بدون ضبط الأسرار الثلاثة أدناه، يظلّ الويبهوك يردّ **403** (وهو آمن)، ولا يُرسَل شيء — لكنّ الإشعارات داخل الموقع تظهر بالجرس عاديًّا.

---

## المتطلّبات

- حساب تيليغرام (على الهاتف أو سطح المكتب).
- صلاحية `wrangler` على Worker `mishkat` (الحساب: `yghaibeh@hotmail.com`).
- تشغيل الأوامر من داخل مجلّد التطبيق `app/` حيث يوجد `wrangler.toml` (لا حاجة لتمرير اسم الـWorker).
- استخدم **`npx wrangler`** (الأمر المجرّد `wrangler` غير مثبّت على PATH).

---

## الخطوة ١ — إنشاء البوت والحصول على التوكن واسم المستخدم

1. في تيليغرام، افتح محادثة مع **[@BotFather](https://t.me/BotFather)**.
2. أرسل `/newbot` واتّبع التعليمات:
   - **اسم العرض** (Display name): مثلاً `مِشكاة — إشعارات`.
   - **اسم المستخدم** (Username): يجب أن ينتهي بـ`bot`، مثلاً `MishkatNotifyBot`. ⬅️ هذا هو `TELEGRAM_BOT_USERNAME` (بدون `@`).
3. سيردّ BotFather برسالةٍ تحوي **التوكن** بالشكل `123456789:AAE...xyz`. ⬅️ هذا هو `TELEGRAM_BOT_TOKEN`. **احتفظ به سرًّا.**
4. (اختياريّ لكن مُستحسَن) اضبط ملف البوت:
   - `/setdescription` — وصفٌ عربيّ مختصر.
   - `/setuserpic` — صورة شعار مِشكاة.
   - `/setprivacy` ⇐ **Enable** (لا يحتاج البوت قراءة الرسائل الجماعية — يكفيه `/start`).

---

## الخطوة ٢ — توليد سرّ الويبهوك

سرٌّ عشوائيّ يُتحقّق منه في كلّ نداء ويبهوك (يمنع الطلبات المزيَّفة). ولّده بأمرٍ واحد:

```bash
openssl rand -hex 32
```

انسخ الناتج — سيكون `TELEGRAM_WEBHOOK_SECRET`.

> شرط تيليغرام: يُسمَح فقط بـ`A–Z a–z 0–9 _ -` وبطول ١–٢٥٦ محرفًا. ناتج `openssl rand -hex` مطابق.

---

## الخطوة ٣ — ضبط الأسرار الثلاثة على الـWorker

من داخل مجلّد `app/`:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# الصق التوكن من BotFather ثم Enter

npx wrangler secret put TELEGRAM_BOT_USERNAME
# الصق اسم المستخدم بدون @ (مثلاً MishkatNotifyBot) ثم Enter

npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# الصق ناتج openssl ثم Enter
```

| السرّ | المصدر | يُستعمَل في |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather | إرسال الرسائل (الكرون) + ردّ التأكيد في الويبهوك |
| `TELEGRAM_BOT_USERNAME` | BotFather (بدون `@`) | بناء رابط `t.me/<user>?start=<token>` لزرّ الربط |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` | التحقّق من رأس `x-telegram-bot-api-secret-token` |

> الأسرار تُحفَظ مشفَّرةً في Cloudflare. لا تضعها في `wrangler.toml` ولا في git. تعديل الأسرار **لا يستلزم** إعادة نشرٍ للكود.

---

## الخطوة ٤ — تسجيل الويبهوك لدى تيليغرام

استبدل `<TOKEN>` و`<SECRET>` بقيمهما، ثمّ نفّذ:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  --data-urlencode "url=https://mishkat.yghaibeh.workers.dev/api/telegram/webhook" \
  --data-urlencode "secret_token=<SECRET>" \
  --data-urlencode 'allowed_updates=["message"]'
```

النتيجة المتوقّعة: `{"ok":true,"result":true,"description":"Webhook was set"}`.

> `secret_token` هنا **يجب** أن يساوي `TELEGRAM_WEBHOOK_SECRET` الذي ضبطته في الخطوة ٣؛ تيليغرام سيُرفقه في كلّ نداءٍ برأس `x-telegram-bot-api-secret-token`، والـWorker يرفض ما لا يطابقه (403).

---

## الخطوة ٥ — التحقّق

```bash
# ١) حالة الويبهوك لدى تيليغرام (يجب أن يظهر url وpending_update_count=0 وبلا آخر خطأ)
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# ٢) حارس الأمان: نداءٌ بلا سرٍّ صحيح يجب أن يُرفَض بـ403
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://mishkat.yghaibeh.workers.dev/api/telegram/webhook   # ⇐ يتوقّع 403
```

ثمّ اختبارٌ حيّ من الطرف إلى الطرف:
1. سجّل الدخول إلى التطبيق بأيّ مستخدم، افتح **جرس الإشعارات ← «ربط تيليغرام»**.
2. اضغط الرابط، ثمّ **Start** في تيليغرام ⇐ يجب أن تصلك رسالة: «تمّ ربط حسابك بمشكاة ✅».
3. في التطبيق، تظهر حالة الربط «مربوط» (`getTelegramStatus`).

---

## الخطوة ٦ — الإرسال (تلقائيّ)

- الكرون يعمل **كلّ ساعة** (`0 * * * *`): يبني التذكيرات/التصعيدات ثمّ يستدعي `dispatchQueued` فيرسل ما في الطابور إلى المستخدمين المربوطين.
- **لا إجراء إضافيّ** — يكفي أن تكون الأسرار مضبوطةً والمستخدمون مربوطين.

### تشغيلٌ يدويّ للكرون أثناء التطوير (اختياريّ)

```bash
npx wrangler dev --test-scheduled
# في نافذةٍ أخرى:
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

> في الإنتاج لا يمكن فرض تشغيل الكرون يدويًّا؛ ينتظر الساعة التالية. للاختبار الفوريّ استعمل وضع التطوير أعلاه.

---

## استكشاف الأخطاء

| العَرَض | السبب المرجّح | الحلّ |
|---|---|---|
| زرّ «ربط تيليغرام» يقول إنّ البوت غير مُهيّأ | `TELEGRAM_BOT_USERNAME` غير مضبوط | أعد الخطوة ٣ لاسم المستخدم |
| ضغطتُ Start فلم تصل رسالة تأكيد | الويبهوك غير مسجَّل أو السرّ غير مطابق | راجع `getWebhookInfo` (حقل `last_error_message`)، وتأكّد أنّ `secret_token`=`TELEGRAM_WEBHOOK_SECRET` |
| `getWebhookInfo` يُظهر `last_error_message: Wrong response ... 403` | السرّ في `setWebhook` ≠ السرّ في الـWorker | أعد ضبط `TELEGRAM_WEBHOOK_SECRET` ثمّ أعد `setWebhook` بنفس القيمة |
| مربوطٌ لكن لا تصل إشعارات | لا رسائل في الطابور، أو الكرون لم يدُر بعد | انتظر الساعة، أو أنشئ حدثًا (سجلّ متأخّر/اعتماد) ثمّ تحقّق |
| «رابطٌ منتهٍ» عند Start | مرّت ساعةٌ على توليد الرمز | أعد الضغط على «ربط تيليغرام» لرمزٍ جديد |

أوامر تشخيص إضافية:

```bash
# حذف الويبهوك (للإعادة من الصفر)
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# سجلّ الـWorker الحيّ (شاهد نداءات الويبهوك)
npx wrangler tail mishkat
```

---

## الأمان والخصوصية

- **الأسرار** مشفَّرة في Cloudflare، خارج git تمامًا.
- الويبهوك يرفض أيّ نداءٍ لا يحمل `x-telegram-bot-api-secret-token` المطابق ⇒ لا التقاط chat_id مزيَّف.
- يُخزَّن **`chat.id` فقط** في `person_contacts.telegram` (لا محتوى رسائل)، ويُمسَح الرمز المؤقّت فور الربط.
- تدوير التوكن عند التسريب: `/revoke` لدى BotFather ⇒ ضبط `TELEGRAM_BOT_TOKEN` الجديد ⇒ إعادة `setWebhook`.

---

## مرجع سريع (بعد أوّل إعداد)

```bash
# تحديث توكن/اسم/سرّ لاحقًا (لا يحتاج إعادة نشر)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_BOT_USERNAME
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  --data-urlencode "url=https://mishkat.yghaibeh.workers.dev/api/telegram/webhook" \
  --data-urlencode "secret_token=<SECRET>"
```

**مواضع الكود المرجعية:** الويبهوك [telegram.server.ts](../app/src/server/telegram.server.ts) · التوجيه [server.ts](../app/src/server.ts) · الربط/الحالة [notifications.server.ts](../app/src/server/notifications.server.ts) · الإرسال [services/notifications.ts](../app/src/server/services/notifications.ts) · الكرون [scheduled.server.ts](../app/src/server/scheduled.server.ts) · التوثيق التنفيذيّ في [06_implementation_log.md](06_implementation_log.md) (FR2).

---

## القناة الثانية (المكمّلة): Web Push للمتصفّح — **مضبوطةٌ ومُفعَّلة**

إشعارات المتصفّح/PWA تعمل بالتوازي مع تيليغرام. **لا حاجة لإجراءٍ من المالك** — مفاتيح VAPID وُلّدت وضُبطت أسرارها على الإنتاج (`VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`)، لأنّها تهيئةٌ للتطبيق لا حسابٌ خارجيّ. المستخدم يفعّلها من **جرس الإشعارات ← «تفعيل إشعارات المتصفّح على هذا الجهاز»** (يطلب إذن المتصفّح).

**تدوير مفاتيح VAPID عند الحاجة** (نادر — يُلغي كلّ الاشتراكات القائمة فتُعاد):

```bash
node -e '(async()=>{const kp=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign"]);const pub=new Uint8Array(await crypto.subtle.exportKey("raw",kp.publicKey));const jwk=await crypto.subtle.exportKey("jwk",kp.privateKey);const u=b=>Buffer.from(b).toString("base64url");console.log("PUBLIC:",u(pub));console.log("PRIVATE:",jwk.d)})()'
# ثمّ:
npx wrangler secret put VAPID_PUBLIC_KEY   # الصق PUBLIC
npx wrangler secret put VAPID_PRIVATE_KEY  # الصق PRIVATE
```

> الفرق الأمنيّ عن تيليغرام: `VAPID_*` مفاتيحُ تطبيقٍ ذاتيّة (لا تُفشي حسابًا)، بينما `TELEGRAM_BOT_TOKEN` يتحكّم ببوتٍ خارجيّ ⇒ إعداد تيليغرام يبقى على المالك.
