export const ROLES = {
  ADMIN: 'admin',              // الإدارة العليا — مديرٌ واحدٌ مشترك فوق القسمين
  SECTION_HEAD: 'section_head', // رأس القسم — مشرف عام ذكور / مشرفة عامة نساء (أعلى طبقة داخل القسم)
  RABITA: 'rabita',
  SQUARE: 'square',
  AMIR: 'amir',                // مسؤول الوحدة الطرفية — أمير مسجد (ذكور) / مشرفة حلقة (نساء)
  TEACHER: 'teacher',   // مدرّس/محفّظ — يملك حلقاته (قد تكون بلا مسجد/أمير)
  STUDENT: 'student',   // طالبٌ معتمَد (تسجيلٌ ذاتيّ §ر) — يرى «المطلوب منّي» ومكتبته فقط
  // كانت ناقصةً هنا رغم وجودها في capabilities.ts (تدقيق ٣٣ §٥.٥) — توحيدُ المصدرين
  COMMITTEE_HEAD: 'committee_head', // مسؤول لجنة مسجد — يُدخل أنشطة لجنته (ق1)
  MEDIA: 'media',                    // مسؤول إعلام — معرض النطاق وأنشطته الإعلامية
  FINANCE_OFFICER: 'finance_officer', // المسؤول المالي — يُعِدّ والمدير يعتمد (وثيقة ٢٨)
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// القسم — بُعدٌ أوّل يقسم الشجرة قسمين معزولين تمامًا تحت الإدارة العليا
export const SECTIONS = ['men', 'women'] as const
export type Section = typeof SECTIONS[number]

// أدوار إشرافية فوق الوحدة الطرفية — تملك الاعتماد الطبقي والرفض (مع سبب مطلوب للرفض)
export const SUPERVISORY_ABOVE_MOSQUE: Role[] = [ROLES.ADMIN, ROLES.SECTION_HEAD, ROLES.RABITA, ROLES.SQUARE]

// أنواع الوحدات التنظيمية (الجذر → الورقة)
// section: جذر القسم · rabita: منطقة · square: مربع · mosque: مسجد (ذكور) · halaqa: حلقة (نساء)
export const ORG_TYPES = ['section', 'rabita', 'square', 'mosque', 'halaqa'] as const
export type OrgType = typeof ORG_TYPES[number]

// الورقة الطرفية لكل قسم
export const SECTION_LEAF: Record<Section, OrgType> = { men: 'mosque', women: 'halaqa' }
