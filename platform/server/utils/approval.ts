import { and, eq, inArray, isNull } from 'drizzle-orm'
import { roleAssignments } from '../database/schema'
import { ancestorIds } from './orgPath'
import { SUPERVISORY_ABOVE_MOSQUE, type Role } from './rbac'
import type { Db } from './db'

// «أعلى طبقة مفعّلة» تُقرّ سجل المسجد (ق1).
// التفسير المعتمد: أقرب طبقة إشرافية نشطة فوق المسجد — عادةً المربع،
// فإن غاب نصعد للكتلة فالمحافظة. (لو أراد المالك «الأعلى مطلقاً» نعكس الفرز فقط.)
export async function resolveApprovalLayer(db: Db, mosquePath: string) {
  const parents = ancestorIds(mosquePath) // الجذر أولاً، تستثني المسجد نفسه
  if (!parents.length) return null
  const rows = await db.select().from(roleAssignments).where(and(
    inArray(roleAssignments.orgUnitId, parents),
    isNull(roleAssignments.endDate),
    eq(roleAssignments.approvalStatus, 'approved'),
  )).all()
  const supervisory = rows.filter((r) => SUPERVISORY_ABOVE_MOSQUE.includes(r.role as Role))
  if (!supervisory.length) return null
  // الأقرب للمسجد = أطول مسار (أعمق)
  supervisory.sort((a, b) => b.orgPath.length - a.orgPath.length)
  return supervisory[0]
}
