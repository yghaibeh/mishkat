// إرسال Web Push من Cloudflare Workers بـ WebCrypto فقط (لا مكتبات Node).
// يطبّق: VAPID (RFC 8292، توقيع ES256) + تعمية الحمولة aes128gcm (RFC 8291/8188).
// مرجعٌ للأعلام والترتيب: RFC 8291 §3.4 (اشتقاق المفتاح) وRFC 8188 (ترميز aes128gcm).

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateKey: string; subject: string };
export type PushResult = { ok: boolean; status: number; gone: boolean };

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// HKDF(salt, ikm, info, L) عبر WebCrypto (Extract+Expand مدمجان)
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

// استيراد مفتاح VAPID الخاصّ (سلَميّ ٣٢ بايت) + العموميّ (نقطة ٦٥ بايت) كـ ECDSA للتوقيع
async function importVapidPrivate(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const pub = b64urlToBytes(publicKey);   // 0x04 || X(32) || Y(32)
  const d = b64urlToBytes(privateKey);    // 32 بايت
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(d),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// توقيع JWT بصيغة VAPID: header.payload.signature (التوقيع r||s خام ٦٤ بايت)
async function buildVapidJwt(endpoint: string, vapid: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject,
  })));
  const signingInput = `${header}.${body}`;
  const priv = await importVapidPrivate(vapid.publicKey, vapid.privateKey);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, enc.encode(signingInput)));
  return `${signingInput}.${bytesToB64url(sig)}`;
}

// تعمية الحمولة وفق aes128gcm: تُعيد جسم الطلب (salt||rs||idlen||as_public||ciphertext)
async function encryptPayload(sub: PushSub, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(sub.p256dh); // 65 بايت
  const authSecret = b64urlToBytes(sub.auth); // 16 بايت
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // مفتاح الخادم العابر (ECDH) + السرّ المشترك
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey)); // 65 بايت
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));

  // IKM = HKDF(salt=auth, ikm=shared, info="WebPush: info\0"||ua_public||as_public, 32)
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // سجلٌّ واحد: الحمولة + فاصل السجلّ الأخير 0x02
  const record = concat(payload, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, record as BufferSource));

  // ترويسة aes128gcm: salt(16) || rs(uint32 BE) || idlen(1)=65 || keyid(as_public 65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // recordSize
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, ct);
}

// يرسل إشعارًا واحدًا لاشتراكٍ واحد. gone=true ⇒ اشتراكٌ منتهٍ (404/410) يجب حذفه.
export async function sendWebPush(sub: PushSub, message: { title: string; body: string; url?: string }, vapid: Vapid): Promise<PushResult> {
  try {
    const payload = enc.encode(JSON.stringify(message));
    const body = await encryptPayload(sub, payload);
    const jwt = await buildVapidJwt(sub.endpoint, vapid);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${vapid.publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
      },
      body: body as BodyInit,
    });
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch {
    return { ok: false, status: 0, gone: false };
  }
}
