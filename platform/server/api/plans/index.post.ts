import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { createPlan, addPlanItem, setItemStatus } from '../../services/plans'

// خطط اللجان السنوية: إنشاء خطة/بند/تحديث حالة (المواد 21، 24–33)
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plan'), orgUnitId: z.string().min(1), committee: z.string().min(1), yearHijri: z.string().min(4), title: z.string().min(2) }),
  z.object({ action: z.literal('item'), planId: z.string().min(1), title: z.string().min(2), dueAt: z.number().int().optional() }),
  z.object({ action: z.literal('item-status'), itemId: z.string().min(1), status: z.enum(['planned', 'in_progress', 'done']) }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  if (body.action === 'plan') {
    const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.orgUnitId)).all())[0]
    if (!ou) throw createError({ statusCode: 404, statusMessage: 'الوحدة غير موجودة' })
    assertAccessPath(user, ou.path)
    return await createPlan(db, body)
  }
  if (body.action === 'item') return await addPlanItem(db, body.planId, body.title, body.dueAt)
  return await setItemStatus(db, body.itemId, body.status)
})
