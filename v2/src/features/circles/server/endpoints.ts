/**
 * دوالُّ خادم الحلقات — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٧.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة (ثلاثٌ لا رابعة).
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من إسقاطها، والحلقةُ من موطنها، والالتحاقُ
 *     من حلقته — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح** (ع-٧: لا يدير أحدٌ ما ليس له).
 *  ٣. **الشخصيُّ نطاقُه ملكيّة**: «حلقاتي» نطاقُها `selfScope` — فطلبُ صفحةِ غيرك مرفوضٌ
 *     **قبل جسم الدالة**، ومَن لا يحمل دورُه القدرةَ يُردّ بـ`DENIED_PERSONAL_NOT_IN_ROLE` (قب-٣٨).
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن يُنشئ ومَن يقرأ حلقاته يُؤخذان من `actor` حصراً.
 *
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨)، فعزلُ الشبكة يقع قبل المحرّك.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { CirclesStore } from "../data/store.js"
import type { CirclesContext } from "../services/context.js"
import { makeScopeReach, type ActorDirectory } from "../services/directory.js"
import { allTypes } from "../services/catalog.js"
import {
  archiveCircle,
  assignTeacher,
  createCircle,
  updateCircle,
  type AssignTeacherInput,
  type CreateCircleInput,
  type UpdateCircleInput,
} from "../services/circles.js"
import { endEnrollment, enroll, type EnrollInput } from "../services/enrollment.js"
import {
  circleStats,
  circlesInScope,
  circlesOfTeacher,
  viewsOf,
  type CircleStats,
  type CircleView,
} from "../services/derive.js"
import type { CircleType } from "../types.js"

/**
 * نموذجُ صفحة «حلقات المسجد» — **مصدرُ بياناتٍ واحد** لكل رقمٍ فيها (ق-١١١):
 * الحلقاتُ بسعتها وأعدادها، وكتالوجُ الأنواع للمرشّح، والنوعُ المختار.
 */
export type CirclesScopeView = {
  readonly unitPath: string
  readonly circles: readonly CircleView[]
  readonly types: readonly CircleType[]
  readonly selectedTypeId: string | null
}

