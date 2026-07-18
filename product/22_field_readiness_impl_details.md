# 22 — تفاصيل التنفيذ (Implementation Details) لخطة الجاهزية الميدانية

> **مرجع الخطة:** [21_field_readiness_plan.md](21_field_readiness_plan.md) — هذه الوثيقة تنزل إلى **مستوى الكود**: هجرات SQL كاملة، توقيعات دوالّ، أغلفة serverFn، وحدات العميل، أوامر النشر، واختبارات. **لا Workarounds.**
> **التاريخ:** ٢٠٢٦-٠٧-٠٩ · **الحالة:** جاهزة للتنفيذ.

## توصياتي المُختارة (حُسِمت الأسئلة الخمسة)
1. **الترتيب:** **(١) العمل دون اتصال أولًا** — لأنه المتطلّب «غير القابل للتفاوض»، ولأن (٣) سجل أنشطة النساء إدخالٌ ميدانيّ **يرث** نمط الأوفلاين فيتفادى إعادة العمل. (٢) الإشعارات **مستقلّة خادميًّا** فتُبنى بالتوازي/فورًا بعدها. التسلسل: **١ → ٢ → ٣ → ٦ → ق → ر**.
2. **أنشطة النساء:** تُنسَب **للحلقة النسائية** أساسًا (الوحدة الطرفية المُدخِلة)، مع السماح بالإدخال على المربع النسائي (نفس الآلية بوحدةٍ أعلى).
3. **تقدّم المنهج:** **آليّ من الحضور + تعديلٌ يدويّ** (الأقوى تربويًّا وأقلّ عبئًا).
4. **Web Push:** **يُؤجَّل إلى ما بعد المرحلة ١** (يحتاج الـSW أصلًا) — تيليغرام الآن.
5. **النشر:** **أنشر الفصل (م٠–م٣) الآن**، ثم ابنِ هذه المراحل دفعاتٍ لاحقة (كلٌّ مُتحقَّقة ومنشورة على حدة).

## اصطلاحات المستودع (تُتَّبع حرفيًّا)
- منطق الخادم في `src/server/*.server.ts` (يستعمل `useDb()`, `currentUser()`, Drizzle). أغلفة RPC في `src/lib/api/*.ts` عبر `createServerFn(...).validator(z...).handler(async ({data}) => { const { fn } = await import("@/server/x.server"); return fn(data); })`.
- الهجرات: ملفّات مرقّمة في `src/server/database/migrations/`؛ التالي **`0030`**. تُطبَّق: `npx wrangler d1 migrations apply influential-masjid --local --persist-to ./.wrangler-state` (و`--remote` للإنتاج).
- المخطط في `src/server/database/schema.ts` (Drizzle) — يجب أن يوازي كلَّ هجرة.
- الاختبارات: vitest + libsql بالذاكرة تطبّق الهجرات الحقيقية؛ `npm test`.
- مسارات مخصّصة (غير serverFn) تُضاف في `src/server.ts` بعد `handleMediaRequest` بنمطها (تُعيد `Response` أو `null`).

---

# المرحلة ١ — العمل دون اتصال (PWA + Outbox)

## ١.١ التبعية والملاحظة المعماريّة
- إضافة تبعية واحدة: **`idb`** (غلاف رقيق على IndexedDB): `npm i idb`.
- **تحديث (٢٠٢٦-٠٧-٠٩): أُزيل غلاف Lovable** (`@lovable.dev/vite-tanstack-config`) وصار `vite.config.ts` قائمًا بذاته ⇒ **يمكن الآن استعمال `vite-plugin-pwa`** بحرّية. لكن **يبقى الخيار المُوصى به service worker مكتوبًا يدويًّا** (§١.٤) لأنه أخفّ وأوضح تحكّمًا ويعمل مع الأصول المُجزَّأة بلا precache-manifest؛ ونضيف إضافة Vite للـPWA فقط إن احتجنا precache شاملًا لاحقًا.

