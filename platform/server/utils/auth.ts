import { SignJWT, jwtVerify } from 'jose'

// تجزئة كلمات المرور وتوقيع الرموز — كلها عبر Web Crypto المتوافق مع Cloudflare Workers
const encoder = new TextEncoder()
const ITERATIONS = 100_000

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256,
  )
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = fromB64(parts[2])
  const key = await crypto.subtle.importKey('raw', encoder.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256,
  )
  const calc = toB64(new Uint8Array(bits))
  // مقارنة ثابتة الزمن
  if (calc.length !== parts[3].length) return false
  let diff = 0
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ parts[3].charCodeAt(i)
  return diff === 0
}

export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encoder.encode(secret))
}

export async function verifyToken<T = Record<string, unknown>>(token: string, secret: string): Promise<T> {
  const { payload } = await jwtVerify(token, encoder.encode(secret))
  return payload as T
}
