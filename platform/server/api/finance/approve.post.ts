import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { approveEntitlement } from '../../services/finance'

// اعتماد المستحق آخر الشهر (ق7) — الإدارة العليا
const bodySchema = z.object({ id: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'المالية للإدارة العليا' })
  const { id } = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  const res = await approveEntitlement(db, id, user.userId)
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
