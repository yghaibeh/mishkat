import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { registerParticipant } from '../../services/competition'

// تسجيل مشترك في مسابقة — يتطلب وصولاً لمسجده (أمير/لجنة/مشرف)
const bodySchema = z.object({
  competitionId: z.string().min(1),
  personId: z.string().min(1),
  mosqueId: z.string().min(1),
  age: z.number().int(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.mosqueId)).all())[0]
  if (!mosque) throw createError({ statusCode: 400, statusMessage: 'المسجد غير موجود' })
  assertAccessPath(user, mosque.path)

  const res = await registerParticipant(db, body, user.userId)
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
