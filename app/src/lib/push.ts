// FR2.4 — Web Push من جهة العميل: اشتراك/إلغاء + حالة الدعم.
import { getPushPublicKey, savePushSubscription, deletePushSubscription } from "@/lib/api/notifications";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyB64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const buf = sub.getKey(name);
  if (!buf) return "";
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// هل هذا الجهاز مشترِكٌ حاليًّا؟
export async function pushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

// يشترك هذا الجهاز في الإشعارات؛ يعيد "ok" أو سبب الفشل.
export async function subscribePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: "المتصفّح لا يدعم الإشعارات." };
  const { key, configured } = await getPushPublicKey();
  if (!configured || !key) return { ok: false, reason: "خدمة الإشعارات غير مُفعَّلة على الخادم بعد." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "لم يُسمَح بالإشعارات." };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) as BufferSource }));
    const res = await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: keyB64(sub, "p256dh"), auth: keyB64(sub, "auth") } });
    if (res && "error" in res && res.error) return { ok: false, reason: res.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? "تعذّر الاشتراك." };
  }
}

// يلغي اشتراك هذا الجهاز (محلّيًّا وعلى الخادم).
export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (!pushSupported()) return { ok: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    return { ok: true };
  } catch { return { ok: false }; }
}
