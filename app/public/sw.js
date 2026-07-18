// Service Worker يدويّ لمشكاة — تخبئةٌ زمن-التشغيل (Cache API) للعمل دون اتصال.
// يعمل مع الأصول المُجزَّأة (hashed) بلا precache-manifest. لا يُخبّئ عمليات الكتابة (تعالجها طبقة Outbox).
const V = "mishkat-v2"; // ترقيةٌ تطهّر مخابئ v1 القديمة كلَّها (انقسام النسخ — ٢٠٢٦-٠٧-١٨)
const SHELL = V + "-shell";
const ASSETS = V + "-assets";

// صفحة سقوطٍ مضمّنة (لا تُجلَب من مسارٍ قد يُعاد توجيهه) — للصفحات غير المزارة سابقًا دون اتصال.
const OFFLINE_HTML = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>دون اتصال — مشكاة</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,Tahoma,sans-serif;background:#f8fafc;color:#0f172a}.c{text-align:center;max-width:22rem;padding:2rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{font-size:.9rem;color:#475569;line-height:1.7}.d{width:10px;height:10px;border-radius:999px;background:#f59e0b;display:inline-block;margin-inline-end:6px}</style></head><body><div class="c"><h1>مِشكاة</h1><p><span class="d"></span>أنت الآن دون اتصال.</p><p>يمكنك متابعة الإدخال — سيُحفَظ محلّيًّا ويُزامَن تلقائيًّا فور عودة الشبكة.</p></div></body></html>';
const offlineResponse = () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });

self.addEventListener("install", (e) => {
  e.waitUntil(Promise.resolve().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return; // الكتابة للشبكة (Outbox يتكفّل بالأوفلاين)
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // HTML: شبكة أولًا، وإلا القشرة المخبّأة، وإلا صفحة الأوفلاين
    e.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((m) => m || offlineResponse())),
    );
    return;
  }

  // ملاحظة (ط٣): /media مُستوثَقٌ خاصٌّ بجمهوره الآن — لا يُخبَّأ (كان الكاش يخدمه لمستخدمٍ آخر بلا إعادة فحص).
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icon") || url.pathname.startsWith("/baseera/")) {
    // أصول: من الكاش فورًا مع تحديثٍ في الخلفية (StaleWhileRevalidate)
    e.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        const net = fetch(request).then((res) => { if (res && res.status === 200) cache.put(request, res.clone()); return res; }).catch(() => cached);
        return cached || net;
      }),
    );
  }
});

// مزامنة الخلفية (حيثما دُعِمت) — يطلب من العملاء تفريغ الطابور
self.addEventListener("sync", (e) => {
  if (e.tag === "mishkat-outbox") e.waitUntil(notifyFlush());
});
async function notifyFlush() {
  const cs = await self.clients.matchAll({ includeUncontrolled: true });
  cs.forEach((c) => c.postMessage({ type: "flush-outbox" }));
}

// FR2.4 — Web Push: عرض إشعار المتصفّح من الحمولة المُعمّاة (aes128gcm يفكّها المتصفّح)
self.addEventListener("push", (e) => {
  let data = { title: "مِشكاة", body: "لديك إشعارٌ جديد", url: "/" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  }));
});

// النقر على الإشعار: يفتح الرابط أو يُركّز تبويبًا مفتوحًا على الأصل
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) { if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(target); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
