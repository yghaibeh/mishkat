/**
 * سطوحُ السجل الأسبوعيّ — `SPEC_authorization` §٥.٢ + عقدُ المحرّك §٦.
 *
 * **ملفٌّ جديدٌ لا تعديلٌ على سطوح المحرّك القائمة**: خمسُ دوالٍّ تلفّ المحرّكَ نفسَه بلا
 * سطرِ منطقٍ ثانٍ. وهنا يجتمع الشرطان ولا يندمجان: `defineServerFn` يفرض **القدرةَ** بـ`can()`
 * قبل جسم الدالة (الشرطُ اللازم)، والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة**
 * (شرطُ الكفاية) — فمالكُ `report.approve` على نطاقٍ يحتوي المسجد يمرّ من الباب ويقف عند المحرّك.
 *
 * وأربعةُ ثوابتٍ كما في سائر الوحدات: قدرةٌ معلنة (G7) · نطاقٌ **يُشتقّ من الكيان المخزَّن**
 * والغائبُ ⇒ `NO_SCOPE` ⇒ رفض · فاعلٌ **من الجلسة لا من المدخل** · واسمُ فعلٍ في التدقيق.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { DailyLogStore } from "../../dailyLog/data/store.js"
import type { ApprovalStore } from "../data/store.js"
import { makeCapabilityCheck } from "../services/authority.js"
import { WEEKLY_RECORD, weeklyRecordPayloadSource } from "../registered/weeklyRecord.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import { pendingForApprover } from "../services/inbox.js"
import type { ApprovalPeriod, ApprovalRequest, ApprovalResult } from "../types.js"

/** حزمةُ مستودعَي الشبكة الواحدة — سجلُّ اليوم مصدرُ الحمولة، والمحرّكُ مصدرُ الحالة. */
export type WeeklyRecordStores = {
  readonly approval: ApprovalStore
  readonly dailyLog: DailyLogStore
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(stores: WeeklyRecordStores, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : stores.dailyLog.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
function requestScope(stores: WeeklyRecordStores, requestId: string | undefined): Scope {
  const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
  return request === null ? NO_SCOPE : unitScope(request.unitPath)
}

export function makeWeeklyRecordEndpoints(
  stores: WeeklyRecordStores,
  settings: SettingsResolver,
  people: readonly Actor[],
) {
  /** سياقُ المحرّك: الساعةُ من الطلب، والفاعلُ من الجلسة، والحمولةُ مصدرُها قيودُ اليوم. */
  const contextOf = (actor: Actor, request: DecisionContext): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    payloadFor: weeklyRecordPayloadSource(stores.dailyLog),
  })

  const submitFn = defineServerFn({
    name: "weekly.record.submit",
    capability: "report.submit",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "write",
    audit: "weekly.record.submit",
    handler: async (
      input: { unitId: string; period: ApprovalPeriod },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const unit = stores.dailyLog.getUnit(input.unitId)!
      return submitForApproval(stores.approval, contextOf(actor, request), {
        typeId: WEEKLY_RECORD.id,
        unitPath: unit.path,
        period: input.period,
      })
    },
  })

  const approveFn = defineServerFn({
    name: "weekly.record.approve",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "weekly.record.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      approveRequest(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const rejectFn = defineServerFn({
    name: "weekly.record.reject",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "weekly.record.reject",
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
    name: "weekly.record.retract",
    capability: "report.retract",
    scope: (input: { requestId: string }) => requestScope(stores, input.requestId),
    intent: "write",
    audit: "weekly.record.retract",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      retractSubmission(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const pendingFn = defineServerFn({
    name: "weekly.record.pending",
    capability: "report.approve",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "weekly.record.pending",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const unit = stores.dailyLog.getUnit(input.unitId)!
      return pendingForApprover(stores.approval, contextOf(actor, request), {
        typeId: WEEKLY_RECORD.id,
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
