import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { users } from '../../../database/schema'
import { requireUser } from '../../../utils/context'
import { verifyTotp } from '../../../utils/totp'

// تأكيد رمز MFA وتفعيله نهائياً
const bodySchema = z.object({ token: z.string().min(6) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { token } = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  const row = (await db.select().from(users).where(eq(users.id, user.userId)).all())[0]
  if (!row?.mfaSecret) throw createError({ statusCode: 400, statusMessage: 'لم يبدأ تفعيل MFA' })
  if (!(await verifyTotp(row.mfaSecret, token))) throw createError({ statusCode: 401, statusMessage: 'رمز غير صحيح' })
  await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.userId)).run()
  return { mfaEnabled: true }
})
