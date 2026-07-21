/**
 * التمكين المفوَّض ومسارا الإلحاق — SPEC_org_and_accounts §٤ + SPEC_authorization §١.٦.
 *
 * **صفر فحص دور**: القرار كلُّه عبر `canProvision()` (الشروط الخمسة) و`can()`. لا تكرارَ
 * لمنطق المصفوفة هنا. و**ذرّي**: كل دفعة إنشاءٍ في `transaction` — عطبٌ جزئيّ يُرجع كلَّ شيء.
 */

import { OrgStore } from "../data/store.js"
import { isSuspendedRole } from "../data/hierarchy.js"
import {
  ok,
  err,
  type Account,
  type RegistrationRequest,
  type Result,
  type StoredAssignment,
} from "../types.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import { canProvision, type ProvisionDecision } from "../../../authorization/provision.js"
import type { RoleId } from "../../../authorization/generated/roles.generated.js"

/** يترجم قرارَ المصفوفة إلى خطأٍ مصنَّف: الموقوف صنفٌ مستقلّ، والباقي تصعيدٌ مرفوض. */
function provisionError(dec: ProvisionDecision): Result<never> {
  if (dec.failedCondition === "موقوف") return err("ROLE_SUSPENDED")
  return err("PROVISION_DENIED", dec.failedCondition)
}

function newAssignment(
  store: OrgStore,
  personId: string,
  roleId: RoleId,
  unitId: string,
  scopePath: string,
  now: Date,
): StoredAssignment {
  return {
    tenantId: store.tenantId,
    id: store.nextId("a"),
    personId,
    roleId,
    unitId,
    scopePath,
    startDate: now,
    endDate: null,
    approvalStatus: "approved",
  }
}

export type ProvisionInput = {
  readonly targetUnitId: string
  readonly targetRoleId: RoleId
  readonly username: string
}

export function provision(
  store: OrgStore,
  provisioner: Actor,
  ctx: DecisionContext,
  input: ProvisionInput,
): Result<{ account: Account; assignment: StoredAssignment }> {
  // النطاق يُشتقّ من الكيان المخزَّن لا من مدخل العميل (§٥.٢).
  const unit = store.getUnit(input.targetUnitId)
  if (unit === null) return err("ENTITY_NOT_FOUND")
  if (isSuspendedRole(input.targetRoleId)) return err("ROLE_SUSPENDED")

  const dec = canProvision(provisioner, input.targetRoleId, unit.path, unit.type, ctx)
  if (!dec.allowed) return provisionError(dec)

  if (store.hasUsername(input.username)) return err("USERNAME_TAKEN")

  // الدفعة الذرّية: حساب + تكليف معتمَد + تدقيق — أو لا شيء (ع-٣٣، ق-١٥).
  return store.transaction(() => {
    const account: Account = {
      tenantId: store.tenantId,
      personId: store.nextId("p"),
      username: input.username,
      status: "active",
      sessionEpoch: 1,
    }
    store.saveAccount(account)
    const assignment = newAssignment(
      store,
      account.personId,
      input.targetRoleId,
      unit.id,
      unit.path,
      ctx.now,
    )
    store.addAssignment(assignment)
    store.appendAudit({
      at: ctx.now,
      actorPersonId: provisioner.personId,
      action: "users.provision",
      capability: "users.provision",
      scopePath: unit.path,
      targetType: "account",
      targetId: account.personId,
      reason: null,
    })
    return ok({ account, assignment })
  })
}

export type PublicRequestInput = {
  readonly username: string
  readonly requestedRoleId: RoleId
  readonly requestedUnitId: string
  readonly origin?: "public" | "invited"
}

/**
 * المسار العام المعلن (CR-001 §ج): **يكتب كياناً معلّقاً واحداً ولا يقرأ بيانات شبكية**.
 * لا تحقُّقَ من وجود الوحدة هنا (قراءةٌ ممنوعة على المجهول) — التحقُّق كلُّه عند البتّ.
 */
export function submitPublicRequest(
  store: OrgStore,
  input: PublicRequestInput,
): Result<RegistrationRequest> {
  const request: RegistrationRequest = {
    tenantId: store.tenantId,
    id: store.nextId("req"),
    personId: store.nextId("p"),
    username: input.username,
    requestedRoleId: input.requestedRoleId,
    requestedUnitId: input.requestedUnitId,
    status: "pending",
    origin: input.origin ?? "public",
  }
  store.saveRequest(request)
  return ok(request)
}

export function approveRegistration(
  store: OrgStore,
  approver: Actor,
  ctx: DecisionContext,
  requestId: string,
): Result<{ account: Account; assignment: StoredAssignment }> {
  const request = store.getRequest(requestId)
  if (request === null) return err("ENTITY_NOT_FOUND")
  if (request.status !== "pending") return err("REQUEST_NOT_PENDING")

  const unit = store.getUnit(request.requestedUnitId)
  if (unit === null) return err("ENTITY_NOT_FOUND")
  if (isSuspendedRole(request.requestedRoleId)) return err("ROLE_SUSPENDED")

  // البتّ يخضع لمصفوفة §١.٦ نفسها (يقفل خ-٤: اعتماد المعلّق كان يفتقد الحارس).
  const dec = canProvision(approver, request.requestedRoleId, unit.path, unit.type, ctx)
  if (!dec.allowed) return provisionError(dec)

  const existing = store.getAccount(request.personId)
  if (existing === null && store.hasUsername(request.username)) return err("USERNAME_TAKEN")

  return store.transaction(() => {
    const account: Account =
      existing ?? {
        tenantId: store.tenantId,
        personId: request.personId,
        username: request.username,
        status: "active",
        sessionEpoch: 1,
      }
    if (existing === null) store.saveAccount(account)

    const assignment = newAssignment(
      store,
      account.personId,
      request.requestedRoleId,
      unit.id,
      unit.path,
      ctx.now,
    )
    store.addAssignment(assignment)
    store.saveRequest({ ...request, status: "approved" })
    store.appendAudit({
      at: ctx.now,
      actorPersonId: approver.personId,
      action: "registration.approve",
      capability: "registration.approve",
      scopePath: unit.path,
      targetType: "account",
      targetId: account.personId,
      reason: null,
    })
    return ok({ account, assignment })
  })
}
