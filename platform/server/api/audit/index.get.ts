import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { auditLog } from '../../database/schema'
import { requireUser, isGlobalAdmin } from '../../utils/context'

// عرض سجل التدقيق — الإدارة العليا (الباب الخامس: حق الاطلاع)
const querySchema = z.object({
  entity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'سجل التدقيق للإدارة العليا' })
  const q = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  const rows = q.entity
    ? await db.select().from(auditLog).where(eq(auditLog.entity, q.entity)).orderBy(desc(auditLog.at)).limit(q.limit).all()
    : await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(q.limit).all()
  return rows
})
