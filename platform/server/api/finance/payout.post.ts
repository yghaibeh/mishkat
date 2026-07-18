import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { recordPayout } from '../../services/finance'

// تسجيل المبلغ المصروف فعلاً (ق7) — صلاحية مالية (الإدارة العليا)
const bodySchema = z.object({
  entitlementId: z.string().min(1),
  paidAmount: z.number().min(0),
  reference: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'الصرف للإدارة العليا' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  const res = await recordPayout(db, body.entitlementId, body.paidAmount, user.userId, body.reference)
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
