import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { weeklyRecords } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { isAmirOf, isLayerApprover, isAdmin } from '../../utils/caps'
import { getMosqueOrThrow } from '../../utils/records'
import { approveRecord } from '../../services/records'

// سلسلة اعتماد السجل (ق1): مسودة → اعتماد الأمير → اعتماد أعلى طبقة مفعّلة
const bodySchema = z.object({
  mosqueId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const mosque = await getMosqueOrThrow(db, body.mosqueId)
  assertAccessPath(user, mosque.path)

  const rows = await db.select().from(weeklyRecords).where(and(
    eq(weeklyRecords.mosqueId, mosque.id), eq(weeklyRecords.weekStart, body.weekStart),
  )).all()
  const record = rows[0]
  if (!record) throw createError({ statusCode: 404, statusMessage: 'لا يوجد سجل لهذا الأسبوع' })

  const res = await approveRecord(db, record, {
    isAmir: isAmirOf(user, mosque.id),
    isLayer: isLayerApprover(user, mosque.path),
    isAdmin: isAdmin(user),
    userId: user.userId,
  })
  if (res.error) throw createError({ statusCode: 403, statusMessage: res.error })
  return res
})
