import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { currentScheme } from '../../utils/scheme'

// أنشطة المسار (رجال/نساء) بأوزانها من المخطط الساري — لتغذية شاشة «سجل اليوم» (ق6)
const querySchema = z.object({ track: z.enum(['male', 'female']) })

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { track } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  const sc = await currentScheme(db, track)
  if (!sc) throw createError({ statusCode: 404, statusMessage: 'لا يوجد مخطط لهذا المسار' })
  return {
    weeklyTarget: sc.scheme.weeklyTarget,
    activities: sc.items.map((i) => ({
      activityTypeId: i.activityTypeId, code: i.code, name: i.name, points: i.points,
    })),
  }
})
