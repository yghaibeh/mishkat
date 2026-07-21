// ⚠️ ملف مولَّد آلياً من authorization.matrix.json — لا يُحرَّر يدوياً.
// المولّد: tools/generate/emit-derived.mjs · الحارس: G5
// SPEC_authorization §٥.١ — المصدر الواحد وكل ما عداه مشتق.

import type { RoleId, UnitTypeId } from "./roles.generated.js"
import type { CapId } from "./capabilities.generated.js"

export const PROVISION_CAPABILITY: CapId = "users.provision"
export const ELEVATED_ROLES: ReadonlySet<RoleId> = Object.freeze(
  new Set<RoleId>(["admin", "section_head"]),
)
export const ELEVATED_GRANT_CAPABILITY: CapId = "user.role.grant.elevated"

/** ش٣ — مصفوفة (نوع الوحدة × الأدوار الجائزة عليها). */
export const UNIT_TYPE_ALLOWED_ROLES: Readonly<Record<UnitTypeId, ReadonlySet<RoleId>>> =
  Object.freeze({
  "root": Object.freeze(new Set<RoleId>(["admin", "finance_officer", "media"])),
  "section": Object.freeze(new Set<RoleId>(["section_head", "finance_officer", "media"])),
  "bloc": Object.freeze(new Set<RoleId>(["bloc_head", "finance_officer", "media"])),
  "region": Object.freeze(new Set<RoleId>(["rabita", "finance_officer", "media"])),
  "square": Object.freeze(new Set<RoleId>(["square"])),
  "mosque": Object.freeze(new Set<RoleId>(["amir", "teacher", "committee_head", "media", "deputy", "secretary", "treasurer", "member", "student", "participant"])),
  "circle": Object.freeze(new Set<RoleId>(["teacher", "student"])),
})

/** CR-001 §ج — القائمة البيضاء المغلقة للمسارات العامة المعلنة. تحرس G16 سقفها. */
export const PUBLIC_DECLARED_WHITELIST: readonly string[] = Object.freeze([
  "competition.publicEnroll",
  "registration.publicRequest",
])
export const PUBLIC_DECLARED_CEILING = 2
