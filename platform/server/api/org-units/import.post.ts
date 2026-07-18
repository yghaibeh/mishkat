import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { parseMosqueCsv } from '../../utils/csv'
import { importMosques } from '../../services/orgUnits'

// استيراد مساجد دفعةً من CSV تحت وحدة أب (مربع غالباً) — لتهيئة إدلب
const bodySchema = z.object({
  parentId: z.string().min(1),
  csv: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const parent = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.parentId)).all())[0]
  if (!parent) throw createError({ statusCode: 400, statusMessage: 'الوحدة الأب غير موجودة' })
  if (!isGlobalAdmin(user) && !canAccessPath(user, parent.path)) {
    throw createError({ statusCode: 403, statusMessage: 'خارج نطاق صلاحيتك' })
  }

  const { rows, errors } = parseMosqueCsv(body.csv)
  const created = rows.length ? await importMosques(db, parent.id, rows, user.userId) : []
  return { created: created.length, mosques: created, errors }
})
