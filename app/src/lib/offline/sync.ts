import { toast } from "sonner";
import { flush } from "./outbox";

// مُشغِّلات تفريغ الطابور: عند عودة الشبكة، عند العودة للتبويب، دوريًّا، ورسائل الـSW.
let started = false;
export function startSync() {
  if (typeof window === "undefined" || started) return;
  started = true;
  // عنصرٌ رُفض دائمًا (تحقّقٌ/صلاحيّة/أرشفة) — نُعلم المستخدمَ بدل إسقاطه صامتًا (ق٣)
  window.addEventListener("outbox-dropped", (e) => {
    const d = (e as CustomEvent<{ reason?: string }>).detail;
    toast.error("تعذّر حفظ إدخالٍ مؤجَّل", { description: d?.reason || "رُفض من الخادم — راجِع البيانات وأعد الإدخال." });
  });
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void flush(); });
  window.setInterval(() => void flush(), 30_000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "flush-outbox") void flush();
    });
  }
  void flush();
}

// تسجيل الـservice worker (PWA) — تخبئة زمن-التشغيل للعمل دون اتصال.
export function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // الحلُّ الجذريّ لانقسام النسخ (بلاغ المالك: «منظرٌ مختلفٌ جذريًّا بين تبويبين»):
  // التطبيقُ SPA — التنقّلُ الداخليُّ يحمّل قطعَ صفحاتٍ مُجزَّأة؛ بعد النشر قد تُخدم قطعةٌ
  // قديمةٌ من الكاش بجانب قطعٍ جديدة (خليطُ نسختين). العلاجُ المعياريّ:
  // (أ) فشلُ استيراد قطعةٍ ديناميكيًّا ⇒ إعادةُ تحميلٍ فوريّة (HTML الجديد يجلب القطعَ الجديدة)
  window.addEventListener("vite:preloadError", () => { window.location.reload(); });
  // (ب) تولّي ServiceWorker جديدٍ (نشرةٌ جديدة) ⇒ إعادةُ تحميلٍ مرّةً واحدةً لتوحيد النسخة
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return; reloaded = true;
    if (navigator.serviceWorker.controller) window.location.reload();
  });
  const doReg = () => { void navigator.serviceWorker.register("/sw.js").then((r) => r.update().catch(() => {})).catch(() => {}); };
  // إن كانت الصفحة قد حُمِّلت أصلًا (useEffect بعد load) نُسجّل فورًا، وإلا ننتظر load
  if (document.readyState === "complete") doReg();
  else window.addEventListener("load", doReg, { once: true });
}