## ١.٢ ملفّات جديدة/معدّلة (جرد)
| ملفّ | الحالة | الغرض |
|---|---|---|
| `app/public/manifest.webmanifest` | جديد | بيان PWA |
| `app/public/sw.js` | جديد | service worker يدويّ (تخبئة زمن-التشغيل) |
| `app/public/icons/icon-192.png`,`icon-512.png`,`maskable-512.png` | جديد | أيقونات |
| `app/src/lib/offline/db.ts` | جديد | فتح IndexedDB (idb) |
| `app/src/lib/offline/outbox.ts` | جديد | طابور الإرسال + المُرسِلات |
| `app/src/lib/offline/sync.ts` | جديد | مُشغِّلات المزامنة (online/interval/visibility/backgroundSync) |
| `app/src/lib/offline/register-sw.ts` | جديد | تسجيل الـSW + طلب التثبيت |
| `app/src/hooks/useOfflineStatus.ts` | جديد | حالة الاتصال + عدد المعلّق |
| `app/src/components/nav/SyncBadge.tsx` | جديد | شارة «يعمل دون اتصال · N بانتظار المزامنة» |
| `app/src/routes/__root.tsx` | تعديل | حقن `<link manifest>`، تسجيل الـSW، إظهار SyncBadge |
| `app/src/server/data.server.ts` | تعديل | `saveDailyLogData` يقبل `clientUuid` لكل إدخال |
| `app/src/server/alaBaseera.server.ts` | تعديل | `recordLessonData` يقبل `clientUuid` + منع التكرار |
| `app/src/server/media.server.ts` | تعديل | الرفع يقبل `clientUuid` + منع التكرار |
| `app/src/lib/api/functions.ts`,`alaBaseera.ts` | تعديل | تمرير `clientUuid` في المُدقِّقات |

## ١.٣ `public/manifest.webmanifest`
```json
{
  "name": "مشكاة — إدارة المسجد المؤثّر",
  "short_name": "مشكاة",
  "lang": "ar", "dir": "rtl",
  "start_url": "/", "scope": "/",
  "display": "standalone", "orientation": "portrait",
  "background_color": "#ffffff", "theme_color": "#065f46",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## ١.٤ `public/sw.js` (تخبئة زمن-التشغيل، بلا precache)
```js
const V = 'mishkat-v1';
const SHELL = V + '-shell';    // تنقّل HTML (NetworkFirst)
const ASSETS = V + '-assets';  // /assets/* المُجزَّأة (StaleWhileRevalidate)
const OFFLINE_URL = '/offline.html'; // صفحة سقوطٍ بسيطة

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;                 // الكتابة تمرّ للشبكة (يعالجها الـOutbox)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // لا نخبّئ الأصول الخارجية
  if (request.mode === 'navigate') {                    // HTML: شبكة أولًا، ثم القشرة المخبّأة
    e.respondWith(fetch(request).then((res) => {
      const copy = res.clone(); caches.open(SHELL).then((c) => c.put(request, copy)); return res;
    }).catch(() => caches.match(request).then((m) => m || caches.match(OFFLINE_URL))));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/media/')) {
    e.respondWith(caches.open(ASSETS).then(async (c) => {
      const cached = await c.match(request);
      const net = fetch(request).then((res) => { c.put(request, res.clone()); return res; }).catch(() => cached);
      return cached || net;                              // StaleWhileRevalidate
    }));
  }
});
// مزامنة الخلفية (حيثما دُعِمت) — يطلب من العميل تفريغ الطابور
self.addEventListener('sync', (e) => { if (e.tag === 'mishkat-outbox') e.waitUntil(notifyClientsToFlush()); });
async function notifyClientsToFlush() {
  const cs = await self.clients.matchAll({ includeUncontrolled: true });
  cs.forEach((c) => c.postMessage({ type: 'flush-outbox' }));
}
```
> ملاحظة: يُضاف ملفٌّ بسيط `public/offline.html` (رسالة «أنت دون اتصال — سيُزامَن إدخالك تلقائيًّا»).

## ١.٥ `src/lib/offline/db.ts`
```ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OutboxKind = "daily_entry" | "women_activity" | "lesson" | "attendance" | "student" | "media";
export interface OutboxItem { id: string; kind: OutboxKind; payload: unknown; blob?: Blob; createdAt: number; tries: number; lastError?: string; }

interface MishkatDB extends DBSchema { outbox: { key: string; value: OutboxItem }; }
let _db: Promise<IDBPDatabase<MishkatDB>> | null = null;
export function db() {
  if (!_db) _db = openDB<MishkatDB>("mishkat-offline", 1, {
    upgrade(d) { d.createObjectStore("outbox", { keyPath: "id" }); },
  });
  return _db;
}
```

## ١.٦ `src/lib/offline/outbox.ts` (القلب)
```ts
import { db, type OutboxKind, type OutboxItem } from "./db";
import { saveDailyLog, /*…*/ } from "@/lib/api/functions";
import { recordLesson, addHalaqaStudent, setLessonStatus } from "@/lib/api/alaBaseera";

// معرّف ثابت للعنصر = clientUuid (يُولَّد مرّة، يُعاد إرساله بأمان)
export function newClientUuid() { return crypto.randomUUID(); }

