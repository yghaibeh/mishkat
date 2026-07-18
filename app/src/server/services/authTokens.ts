import { and, eq } from 'drizzle-orm'
import { refreshTokens, authAttempts } from '../database/schema'
import type { Db } from '../utils/db'

// تصلّب المصادقة: رموز تحديث قابلة للتدوير/الإبطال + حدّ محاولات الدخول.

const DAY = 86_400_000

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function issueRefreshToken(db: Db, userId: string, ttlDays = 30): Promise<string> {
  const token = randomToken()
  const tokenHash = await sha256hex(token)
  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(), userId, tokenHash, expiresAt: Date.now() + ttlDays * DAY, revoked: false, createdAt: Date.now(),
  }).run()
  return token
}

// تدوير الرمز: يتحقق ويُبطل القديم ويُصدر جديداً (token rotation)
export async function rotateRefreshToken(db: Db, oldToken: string): Promise<{ refreshToken?: string; userId?: string; error?: string }> {
  const hash = await sha256hex(oldToken)
  const row = (await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).all())[0]
  if (!row || row.revoked || row.expiresAt < Date.now()) return { error: 'رمز تحديث غير صالح' }
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, row.id)).run()
  const refreshToken = await issueRefreshToken(db, row.userId)
  return { refreshToken, userId: row.userId }
}

export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  const hash = await sha256hex(token)
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.tokenHash, hash)).run()
}

// حدّ محاولات الدخول: نافذة 15 دقيقة، 5 محاولات فاشلة كحد أقصى
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export async function isRateLimited(db: Db, key: string, asOf = Date.now()): Promise<boolean> {
  const row = (await db.select().from(authAttempts).where(eq(authAttempts.key, key)).all())[0]
  if (!row) return false
  if (asOf - row.windowStart > WINDOW_MS) return false // النافذة انتهت
  return row.count >= MAX_ATTEMPTS
}

export async function recordFailedAttempt(db: Db, key: string, asOf = Date.now()): Promise<void> {
  const row = (await db.select().from(authAttempts).where(eq(authAttempts.key, key)).all())[0]
  if (!row || asOf - row.windowStart > WINDOW_MS) {
    if (row) await db.update(authAttempts).set({ count: 1, windowStart: asOf }).where(eq(authAttempts.key, key)).run()
    else await db.insert(authAttempts).values({ key, count: 1, windowStart: asOf }).run()
    return
  }
  await db.update(authAttempts).set({ count: row.count + 1 }).where(eq(authAttempts.key, key)).run()
}

export async function resetAttempts(db: Db, key: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, key)).run()
}
