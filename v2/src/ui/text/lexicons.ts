/**
 * المعاجم المغلقة — SPEC_design_system §٥-٢ + ق-١١٧/ق-١١٨.
 *
 * ثلاثةُ ثوابت:
 *  ١. **اسمُ الدور من مصدره وحده** (`ROLES[id].ar` المولَّد من المصفوفة): في v1 كرَّرت شاشةٌ
 *     أسماءَ الأدوار محلياً فتسرّب دورٌ لم يكن ينبغي أن يُذكر. هنا لا نسخة — إحالةٌ.
 *  ٢. **أيقونةٌ لكل مفتاح ولا مفتاحَ زائد**: النوعُ `Record<RoleId, string>` يجعل الدورَ
 *     الجديدَ بلا أيقونةٍ **خطأَ بناء** (ق-١١٨ حارسٌ بنيويّ لا تذكُّر).
 *  ٣. **سقوطٌ آمن «أخرى»**: مفتاحٌ مجهولٌ لا يظهر خاماً للمستخدم أبداً (ق-١١٧).
 */

import { ROLES, type RoleId, type UnitTypeId } from "../../authorization/generated/roles.generated.js"

export const FALLBACK_LABEL_AR = "أخرى"

/** اسمُ الدور — إحالةٌ إلى المصدر المولَّد لا نسخةٌ محلية. */
export function roleLabel(id: RoleId): string {
  return ROLES[id].ar
}

/** أسماءُ أنواع الوحدات — معجمٌ مغلقٌ واحد (النوعُ يفرض اكتمالَه). */
const ORG_TYPE_LABEL: Readonly<Record<UnitTypeId, string>> = Object.freeze({
  root: "الشبكة",
  section: "قسم",
  bloc: "كتلة",
  region: "منطقة",
  square: "مربع",
  mosque: "مسجد",
  circle: "حلقة",
})

export function orgTypeLabel(type: UnitTypeId): string {
  return ORG_TYPE_LABEL[type]
}

/** أيقونةُ كل دور (ق-١١٨) — دورٌ جديدٌ بلا أيقونةٍ يُفشل البناء. */
export const ROLE_ICON: Readonly<Record<RoleId, string>> = Object.freeze({
  admin: "shield",
  section_head: "compass",
  bloc_head: "layers",
  rabita: "map",
  square: "grid",
  amir: "mosque",
  teacher: "book-open",
  committee_head: "users",
  media: "camera",
  finance_officer: "wallet",
  student: "user",
  deputy: "user-check",
  secretary: "notebook",
  treasurer: "coins",
  member: "user",
  participant: "flag",
})

/** أيقونةُ كل نوع وحدة (ق-١١٨). */
export const ORG_TYPE_ICON: Readonly<Record<UnitTypeId, string>> = Object.freeze({
  root: "globe",
  section: "compass",
  bloc: "layers",
  region: "map",
  square: "grid",
  mosque: "mosque",
  circle: "book-open",
})

/**
 * قراءةٌ آمنة من معجمٍ مفتوح المفاتيح (فئاتُ صرفٍ، أنواعُ تغطياتٍ… تأتي من البيانات):
 * المجهولُ يسقط إلى «أخرى» ولا يظهر مفتاحاً خاماً (نظير `material-categories` في v1).
 */
export function lexicon(map: Readonly<Record<string, string>>, key: string): string {
  const value = map[key]
  return value === undefined || value.trim().length === 0 ? FALLBACK_LABEL_AR : value
}
