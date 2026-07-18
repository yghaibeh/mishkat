import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { users } from '../../../database/schema'
import { requireUser } from '../../../utils/context'
import { randomBase32Secret, otpauthUri } from '../../../utils/totp'

// بدء تفعيل MFA: يولّد سرّاً (غير مُفعّل بعد) ويعيد رابط otpauth للمسح
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb(event)
  const secret = randomBase32Secret()
  await db.update(users).set({ mfaSecret: secret, mfaEnabled: false }).where(eq(users.id, user.userId)).run()
  return { secret, otpauthUri: otpauthUri(secret, user.fullName) }
})
