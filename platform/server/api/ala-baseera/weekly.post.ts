import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { addGroupActivity, upsertWeeklyHalaqaRecord, addStudentEvaluation } from '../../services/halaqaWeekly'

// حلقات «على بصيرة» الأسبوعية: نشاط جماعي/سجل أسبوعي/تقييم طالب
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('group-activity'), halaqaId: z.string().min(1), weekStart: z.string().min(8), description: z.string().min(2), dateHijri: z.string().optional() }),
  z.object({ action: z.literal('weekly-record'), halaqaId: z.string().min(1), weekStart: z.string().min(8), supervisorNotes: z.string().optional(), adminNotes: z.string().optional() }),
  z.object({ action: z.literal('evaluation'), enrollmentId: z.string().min(1), lessonSessionId: z.string().min(1), score: z.number().int().optional(), note: z.string().optional() }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  if (body.action === 'group-activity') {
    const r = await addGroupActivity(db, body)
    if (r.error) throw createError({ statusCode: 400, statusMessage: r.error })
    return r
  }
  if (body.action === 'weekly-record') {
    // ملاحظات الإدارة لمشرف فأعلى
    if (body.adminNotes && !isSupervisor(user)) throw createError({ statusCode: 403, statusMessage: 'ملاحظات الإدارة لمشرف فأعلى' })
    return await upsertWeeklyHalaqaRecord(db, body.halaqaId, body.weekStart, body)
  }
  return await addStudentEvaluation(db, body)
})
