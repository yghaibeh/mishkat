#!/usr/bin/env node
/**
 * مولّد المشتقات من المصفوفة الذهبية — SPEC_authorization §٥.١.
 * «يُشتقّ منه آلياً — ولا يُكتب أيٌّ منها يدوياً».
 * تحرس G5 أن تشغيل هذا المولّد لا يُحدث فرقاً (وإلا فالمشتق حُرِّر يدوياً أو انحرف).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..", "..")
const matrixPath = join(root, "src", "authorization", "matrix", "authorization.matrix.json")
const outDir = join(root, "src", "authorization", "generated")

const matrix = JSON.parse(readFileSync(matrixPath, "utf8"))

const HEADER = `// ⚠️ ملف مولَّد آلياً من authorization.matrix.json — لا يُحرَّر يدوياً.
// المولّد: tools/generate/emit-derived.mjs · الحارس: G5
// SPEC_authorization §٥.١ — المصدر الواحد وكل ما عداه مشتق.
`

function emitCapabilities() {
  const caps = matrix.capabilities
  const ids = caps.map((c) => `  | ${JSON.stringify(c.id)}`).join("\n")
  const meta = caps
    .map(
      (c) =>
        `  ${JSON.stringify(c.id)}: { no: ${c.no}, ar: ${JSON.stringify(c.ar)}, type: ${JSON.stringify(
          c.type,
        )}, scopeKind: ${JSON.stringify(c.scopeKind)}, module: ${JSON.stringify(c.module)} },`,
    )
    .join("\n")

  return `${HEADER}
/** معرّف القدرة — اتحادٌ مغلق. معرّفٌ مخترع لا يُترجم (G1 تمسكه زمن البناء). */
export type CapId =
${ids}

export type CapType = "scoped" | "personal" | "root"
export type CapScopeKind = "subtree" | "exact" | "below" | "root" | "personal"

export type CapabilityMeta = {
  readonly no: number
  readonly ar: string
  readonly type: CapType
  readonly scopeKind: CapScopeKind
  readonly module: string
}

export const CAPS: Readonly<Record<CapId, CapabilityMeta>> = Object.freeze({
${meta}
})

export const CAP_IDS: readonly CapId[] = Object.freeze(Object.keys(CAPS) as CapId[])
`
}

function emitRoles() {
  const roles = matrix.roles
  const ids = roles.map((r) => `  | ${JSON.stringify(r.id)}`).join("\n")
  const meta = roles
    .map(
      (r) =>
        `  ${JSON.stringify(r.id)}: { ar: ${JSON.stringify(r.ar)}, rank: ${r.rank}, state: ${JSON.stringify(
          r.state,
        )}, allowedUnitTypes: Object.freeze([${r.allowedUnitTypes
          .map((u) => JSON.stringify(u))
          .join(", ")}] as const) },`,
    )
    .join("\n")

  const bundles = roles
    .map((r) => {
      const caps = matrix.matrix[r.id] ?? []
      const sorted = [...caps].sort()
      return `  ${JSON.stringify(r.id)}: Object.freeze(new Set<CapId>([\n${sorted
        .map((c) => `    ${JSON.stringify(c)},`)
        .join("\n")}\n  ])),`
    })
    .join("\n")

  return `${HEADER}
import type { CapId } from "./capabilities.generated.js"

/** معرّف الدور — اتحادٌ مغلق. لا دور خارج المصفوفة. */
export type RoleId =
${ids}

export type UnitTypeId = ${matrix.unitTypes.map((u) => JSON.stringify(u.id)).join(" | ")}

export type RoleMeta = {
  readonly ar: string
  readonly rank: number
  readonly state: "active" | "suspended"
  readonly allowedUnitTypes: readonly UnitTypeId[]
}

export const ROLES: Readonly<Record<RoleId, RoleMeta>> = Object.freeze({
${meta}
})

export const ROLE_IDS: readonly RoleId[] = Object.freeze(Object.keys(ROLES) as RoleId[])

/** حزم الأدوار — ثابتة في الكود، لا تُقرأ من قاعدة البيانات أبداً (§٤.٥). */
export const ROLE_CAPABILITIES: Readonly<Record<RoleId, ReadonlySet<CapId>>> = Object.freeze({
${bundles}
})
`
}

function emitProvision() {
  const p = matrix.provisionRules
  const entries = Object.entries(p.unitTypeAllowedRoles)
    .map(
      ([unit, roles]) =>
        `  ${JSON.stringify(unit)}: Object.freeze(new Set<RoleId>([${roles
          .map((r) => JSON.stringify(r))
          .join(", ")}])),`,
    )
    .join("\n")

  const w = matrix.publicDeclaredWhitelist
  return `${HEADER}
import type { RoleId, UnitTypeId } from "./roles.generated.js"
import type { CapId } from "./capabilities.generated.js"

export const PROVISION_CAPABILITY: CapId = ${JSON.stringify(p.provisionCapability)}
export const ELEVATED_ROLES: ReadonlySet<RoleId> = Object.freeze(
  new Set<RoleId>([${p.reservedRoles.map((r) => JSON.stringify(r)).join(", ")}]),
)
export const ELEVATED_GRANT_CAPABILITY: CapId = ${JSON.stringify(p.reservedRolesCapability)}

/** ش٣ — مصفوفة (نوع الوحدة × الأدوار الجائزة عليها). */
export const UNIT_TYPE_ALLOWED_ROLES: Readonly<Record<UnitTypeId, ReadonlySet<RoleId>>> =
  Object.freeze({
${entries}
})

/** CR-001 §ج — القائمة البيضاء المغلقة للمسارات العامة المعلنة. تحرس G16 سقفها. */
export const PUBLIC_DECLARED_WHITELIST: readonly string[] = Object.freeze([
${w.routes.map((r) => `  ${JSON.stringify(r.id)},`).join("\n")}
])
export const PUBLIC_DECLARED_CEILING = ${w.ceiling}
`
}

const outputs = {
  "capabilities.generated.ts": emitCapabilities(),
  "roles.generated.ts": emitRoles(),
  "provision.generated.ts": emitProvision(),
}

let changed = []
for (const [name, content] of Object.entries(outputs)) {
  const path = join(outDir, name)
  let previous = null
  try {
    previous = readFileSync(path, "utf8")
  } catch {
    /* ملف جديد */
  }
  if (previous !== content) {
    writeFileSync(path, content, "utf8")
    changed.push(name)
  }
}

if (process.argv.includes("--check")) {
  if (changed.length > 0) {
    console.error(`✗ المشتقات منحرفة عن المصفوفة الذهبية: ${changed.join("، ")}`)
    process.exit(1)
  }
  console.log("✓ المشتقات مطابقة للمصفوفة الذهبية")
} else {
  console.log(changed.length ? `تُحدِّثت: ${changed.join("، ")}` : "لا تغيير")
}
