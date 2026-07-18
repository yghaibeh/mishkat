import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { assignTerm } from '../../services/governance'

// تكليف بدورة (سنتان، بحدّ دورتين) — للإدارة أو مشرف نطاق الوحدة
const bodySchema = z.object({
  personId: z.string().min(1),
  role: z.string().min(1),
  orgUnitId: z.string().min(1),
  portfolio: z.string().optional(),
  startDate: z.number().int(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.orgUnitId)).all())[0]
  if (!ou) throw createError({ statusCode: 400, statusMessage: 'الوحدة التنظيمية غير موجودة' })
  if (!isGlobalAdmin(user) && !canAccessPath(user, ou.path)) {
    throw createError({ statusCode: 403, statusMessage: 'خارج نطاق صلاحيتك' })
  }

  const res = await assignTerm(db, body, user.userId)
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
