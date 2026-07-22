/**
 * سطوحُ إقرار خطة الرواتب — `SPEC_authorization` §٥.٢ + عقدُ المحرّك §٦-و.
 *
 * **ملفٌّ جديدٌ لا تعديلٌ على سطوح المحرّك القائمة**: أربعةُ سطوحٍ تلفّ المحرّكَ نفسَه بلا
 * سطرِ منطقٍ ثانٍ. وهنا يجتمع الشرطان ولا يندمجان: `defineServerFn` يفرض **القدرةَ** بـ`can()`
 * قبل جسم الدالة (الشرطُ اللازم)، والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة**
 * (شرطُ الكفاية) — فمالكُ `payroll.approve` على نطاقٍ يحتوي الوحدة يمرّ من الباب ويقف عند المحرّك.
 *
 * **ولماذا التقديمُ هنا لا في وحدة الرواتب؟** لأن `submitForApproval` **فعلُ اعتماد**،
 * ووجودُه خارج مجلد المحرّك **يُفشل G22** — وهو الحدُّ الذي صحّحه `PARALLEL_WORK` §٨.
 * فالوحدةُ تشتقّ وتُسلّم، **والمحرّكُ يختم**؛ ولا تعرف الوحدةُ أنّ ثمّة سلسلةً أصلاً.
 *
 * **وفصلُ المهام مرسومٌ في المصفوفة قبل سطر الكود** (ب-٣٣): `finance_officer` يملك
 * `payroll.run` **ولا يملك** `payroll.approve`؛ و`admin` يملك الإقرار **ولا يملك** التقديم.
 * فمن يقترح لا يقرّ — **بالمصفوفة لا بحارسٍ في الكود**.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { PayrollStores } from "../../payroll/data/store.js"
import type { PayrollContext } from "../../payroll/services/context.js"
import type { ApprovalStore } from "../data/store.js"
import { makeCapabilityCheck } from "../services/authority.js"
import { PAYROLL_PLAN, payrollPlanPayloadSource } from "../registered/payroll.js"
import {
  approveRequest,
  rejectRequest,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import { pendingForApprover } from "../services/inbox.js"
import type { ApprovalRequest, ApprovalResult } from "../types.js"

/** نافذةُ الشهر ومَن فيه — يمرّرها المُركِّب، **لا استعلامَ داخل الخدمة** (§٤.٥). */
export type PayrollWindow = {
  readonly from: Date
  readonly to: Date
  readonly personIds: readonly string[]
}

export function makePayrollPlanEndpoints(
  stores: PayrollStores,
  approval: ApprovalStore,
  settings: SettingsResolver,
  people: readonly Actor[],
  payrollContextOf: (actor: Actor, request: DecisionContext) => PayrollContext,
  windowOf: (unitPath: string) => PayrollWindow,
) {
  const contextOf = (actor: Actor, request: DecisionContext, unitPath: string): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    // **الحمولةُ تُشتقّ من مصدرها** لحظةَ التقديم ثم تُجمَّد — وهو الختمُ بعينه.
    payloadFor: payrollPlanPayloadSource(stores, payrollContextOf(actor, request), windowOf(unitPath)),
  })

  /** نطاقُ الوحدة **من المستودع** — والوحدةُ المجهولة ⇒ `NO_SCOPE` ⇒ رفض. */
  const unitById = (unitId: string | undefined): Scope => {
    const unit = unitId === undefined ? null : stores.ledger.getUnit(unitId)
    return unit === null ? NO_SCOPE : unitScope(unit.path)
  }

  /** نطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
  const requestScope = (requestId: string | undefined): Scope => {
    const request = requestId === undefined ? null : approval.getRequest(requestId)
    return request === null ? NO_SCOPE : unitScope(request.unitPath)
  }

  const submitFn = defineServerFn({
    name: "payroll.plan.submit",
    capability: "payroll.run",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "write",
    audit: "payroll.plan.submit",
    handler: async (
      input: { unitId: string; periodId: string; endsAt: Date },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return submitForApproval(approval, contextOf(actor, request, unit.path), {
        typeId: PAYROLL_PLAN.id,
        unitPath: unit.path,
        period: { id: input.periodId, endsAt: input.endsAt },
      })
    },
  })

  const approveFn = defineServerFn({
    name: "payroll.plan.approve",
    capability: "payroll.approve",
    scope: (input: { requestId: string }) => requestScope(input.requestId),
    intent: "write",
    audit: "payroll.plan.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const stored = approval.getRequest(input.requestId)!
      return approveRequest(approval, contextOf(actor, request, stored.unitPath), {
        requestId: input.requestId,
      })
    },
  })

  const rejectFn = defineServerFn({
    name: "payroll.plan.reject",
    capability: "payroll.approve",
    scope: (input: { requestId: string }) => requestScope(input.requestId),
    intent: "write",
    audit: "payroll.plan.reject",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => {
      const stored = approval.getRequest(input.requestId)!
      return rejectRequest(approval, contextOf(actor, request, stored.unitPath), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      })
    },
  })

  const pendingFn = defineServerFn({
    name: "payroll.plan.pending",
    capability: "payroll.approve",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "read",
    audit: "payroll.plan.pending",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return pendingForApprover(approval, contextOf(actor, request, unit.path), {
        typeId: PAYROLL_PLAN.id,
        scopePath: unit.path,
      })
    },
  })

  return { submit: submitFn, approve: approveFn, reject: rejectFn, pending: pendingFn }
}
