import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { users, persons } from '../../database/schema'
import { verifyPassword, signToken } from '../../utils/auth'
import { verifyTotp } from '../../utils/totp'
import { isRateLimited, recordFailedAttempt, resetAttempts, issueRefreshToken } from '../../services/authTokens'

const bodySchema = z.object({ login: z.string(), password: z.string(), totp: z.string().optional() })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  // حدّ المحاولات (5 خلال 15 دقيقة)
  if (await isRateLimited(db, body.login)) {
    throw createError({ statusCode: 429, statusMessage: 'محاولات كثيرة — حاول لاحقاً' })
  }

  const rows = await db.select().from(users).where(eq(users.login, body.login)).all()
  const user = rows[0]
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    await recordFailedAttempt(db, body.login)
    throw createError({ statusCode: 401, statusMessage: 'بيانات الدخول غير صحيحة' })
  }
  // المصادقة الثنائية إن كانت مفعّلة
  if (user.mfaEnabled) {
    if (!body.totp) throw createError({ statusCode: 401, statusMessage: 'mfa_required' })
    if (!user.mfaSecret || !(await verifyTotp(user.mfaSecret, body.totp))) {
      await recordFailedAttempt(db, body.login)
      throw createError({ statusCode: 401, statusMessage: 'رمز MFA غير صحيح' })
    }
  }
  await resetAttempts(db, body.login)
  await db.update(users).set({ lastLogin: Date.now() }).where(eq(users.id, user.id)).run()

  const personRows = await db.select().from(persons).where(eq(persons.id, user.personId)).all()
  const cfg = useRuntimeConfig(event)
  const token = await signToken({ sub: user.id, pid: user.personId }, cfg.jwtSecret)
  const refreshToken = await issueRefreshToken(db, user.id)
  return { token, refreshToken, user: { id: user.id, fullName: personRows[0]?.fullName ?? '' } }
})