export async function enqueue(kind: OutboxKind, payload: unknown, blob?: Blob): Promise<string> {
  const id = (payload as { clientUuid?: string }).clientUuid ?? newClientUuid();
  const item: OutboxItem = { id, kind, payload, blob, createdAt: Date.now(), tries: 0 };
  await (await db()).put("outbox", item);
  void flush();          // محاولةٌ فوريّة إن كان أونلاين
  return id;
}
export async function pendingCount() { return (await (await db()).count("outbox")); }

// المُرسِلات: تربط kind بـserverFn المناسب (كلّها idempotent خادميًّا)
const SENDERS: Record<OutboxKind, (it: OutboxItem) => Promise<void>> = {
  daily_entry: async (it) => { const r = await saveDailyLog({ data: it.payload as never }); assertOk(r); },
  women_activity: async (it) => { const { saveWomenActivity } = await import("@/lib/api/women"); assertOk(await saveWomenActivity({ data: it.payload as never })); },
  lesson: async (it) => { assertOk(await recordLesson({ data: it.payload as never })); },
  attendance: async (it) => { assertOk(await recordLesson({ data: it.payload as never })); }, // الحضور داخل الدرس
  student: async (it) => { assertOk(await addHalaqaStudent({ data: it.payload as never })); },
  media: async (it) => { await uploadMedia(it); },
};
function assertOk(r: unknown) { if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error) throw new Error((r as { error: string }).error); }

async function uploadMedia(it: OutboxItem) {
  const p = it.payload as { scope: string; refId: string; clientUuid: string; filename: string };
  const fd = new FormData();
  fd.append("file", it.blob!, p.filename); fd.append("scope", p.scope); fd.append("refId", p.refId); fd.append("clientUuid", p.clientUuid);
  const res = await fetch("/api/media/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload " + res.status);
}

