import type { AuthUser } from './context'
import { isWithin } from './orgPath'
import { ROLES, SUPERVISORY_ABOVE_MOSQUE, type Role } from './rbac'

// قرارات الصلاحيات — دوال نقية تعمل على تكليفات المستخدم (قابلة للاختبار، مصدر واحد للحقيقة)

export function isAdmin(u: AuthUser): boolean {
  return u.assignments.some((a) => a.role === ROLES.ADMIN)
}

// الوصول النطاقي: الوحدة ذات المسار target ضمن أحد نطاقات المستخدم (القاعدة الذهبية)
export function canAccess(u: AuthUser, targetPath: string): boolean {
  return isAdmin(u) || u.assignments.some((a) => isWithin(targetPath, a.orgPath))
}

export function isAmirOf(u: AuthUser, mosqueId: string): boolean {
  return u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === mosqueId)
}

// تعديل الأسبوع المقفل/فتحه: الكتلة/المحافظة/الإدارة فقط (ق5)
export function canEditLockedWeek(u: AuthUser, mosquePath: string): boolean {
  return isAdmin(u) || u.assignments.some((a) =>
    [ROLES.BLOC, ROLES.RABITA].includes(a.role as Role) && isWithin(mosquePath, a.orgPath))
}
export const canUnlockWeek = canEditLockedWeek

// قفل الأسبوع: الأمير أو أعلى (ق5)
export function canLockWeek(u: AuthUser, mosqueId: string, mosquePath: string): boolean {
  return isAmirOf(u, mosqueId) || canEditLockedWeek(u, mosquePath)
}

// الاعتماد النهائي: أعلى طبقة مفعّلة فوق المسجد (ق1) — مشرف نطاقه يشمل المسجد وأعلى منه
export function isLayerApprover(u: AuthUser, mosquePath: string): boolean {
  return isAdmin(u) || u.assignments.some((a) =>
    SUPERVISORY_ABOVE_MOSQUE.includes(a.role as Role) && isWithin(mosquePath, a.orgPath) && a.orgPath !== mosquePath)
}

// مشرف عام (لإعداد «على بصيرة»/نتائج الاختبارات): إدارة أو رابطة/كتلة/مربع
export function isSupervisor(u: AuthUser): boolean {
  return isAdmin(u) || u.assignments.some((a) =>
    [ROLES.RABITA, ROLES.BLOC, ROLES.SQUARE].includes(a.role as Role))
}
