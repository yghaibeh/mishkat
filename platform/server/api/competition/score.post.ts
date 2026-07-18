import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { participants, orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { recordScore } from '../../services/competition'

// رصد نقاط نشاط شهري للمشترك — يتطلب وصولاً لمسجده
const bodySchema = z.object({
  participantId: z.string().min(1),
  programId: z.string().min(1),
  points: z.number().int().min(0),
  excuseStatus: z.enum(['none', 'excused']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const p = (await db.select().from(participants).where(eq(participants.id, body.participantId)).all())[0]
  if (!p) throw createError({ statusCode: 404, statusMessage: 'المشترك غير موجود' })
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, p.mosqueId)).all())[0]
  if (mosque) assertAccessPath(user, mosque.path)

  return await recordScore(db, body, user.userId)
})