let flushing = false;
export async function flush() {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  try {
    const all = await (await db()).getAll("outbox");
    for (const it of all.sort((a, b) => a.createdAt - b.createdAt)) {
      try { await SENDERS[it.kind](it); await (await db()).delete("outbox", it.id); }
      catch (e) {
        it.tries++; it.lastError = String((e as Error).message ?? e);
        if (it.tries > 20) await (await db()).delete("outbox", it.id); // حدّ أقصى — يُسجَّل خطأ للمستخدم
        else await (await db()).put("outbox", it);
        break; // نتوقّف عند أوّل فشل (شبكة) ونعيد لاحقًا
      }
    }
  } finally { flushing = false; window.dispatchEvent(new Event("outbox-changed")); }
}
```

## ١.٧ `src/lib/offline/sync.ts` + `register-sw.ts`
```ts
// sync.ts — مُشغِّلات التفريغ
import { flush } from "./outbox";
export function startSync() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void flush(); });
  setInterval(() => void flush(), 30_000);
  navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.type === "flush-outbox") void flush(); });
  void flush();
}
```
```ts
// register-sw.ts
export function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
```
تُستدعيان في `__root.tsx` (داخل `useEffect` بالعميل) + `<link rel="manifest" href="/manifest.webmanifest">` في الـhead.

## ١.٨ العميل: توجيه الإدخال عبر الطابور
مثال `DailyLogPage.onSave` ([DailyLogPage.tsx](app/src/components/daily-log/DailyLogPage.tsx)) — يُولّد `clientUuid` لكلّ إدخال ويُصفّه بدل الاستدعاء المباشر:
```ts
const entries = activities.filter(...).map((a, i) => ({
  clientUuid: `${mosqueId ?? "self"}:${weekStartLocal}:${a.activityTypeId}`, // ثابت لنفس (وحدة،أسبوع،نشاط)
  activityTypeId: a.activityTypeId, count: counts[i], participantCount: participants[i],
}));
await enqueue("daily_entry", { track, entries, shura });   // يُحفَظ محلّيًّا فورًا، ويُرسَل عند توفّر الشبكة
toast.success(navigator.onLine ? "حُفظ" : "حُفظ محليًّا — سيُزامَن تلقائيًّا");
```
> **مفتاح الـidempotency**: `clientUuid` مُشتقٌّ من (الوحدة، الأسبوع، النشاط) — فإعادة الإرسال أو الإدخال المكرّر لنفس الخلية يُحدِّث لا يُكرِّر (يوازي مفتاح `syncEntries` الطبيعيّ). المرفقات: `enqueue("media", {scope, refId, clientUuid, filename}, blob)`.

## ١.٩ تعديلات الخادم (idempotency حقيقيّة)
### `saveDailyLogData` ([data.server.ts:234](app/src/server/data.server.ts))
- **قبل**: يُولّد `clientUuid` داخليًّا بـ`now` (غير ثابت).
- **بعد**: يقبل `clientUuid` لكلّ إدخال من العميل:
```ts
export async function saveDailyLogData(input: { track: "male"|"female";
  entries: Array<{ clientUuid: string; activityTypeId: string; count: number; participantCount?: number }>;
  shura: boolean; }) {
  // …
  const entries = input.entries.filter(e => e.count > 0).map(e => ({
    clientUuid: e.clientUuid,   // ← من العميل (كان: `${mosque.id}-${weekStart}-…-${now}-${i}`)
    weekStart, day: "sat", activityTypeId: e.activityTypeId, count: e.count,
    participantCount: e.participantCount ?? 1, shuraConfirmed: input.shura, recordedAt: now,
  }));
  // syncEntries يتكفّل بالتكرار (فحص daily_entries.client_uuid موجود أصلًا)
}
```
والمُدقِّق في [functions.ts:30](app/src/lib/api/functions.ts) يضيف `clientUuid: z.string().min(1)` لكل إدخال.

### `recordLessonData` ([alaBaseera.server.ts:362](app/src/server/alaBaseera.server.ts))
- يقبل `clientUuid?: string`؛ إن مُرِّر وكان موجودًا مسبقًا يُرجِع نفس المعرّف (لا يُنشئ):
```ts
if (input.clientUuid) {
  const dup = (await db.select({ id: lessonSessions.id }).from(lessonSessions).where(eq(lessonSessions.clientUuid, input.clientUuid)).all())[0];
  if (dup) return { ok: true as const, id: dup.id };
}
```
> يتطلّب عمود `client_uuid` على `lesson_sessions` (هجرة ١.١٠).

### `/api/media/upload` ([media.server.ts:38](app/src/server/media.server.ts))
- يقرأ `clientUuid` من الـFormData؛ إن وُجد صفٌّ بنفس الـuuid في `attachments`/`lesson_attachments` يُرجِع نجاحًا دون إعادة رفع.

## ١.١٠ الهجرة `0030_offline_client_uuid.sql`
```sql
ALTER TABLE lesson_sessions ADD COLUMN client_uuid TEXT;
ALTER TABLE attachments ADD COLUMN client_uuid TEXT;
ALTER TABLE lesson_attachments ADD COLUMN client_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ls_client_uuid ON lesson_sessions(client_uuid) WHERE client_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_att_client_uuid ON attachments(client_uuid);
```
(المخطط في `schema.ts` يوازيها.)

## ١.١١ الاختبارات (vitest)
- `offline-idempotency.test.ts`: استدعاء `saveDailyLogData` مرّتين بنفس `clientUuid` ⇒ صفٌّ واحد في `daily_entries`. و`recordLessonData` مرّتين بنفس `clientUuid` ⇒ جلسةٌ واحدة.
- e2e يدويّ (preview): قطع الشبكة (`navigator.onLine=false` عبر eval) → إدخال → `pendingCount()=1` → استعادة → `flush()` → صفٌّ واحد.

## ١.١٢ معايير القبول
1. التطبيق يُثبَّت (Add to Home Screen) ويفتح دون اتصال بقشرةٍ مخبّأة.
2. إدخال سجل اليوم دون اتصال يُحفَظ محلّيًّا (شارة «N بانتظار») ثم يُزامَن مرّةً واحدةً عند العودة.
3. صورةٌ تُلتقَط دون اتصال تُرفَع تلقائيًّا لاحقًا.

---

# المرحلة ٢ — إيصال الإشعارات (Telegram) + إغلاق الدورة

## ٢.١ ما هو جاهزٌ فعلًا (لا يُعاد بناؤه)
- الكرون `runDueTasksData` يستدعي `dispatchQueued(db, TELEGRAM_BOT_TOKEN)` ([scheduled.server.ts:60](app/src/server/scheduled.server.ts)).
- `dispatchQueued`/`sendTelegram` جاهزتان؛ ترسلان إلى `personContacts.telegram` كـchatId.

## ٢.٢ الناقص (٣ قطع)
### (أ) السرّ
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN   # القيمة من BotFather
```
+ إضافته لأنواع البيئة حيث تُقرأ (`getCloudflareEnv()`).

### (ب) الهجرة `0031_telegram_link.sql`
```sql
ALTER TABLE person_contacts ADD COLUMN link_token TEXT;
ALTER TABLE person_contacts ADD COLUMN link_expires INTEGER;
CREATE INDEX IF NOT EXISTS idx_pc_link_token ON person_contacts(link_token);
```

