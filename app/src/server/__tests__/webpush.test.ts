import { describe, it, expect, afterEach } from "vitest";
import { sendWebPush } from "@/server/utils/webpush";

// اختبارٌ حاسمٌ لتعمية Web Push المكتوبة يدويًّا: نُعمّي ثمّ نفكّ بالطرف المقابل (UA)
// ونتحقّق من توقيع VAPID — يثبت مطابقة RFC 8291/8292 دون الاعتماد على مكتبة.

const enc = new TextEncoder();
const dec = new TextDecoder();
function b64url(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, k, len * 8));
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe("Web Push (WebCrypto aes128gcm + VAPID)", () => {
  it("يُعمّي حمولةً يفكّها المشترِك، ويوقّع VAPID توقيعًا صحيحًا", async () => {
    // اشتراك المتصفّح (UA): زوج ECDH + سرّ auth
    const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const uaPub = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const sub = { endpoint: "https://push.example.com/xyz", p256dh: b64url(uaPub), auth: b64url(authSecret) };

    // مفاتيح VAPID (ECDSA)
    const vk = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const vkPub = new Uint8Array(await crypto.subtle.exportKey("raw", vk.publicKey));
    const vkJwk = await crypto.subtle.exportKey("jwk", vk.privateKey);
    const vapid = { publicKey: b64url(vkPub), privateKey: vkJwk.d!, subject: "mailto:a@b.c" };

    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => { captured = { url, init }; return new Response(null, { status: 201 }); }) as typeof fetch;

    const msg = { title: "أسبوعٌ يحتاج اعتمادكم", body: "يحتاج مسجد «النور» اعتمادكم.", url: "/mosque/m1?t=report" };
    const res = await sendWebPush(sub, msg, vapid);
    expect(res.ok).toBe(true);
    expect(captured).toBeTruthy();
    const { url, init } = captured!;
    expect(url).toBe(sub.endpoint);
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");

    // ١) توقيع VAPID صحيح ويحمل المفتاح العموميّ
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(headers["Authorization"]);
    expect(m).toBeTruthy();
    expect(m![2]).toBe(vapid.publicKey);
    const [h, p, s] = m![1].split(".");
    const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vk.publicKey, fromB64url(s) as BufferSource, enc.encode(`${h}.${p}`));
    expect(verified).toBe(true);
    const claims = JSON.parse(dec.decode(fromB64url(p)));
    expect(claims.aud).toBe("https://push.example.com");
    expect(claims.sub).toBe("mailto:a@b.c");

    // ٢) فكّ الحمولة بمفتاح المشترِك الخاصّ ⇒ يطابق الرسالة الأصلية
    const body = new Uint8Array(init.body as ArrayBuffer);
    const salt = body.slice(0, 16);
    const idlen = body[20];
    expect(idlen).toBe(65);
    const asPublic = body.slice(21, 21 + idlen);
    const ct = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
    const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPublic), 32);
    const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
    const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ct));
    expect(plain[plain.length - 1]).toBe(2); // فاصل السجلّ الأخير
    const obj = JSON.parse(dec.decode(plain.slice(0, plain.length - 1)));
    expect(obj).toEqual(msg);
  });

  it("يعيد gone=true عند اشتراكٍ منتهٍ (410)", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 410 })) as typeof fetch;
    const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const uaPub = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const vk = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]) as CryptoKeyPair;
    const vkPub = new Uint8Array(await crypto.subtle.exportKey("raw", vk.publicKey));
    const vkJwk = await crypto.subtle.exportKey("jwk", vk.privateKey);
    const r = await sendWebPush(
      { endpoint: "https://push.example.com/gone", p256dh: b64url(uaPub), auth: b64url(crypto.getRandomValues(new Uint8Array(16))) },
      { title: "t", body: "b" },
      { publicKey: b64url(vkPub), privateKey: vkJwk.d!, subject: "mailto:a@b.c" },
    );
    expect(r.ok).toBe(false);
    expect(r.gone).toBe(true);
  });
});
