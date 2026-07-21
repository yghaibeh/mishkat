/**
 * سطوحُ سلسلة ق-١٣ — `SPEC_authorization` §٥.٢ + عقدُ المحرّك §٦.
 *
 * **هنا يجتمع الشرطان ولا يندمجان**:
 *  - `defineServerFn` يفرض **القدرةَ** بـ`can()` **قبل جسم الدالة** (الشرطُ اللازم)؛
 *  - والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة** (شرطُ الكفاية).
 * فمالكُ `report.approve` على نطاقٍ يحتوي اللجنة **يمرّ من الباب ويقف عند المحرّك** إن لم
 * يكن أميرَ مسجدها.
 *
 * **والتقديمُ والسحبُ نطاقُهما شخصيّ**: `committee.own` صنفُها «ش»، فيُشتقّ النطاق من
 * **مسؤول اللجنة المخزَّن** (`selfScope`) — لا يقدّم أحدٌ عملَ لجنةِ غيره ولو ملك كلَّ شيءٍ آخر،
 * ولجنةٌ مسؤولُها اسمٌ حرٌّ بلا حساب (ق-٣١) **لا بابَ لها** لأن الملكيةَ شرطُ الباب.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { CommitteeStore } from "../../committees/data/store.js"
import type { ApprovalStore } from "../data/store.js"
import { makeCapabilityCheck } from "../services/authority.js"
import {
  COMMITTEE_ACTIVITY_TYPE,
  committeeActivityPayloadSource,
} from "../registered/committeeActivity.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import { pendingForApprover } from "../services/inbox.js"
import type { ApprovalPeriod, ApprovalRequest, ApprovalResult } from "../types.js"

/** مستودعا هذه السلسلة **مقترنَين بشبكةٍ واحدة** (قب-١٨): سجلُّ اللجان وسجلُّ الاعتماد. */
export type CommitteeApprovalStores = {
  readonly committees: CommitteeStore
  readonly approval: ApprovalStore
}

/** نطاقٌ **شخصيّ** من مسؤول اللجنة المخزَّن — بابُ التقديم والسحب. */
function ownedCommitteeScope(stores: CommitteeApprovalStores, committeeId: string | undefined): Scope {
  const committee = committeeId === undefined ? null : stores.committees.getCommittee(committeeId)
  if (committee === null || committee.headPersonId === null) return NO_SCOPE
  return selfScope(committee.headPersonId, "committee", committee.id)
}

/** نطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
function requestScope(stores: CommitteeApprovalStores, requestId: string | undefined): Scope {
  const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
  return request === null ? NO_SCOPE : unitScope(request.unitPath)
}

/** نطاقُ السحب: **الطلبُ ⟵ لجنتُه ⟵ مسؤولُها** — سلسلةٌ كلُّها من الكيانات المخزَّنة. */
function retractScope(stores: CommitteeApprovalStores, requestId: string | undefined): Scope {
  const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
  if (request === null) return NO_SCOPE
  const committee = stores.committees.committees().find((c) => c.path === request.unitPath)
  return ownedCommitteeScope(stores, committee?.id)
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ في مستودع هذه الشبكة، أو `NO_SCOPE` (قب-١٨). */
function unitById(stores: CommitteeApprovalStores, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : stores.committees.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

export function makeCommitteeApprovalEndpoints(
  stores: CommitteeApprovalStores,
  settings: SettingsResolver,
  people: readonly Actor[],
) {
  /** سياقُ المحرّك: الساعةُ من الطلب، والفاعلُ من الجلسة، والحمولةُ مصدرُها سجلُّ اللجنة. */
  const contextOf = (actor: Actor, request: DecisionContext): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    payloadFor: committeeActivityPayloadSource(stores.committees),
  })

  const submitFn = defineServerFn({
    name: "committee.activity.submit",
    capability: "committee.own",
    scope: (input: { committeeId: string }) => ownedCommitteeScope(stores, input.committeeId),
    intent: "write",
    audit: "committee.activity.submit",
    handler: async (
      input: { committeeId: string; period: ApprovalPeriod },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const committee = stores.committees.getCommittee(input.committeeId)!
      return submitForApproval(stores.approval, contextOf(actor, request), {
        typeId: COMMITTEE_ACTIVITY_TYPE,
        unitPath: committee.path,
        period: input.period,
      })
    },
  })

  const approveFn = defineServerFn({
    name: "committee.activity.approve",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "committee.activity.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      approveRequest(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const rejectFn = defineServerFn({
    name: "committee.activity.reject",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "committee.activity.reject",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      rejectRequest(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const retractFn = defineServerFn({
    name: "committee.activity.retract",
    capability: "committee.own",
    scope: (input: { requestId: string }) => retractScope(stores, input.requestId),
    intent: "write",
    audit: "committee.activity.retract",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      retractSubmission(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const pendingFn = defineServerFn({
    name: "committee.activity.pending",
    capability: "report.approve",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "committee.activity.pending",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const unit = stores.committees.getUnit(input.unitId)!
      return pendingForApprover(stores.approval, contextOf(actor, request), {
        typeId: COMMITTEE_ACTIVITY_TYPE,
        scopePath: unit.path,
      })
    },
  })

  return {
    submit: submitFn,
    approve: approveFn,
    reject: rejectFn,
    retract: retractFn,
    pending: pendingFn,
  }
}
