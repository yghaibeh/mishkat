import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin, canAccessPath } from '../../utils/context'
import { isSupervisor } from '../../utils/caps'
import { termsEndingSoon, amirVacancies, overdueResignations } from '../../services/governance'

// تنبيهات الحوكمة: دورات تنتهي قريباً + شواغر أمراء + استقالات متأخرة — ضمن النطاق
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isSupervisor(user)) throw createError({ statusCode: 403, statusMessage: 'تنبيهات الحوكمة لمشرف فأعلى' })
  const db = useDb(event)
  const now = Date.now()

  const inScope = <T extends { orgPath?: string; path?: string }>(rows: T[]) =>
    isGlobalAdmin(user) ? rows : rows.filter((r) => {
      const p = (r as any).orgPath ?? (r as any).path
      return p ? canAccessPath(user, p) : false
    })

  const ending = inScope(await termsEndingSoon(db, now))
  const vacancies = inScope(await amirVacancies(db, now))
  const overdue = await overdueResignations(db, now)

  return {
    termsEndingSoon: ending.map((r: any) => ({ id: r.id, personId: r.personId, role: r.role, orgUnitId: r.orgUnitId, endDate: r.endDate })),
    amirVacancies: vacancies.map((m: any) => ({ id: m.id, name: m.name })),
    overdueResignations: overdue.map((r) => ({ id: r.id, roleAssignmentId: r.roleAssignmentId, decisionDeadline: r.decisionDeadline })),
  }
})
