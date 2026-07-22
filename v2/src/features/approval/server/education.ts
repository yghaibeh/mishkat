/**
 * سطوحُ اعتماد درس الحلقة — `SPEC_authorization` §٥.٢ + عقدُ المحرّك §٦-هـ.
 *
 * **ملفٌّ جديدٌ لا تعديلٌ على سطوح المحرّك القائمة**: ثمانيةُ سطوحٍ تلفّ المحرّكَ نفسَه بلا
 * سطرِ منطقٍ ثانٍ. وهنا يجتمع الشرطان ولا يندمجان: `defineServerFn` يفرض **القدرةَ** بـ`can()`
 * قبل جسم الدالة (الشرطُ اللازم)، والمحرّكُ في الجسم يفرض **الأقربيّةَ والحالةَ والهويّة**
 * (شرطُ الكفاية) — فمالكُ قدرةِ الاعتماد على نطاقٍ يحتوي الحلقة يمرّ من الباب ويقف عند المحرّك.
 *
 * **ولماذا بابا تقديمٍ لا باب؟** ق-٨٤ تمنح الإدخالَ لصاحبَي حقٍّ **مختلفَي نوع القدرة**:
 * المعلّمُ المالك (شخصية) وأميرُ المكان (منطاقة «ذ»)؛ والإعلانُ على دالة الخادم **قدرةٌ واحدة
 * لا `anyOf`**. فبابان رفيعان يفوّضان **المحرّكَ نفسَه**، لا منطقان يتباعدان.
 *
 * وأربعةُ ثوابتٍ كما في سائر السطوح: قدرةٌ معلنة (G7) · نطاقٌ **يُشتقّ من الكيان المخزَّن**
 * والغائبُ ⇒ `NO_SCOPE` ⇒ رفض · فاعلٌ **من الجلسة لا من المدخل** · واسمُ فعلٍ في التدقيق.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, rootScope, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { EducationPorts } from "../../education/services/bindings.js"
import type { CircleDayReadPort } from "../../education/services/ports.js"
import type { ApprovalStore } from "../data/store.js"
import { makeCapabilityCheck } from "../services/authority.js"
import {
  EDUCATION_LESSON,
  circleAnchorPath,
  educationLessonPayloadSource,
} from "../registered/education.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
  type ApprovalContext,
} from "../services/engine.js"
import { breakGlassApprove, overrideApprove } from "../services/exceptions.js"
import { pendingForApprover } from "../services/inbox.js"
import type { ApprovalRequest, ApprovalResult } from "../types.js"

/**
 * حزمةُ الشبكة الواحدة — **الجلسةُ اليومية مصدرُ الحمولة والمِرساة** (CR-016: كيانٌ واحدٌ
 * يُقرأ من موطنه بمنفذ)، والمحرّكُ مصدرُ الحالة.
 */
export type EducationApprovalStores = {
  readonly approval: ApprovalStore
  readonly days: CircleDayReadPort
}

