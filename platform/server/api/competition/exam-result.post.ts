import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { recordExamResult } from '../../services/competition'

// رصد نتيجة اختبار مركزي — مشرف فأعلى (مركزي)
const bodySchema = z.object({
  examId: z.string().min(1),
  participantId: z.string().min(1),
  score: z.number().int().min(0),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isSupervisor(user)) throw createError({ statusCode: 403, statusMessage: 'رصد نتائج الاختبار لمشرف فأعلى' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  return await recordExamResult(db, body)
})