### (ج) مسار الويبهوك + الربط
**ملفّ جديد `src/server/telegram.server.ts`** (نمط `media.server.ts` — يُعيد `Response|null`):
```ts
export async function handleTelegramRequest(request: Request, env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WEBHOOK_SECRET?: string }): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/telegram/webhook") return null;
  // تحقّق أمنيّ: رأس تيليغرام السرّيّ
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  const update = await request.json().catch(() => null) as { message?: { chat?: { id: number }; text?: string } } | null;
  const msg = update?.message; const text = msg?.text?.trim() ?? "";
  const chatId = msg?.chat?.id;
  if (chatId && text.startsWith("/start")) {
    const token = text.split(/\s+/)[1] ?? "";
    const db = useDb(); const now = Date.now();
    const pc = (await db.select().from(personContacts).where(eq(personContacts.linkToken, token)).all())[0];
    if (pc && (pc.linkExpires ?? 0) > now) {
      await db.update(personContacts).set({ telegram: String(chatId), linkToken: null, linkExpires: null }).where(eq(personContacts.personId, pc.personId)).run();
      await sendTelegram(env.TELEGRAM_BOT_TOKEN!, String(chatId), "تمّ ربط حسابك بمشكاة ✅ ستصلك الإشعارات هنا.");
    } else {
      await sendTelegram(env.TELEGRAM_BOT_TOKEN!, String(chatId), "رابطٌ منتهٍ أو غير صحيح. أعد المحاولة من التطبيق.");
    }
  }
  return Response.json({ ok: true });
}
```
**ربطه في `src/server.ts`** بعد `handleMediaRequest`:
```ts
const { handleTelegramRequest } = await import("./server/telegram.server");
const tg = await handleTelegramRequest(request, env as never); if (tg) return tg;
```
**تسجيل الويبهوك مرّة** (سرّ عشوائيّ):
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://mishkat.yghaibeh.workers.dev/api/telegram/webhook&secret_token=<SECRET>"
```

## ٢.٣ توليد رمز الربط + زرّ الواجهة
- serverFn `linkTelegramData()` (خادم): يولّد `link_token` (uuid) + `link_expires = now + 15m` لشخص المستخدم الحاليّ، ويُرجع رابط `https://t.me/<BOT_USERNAME>?start=<token>`.
- واجهة: بطاقة «الإشعارات» في صفحة المستخدم/`me`: زرّ **«اربط تيليغرام»** يفتح الرابط. (عرض الحالة: مربوط/غير مربوط.)

