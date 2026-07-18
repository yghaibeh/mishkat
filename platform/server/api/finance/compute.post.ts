import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { computeMonthlyEntitlement } from '../../services/finance'

// ترشيح المستحق الشهري لشخص (الإدارة العليا)
const bodySchema = z.object({
  personId: z.string().min(1),
  month: z.string().min(4),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'المالية للإدارة العليا' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  return await computeMonthlyEntitlement(db, body.personId, body.month, user.userId)
})
