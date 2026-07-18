import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { isAdmin } from '../../utils/caps'
import { createCompetition, addProgram, addExam } from '../../services/competition'

// إعداد المسابقة: إنشاء مسابقة/برنامج شهري/اختبار — الإدارة العليا
const bodySchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('competition'), name: z.string().min(2), startMonth: z.string().optional(), endMonth: z.string().optional(), qualificationMonth: z.string().optional(), prizePool: z.number().optional() }),
  z.object({ entity: z.literal('program'), competitionId: z.string().min(1), monthHijri: z.string().min(4), track: z.enum(['worship', 'knowledge', 'activities']), title: z.string().min(2), maxPoints: z.number().int().optional() }),
  z.object({ entity: z.literal('exam'), competitionId: z.string().min(1), title: z.string().min(2), dateHijri: z.string().optional(), maxScore: z.number().int().optional() }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'إعداد المسابقة للإدارة العليا' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  if (body.entity === 'competition') return await createCompetition(db, body)
  if (body.entity === 'program') return await addProgram(db, body)
  return await addExam(db, body)
})
