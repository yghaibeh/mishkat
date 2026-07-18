import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { qualifyTop, selectWinner } from '../../services/competition'

// التصفية النهائية واختيار الفائز — الإدارة العليا
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('qualify'), competitionId: z.string().min(1), topN: z.number().int().positive() }),
  z.object({ action: z.literal('winner'), competitionId: z.string().min(1) }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'التصفية للإدارة العليا' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  if (body.action === 'qualify') return await qualifyTop(db, body.competitionId, body.topN)
  const res = await selectWinner(db, body.competitionId)
  if ('error' in res) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
