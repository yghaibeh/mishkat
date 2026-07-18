import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { teachers } from '../../database/schema'
import { requireUser } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { recordLesson } from '../../services/alaBaseera'

// تسجيل جلسة درس «على بصيرة» — المعلّم نفسه أو مشرف فأعلى
const bodySchema = z.object({
  halaqaId: z.string().min(1),
  teacherId: z.string().min(1),
  durationHours: z.number().positive(),
  dateHijri: z.string().optional(),
  hijriMonth: z.string().optional(),
  lessonTitle: z.string().optional(),
  majlis: z.string().optional(),
  materials: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const teacher = (await db.select().from(teachers).where(eq(teachers.id, body.teacherId)).all())[0]
  const isOwnTeacher = teacher?.personId === user.personId
  if (!isSupervisor(user) && !isOwnTeacher) throw createError({ statusCode: 403, statusMessage: 'تسجيل الدرس للمعلّم أو مشرف فأعلى' })

  const res = await recordLesson(db, body, user.userId)
  if (res.error) throw createError({ statusCode: 400, statusMessage: res.error })
  return res
})
