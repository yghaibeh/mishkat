/**
 * سلّم الشجرة — SPEC_org_and_accounts §١.٢/§١.٥.
 *
 * معرفةٌ بنيويّة خاصةٌ بالوحدة (ترتيبُ الأنواع في السلّم) — ليست دوراً ولا قدرة، فلا تمسّ
 * المصفوفة الذهبية. الطبقة الموقوفة `bloc` **غيابُ صفوفٍ لا `if` خاص**: نوعُها معطَّل فلا
 * تُنشأ عقدةٌ منه، وNESSA لا يراه (§١.٧ من مواصفة الصلاحيات).
 */

import type { UnitTypeId, RoleId } from "../../../authorization/generated/roles.generated.js"
import { ROLES } from "../../../authorization/generated/roles.generated.js"

/** الابن الشرعي لكل نوعٍ في السلّم (نوع الأب ← أنواع الأبناء الجائزة). */
export const LEGAL_CHILDREN: Readonly<Record<UnitTypeId, readonly UnitTypeId[]>> = Object.freeze({
  root: Object.freeze(["section"] as const),
  section: Object.freeze(["bloc", "region"] as const),
  bloc: Object.freeze(["region"] as const),
  region: Object.freeze(["square"] as const),
  square: Object.freeze(["mosque"] as const),
  mosque: Object.freeze(["circle"] as const),
  circle: Object.freeze([] as const),
})

/**
 * أنواع الوحدات المعطَّلة بمفتاح تفعيل (قب-٧): إنشاء عقدةٍ منها مرفوض عند الحدّ.
 * تفعيلُها فعلٌ واحد بـ`featureFlag.manage` — لا كودَ خاصّ في منطق الأعمال.
 */
export const DISABLED_UNIT_TYPES: ReadonlySet<UnitTypeId> = Object.freeze(new Set<UnitTypeId>(["bloc"]))

export function isLegalChildType(parentType: UnitTypeId, childType: UnitTypeId): boolean {
  return LEGAL_CHILDREN[parentType].includes(childType)
}

export function isDisabledUnitType(type: UnitTypeId): boolean {
  return DISABLED_UNIT_TYPES.has(type)
}

/** القسمان يُثبِّتان `section` في مقطعهما؛ ويُرثه كل النسل (ق-٢٠). */
export function sectionOfSegment(id: string): "men" | "women" | null {
  if (id === "men") return "men"
  if (id === "women") return "women"
  return null
}

/** الدور الموقوف لا يظهر في أي منتقي دور (قب-٧، §١.٥) — تُعرَض حالتُه معطّلةً. */
export function isSuspendedRole(roleId: RoleId): boolean {
  return ROLES[roleId].state !== "active"
}
