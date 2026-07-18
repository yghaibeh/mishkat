import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { roleAssignments, orgUnits } from '../../database/schema'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { writeAudit } from '../../utils/audit'

// اعتماد تكليف معلّق (مثل تعيين الأمير) — من الإدارة العليا أو مشرف أعلى في النطاق
const bodySchema = z.object({ id: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const approver = await requireUser(event)
  const { id } = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const rows = await db.select().from(roleAssignments).where(eq(roleAssignments.id, id)).all()
  const ra = rows[0]
  if (!ra) throw createError({ statusCode: 404, statusMessage: 'التكليف غير موجود' })
  if (ra.approvalStatus === 'approved') return { id, approvalStatus: 'approved' }

  if (!isGlobalAdmin(approver) && !canAccessPath(approver, ra.orgPath)) {
    throw createError({ statusCode: 403, statusMessage: 'لا تملك صلاحية الاعتماد في هذا النطاق' })
  }

  await db.update(roleAssignments)
    .set({ approvalStatus: 'approved', approvedBy: approver.userId })
    .where(eq(roleAssignments.id, id))
    .run()
  await writeAudit(db, {
    actorUserId: approver.userId, action: 'approve_role', entity: 'role_assignment', entityId: id,
    before: { approvalStatus: 'pending' }, after: { approvalStatus: 'approved' },
  })
  return { id, approvalStatus: 'approved' }
})
