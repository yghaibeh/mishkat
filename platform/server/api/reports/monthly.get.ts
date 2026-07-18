import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { monthlyMosqueReport } from '../../services/reports'

// التقرير الشهري المولّد لمسجد — ضمن نطاق المستخدم
const querySchema = z.object({
  mosqueId: z.string().min(1),
  month: z.string().min(4),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { mosqueId, month } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)

  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0]
  if (!mosque) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
  assertAccessPath(user, mosque.path)

  return await monthlyMosqueReport(db, mosqueId, month)
})
