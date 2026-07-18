import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { roleAssignments, orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { ROLES, type Role } from '../../utils/rbac'
import { writeAudit } from '../../utils/audit'

// منح دور لشخص ضمن وحدة تنظيمية (ق4: المشرف الأعلى يمنح الصلاحيات)
const bodySchema = z.object({
  personId: z.string().min(1),
  role: z.string().min(1),
  orgUnitId: z.string().min(1),
  portfolio: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const granter = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const ouRows = await db.select().from(orgUnits).where(eq(orgUnits.id, body.orgUnitId)).all()
  const ou = ouRows[0]
  if (!ou) throw createError({ statusCode: 400, statusMessage: 'الوحدة التنظيمية غير موجودة' })

  // الصلاحية: المانح إمّا إدارة عليا أو مشرف نطاقه يشمل هذه الوحدة
  if (!isGlobalAdmin(granter) && !canAccessPath(granter, ou.path)) {
    throw createError({ statusCode: 403, statusMessage: 'لا تملك صلاحية المنح في هذا النطاق' })
  }

  // تعيين الأمير يتطلب مصادقة الإدارة العليا (ق1/المادة 15):
  // إن لم يكن المانح إدارة عليا، يدخل التكليف بحالة pending حتى يُعتمد
  const needsApproval = body.role === ROLES.AMIR && !isGlobalAdmin(granter)

  const id = crypto.randomUUID()
  const now = Date.now()
  await db.insert(roleAssignments).values({
    id, personId: body.personId, role: body.role as Role, orgUnitId: ou.id, orgPath: ou.path,
    portfolio: body.portfolio ?? null, startDate: now, endDate: null, termNumber: 1,
    approvalStatus: needsApproval ? 'pending' : 'approved',
    approvedBy: needsApproval ? null : granter.userId, createdAt: now,
  }).run()
  await writeAudit(db, {
    actorUserId: granter.userId, action: 'grant_role', entity: 'role_assignment', entityId: id,
    after: { personId: body.personId, role: body.role, orgUnitId: ou.id, approvalStatus: needsApproval ? 'pending' : 'approved' },
  })
  return { id, approvalStatus: needsApproval ? 'pending' : 'approved' }
})