## ٢.٤ نصوص الإشعارات + روابط عميقة
في `dispatchQueued` ([notifications.ts:104](app/src/server/services/notifications.ts)) نضيف حالات:
```ts
if (n.kind === 'layer_approval_needed') text = `يحتاج مسجد «${p.mosqueName}» اعتمادكم — https://mishkat.yghaibeh.workers.dev/mosque/${p.mosqueId}?t=report`;
else if (n.kind === 'week_approved') text = `اعتُمد أسبوع «${p.mosqueName}» نهائيًّا.`;
```

## ٢.٥ الاختبارات
- `telegram-webhook.test.ts`: طلبٌ بـsecret خاطئ ⇒ 403؛ `/start <token>` صحيح ⇒ يُحدَّث `personContacts.telegram = chatId` ويُمسَح الـtoken؛ token منتهٍ ⇒ لا تحديث.
- `notifications`: `dispatchQueued` بـmock fetch ⇒ يرسل للـchatId الصحيح بالنصّ المتضمّن الرابط.

## ٢.٦ القبول
مستخدمٌ يربط تيليغرام → إقرار الأمير ⇒ (بتشغيل الكرون يدويًّا عبر `runDueTasksData()` أو انتظار الساعة) تصل رسالةٌ للمشرف المُغطّي بالرابط.

---

# المرحلة ٣ — سجلّ الأنشطة النسائية

## ٣.١ التصميم: تعميم سجل النقاط من «مسجد» إلى «وحدة»
**الهجرة `0032_unit_records.sql`** (إضافة عمودَي وحدة + ملء القديم = المسجد):
```sql
ALTER TABLE weekly_records ADD COLUMN unit_id TEXT;
ALTER TABLE weekly_records ADD COLUMN unit_path TEXT;
UPDATE weekly_records SET unit_id = mosque_id, unit_path = mosque_path WHERE unit_id IS NULL;
ALTER TABLE daily_entries ADD COLUMN unit_id TEXT;
UPDATE daily_entries SET unit_id = mosque_id WHERE unit_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_wr_unit_week ON weekly_records(unit_id, week_start);
```
> `mosque_id/mosque_path` يبقيان (توافقٌ تاريخيّ)؛ `unit_id/unit_path` هما **المصدر الموحّد** للقراءة/الكتابة الجديدة. (النزاهة التاريخية ق-15 محفوظة: الربط بالمعرّفات.)

## ٣.٢ تعميم طبقة الخدمة
- `getOrCreateWeeklyRecord(db, unit, weekStart)` ([utils/records.ts](app/src/server/utils/records.ts)): يقبل **وحدةً** (مسجد أو حلقة نسائية)، ويملأ `unit_id/unit_path` (+ `mosque_id/mosque_path` = نفسها للتوافق)، ويختار المخطط من `currentScheme(db, unit.genderTrack)` — فيُنتقى `scheme-female` للوحدة النسائية تلقائيًّا.
- `syncEntries(db, unit, caps, entries)`: نفس المنطق، يعمل على `unit`.

## ٣.٣ الخادم + الغلاف
```ts
// data.server.ts
export async function saveWomenActivityData(input: { unitId: string; entries: Array<{ clientUuid: string; activityTypeId: string; count: number; participantCount?: number }>; shura: boolean; }) {
  const db = useDb(); const u = await currentUser();
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.unitId)).all())[0];
  if (!unit || unit.section !== "women") return { error: "وحدةٌ نسائية غير صالحة" as const };
  // صلاحية: مشرفة الحلقة (amir على الوحدة) أو جهة أعلى مُغطّية
  const isMushrifa = u!.assignments.some(a => a.role === "amir" && a.orgUnitId === unit.id);
  const isLayer = isGlobalAdmin(u!) || u!.assignments.some(a => ["square","rabita","section_head"].includes(a.role) && unit.path.startsWith(a.orgPath));
  if (!isMushrifa && !isLayer) return { error: "لا صلاحية" as const };
  const res = await syncEntries(db, unit, { userId: u!.userId, canEditLocked: false, committee: null },
    input.entries.filter(e=>e.count>0).map(e => ({ clientUuid: e.clientUuid, weekStart: weekStartSaturday(new Date()), day: "sat", activityTypeId: e.activityTypeId, count: e.count, participantCount: e.participantCount ?? 1, shuraConfirmed: input.shura, recordedAt: Date.now() })));
  return { applied: res.applied, totalPoints: res.records[0]?.totalPoints ?? 0 };
}
export async function womenActivitiesCatalog() { /* activity_types حيث gender_track='female' + weeklyTarget من scheme-female */ }
```
غلاف `src/lib/api/women.ts`: `saveWomenActivity` + `getWomenActivities`.

## ٣.٤ الواجهة
- تبويب **«سجل الأنشطة»** في صفحة الحلقة النسائية (ضمن `MyCirclesPage`/صفحة الحلقة): يُعيد استعمال نمط `DailyLogPage` (عدّادات الأنشطة النسائية + إقرار الشورى + قسم التوثيق بالصور القائم)، مع تمرير `unitId = الحلقة` و`genderTrack="female"`. الإدخال يمرّ عبر Outbox (kind `women_activity`).
- الاعتماد يُعيد استعمال `ReportActions`/سلسلة ق1-ج (المشرفة تُقرّ ← جهةٌ أعلى تعتمد).

## ٣.٥ المالية
- نقاط أنشطة النساء تُنسَب **للمشرفة** (نظير نسبة نقاط المسجد للأمير) — تدخل `buildTracks` القائمة عبر `weekly_records` (التي صارت للوحدة). لا تغيير جوهريّ في المالية سوى أن مصدرها وحدةٌ نسائية.

## ٣.٦ الاختبارات + القبول
- `women-activity.test.ts`: مشرفة تُدخل «زيارة دعوية ×٣ + توزيع حجابات ×١٠» بمخطط النساء ⇒ `weekly_records(unit=halaqa)` بنقاطٍ صحيحة؛ جهةٌ أعلى تعتمد ⇒ layer_approved؛ المالية تحتسبها.

---

# المرحلة ٦ — تتبّع تقدّم الطالبة في المنهج

## ٦.١ الهجرة `0033_curriculum_progress.sql`
```sql
CREATE TABLE IF NOT EXISTS curriculum_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  manhaj_key TEXT NOT NULL,       -- مفتاح المجلس (يوازي lesson_sessions.majlis / manhaj_lessons)
  status TEXT NOT NULL DEFAULT 'completed', -- not_started | in_progress | completed
  rating INTEGER,                 -- تقييمٌ اختياريّ 1..5
  source TEXT NOT NULL DEFAULT 'auto', -- auto (من الحضور) | manual
  date_hijri TEXT,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_enroll_majlis ON curriculum_progress(enrollment_id, manhaj_key);
