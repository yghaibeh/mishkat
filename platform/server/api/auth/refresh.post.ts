import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { users } from '../../database/schema'
import { signToken } from '../../utils/auth'
import { rotateRefreshToken } from '../../services/authTokens'

// تجديد رمز الوصول عبر تدوير رمز التحديث
const bodySchema = z.object({ refreshToken: z.string().min(10) })

export default defineEventHandler(async (event) => {
  const { refreshToken } = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const res = await rotateRefreshToken(db, refreshToken)
  if (res.error || !res.userId) throw createError({ statusCode: 401, statusMessage: res.error ?? 'رمز غير صالح' })

  const user = (await db.select().from(users).where(eq(users.id, res.userId)).all())[0]
  if (!user) throw createError({ statusCode: 401, statusMessage: 'المستخدم غير موجود' })

  const cfg = useRuntimeConfig(event)
  const token = await signToken({ sub: user.id, pid: user.personId }, cfg.jwtSecret)
  return { token, refreshToken: res.refreshToken }
})
