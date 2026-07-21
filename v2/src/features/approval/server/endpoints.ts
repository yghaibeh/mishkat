/**
 * دوالُّ خادم المحرّك — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * **هنا يجتمع الشرطان ولا يندمجان**:
 *  - `defineServerFn` يفرض **القدرةَ** بـ`can()` **قبل جسم الدالة** (الشرطُ اللازم)؛
 *  - والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة** (شرطُ الكفاية).
 * فمالكُ `box.closing.approve` على نطاقٍ يحتوي الوحدة **يمرّ من الباب ويقف عند المحرّك**.
 *
 * وأربعةُ ثوابتٍ كما في سائر الوحدات: قدرةٌ معلنة (G7) · نطاقٌ **يُشتقّ من الكيان المخزَّن**
 * والغائبُ ⇒ `NO_SCOPE` ⇒ رفض · فاعلٌ **من الجلسة لا من المدخل** · واسمُ فعلٍ في التدقيق.
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨) فعزلُ الشبكة يقع قبل المحرّك.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, rootScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { ApprovalStores } from "../data/tenant.js"
import { makeCapabilityCheck } from "../services/authority.js"
import { boxClosingPayloadSource } from "../registered/boxClosing.js"
import {
  approveRequest,
  rejectRequest,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import {
  breakGlassApprove,
} from "../services/exceptions.js"
import {
  pendingForApprover,
} from "../services/inbox.js"
import type { ApprovalPeriod, ApprovalRequest, ApprovalResult } from "../types.js"

const BOX_CLOSING_TYPE = "box.closing"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(stores: ApprovalStores, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : stores.box.ledger.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
function requestScope(stores: ApprovalStores, requestId: string | undefined): Scope {
  const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
  return request === null ? NO_SCOPE : unitScope(request.unitPath)
}

export function makeApprovalEndpoints(
  stores: ApprovalStores,
  settings: SettingsResolver,
  people: readonly Actor[],
) {
  /** سياقُ المحرّك: الساعةُ من الطلب، والفاعلُ من الجلسة، والحمولةُ مصدرُها الدفتر. */
  const contextOf = (actor: Actor, request: DecisionContext): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    payloadFor: boxClosingPayloadSource(stores.box),
  })

  const submitFn = defineServerFn({
    name: "box.closing.submit",
    capability: "box.closing.submit",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "write",
    audit: "box.closing.submit",
    handler: async (
      input: { unitId: string; period: ApprovalPeriod },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const unit = stores.box.ledger.getUnit(input.unitId)!
      return submitForApproval(stores.approval, contextOf(actor, request), {
        typeId: BOX_CLOSING_TYPE,
        unitPath: unit.path,
        period: input.period,
      })
    },
  })

  const approveFn = defineServerFn({
    name: "box.closing.approve",
    capability: "box.closing.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "box.closing.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      approveRequest(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const rejectFn = defineServerFn({
    name: "box.closing.reject",
    capability: "box.closing.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "box.closing.reject",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      rejectRequest(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const breakGlassFn = defineServerFn({
    name: "box.closing.breakGlass",
    capability: "approve.breakGlass",
    // قدرةٌ **جذرية**: نطاقُها الجذر صراحةً — فلا يكون الشمولُ سهواً (المادة ٤/٣).
    scope: () => rootScope(),
    intent: "write",
    audit: "box.closing.breakGlass",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      breakGlassApprove(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
      }),
  })

  const pendingFn = defineServerFn({
    name: "box.closing.pending",
    capability: "box.closing.approve",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "box.closing.pending",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const unit = stores.box.ledger.getUnit(input.unitId)!
      return pendingForApprover(stores.approval, contextOf(actor, request), {
        typeId: BOX_CLOSING_TYPE,
        scopePath: unit.path,
      })
    },
  })

  return {
    submit: submitFn,
    approve: approveFn,
    reject: rejectFn,
    breakGlass: breakGlassFn,
    pending: pendingFn,
  }
}
