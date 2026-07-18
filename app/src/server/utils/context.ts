import { and, eq, isNull } from 'drizzle-orm'
import { useDb } from './db'
import { persons, roleAssignments, users } from '../database/schema'
import { verifyToken } from './auth'
import { isWithin } from './orgPath'
import { ROLES, type Role } from './rbac'

export interface AuthUser {
  userId: string
  personId: string
  fullName: string
  assignments: Array<{ role: Role; orgUnitId: string; orgPath: string; portfolio: string | null }>
}

// يحمّل المستخدم من رمز JWT (بدل h3 event — تُمرَّر السلسلة مباشرة في TanStack Start)
export async function userFromToken(token: string | undefined, jwtSecret: string): Promise<AuthUser | null> {
  if (!token) return null
  let payload: { sub: string; pid: string; ep?: number }
  try {
    payload = await verifyToken<{ sub: string; pid: string; ep?: number }>(token, jwtSecret)
  } catch {
    return null
  }
  const db = useDb()
  // ط١: الاستعلاماتُ الثلاثةُ مستقلّةٌ (كلُّها بمفاتيح الرمز) ⇒ موجةٌ واحدةٌ بدل ٣ جولاتٍ متسلسلة
  const [personRows, acctRows, asg] = await Promise.all([
    db.select().from(persons).where(eq(persons.id, payload.pid)).all(),
    db.select({ epoch: users.sessionEpoch }).from(users).where(eq(users.id, payload.sub)).all(),
    db.select().from(roleAssignments).where(and(
      eq(roleAssignments.personId, payload.pid),
      isNull(roleAssignments.endDate),
      eq(roleAssignments.approvalStatus, 'approved'),
    )).all(),
  ])
  const person = personRows[0]
  // حالة الحساب هي المصدر الوحيد: أيُّ حالةٍ غير active (موقوف/ملغى) ⇒ لا جلسة
  if (!person || person.status !== 'active') return null
  // إبطالٌ لحظيّ: رمزٌ حِقبتُه لا تطابق session_epoch الحاليّ (رُفع عند تجميدٍ/تغيير كلمة مرور) ⇒ ملغى
  const acct = acctRows[0]
  if (!acct || (payload.ep ?? 0) !== acct.epoch) return null
  return {
    userId: payload.sub, personId: payload.pid, fullName: person.fullName,
    assignments: asg.map((a) => ({ role: a.role as Role, orgUnitId: a.orgUnitId, orgPath: a.orgPath, portfolio: a.portfolio })),
  }
}

export function isGlobalAdmin(u: AuthUser): boolean {
  return u.assignments.some((a) => a.role === ROLES.ADMIN)
}

export function canAccessPath(u: AuthUser, targetPath: string): boolean {
  if (isGlobalAdmin(u)) return true
  return u.assignments.some((a) => isWithin(targetPath, a.orgPath))
}
