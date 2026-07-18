import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { roleAssignments } from '../../database/schema'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { requestResignation } from '../../services/governance'

// طلب استقالة من تكليف — صاحب التكليف نفسه أو الإدارة
const bodySchema = z.object({
  roleAssignmentId: z.string().min(1),
  reason: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const ra = (await db.select().from(roleAssignments).where(eq(roleAssignments.id, body.roleAssignmentId)).all())[0]
  if (!ra) throw createError({ statusCode: 404, statusMessage: 'التكليف غير موجود' })
  if (ra.personId !== user.personId && !isGlobalAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'الاستقالة لصاحب التكليف أو الإدارة' })
  }
  return await requestResignation(db, body.roleAssignmentId, ra.personId, body.reason, Date.now())
})
