/**
 * بذرةُ عالم الاعتماد — تُبنى **فوق** بذرة الصندوق (وهي فوق بذرة الدفتر، وكلُّها فوق العالم
 * القانونيّ الواحد — TESTING_POLICY §٥). **لا عالمَ رابعٌ يتباعد.**
 *
 * وفيها **إثباتُ عموميّة المحرّك**: نوعُ اعتمادٍ يُسجَّل **من خارج مجلد المحرّك** بنفس
 * الواجهة المعلنة (`unit.report` بقدرات `report.*`) — فلو كان المحرّكُ مفصَّلاً على الإقفال
 * لَما قَبِل نوعاً ثانياً.
 */

import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import type { ApprovalStores } from "../../../src/features/approval/data/tenant.js"
import { defineApprovalType } from "../../../src/features/approval/registry.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import { boxClosingPayloadSource } from "../../../src/features/approval/registered/boxClosing.js"
import type { ApprovalContext } from "../../../src/features/approval/services/engine.js"
import type { ApprovalPeriod } from "../../../src/features/approval/types.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"
import { seedBoxStores } from "../box/_seed.js"
import { MAIN_TENANT_ID, NOW } from "../ledger/_seed.js"

export { MAIN_TENANT_ID, NOW, SECOND_TENANT_ID, c } from "../ledger/_seed.js"

export const KHALID = "khalid"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const OMAR = "omar"
/** مسجدٌ تحت مربعٍ **شاغرٍ عمداً** (sq7) — فأقربُه المنطقة (ق-٢). */
export const OMAR_PATH = "/men/homs/sq7/omar/"
export const SQ2_PATH = "/men/homs/sq2/"
export const HOMS_PATH = "/men/homs/"
export const MEN_PATH = "/men/"

/** النوعُ البرهانيّ الثاني — يسجّله **الاختبار** لا المحرّك (إثباتُ العموميّة). */
export const UNIT_REPORT = defineApprovalType({
  id: "unit.report",
  entityAr: "تقريرُ الوحدة",
  scopeKind: "unit",
  submitCapability: "report.submit",
  approveCapability: "report.approve",
  overrideCapability: "report.approve.override",
  retractCapability: "report.retract",
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

export const PERIOD: ApprovalPeriod = { id: "1447-12", endsAt: NOW }

/** فترةٌ انتهت منذ زمنٍ بعيد — لاختبار القفل الزمنيّ من **الإعداد** لا من رقم. */
export const OLD_PERIOD: ApprovalPeriod = {
  id: "1447-06",
  endsAt: new Date("2026-01-31T00:00:00.000Z"),
}

export const READ: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...READ, intent: "write" }

export function seedApprovalStores(tenantId: string = MAIN_TENANT_ID): ApprovalStores {
  return { box: seedBoxStores(tenantId), approval: new ApprovalStore(tenantId) }
}

/** لقطةُ العالم القانونيّ — لا نسخةَ أشخاصٍ ثانية. */
export function canonicalPeople(): readonly Actor[] {
  return buildCanonicalWorld().people
}

/** إسقاطُ أشخاصٍ من اللقطة — محاكاةُ شغورٍ لا يمسّ الفيكستشر الحاكم. */
export function peopleWithout(...personIds: readonly string[]): readonly Actor[] {
  return canonicalPeople().filter((p) => !personIds.includes(p.personId))
}

/** **تفريغُ التكليف** (ق-٢): إسناداتُ المذكورين كلُّها منتهيةٌ قبل «الآن». */
export function withEndedAssignments(...personIds: readonly string[]): readonly Actor[] {
  const ended = new Date("2026-05-01T00:00:00.000Z")
  return canonicalPeople().map((p) =>
    personIds.includes(p.personId)
      ? { ...p, assignments: p.assignments.map((a) => ({ ...a, endDate: ended })) }
      : p,
  )
}

/** مكلَّفو المربع الثاني والمنطقة في العالم القانونيّ — **الطبقتان الحيّتان** فوق مسجد خالد. */
export const SQ2_APPROVERS = ["u-granted", "u-square"] as const
export const HOMS_APPROVERS = ["u-blocked", "u-rabita"] as const
export const LAYERS_ABOVE_KHALID = [...SQ2_APPROVERS, ...HOMS_APPROVERS, "u-section-head"] as const

export type ContextOptions = {
  readonly people?: readonly Actor[]
  readonly settings?: readonly SettingOverride[]
  readonly now?: Date
  readonly stores?: ApprovalStores
}

export function approvalContext(
  actorPersonId: string,
  options: ContextOptions = {},
): ApprovalContext {
  const now = options.now ?? NOW
  const people = options.people ?? canonicalPeople()
  const stores = options.stores
  return {
    now,
    actorPersonId,
    people,
    settings: createSettingsResolver(options.settings ?? []),
    holds: makeCapabilityCheck(people, { now, intent: "read", isFeatureEnabled: () => true }),
    payloadFor: (typeId, unitPath, period) =>
      stores === undefined
        ? { typeId, unitPath, periodId: period.id }
        : boxClosingPayloadSource(stores.box)(typeId, unitPath, period),
  }
}
