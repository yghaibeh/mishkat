/**
 * شاشات الوحدة الدنيا — SPEC_org_and_accounts §٥ (شجرة · إنشاء حساب · قائمة إسنادات).
 *
 * **طبقة عرض نقيّة**: كلُّ شاشةٍ دالةٌ من (قشرة القدرات المحسوبة + بيانات) إلى بنية عرض.
 * لا تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦) — تُظهر العناصر بأعلام القدرات فقط،
 * وتعرض حالةً فارغةً مُشخِّصةً عند المنع لا شاشةً بيضاء.
 *
 * **دخلت السياج في T5**: نصوصُها صارت مفاتيحَ من الطبقة المركزية (§٥ — لا حرفَ هنا)،
 * ولكلٍّ **عقدُ شاشةٍ مسجَّل** (ق-١١٣: قائمةُ LEGACY فارغةٌ وتبقى فارغة)، ومعاينتُها
 * تُبنى من **المكتبة المغلقة** فتحاكمها G20 كأيّ شاشةٍ أخرى.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { RoleId } from "../../../authorization/generated/roles.generated.js"
import { ROLES } from "../../../authorization/generated/roles.generated.js"
import { DISABLED_UNIT_TYPES } from "../data/hierarchy.js"
import type { OrgUnit, StoredAssignment } from "../types.js"
import { t } from "../../../ui/text/dictionary.js"
import { orgTypeLabel } from "../../../ui/text/lexicons.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form } from "../../../ui/components/molecules.js"
import { dataTable, emptyState, unitTree } from "../../../ui/components/organisms.js"
import { TREE_LAZY_THRESHOLD } from "../../../ui/components/limits.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"

export type DeniedView = { readonly kind: "denied"; readonly reasonAr: string }
type Caps = ReadonlySet<CapId>

const NO_VIEW: DeniedView = {
  kind: "denied",
  reasonAr: `${t("state.deniedTitle")} — ${t("state.deniedHint")}`,
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢) — يُعاد استعماله في معاينات هذه الوحدة. */
const VIEWER_EMPTY = (): UiNode =>
  emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })

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
    headingAr: t("org.treeHeading"),
    nodes: units.map((u) => ({ id: u.id, labelAr: u.labelAr, path: u.path })),
    actions: {
      createUnit: caps.has("orgUnit.manage"),
      archiveUnit: caps.has("orgUnit.manage"),
    },
    // الاسمُ عربيٌّ من المعجم المغلق — لا مفتاحٌ خامٌّ يظهر للمستخدم (ق-١١٧).
    disabledLayersAr: [...DISABLED_UNIT_TYPES].map(
      (type) => `${orgTypeLabel(type)}: ${t("org.suspendedLayer")}`,
    ),
  }
}

export const ORG_TREE_CONTRACT: ScreenContract = Object.freeze({
  route: "/admin/org-tree",
  surface: "admin",
  lenses: ["admin", "section_head", "rabita", "square"] as const,
  canonicalHome: ["orgUnit", "tenant"] as const,
  capabilities: ["network.view", "orgUnit.manage"] as const,
  dataSource: "org.orgTree",
  emptyStates: { owner: "state.emptyOwnerTitle", viewer: "state.deniedTitle" } as const,
})

export function orgTreeScreenNodes(caps: Caps, units: readonly OrgUnit[]): UiNode {
  if (!caps.has("network.view")) return VIEWER_EMPTY()
  const tree = unitTree({
    nodes: units.map((u, i) => ({ id: u.id, labelAr: u.labelAr, type: u.type, depth: i })),
    leafKind: "structure",
    lazyThreshold: TREE_LAZY_THRESHOLD,
    capability: "network.view",
    emptyState: VIEWER_EMPTY(),
  })
  if (!caps.has("orgUnit.manage")) return tree
  return form({
    schema: "orgUnitInput",
    fields: [tree],
    submit: button({ labelKey: "org.createUnit", variant: "primary", capability: "orgUnit.manage" }),
  })
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
    return { kind: "denied", reasonAr: `${t("state.deniedTitle")} — ${t("state.deniedHint")}` }
  }
  return {
    kind: "granted",
    headingAr: t("org.createAccount"),
    roleOptions: provisionableRoles.map((r) => ({ id: r, labelAr: ROLES[r].ar })),
    fields: [
      { name: "username", labelAr: t("org.username") },
      { name: "password", labelAr: t("org.password") },
    ],
  }
}

export const CREATE_ACCOUNT_CONTRACT: ScreenContract = Object.freeze({
  route: "/admin/accounts/new",
  surface: "admin",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  canonicalHome: ["account"] as const,
  capabilities: ["users.provision"] as const,
  dataSource: "org.provisioning",
  emptyStates: { owner: "state.emptyOwnerTitle", viewer: "state.deniedTitle" } as const,
})

export function createAccountScreenNodes(caps: Caps): UiNode {
  if (!caps.has("users.provision")) return VIEWER_EMPTY()
  return form({
    schema: "provisionInput",
    fields: [
      field({ name: "username", labelKey: "org.username", kind: "text", required: true }),
      field({ name: "password", labelKey: "org.password", kind: "text", required: true }),
    ],
    submit: button({
      labelKey: "org.createAccount",
      variant: "primary",
      capability: "users.provision",
    }),
  })
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
    headingAr: t("org.assignments"),
    rows: assignments.map((a) => ({
      id: a.id,
      personId: a.personId,
      roleAr: ROLES[a.roleId].ar,
      scopePath: a.scopePath,
    })),
    actions: { endAssignment: caps.has("user.manage") },
  }
}

export const ASSIGNMENTS_CONTRACT: ScreenContract = Object.freeze({
  route: "/admin/assignments",
  surface: "admin",
  lenses: ["admin", "section_head", "rabita"] as const,
  // عرضٌ منسوب: موطنُ الحساب والتكليف شاشةُ التوفير — لا موطنَ ثانٍ (IA §١ ك-١٣).
  canonicalHome: [] as const,
  capabilities: ["network.view", "user.manage"] as const,
  dataSource: "org.assignments",
  emptyStates: { owner: "state.emptyOwnerTitle", viewer: "state.deniedTitle" } as const,
})

export function assignmentsScreenNodes(
  caps: Caps,
  assignments: readonly StoredAssignment[],
): UiNode {
  if (!caps.has("network.view")) return VIEWER_EMPTY()
  const table = dataTable({
    columns: [
      { key: "person", labelKey: "org.username" },
      { key: "role", labelKey: "org.assignments" },
    ],
    rows: assignments.map((a) => ({ person: a.personId, role: a.roleId })),
    state: assignments.length === 0 ? "empty" : "data",
    capability: "network.view",
    emptyState: VIEWER_EMPTY(),
  })
  if (!caps.has("user.manage")) return table
  return form({
    schema: "endAssignmentInput",
    fields: [table],
    submit: button({ labelKey: "org.endAssignment", variant: "primary", capability: "user.manage" }),
  })
}

registerScreen({ contract: ORG_TREE_CONTRACT, preview: (caps) => orgTreeScreenNodes(caps, []) })
registerScreen({ contract: CREATE_ACCOUNT_CONTRACT, preview: createAccountScreenNodes })
registerScreen({ contract: ASSIGNMENTS_CONTRACT, preview: (caps) => assignmentsScreenNodes(caps, []) })
