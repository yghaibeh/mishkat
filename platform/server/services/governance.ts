import { and, eq, isNull } from 'drizzle-orm'
import { roleAssignments, orgUnits, resignations } from '../database/schema'
import { ROLES } from '../utils/rbac'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// دورة الإدارة (الباب الخامس): سنتان، حد دورتين بنفس الحقيبة، تحضير قبل 3 أشهر،
// شغور يُملأ خلال شهر، استقالة تُبَتّ خلال شهر.

export const TERM_YEARS = 2
export const MAX_TERMS = 2
export const PREP_DAYS = 90        // التحضير قبل انتهاء الدورة بثلاثة أشهر
export const RESIGN_DECISION_DAYS = 30
const DAY = 86_400_000

export function addDays(ms: number, n: number): number { return ms + n * DAY }
export function addYears(ms: number, n: number): number {
  const d = new Date(ms)
  d.setUTCFullYear(d.getUTCFullYear() + n)
  return d.getTime()
}

// عدد الدورات السابقة لنفس الشخص في نفس الحقيبة/الموقع
export async function priorTermsCount(db: Db, personId: string, role: string, orgUnitId: string, portfolio: string | null): Promise<number> {
  const rows = await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.personId, personId),
    eq(roleAssignments.role, role),
    eq(roleAssignments.orgUnitId, orgUnitId),
    portfolio ? eq(roleAssignments.portfolio, portfolio) : isNull(roleAssignments.portfolio),
  )).all()
  return rows.length
}

// تكليف بدورة جديدة مع حساب رقمها ونهايتها وفرض الحد الأقصى (ق/الباب الخامس)
export async function assignTerm(db: Db, input: {
  personId: string; role: string; orgUnitId: string; portfolio?: string | null; startDate: number
}, actorUserId?: string): Promise<{ id?: string; termNumber?: number; endDate?: number; error?: string }> {
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0]
  if (!ou) return { error: 'الوحدة التنظيمية غير موجودة' }
  const portfolio = input.portfolio ?? null
  const prior = await priorTermsCount(db, input.personId, input.role, input.orgUnitId, portfolio)
  if (prior >= MAX_TERMS) return { error: `بلغ الحد الأقصى للدورات (${MAX_TERMS}) في هذه الحقيبة` }

  const id = crypto.randomUUID()
  const endDate = addYears(input.startDate, TERM_YEARS)
  const termNumber = prior + 1
  await db.insert(roleAssignments).values({
    id, personId: input.personId, role: input.role, orgUnitId: ou.id, orgPath: ou.path,
    portfolio, startDate: input.startDate, endDate, termNumber,
    approvalStatus: 'approved', approvedBy: actorUserId ?? null, createdAt: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'assign_term', entity: 'role_assignment', entityId: id, after: { personId: input.personId, role: input.role, termNumber } })
  return { id, termNumber, endDate }
}

// تكليفات تنتهي دورتها قريباً (خلال PREP_DAYS) — للتحضير لخلَف
export async function termsEndingSoon(db: Db, asOf: number, withinDays = PREP_DAYS) {
  const rows = await db.select().from(roleAssignments).where(eq(roleAssignments.approvalStatus, 'approved')).all()
  const limit = addDays(asOf, withinDays)
  return rows.filter((r) => r.endDate != null && r.endDate > asOf && r.endDate <= limit)
}

// مساجد بلا أمير مفعّل (شغور) — يُملأ خلال شهر
export async function amirVacancies(db: Db, asOf: number) {
  const mosques = await db.select().from(orgUnits).where(eq(orgUnits.type, 'mosque')).all()
  const amirs = await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.role, ROLES.AMIR), eq(roleAssignments.approvalStatus, 'approved'),
  )).all()
  const filled = new Set(amirs.filter((a) => a.endDate == null || a.endDate > asOf).map((a) => a.orgUnitId))
  return mosques.filter((m) => !filled.has(m.id))
}

// طلب استقالة — بمهلة بتّ شهر
export async function requestResignation(db: Db, roleAssignmentId: string, personId: string, reason: string | undefined, requestedAt: number) {
  const id = crypto.randomUUID()
  await db.insert(resignations).values({
    id, roleAssignmentId, personId, reason: reason ?? null,
    requestedAt, decisionDeadline: addDays(requestedAt, RESIGN_DECISION_DAYS),
    status: 'pending', decidedBy: null, decidedAt: null,
  }).run()
  return { id, decisionDeadline: addDays(requestedAt, RESIGN_DECISION_DAYS) }
}

// البتّ في الاستقالة — القبول يُنهي التكليف (يضبط نهايته)
export async function decideResignation(db: Db, resignationId: string, accept: boolean, deciderUserId: string, decidedAt: number): Promise<{ status?: string; error?: string }> {
  const r = (await db.select().from(resignations).where(eq(resignations.id, resignationId)).all())[0]
  if (!r) return { error: 'الطلب غير موجود' }
  if (r.status !== 'pending') return { status: r.status }
  const status = accept ? 'accepted' : 'rejected'
  await db.update(resignations).set({ status, decidedBy: deciderUserId, decidedAt }).where(eq(resignations.id, resignationId)).run()
  if (accept) {
    await db.update(roleAssignments).set({ endDate: decidedAt }).where(eq(roleAssignments.id, r.roleAssignmentId)).run()
  }
  await writeAudit(db, { actorUserId: deciderUserId, action: 'decide_resignation', entity: 'resignation', entityId: resignationId, after: { status } })
  return { status }
}

// استقالات تجاوزت مهلة البتّ (شهر) دون قرار
export async function overdueResignations(db: Db, asOf: number) {
  const rows = await db.select().from(resignations).where(eq(resignations.status, 'pending')).all()
  return rows.filter((r) => r.decisionDeadline < asOf)
}
