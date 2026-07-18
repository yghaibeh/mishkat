import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { decideResignation } from '../../services/governance'

// البتّ في الاستقالة (قبول/رفض) — مشرف فأعلى
const bodySchema = z.object({
  resignationId: z.string().min(1),
  accept: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isSupervisor(user)) throw createError({ statusCode: 403, statusMessage: 'البتّ في الاستقالة لمشرف فأعلى' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  const res = await decideResignation(db, body.resignationId, body.accept, user.userId, Date.now())
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
