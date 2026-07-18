import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { planProgress } from '../../services/plans'

const querySchema = z.object({ planId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { planId } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  return await planProgress(db, planId)
})
