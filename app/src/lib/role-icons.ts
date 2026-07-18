// ك٦ (الوثيقة ٢٩): مصدرٌ واحدٌ لأيقونات الأدوار وأنواع الوحدات — يمنع فقدَ أيقونةٍ أو تضاربَها.
// يُبقى منفصلًا عن capabilities.ts (المشترك خادمًا/عميلًا) كي لا تُسحَب lucide-react إلى حزمة الخادم.
import {
  ShieldCheck, UserCog, MapPin, Grid3x3, User, User2, GraduationCap, Users, Camera, Wallet,
  Landmark, Building2, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// كلُّ دورٍ في ROLE_LABEL له أيقونة (يحرسه اختبارُ role-icons.test).
export const ROLE_ICON: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  section_head: UserCog,
  rabita: MapPin,
  square: Grid3x3,
  amir: User,
  teacher: GraduationCap,
  committee_head: Users,
  media: Camera,
  finance_officer: Wallet,
  student: User2,
};

// كلُّ نوعٍ في ORG_TYPE_LABEL له أيقونة (section/rabita/square/mosque/halaqa).
export const ORG_TYPE_ICON: Record<string, LucideIcon> = {
  section: Landmark,
  rabita: MapPin,
  square: Grid3x3,
  mosque: Building2,
  halaqa: BookOpen,
};

export const roleIcon = (role: string): LucideIcon => ROLE_ICON[role] ?? User;
export const orgTypeIcon = (type: string): LucideIcon => ORG_TYPE_ICON[type] ?? Building2;
