// الأدوار والصلاحيات — مطابقة لوثيقة 02_roles_permissions

export const ROLES = {
  ADMIN: 'admin',         // الإدارة العليا (نطاق عام) — راتب مقطوع (ق2-ب)
  RABITA: 'rabita',       // مسؤول رابطة/محافظة
  BLOC: 'bloc',           // مسؤول كتلة
  SQUARE: 'square',       // مسؤول مربع
  AMIR: 'amir',           // أمير المسجد
  DEPUTY: 'deputy',       // نائب الأمير
  SECRETARY: 'secretary', // أمين السر
  TREASURER: 'treasurer', // أمين الصندوق
  COMMITTEE: 'committee', // مسؤول لجنة
  MEMBER: 'member',       // مسجَّل/عضو (الدور الافتراضي عند التسجيل — ق4)
  PARTICIPANT: 'participant', // مشترك مسابقة
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// أدوار إشرافية فوق المسجد — تُقرّ السجل الأسبوعي (ق1)
export const SUPERVISORY_ABOVE_MOSQUE: Role[] = [ROLES.ADMIN, ROLES.RABITA, ROLES.BLOC, ROLES.SQUARE]

// أنواع الوحدات التنظيمية (الجذر → الورقة)
export const ORG_TYPES = ['rabita', 'bloc', 'square', 'mosque'] as const
export type OrgType = typeof ORG_TYPES[number]
