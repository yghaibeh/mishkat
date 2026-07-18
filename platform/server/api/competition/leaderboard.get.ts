import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { leaderboard } from '../../services/competition'

// الترتيب العام للمسابقة — منشور لكل مستخدم (فلسفة التفاعل، ق4)
const querySchema = z.object({ competitionId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { competitionId } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  return await leaderboard(db, competitionId)
})
