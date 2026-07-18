import type { H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { useDb } from './db'
import { persons, roleAssignments } from '../database/schema'
import { isWithin } from './orgPath'
import { ROLES, type Role } from './rbac'

export interface AuthUser {
  userId: string
  personId: string
  fullName: string
  assignments: Array<{ role: Role; orgUnitId: string; orgPath: string; portfolio: string | null }>
}

// يُملأ في middleware/auth.ts من رمز JWT
export function getAuth(event: H3Event): { userId: string; personId: string } | null {
  return (event.context as any).auth ?? null
}

// يحمّل الشخص وتكليفاته النشطة المعتمدة
export async function loadUser(event: H3Event): Promise<AuthUser | null> {
  const auth = getAuth(event)
  if (!auth) return null
  const db = useDb(event)
  const personRows = await db.select().from(persons).where(eq(persons.id, auth.personId)).all()
  const person = personRows[0]
  if (!person) return null
  const asg = await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.personId, auth.personId),
    isNull(roleAssignments.endDate),
    eq(roleAssignments.approvalStatus, 'approved'),
  )).all()
  return {
    userId: auth.userId,
    personId: auth.personId,
    fullName: person.fullName,
    assignments: asg.map((a) => ({
      role: a.role as Role, orgUnitId: a.orgUnitId, orgPath: a.orgPath, portfolio: a.portfolio,
    })),
  }
}

export async function requireUser(event: H3Event): Promise<AuthUser> {
  const u = await loadUser(event)
  if (!u) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول' })
  return u
}

export function isGlobalAdmin(u: AuthUser): boolean {
  return u.assignments.some((a) => a.role === ROLES.ADMIN)
}

// هل يصل المستخدم للوحدة ذات المسار target (ضمن أحد نطاقاته)؟
export function canAccessPath(u: AuthUser, targetPath: string): boolean {
  if (isGlobalAdmin(u)) return true
  return u.assignments.some((a) => isWithin(targetPath, a.orgPath))
}

export function assertAccessPath(u: AuthUser, targetPath: string): void {
  if (!canAccessPath(u, targetPath)) {
    throw createError({ statusCode: 403, statusMessage: 'خارج نطاق صلاحيتك' })
  }
}
