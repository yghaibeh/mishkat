// TOTP (RFC 6238) عبر Web Crypto — بلا تبعيات، متوافق مع Workers. للمصادقة الثنائية (MFA).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return new Uint8Array(out)
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function randomBase32Secret(len = 20): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(len)))
}

export async function totp(secretBase32: string, opts?: { time?: number; step?: number; digits?: number }): Promise<string> {
  const step = opts?.step ?? 30
  const digits = opts?.digits ?? 6
  const time = opts?.time ?? Math.floor(Date.now() / 1000)
  let counter = Math.floor(time / step)
  const msg = new Uint8Array(8)
  for (let i = 7; i >= 0; i--) { msg[i] = counter & 0xff; counter = Math.floor(counter / 256) }
  const key = await crypto.subtle.importKey('raw', base32Decode(secretBase32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const offset = sig[19] & 0x0f
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3]
  return (bin % 10 ** digits).toString().padStart(digits, '0')
}

// تحقق مع نافذة تسامح ±window خطوات (لانحراف الساعة)
export async function verifyTotp(secretBase32: string, token: string, opts?: { time?: number; step?: number; digits?: number; window?: number }): Promise<boolean> {
  const w = opts?.window ?? 1
  const step = opts?.step ?? 30
  const time = opts?.time ?? Math.floor(Date.now() / 1000)
  for (let i = -w; i <= w; i++) {
    if (await totp(secretBase32, { time: time + i * step, step, digits: opts?.digits }) === token) return true
  }
  return false
}

// رابط otpauth لتطبيقات المصادقة (Google Authenticator…)
export function otpauthUri(secretBase32: string, account: string, issuer = 'المسجد المؤثر'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}`
}