/** نموذجُ صفحة «حلقاتي» — عدسةُ ملكيةٍ على الكيان نفسِه، لا موطنٌ ثانٍ (ز-٢). */
export type MyCirclesView = {
  readonly personId: string
  readonly circles: readonly CircleView[]
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: CirclesStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقٌ من **موطن الحلقة المخزَّن** — لا من مسارٍ يمرّره العميل (يقتل صنف خ). */
function circleScope(store: CirclesStore, circleId: string | undefined): Scope {
  const circle = circleId === undefined ? null : store.getCircle(circleId)
  return circle === null ? NO_SCOPE : unitScope(circle.unitPath)
}

/** نطاقُ الالتحاق **موطنُ حلقته** — فالطالبُ ابنُ الحلقة، وحارسُه حارسُها (ق-٨٤). */
function enrollmentScope(store: CirclesStore, enrollmentId: string | undefined): Scope {
  const enrollment = enrollmentId === undefined ? null : store.getEnrollment(enrollmentId)
  return enrollment === null ? NO_SCOPE : circleScope(store, enrollment.circleId)
}

export function makeCirclesEndpoints(store: CirclesStore, directory: ActorDirectory) {
  const contextOf = (actor: Actor, request: DecisionContext): CirclesContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    reaches: makeScopeReach(directory, request.now),
  })

  const scopeViewFn = defineServerFn({
    name: "circle.scope.view",
    capability: "circle.view",
    scope: (input: { unitId: string; typeId?: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "circle.scope.view",
    handler: async (input: { unitId: string; typeId?: string }): Promise<CirclesScopeView> => {
      const unit = store.getUnit(input.unitId)!
      return {
        unitPath: unit.path,
        circles: viewsOf(store, circlesInScope(store, unit.path, input.typeId)),
        types: allTypes(store),
        selectedTypeId: input.typeId ?? null,
      }
    },
  })

  const statsViewFn = defineServerFn({
    name: "circle.stats.view",
    capability: "circle.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "circle.stats.view",
    handler: async (input: { unitId: string }): Promise<CircleStats> =>
      circleStats(store, store.getUnit(input.unitId)!.path),
  })

  const createFn = defineServerFn({
    name: "circle.create",
    capability: "circle.manage",
    // نطاقُ الإنشاء **الوحدةُ بعينها**: و`circle.manage` نوعُها «ذ» ⇒ قائدُها وحدَه (ع-٥/ع-٧).
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "circle.create",
    handler: async (input: CreateCircleInput, { actor, request }) =>
      createCircle(store, contextOf(actor, request), input),
  })

  const updateFn = defineServerFn({
    name: "circle.update",
    capability: "circle.manage",
    scope: (input: { circleId: string }) => circleScope(store, input.circleId),
    intent: "write",
    audit: "circle.update",
    handler: async (input: UpdateCircleInput, { actor, request }) =>
      updateCircle(store, contextOf(actor, request), input),
  })

  const archiveFn = defineServerFn({
    name: "circle.archive",
    capability: "circle.manage",
    scope: (input: { circleId: string }) => circleScope(store, input.circleId),
    intent: "write",
    audit: "circle.archive",
    handler: async (input: { circleId: string }, { actor, request }) =>
      archiveCircle(store, contextOf(actor, request), input),
  })

  const assignTeacherFn = defineServerFn({
    name: "circle.teacher.assign",
    capability: "circle.manage",
    scope: (input: { circleId: string }) => circleScope(store, input.circleId),
    intent: "write",
    audit: "circle.teacher.assign",
    handler: async (input: AssignTeacherInput, { actor, request }) =>
      assignTeacher(store, contextOf(actor, request), input),
  })

  const enrollFn = defineServerFn({
    name: "circle.enrollment.record",
    capability: "circle.manage",
    // **ق-٨٤ الإدخالُ لمالكه**: نطاقُه موطنُ الحلقة — فالمشرفُ يرى بـ`circle.view` ولا يُدخل.
    scope: (input: { circleId: string }) => circleScope(store, input.circleId),
    intent: "write",
    audit: "circle.enrollment.record",
    handler: async (input: EnrollInput, { actor, request }) =>
      enroll(store, contextOf(actor, request), input),
  })

  const endEnrollmentFn = defineServerFn({
    name: "circle.enrollment.end",
    capability: "circle.manage",
    scope: (input: { enrollmentId: string }) => enrollmentScope(store, input.enrollmentId),
    intent: "write",
    audit: "circle.enrollment.end",
    handler: async (input: { enrollmentId: string }, { actor, request }) =>
      endEnrollment(store, contextOf(actor, request), input),
  })

  const mineFn = defineServerFn({
    name: "circle.mine.view",
    capability: "circle.teach",
    // **صفحةُ صاحبها وحده**: طلبُها بمعرّف غيرك ⇒ `DENIED_PERSONAL_NOT_OWNER`؛ ودورٌ لا
    // يحملها ⇒ `DENIED_PERSONAL_NOT_IN_ROLE` (قب-٣٨) — سببان مميِّزان لا سببٌ مبهم.
    scope: (input: { personId: string }) => selfScope(input.personId, "circle", input.personId),
    intent: "read",
    audit: "circle.mine.view",
    handler: async (_input: { personId: string }, { actor }): Promise<MyCirclesView> => ({
      // والقراءةُ **بمعرّف الجلسة** لا بالمدخل — فلا تُقرأ حلقاتُ غيرك ولو مرّ الفحص.
      personId: actor.personId,
      circles: viewsOf(store, circlesOfTeacher(store, actor.personId)),
    }),
  })

  return {
    scopeView: scopeViewFn,
    statsView: statsViewFn,
    create: createFn,
    update: updateFn,
    archive: archiveFn,
    assignTeacher: assignTeacherFn,
    enroll: enrollFn,
    endEnrollment: endEnrollmentFn,
    mine: mineFn,
  }
}
