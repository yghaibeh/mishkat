import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { meetingQuorum } from '../../services/meetings'

const querySchema = z.object({ meetingId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { meetingId } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  const res = await meetingQuorum(db, meetingId)
  if ('error' in res) throw createError({ statusCode: 404, statusMessage: res.error })
  return res
})
