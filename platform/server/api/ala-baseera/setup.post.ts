import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { createVenue, createTeacher, createHalaqa, enrollStudent } from '../../services/alaBaseera'

// إعداد «على بصيرة»: مكان/معلّم/حلقة/تسجيل — للإدارة أو مشرف (إجراء واحد بنوع entity)
const bodySchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('venue'), type: z.enum(['mosque', 'institute', 'home']), name: z.string().min(2), orgUnitId: z.string().optional(), genderTrack: z.enum(['male', 'female']).optional() }),
  z.object({ entity: z.literal('teacher'), personId: z.string().min(1), qualification: z.string().optional() }),
  z.object({ entity: z.literal('halaqa'), name: z.string().min(2), venueId: z.string().min(1), teacherId: z.string().min(1), genderTrack: z.enum(['male', 'female']).optional(), capacity: z.number().int().optional() }),
  z.object({ entity: z.literal('enroll'), halaqaId: z.string().min(1), personId: z.string().min(1) }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isSupervisor(user)) throw createError({ statusCode: 403, statusMessage: 'إعداد «على بصيرة» لمشرف فأعلى' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  switch (body.entity) {
    case 'venue': return await createVenue(db, body)
    case 'teacher': return await createTeacher(db, body)
    case 'halaqa': return await createHalaqa(db, body)
    case 'enroll': {
      const res = await enrollStudent(db, body.halaqaId, body.personId)
      if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
      return res
    }
  }
})