export function makeEducationLessonEndpoints(
  stores: EducationApprovalStores,
  ports: EducationPorts,
  settings: SettingsResolver,
  people: readonly Actor[],
) {
  const contextOf = (actor: Actor, request: DecisionContext): ApprovalContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    people,
    holds: makeCapabilityCheck(people, request),
    payloadFor: educationLessonPayloadSource(stores.days, ports),
  })

  /** مِرساةُ الدرس **من الكيان المخزَّن**: درسٌ ⟵ حلقتُه ⟵ مسارُها تحت وحدتها. */
  const anchorOf = (lessonId: string | undefined): string | null => {
    const lesson = lessonId === undefined ? null : stores.days.byId(lessonId)
    if (lesson === null) return null
    const circle = ports.circleOf(lesson.circleId)
    return circle === null ? null : circleAnchorPath(circle)
  }

  /** نطاقُ التقديم بالبابِ القياديّ: **وحدةُ الحلقة بعينها** («ذ» — قائدُها وحده). */
  const circleUnitScope = (lessonId: string | undefined): Scope => {
    const lesson = lessonId === undefined ? null : stores.days.byId(lessonId)
    const circle = lesson === null ? null : ports.circleOf(lesson.circleId)
    return circle === null ? NO_SCOPE : unitScope(circle.unitPath)
  }

  /** نطاقُ البابِ الشخصيّ: **معلّمُ الحلقة المخزَّن** — ومن ليس صاحبَها يُردّ قبل الجسم. */
  const teacherScope = (lessonId: string | undefined): Scope => {
    const lesson = lessonId === undefined ? null : stores.days.byId(lessonId)
    const circle = lesson === null ? null : ports.circleOf(lesson.circleId)
    if (circle === null || circle.teacherPersonId === null) return NO_SCOPE
    return selfScope(circle.teacherPersonId, "lesson", circle.id)
  }

  /** نطاقُ البتّ **من الطلب المخزَّن** لا من مدخل الباتّ — والطلبُ المجهول ⇒ رفض. */
  const requestScope = (requestId: string | undefined): Scope => {
    const request = requestId === undefined ? null : stores.approval.getRequest(requestId)
    return request === null ? NO_SCOPE : unitScope(request.unitPath)
  }

  const submit = (
    actor: Actor,
    request: DecisionContext,
    lessonId: string,
  ): ApprovalResult<ApprovalRequest> => {
    const lesson = stores.days.byId(lessonId)!
    const anchor = anchorOf(lessonId)!
    return submitForApproval(stores.approval, contextOf(actor, request), {
      typeId: EDUCATION_LESSON.id,
      unitPath: anchor,
      // **الفترةُ هي الدرسُ**: معرّفُه ولحظةُ انعقاده — فيصير الاعتمادُ «للدرس المفرد».
      period: { id: lesson.id, endsAt: lesson.heldAt },
    })
  }

  const submitFn = defineServerFn({
    name: "education.lesson.submit",
    capability: "circle.teach",
    scope: (input: { lessonId: string }) => teacherScope(input.lessonId),
    intent: "write",
    audit: "education.lesson.submit",
    handler: async (
      input: { lessonId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => submit(actor, request, input.lessonId),
  })

  const submitByOwnerFn = defineServerFn({
    name: "education.lesson.submit.owner",
    capability: "circle.manage",
    scope: (input: { lessonId: string }) => circleUnitScope(input.lessonId),
    intent: "write",
    audit: "education.lesson.submit.owner",
    handler: async (
      input: { lessonId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> => submit(actor, request, input.lessonId),
  })

  const retractFn = defineServerFn({
    name: "education.lesson.retract",
    capability: "circle.teach",
    scope: (input: { lessonId: string }) => teacherScope(input.lessonId),
    intent: "write",
    audit: "education.lesson.retract",
    handler: async (
      input: { lessonId: string; requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      retractSubmission(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const approveFn = defineServerFn({
    name: "education.lesson.approve",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(input.requestId),
    intent: "write",
    audit: "education.lesson.approve",
    handler: async (
      input: { requestId: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      approveRequest(stores.approval, contextOf(actor, request), { requestId: input.requestId }),
  })

  const rejectFn = defineServerFn({
    name: "education.lesson.reject",
    capability: "report.approve",
    scope: (input: { requestId: string }) => requestScope(input.requestId),
    intent: "write",
    audit: "education.lesson.reject",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      rejectRequest(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const overrideFn = defineServerFn({
    name: "education.lesson.override",
    capability: "report.approve.override",
    scope: (input: { requestId: string }) => requestScope(input.requestId),
    intent: "write",
    audit: "education.lesson.override",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      overrideApprove(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const breakGlassFn = defineServerFn({
    name: "education.lesson.breakGlass",
    capability: "approve.breakGlass",
    // قدرةٌ **جذرية**: نطاقُها الجذر صراحةً — فلا يكون الشمولُ سهواً (المادة ٤/٣).
    scope: () => rootScope(),
    intent: "write",
    audit: "education.lesson.breakGlass",
    handler: async (
      input: { requestId: string; reasonAr: string },
      { actor, request },
    ): Promise<ApprovalResult<ApprovalRequest>> =>
      breakGlassApprove(stores.approval, contextOf(actor, request), {
        requestId: input.requestId,
        reasonAr: input.reasonAr,
      }),
  })

  const pendingFn = defineServerFn({
    name: "education.lesson.pending",
    capability: "report.approve",
    scope: (input: { circleId: string }) => {
      const circle = ports.circleOf(input.circleId)
      return circle === null ? NO_SCOPE : unitScope(circle.unitPath)
    },
    intent: "read",
    audit: "education.lesson.pending",
    handler: async (
      input: { circleId: string },
      { actor, request },
    ): Promise<readonly ApprovalRequest[]> => {
      const circle = ports.circleOf(input.circleId)!
      return pendingForApprover(stores.approval, contextOf(actor, request), {
        typeId: EDUCATION_LESSON.id,
        scopePath: circle.unitPath,
      })
    },
  })

  return {
    submit: submitFn,
    submitByOwner: submitByOwnerFn,
    retract: retractFn,
    approve: approveFn,
    reject: rejectFn,
    override: overrideFn,
    breakGlass: breakGlassFn,
    pending: pendingFn,
  }
}