CREATE INDEX IF NOT EXISTS idx_cp_enroll ON curriculum_progress(enrollment_id);
```

## ٦.٢ التحديث الآليّ (عند اعتماد الدرس)
في `setLessonStatusData` عند `status="approved"` ولوجود `lesson.majlis`:
```ts
if (input.status === "approved" && l.majlis) {
  const present = await db.select({ e: lessonAttendance.enrollmentId }).from(lessonAttendance)
    .where(and(eq(lessonAttendance.lessonSessionId, l.id), eq(lessonAttendance.state, "present"))).all();
  for (const p of present) {
    await db.insert(curriculumProgress).values({ id: crypto.randomUUID(), enrollmentId: p.e, manhajKey: l.majlis, status: "completed", source: "auto", dateHijri: l.dateHijri, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: [curriculumProgress.enrollmentId, curriculumProgress.manhajKey], set: { status: "completed", updatedAt: Date.now() } }).run();
  }
}
```
> إن لم يُدعَم `onConflictDoUpdate` في إعداد Drizzle الحاليّ: `delete` ثم `insert` (كنمط `setStudentEvaluationData`).

## ٦.٣ التحديث اليدويّ + القراءة
```ts
export async function setCurriculumProgressData(input: { enrollmentId: string; manhajKey: string; status: "not_started"|"in_progress"|"completed"; rating?: number }) { /* halaqaInScope عبر enrollment→halaqa */ }
export async function halaqaCurriculumData(halaqaId: string) {
  // مصفوفة: طالبات × مجالس المنهج (من manhaj_lessons) بحالة كلٍّ + نسبة الإنجاز لكل طالبة/قسم
}
export async function studentCurriculumData(enrollmentId: string) { /* تقدّم طالبةٍ عبر الأقسام الستّة */ }
```
غلاف `src/lib/api/alaBaseera.ts`: `getHalaqaCurriculum` + `setCurriculumProgress`.

## ٦.٤ الواجهة
تبويب **«المنهج»** في صفحة الحلقة: مصفوفةٌ (طالبات في الصفوف × مجالس في الأعمدة) بخلايا ملوّنة (أخضر=مكتمل/ذهبيّ=جارٍ/رماديّ=لم يبدأ)، نقرُ الخليّة يبدّل الحالة (يدويّ). أعلى كلّ طالبة شريط تقدّمٍ (٪ من ٢٠ مجلسًا).

## ٦.٥ الاختبار + القبول
- `curriculum.test.ts`: درسٌ للمجلس الثالث بحضور طالبتين يُعتمَد ⇒ للطالبتين `curriculum_progress(manhaj_key=المجلس الثالث, status=completed, source=auto)`؛ تعديلٌ يدويّ لطالبةٍ يعمل؛ `halaqaCurriculumData` يعكس المصفوفة.

---

# المرحلة ق — قابلية التوسّع

## ق.١ وضعٌ كسول لـ`UnitTree`
- إضافة خاصّيتين اختياريّتين لـ[unit-tree.tsx](app/src/components/ui/unit-tree.tsx): `lazy?: boolean` و`loadLeaves?: (unitId: string) => Promise<Leaf[]>`.
- في الوضع الكسول: لا تُمرَّر `leaves` مقدّمًا؛ عند فتح عقدةٍ تُستدعى `loadLeaves(unitId)` وتُخبّأ في حالةٍ داخلية `Map<unitId, Leaf[]>` (نمط `UsersTree` القائم في [UsersPanel.tsx:118](app/src/components/admin/UsersPanel.tsx)). عدّاد الفرع يأتي من الخادم (`leafCountByUnit`) بدل الحساب المحلّيّ.
- خادميًّا: `unitHalaqat(unitId, offset)` و`unitEntitlements(unitId, month, offset)` (مُقيَّدة بالنطاق) + `treeCounts(section?)` (عدد الأوراق لكل وحدة عبر GROUP BY) للشارات. تُستعمَل عند تجاوز عتبةٍ (مثلاً >٥٠٠ ورقة) وإلا يبقى الوضع الكامل.

## ق.٢ مؤشّرات شبكة النساء
في `networkData` ([data.server.ts:369](app/src/server/data.server.ts)):
```ts
const section = (unit?.section ?? scope?.section ?? "men");
const leafType = section === "women" ? "halaqa" : "mosque";
// allMosques → allLeaves: eq(orgUnits.type, leafType)
// leaf detection: unit.type === leafType
```
وفي [NetworkPage.tsx](app/src/components/network/NetworkPage.tsx): تسميات حسب القسم («حلقة نسائية»/«مسجد»، «X حلقة»/«X مسجد»). مؤشّرات النساء تُبنى على الحلقات والساعات لا نقاط المسجد.
**قبول:** مسؤولة منطقةٍ نسائية ترى «١٢ حلقة نسائية» ومؤشّراتٍ ذات معنى بدل «٠ مسجد».

---

# المرحلة ر — تقارير قيادية + سجلّ التدقيق

## ر.١ رولّ-أب شبكيّ + تصدير
```ts
export async function networkRollupData(input: { section?: "men"|"women"; month: string; unitId?: string }) {
  // تجميعٌ بالنطاق: عدد المساجد/الحلقات، نسبة الإدخال، متوسّط النقاط/الساعات، المتعثّرون، اتّجاه شهريّ، إجماليات مالية لكل منطقة.
}
```
- **تصدير PDF**: قالب HTML عربيّ RTL على نمط [reportHtml.ts](app/src/server/services/reportHtml.ts) عبر مسار `GET /api/reports/network-rollup.html?...` (طباعة المتصفّح→PDF).
- **تصدير CSV**: مسار `GET /api/reports/network-rollup.csv?...` (نمط الفواصل من [csv.ts](app/src/server/utils/csv.ts)) للأرقام.
- زرّ «تصدير (PDF/CSV)» في لوحة الشبكة للإدارة.

## ر.٢ عرض سجلّ التدقيق
- قدرة جديدة `audit.view` في [capabilities.ts](app/src/lib/capabilities.ts) (للإدارة والمنطقة/رأس القسم ضمن نطاقهم).
- `auditLogData({ scope?, actor?, entity?, from?, to?, offset })` ([audit_log] table): معزولٌ بالنطاق (الإدارة=الكلّ؛ المشرف نطاقه عبر مطابقة الوحدة إن وُجدت في السجل).
- واجهة **«سجلّ التدقيق»** تبويبٌ في التهيئة: قائمةٌ زمنية (مَن/متى/الفعل/الكيان/قبل→بعد) بترشيحٍ وبحث. تُطبَّق قاعدة العرض الشجريّ (§6 من [11_navigation_model](11_navigation_model.md)) إن جُمِّعت حسب الوحدة.

## ر.٣ القبول
الإدارة تصدّر تقرير قسمٍ/شهرٍ (PDF+CSV) مطابقًا للوحة، وتفتح «سجلّ التدقيق» فترى الاعتمادات/التعديلات الأخيرة بمَن نفّذها وقيمها قبل/بعد.

---

# خلاصة الهجرات الجديدة (بالترتيب)
| هجرة | المحتوى | المرحلة |
|---|---|---|
| `0030_offline_client_uuid.sql` | `client_uuid` على lesson_sessions/attachments/lesson_attachments + فهارس | ١ |
| `0031_telegram_link.sql` | `link_token`/`link_expires` على person_contacts | ٢ |
| `0032_unit_records.sql` | `unit_id/unit_path` على weekly_records + `unit_id` على daily_entries + backfill | ٣ |
| `0033_curriculum_progress.sql` | جدول تقدّم المنهج | ٦ |

# التحقّق والنشر لكلّ مرحلة (ثابت)
1. `npx tsc --noEmit` (نظيف عدا أخطاء auth/records/totp الثلاثة المعروفة).
2. `npm run build`.
3. `npm test` (كلّ الاختبارات خضراء + الجديدة).
4. محلّيًّا: `rm -rf ./.wrangler-state/v3/d1` → `cf:migrate:local` → بذر → preview e2e.
5. إنتاجًا: `wrangler d1 migrations apply … --remote` → (عند اللزوم) `cf:seed:remote` → `npm run deploy` → تحقّق إنتاج.
6. توثيقٌ في [06_implementation_log](06_implementation_log.md).

# تقدير الحجم (تقريبيّ)
| مرحلة | حجم | مخاطر رئيسة |
|---|---|---|
| ١ أوفلاين | كبير (٣–٥ أيام) | تعارض المزامنة، تخزين الصور، دعم iOS للـSW |
| ٢ تيليغرام | متوسط (١–٢ يوم) | أمن الويبهوك، صحّة chat_id |
| ٣ أنشطة النساء | متوسط–كبير (٢–٣ أيام) | تعميم weekly_records يمسّ الشبكة/المالية |
| ٦ المنهج | متوسط (٢ يوم) | ربط المجلس بالحضور |
| ق التوسّع | متوسط (١–٢ يوم) | تكييف networkData |
| ر التقارير | متوسط (٢ يوم) | دقّة التجميع + عزل التدقيق |
