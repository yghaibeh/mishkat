import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { createCircle, addStudent, addProgress } from '../../services/tahfeez'

// حلقات التحفيظ: إنشاء حلقة/طالب/تقدّم (المادة 29)
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('circle'), mosqueId: z.string().min(1), name: z.string().min(2), teacherPersonId: z.string().optional() }),
  z.object({ action: z.literal('student'), circleId: z.string().min(1), personId: z.string().min(1) }),
  z.object({ action: z.literal('progress'), studentId: z.string().min(1), scope: z.string().optional(), fromAyah: z.number().int().optional(), toAyah: z.number().int().optional(), rating: z.number().int().optional(), dateHijri: z.string().optional() }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  if (body.action === 'circle') {
    const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.mosqueId)).all())[0]
    if (!m) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
    assertAccessPath(user, m.path)
    return await createCircle(db, body)
  }
  if (body.action === 'student') return await addStudent(db, body.circleId, body.personId)
  return await addProgress(db, body)
})
