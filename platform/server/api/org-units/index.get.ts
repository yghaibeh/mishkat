import { like, or } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { descendantPattern } from '../../utils/orgPath'

// قائمة الوحدات التنظيمية ضمن نطاق المستخدم فقط (القاعدة الذهبية)
export default defineEventHandler(async (event) => {
  const u = await requireUser(event)
  const db = useDb(event)

  if (isGlobalAdmin(u)) {
    return await db.select().from(orgUnits).all()
  }
  const patterns = u.assignments.map((a) => like(orgUnits.path, descendantPattern(a.orgPath)))
  if (!patterns.length) return []
  return await db.select().from(orgUnits).where(or(...patterns)).all()
})
