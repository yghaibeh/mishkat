import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { ORG_TYPES } from '../../utils/rbac'
import { createOrgUnit } from '../../services/orgUnits'

// إنشاء وحدة تنظيمية (لبناء الشجرة) — جذر: للإدارة العليا فقط؛ غيره: لمشرف نطاق الأب
const bodySchema = z.object({
  parentId: z.string().nullable(),
  type: z.enum(ORG_TYPES),
  genderTrack: z.enum(['male', 'female']).default('male'),
  name: z.string().min(2),
  city: z.string().optional(),
  district: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  if (!body.parentId) {
    if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'إنشاء الجذر للإدارة العليا فقط' })
  } else {
    const parent = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.parentId)).all())[0]
    if (!parent) throw createError({ statusCode: 400, statusMessage: 'الوحدة الأب غير موجودة' })
    if (!isGlobalAdmin(user) && !canAccessPath(user, parent.path)) {
      throw createError({ statusCode: 403, statusMessage: 'خارج نطاق صلاحيتك' })
    }
  }
  return await createOrgUnit(db, body, user.userId)
})
