/**
 * دوال خادم وحدة الشجرة والحسابات — SPEC_org_and_accounts §٥ + SPEC_authorization §٥.٢.
 *
 * **هنا تصير G7 عاملةً**: كل نقطةٍ تمرّ بـ`defineServerFn` بإعلانٍ إلزاميّ —
 * `capability` + مُحلِّل `scope` **يشتقّ النطاق من الكيان المخزَّن** + `audit`. الفرض يقع
 * قبل جسم الدالة؛ والكيان غير الموجود ⇒ `NO_SCOPE` ⇒ رفض (يُقفل ولا يُفتح).
 *
 * مصنعٌ يحقن المستودع: `scope`/`handler` يُغلِقان عليه — فلا استيرادَ مباشر لطبقة القاعدة،
 * ويُبدَّل المستودع في الاختبار وفي الإنتاج دون تغيير الإعلان. (أنواع المدخلات تُصرَّح على
 * المعاملات لا بوسوم توليدية — فيراها حارسُ G7 دالةً معلَنة.)
 */

import { defineServerFn, PUBLIC_DECLARED } from "../../../server/defineServerFn.js"
import { unitScope, NO_SCOPE, type Scope } from "../../../authorization/scope.js"
import { OrgStore } from "../data/store.js"
import { createUnit, moveUnit, archiveUnit } from "../services/orgTree.js"
import { setStatus, resetPassword } from "../services/accounts.js"
import { endAssignment } from "../services/assignments.js"
import { provision, approveRegistration, submitPublicRequest } from "../services/provisioning.js"
import type { CreateUnitInput, MoveUnitInput } from "../services/orgTree.js"
import type { ProvisionInput, PublicRequestInput } from "../services/provisioning.js"
import type { AccountStatus } from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنة، أو `NO_SCOPE` إن غابت — يُقفل ولا يُفتح (§٥.٢). */
function unitById(store: OrgStore, id: string | undefined): Scope {
  const unit = id === undefined ? null : store.getUnit(id)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ حسابٍ = نطاقُ أول إسنادٍ له (النطاق يُشتقّ من الكيان لا من مدخل العميل). */
function scopeOfPerson(store: OrgStore, personId: string | undefined): Scope {
  if (personId === undefined) return NO_SCOPE
  const first = store.assignmentsForPerson(personId)[0]
  return first === undefined ? NO_SCOPE : unitScope(first.scopePath)
}

export function makeOrgEndpoints(store: OrgStore) {
  const createUnitFn = defineServerFn({
    name: "orgUnit.create",
    capability: "orgUnit.manage",
    scope: (input: CreateUnitInput) => unitById(store, input.parentId),
    intent: "write",
    audit: "orgUnit.create",
    handler: async (input: CreateUnitInput, { request }) => createUnit(store, request, input),
  })

  const moveUnitFn = defineServerFn({
    name: "orgUnit.move",
    capability: "orgUnit.manage",
    scope: (input: MoveUnitInput) => unitById(store, input.unitId),
    intent: "write",
    audit: "orgUnit.move",
    handler: async (input: MoveUnitInput, { request }) => moveUnit(store, request, input),
  })

  const archiveUnitFn = defineServerFn({
    name: "orgUnit.archive",
    capability: "orgUnit.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "orgUnit.archive",
    handler: async (input: { unitId: string }, { request }) =>
      archiveUnit(store, request, input.unitId),
  })

  const provisionFn = defineServerFn({
    name: "users.provision",
    capability: "users.provision",
    scope: (input: ProvisionInput) => unitById(store, input.targetUnitId),
    intent: "write",
    audit: "users.provision",
    handler: async (input: ProvisionInput, { actor, request }) =>
      provision(store, actor, request, input),
  })

  const approveRegistrationFn = defineServerFn({
    name: "registration.approve",
    capability: "registration.approve",
    scope: (input: { requestId: string }) => {
      const req = store.getRequest(input.requestId)
      return unitById(store, req === null ? undefined : req.requestedUnitId)
    },
    intent: "write",
    audit: "registration.approve",
    handler: async (input: { requestId: string }, { actor, request }) =>
      approveRegistration(store, actor, request, input.requestId),
  })

  const publicRequestFn = defineServerFn({
    // المسار العام المعلن — في القائمة البيضاء (CR-001 §ج).
    name: "registration.publicRequest",
    capability: PUBLIC_DECLARED,
    intent: "write",
    audit: "registration.request.public",
    handler: async (input: PublicRequestInput) => submitPublicRequest(store, input),
  })

  const endAssignmentFn = defineServerFn({
    name: "assignment.end",
    capability: "user.manage",
    scope: (input: { assignmentId: string }) => {
      const a = store.assignments.find((x) => x.id === input.assignmentId)
      return a === undefined ? NO_SCOPE : unitScope(a.scopePath)
    },
    intent: "write",
    audit: "assignment.end",
    handler: async (input: { assignmentId: string }, { request }) =>
      endAssignment(store, request, input.assignmentId),
  })

  const setStatusFn = defineServerFn({
    name: "account.setStatus",
    capability: "account.status.manage",
    scope: (input: { personId: string; status: AccountStatus }) =>
      scopeOfPerson(store, input.personId),
    intent: "write",
    audit: "account.status.manage",
    handler: async (input: { personId: string; status: AccountStatus }) =>
      setStatus(store, input.personId, input.status),
  })

  const resetPasswordFn = defineServerFn({
    name: "account.resetPassword",
    capability: "account.password.reset",
    scope: (input: { personId: string }) => scopeOfPerson(store, input.personId),
    intent: "write",
    audit: "account.password.reset",
    handler: async (input: { personId: string }) => resetPassword(store, input.personId),
  })

  return {
    createUnit: createUnitFn,
    moveUnit: moveUnitFn,
    archiveUnit: archiveUnitFn,
    provision: provisionFn,
    approveRegistration: approveRegistrationFn,
    publicRequest: publicRequestFn,
    endAssignment: endAssignmentFn,
    setStatus: setStatusFn,
    resetPassword: resetPasswordFn,
  }
}
