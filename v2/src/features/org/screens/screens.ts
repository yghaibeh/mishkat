/**
 * شاشات الوحدة الدنيا — SPEC_org_and_accounts §٥ (شجرة · إنشاء حساب · قائمة إسنادات).
 *
 * **طبقة عرض نقيّة**: كلُّ شاشةٍ دالةٌ من (قشرة القدرات المحسوبة + بيانات) إلى بنية عرض.
 * لا تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦) — تُظهر العناصر بأعلام القدرات فقط،
 * وتعرض حالةً فارغةً مُشخِّصةً عند المنع لا شاشةً بيضاء.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { RoleId } from "../../../authorization/generated/roles.generated.js"
import { ROLES } from "../../../authorization/generated/roles.generated.js"
import { DISABLED_UNIT_TYPES } from "../data/hierarchy.js"
import type { OrgUnit, StoredAssignment } from "../types.js"

export type DeniedView = { readonly kind: "denied"; readonly reasonAr: string }
type Caps = ReadonlySet<CapId>

const NO_VIEW: DeniedView = {
  kind: "denied",
  reasonAr: "لا صلاحية عرضٍ على هذا النطاق — راجع مسؤولك",
}

// ── شاشة الشجرة ───────────────────────────────────────────────────────────
export type TreeNode = { readonly id: string; readonly labelAr: string; readonly path: string }
export type OrgTreeView =
  | DeniedView
  | {
      readonly kind: "granted"
      readonly headingAr: string
      readonly nodes: readonly TreeNode[]
      readonly actions: {
        readonly createUnit: boolean
        readonly archiveUnit: boolean
      }
      /** الطبقات الموقوفة تُعرَض معطّلةً بوسمٍ (قب-٧) — عرضٌ لا قرار. */
      readonly disabledLayersAr: readonly string[]
    }

export function orgTreeScreen(caps: Caps, units: readonly OrgUnit[]): OrgTreeView {
  if (!caps.has("network.view")) return NO_VIEW
  return {
    kind: "granted",
    headingAr: "الشجرة التنظيمية",
    nodes: units.map((u) => ({ id: u.id, labelAr: u.labelAr, path: u.path })),
    actions: {
      createUnit: caps.has("orgUnit.manage"),
      archiveUnit: caps.has("orgUnit.manage"),
    },
    disabledLayersAr: [...DISABLED_UNIT_TYPES].map((t) => `طبقة «${t}» موقوفة بمفتاح تفعيل`),
  }
}

// ── شاشة إنشاء حساب ────────────────────────────────────────────────────────
export type RoleOption = { readonly id: RoleId; readonly labelAr: string }
export type CreateAccountView =
  | DeniedView
  | {
      readonly kind: "granted"
      readonly headingAr: string
      /** منتقي الدور = ما يجوز توفيرُه فقط (الموقوف والأعلى مُقصَيان بنيوياً). */
      readonly roleOptions: readonly RoleOption[]
      readonly fields: readonly { readonly name: string; readonly labelAr: string }[]
    }

export function createAccountScreen(
  caps: Caps,
  provisionableRoles: readonly RoleId[],
): CreateAccountView {
  if (!caps.has("users.provision")) {
    return { kind: "denied", reasonAr: "لا تملك تمكينَ حساباتٍ على هذا النطاق" }
  }
  return {
    kind: "granted",
    headingAr: "إنشاء حساب عاملٍ في وحدتك",
    roleOptions: provisionableRoles.map((r) => ({ id: r, labelAr: ROLES[r].ar })),
    fields: [
      { name: "username", labelAr: "اسم المستخدم" },
      { name: "password", labelAr: "كلمة المرور" },
    ],
  }
}

// ── شاشة قائمة الإسنادات ───────────────────────────────────────────────────
export type AssignmentRow = {
  readonly id: string
  readonly personId: string
  readonly roleAr: string
  readonly scopePath: string
}
export type AssignmentsView =
  | DeniedView
  | {
      readonly kind: "granted"
      readonly headingAr: string
      readonly rows: readonly AssignmentRow[]
      /** إنهاء التكليف قدرتُه `user.manage` — للمربع/الأمير غائبٌ (قب-١١/ق-م٢). */
      readonly actions: { readonly endAssignment: boolean }
    }

export function assignmentsScreen(
  caps: Caps,
  assignments: readonly StoredAssignment[],
): AssignmentsView {
  if (!caps.has("network.view")) return NO_VIEW
  return {
    kind: "granted",
    headingAr: "الإسنادات في نطاقك",
    rows: assignments.map((a) => ({
      id: a.id,
      personId: a.personId,
      roleAr: ROLES[a.roleId].ar,
      scopePath: a.scopePath,
    })),
    actions: { endAssignment: caps.has("user.manage") },
  }
}
