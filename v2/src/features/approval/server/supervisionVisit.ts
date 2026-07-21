/**
 * سطوحُ الزيارة الإشرافية — `SPEC_authorization` §٥.٢ + عقدُ المحرّك §٦.
 *
 * **ملفٌّ جديدٌ لا تعديلٌ على سطوح المحرّك القائمة**: أربعُ دوالٍّ تلفّ المحرّكَ نفسَه بلا
 * سطرِ منطقٍ ثانٍ. وهنا يجتمع الشرطان ولا يندمجان: `defineServerFn` يفرض **القدرةَ** بـ`can()`
 * قبل جسم الدالة (الشرطُ اللازم)، والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة**
 * (شرطُ الكفاية) — فمالكُ `visit.approve` على نطاقٍ يحتوي المربع يمرّ من الباب ويقف عند المحرّك
 * إن لم يكن الأقرب.
 *
 * وأربعةُ ثوابتٍ كما في سائر الوحدات: قدرةٌ معلنة (G7) · نطاقٌ **يُشتقّ من الكيان المخزَّن**
 * (مرساةُ الزيارة من الزيارة، ونطاقُ البتّ من الطلب) والغائبُ ⇒ `NO_SCOPE` ⇒ رفض · فاعلٌ
 * **من الجلسة لا من المدخل** · واسمُ فعلٍ في التدقيق.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { SupervisionStore } from "../../supervision/data/store.js"
import type { ApprovalStore } from "../data/store.js"
import { makeCapabilityCheck } from "../services/authority.js"
import {
  SUPERVISION_VISIT,
  supervisionVisitPayloadSource,
  supervisionVisitPeriodOf,
} from "../registered/supervisionVisit.js"
import {
  approveRequest,
  rejectRequest,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import { pendingForApprover } from "../services/inbox.js"
import type { ApprovalRequest, ApprovalResult } from "../types.js"

/** حزمةُ مستودعَي الشبكة الواحدة — الإشرافُ مصدرُ الحمولة، والمحرّكُ مصدرُ الحالة. */
export type VisitApprovalStores = {
  readonly supervision: SupervisionStore
  readonly approval: ApprovalStore
}

/** ق-١٦: نطاقُ الرفع **مرساةُ الزيارة المخزَّنة** — لا مسارٌ يرسله العميل. */
function visitAnchorScope(stores: VisitApprovalStores, visitId: string | undefined): Scope {
  const visit = visitId === undefined ? null : stores.supervision.getVisit(visitId)
  return visit === null ? NO_SCOPE : unitScope(visit.supervisorPath)
}

/** ونطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
function requestScope(stores: VisitApprovalStores, requestId: string | undefined): Scope {
  const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
  return request === null ? NO_SCOPE : unitScope(request.unitPath)
}

function unitScopeById(stores: VisitApprovalStores, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : stores.supervision.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

export function makeVisitApprovalEndpoints(
  stores: VisitApprovalStores,
  settings: SettingsResolver,
  people: readonly Actor[],
) {
  /** سياقُ المحرّك: الساعةُ من الطلب، والفاعلُ من الجلسة، والحمولةُ مصدرُها الزيارةُ المسجَّلة. */
  const contextOf = (actor: Actor, request: DecisionContext): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    payloadFor: supervisionVisitPayloadSource(stores.supervision),
  })

  const submitFn = defineServerFn({
    name: "visit.submit",
    capability: "visit.conduct",
    scope: (input: { visitId: string }) => visitAnchorScope(stores, input.visitId),
    intent: "write",
    audit: "visit.submit",
    handler: async (
      input: { visitId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const visit = stores.supervision.getVisit(input.visitId)!
      return submitForApproval(stores.approval, contextOf(actor, request), {
        typeId: SUPERVISION_VISIT.id,
        unitPath: visit.supervisorPath,
        period: supervisionVisitPeriodOf(visit),
      })
    },
  })

  const approveFn = defineServerFn({
    name: "visit.approve",
    capability: "visit.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "visit.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      approveRequest(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const rejectFn = defineServerFn({
    name: "visit.reject",
    capability: "visit.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "visit.reject",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      rejectRequest(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const pendingFn = defineServerFn({
    name: "visit.pending",
    capability: "visit.approve",
    scope: (input: { unitId: string }) => unitScopeById(stores, input.unitId),
    intent: "read",
    audit: "visit.pending",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const unit = stores.supervision.getUnit(input.unitId)!
      return pendingForApprover(stores.approval, contextOf(actor, request), {
        typeId: SUPERVISION_VISIT.id,
        scopePath: unit.path,
      })
    },
  })

  return { submit: submitFn, approve: approveFn, reject: rejectFn, pending: pendingFn }
}
