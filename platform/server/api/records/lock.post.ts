import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { weeklyRecords } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { canLockWeek, canUnlockWeek } from '../../utils/caps'
import { getMosqueOrThrow } from '../../utils/records'
import { setLock } from '../../services/records'

// قفل/فتح الأسبوع (ق5): القفل من الأمير فأعلى؛ الفتح للكتلة/المحافظة فأعلى حصراً
const bodySchema = z.object({
  mosqueId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locked: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const mosque = await getMosqueOrThrow(db, body.mosqueId)
  assertAccessPath(user, mosque.path)

  if (!body.locked && !canUnlockWeek(user, mosque.path)) throw createError({ statusCode: 403, statusMessage: 'فتح الأسبوع للكتلة/المحافظة فأعلى' })
  if (body.locked && !canLockWeek(user, mosque.id, mosque.path)) throw createError({ statusCode: 403, statusMessage: 'لا تملك صلاحية قفل هذا الأسبوع' })

  const rows = await db.select().from(weeklyRecords).where(and(
    eq(weeklyRecords.mosqueId, mosque.id), eq(weeklyRecords.weekStart, body.weekStart),
  )).all()
  const record = rows[0]
  if (!record) throw createError({ statusCode: 404, statusMessage: 'لا يوجد سجل لهذا الأسبوع' })

  return await setLock(db, record, user.userId, body.locked)
})
