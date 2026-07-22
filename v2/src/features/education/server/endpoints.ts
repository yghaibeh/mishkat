/**
 * دوالُّ خادم التعليم — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٨.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة (أربعٌ لا خامسة).
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الحلقةُ من منفذِ شبكة الطلب، والغائبةُ ⇒ `NO_SCOPE`
 *     ⇒ **رفضٌ يُقفل ولا يُفتح** — فيقع عزلُ الشبكة قبل فحص القدرة (قب-١٨).
 *  ٣. **الشخصيُّ نطاقُه ملكيّة**: بابُ المعلّم نطاقُه **معلّمُ الحلقة المخزَّن**، فمن ليس
 *     صاحبَها يُردّ بـ`DENIED_PERSONAL_NOT_OWNER`، ومَن لا تحمل حزمةُ دورِه القدرةَ يُردّ
 *     بـ`DENIED_PERSONAL_NOT_IN_ROLE` (قب-٣٨) — سببان مميِّزان لا سببٌ مبهم.
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن أدخل ومَن صحّح ومَن يقرأ دروسَه من `actor` حصراً.
 *
 * **وليس هنا سطحُ اعتمادٍ واحد** (G22): تقديمُ الدرس واعتمادُه ورفضُه وسحبُه سطوحٌ تعيش في
 * مجلد المحرّك (`approval/server/education.ts`) — والحالُ يصل هذه الوحدةَ **منفذاً محقوناً**.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, rootScope, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { EducationStore } from "../data/store.js"
import type { EducationPorts } from "../services/bindings.js"
import type { EducationContext } from "../services/context.js"
import type { CircleDay, CircleDayPort, LessonApprovalCheck } from "../services/ports.js"
import {
  lessonsOfCircle,
  lessonsOfTeacher,
  recordLesson,
  type RecordLessonInput,
} from "../services/lessons.js"
import {
  curriculumProgress,
  markProgress,
  type MarkProgressInput,
  type ProgressMatrix,
} from "../services/progress.js"
import {
  manhajTree,
  upsertBook,
  upsertCurriculum,
  upsertLevel,
  upsertSession,
  type ManhajCurriculum,
} from "../services/curriculum.js"
import type { EducationResult, ProgressCorrection } from "../types.js"

/** سطرُ درسٍ كما تعرضه الشاشة — **كلُّ حقلٍ فيه مشتقٌّ** من المصدر الواحد (ق-١١١). */
export type LessonRow = {
  readonly lessonId: string
  /** يومُ انعقاده — **مفتاحُ الجلسة الطبيعيّ** عند صاحب الكيان (CR-016). */
  readonly dayKey: string
  readonly sessionId: string
  readonly sessionAr: string
  readonly heldAt: Date
  readonly durationMinutes: number
  readonly venueAr: string | null
  readonly presentCount: number
  readonly rosterCount: number
  readonly photoCount: number
  /** حالُ الدرس **من المنفذ** — ولا حقلَ يحفظه في أيّ كيان (G22). */
  readonly approved: boolean
}

/** نموذجُ صفحة «دروسُ الحلقة وتقدّمُ المنهج» — مصدرُ بياناتٍ واحد. */
export type CircleLessonsView = {
  readonly circleId: string
  readonly unitPath: string
  readonly curriculumAr: string
  readonly lessons: readonly LessonRow[]
  readonly progress: ProgressMatrix
}

/** نموذجُ صفحة «دروسي» — عدسةُ ملكيةٍ على الكيان نفسِه لا موطنٌ ثانٍ (IA ز-٢). */
export type MyLessonsView = {
  readonly personId: string
  readonly lessons: readonly LessonRow[]
}

/** مدخلُ إدارة المنهاج — **صفٌّ يُضاف بياناً** (قب-٢٢)، بأربعة أشكالٍ مميَّزة لا شكلٍ مبهم. */
export type ManhajUpsertInput =
  | { readonly kind: "curriculum"; readonly id: string; readonly ar: string; readonly circleTypeId: string }
  | { readonly kind: "level"; readonly id: string; readonly ar: string; readonly curriculumId: string; readonly ordinal: number }
  | { readonly kind: "book"; readonly id: string; readonly ar: string; readonly levelId: string; readonly ordinal: number }
  | { readonly kind: "session"; readonly id: string; readonly ar: string; readonly bookId: string; readonly ordinal: number }

export function makeEducationEndpoints(
  store: EducationStore,
  ports: EducationPorts,
  settings: SettingsResolver,
  /** ق-٨٥: منفذُ حال الاعتماد — يُحقن من مُركِّب النظام، فلا تعرف الوحدةُ السلسلة (G22). */
  isLessonApproved: LessonApprovalCheck,
  /**
   * CR-016 — **منفذُ الجلسة اليومية**: كيانٌ واحدٌ موطنُه وحدةُ السجل اليوميّ، يُبنى لكل طلبٍ
   * بساعته وفاعله (`services/dayLogPort.ts` هو ملفُّ الوصل الوحيد الذي يُنفّذه).
   */
  daysFor: (actorPersonId: string, now: Date) => CircleDayPort,
) {
  const contextOf = (actor: Actor, request: DecisionContext): EducationContext => ({
    ...ports,
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    isLessonApproved,
    days: daysFor(actor.personId, request.now),
  })

  /** نطاقٌ من **موطن الحلقة المخزَّن** — لا من مسارٍ يمرّره العميل (يقتل صنف خ). */
  const circleScope = (circleId: string | undefined): Scope => {
    const circle = circleId === undefined ? null : ports.circleOf(circleId)
    return circle === null ? NO_SCOPE : unitScope(circle.unitPath)
  }

  /** نطاقُ البابِ الشخصيّ — **معلّمُ الحلقة المخزَّن**؛ وبلا معلّمٍ لا مالكَ فلا باب. */
  const teacherScope = (circleId: string | undefined): Scope => {
    const circle = circleId === undefined ? null : ports.circleOf(circleId)
    if (circle === null || circle.teacherPersonId === null) return NO_SCOPE
    return selfScope(circle.teacherPersonId, "lesson", circle.id)
  }

  /** **كلُّ رقمٍ في السطر مشتقٌّ** من الجلسة في موطنها — ولا حقلَ يحفظ عدداً (ق-١١١). */
  const rowOf = (lesson: CircleDay): LessonRow => ({
    lessonId: lesson.id,
    dayKey: lesson.dayKey,
    sessionId: lesson.curriculumSessionId,
    sessionAr: store.getSession(lesson.curriculumSessionId)?.ar ?? "",
    heldAt: lesson.heldAt,
    durationMinutes: lesson.durationMinutes,
    venueAr: lesson.venueAr,
    presentCount: lesson.presentEnrollmentIds.length,
    rosterCount: lesson.rosterEnrollmentIds.length,
    photoCount: lesson.photoKeys.length,
    approved: isLessonApproved(lesson.id),
  })

  // ① بابُ المعلّم المالك (ق-٨٤ · قب-٣٨) ─────────────────────────────────────
  const recordFn = defineServerFn({
    name: "education.lesson.record",
    capability: "circle.teach",
    scope: (input: { circleId: string }) => teacherScope(input.circleId),
    intent: "write",
    audit: "education.lesson.record",
    handler: async (
      input: RecordLessonInput,
      { actor, request },
    ): Promise<EducationResult<CircleDay>> =>
      recordLesson(store, contextOf(actor, request), input),
  })

  // ② بابُ أمير المكان (ق-٨٤/ق-٩٠) — **الكاتبُ نفسُه، وقدرةٌ أخرى** ────────────
  const recordByOwnerFn = defineServerFn({
    name: "education.lesson.record.owner",
    capability: "circle.manage",
    scope: (input: { circleId: string }) => circleScope(input.circleId),
    intent: "write",
    audit: "education.lesson.record.owner",
    handler: async (
      input: RecordLessonInput,
      { actor, request },
    ): Promise<EducationResult<CircleDay>> =>
      recordLesson(store, contextOf(actor, request), input),
  })

  // ③ التصحيحُ اليدويّ المحكوم (ق-٩٢ ذيلاً · قب-٩) ───────────────────────────
  const markProgressFn = defineServerFn({
    name: "education.progress.mark",
    capability: "circle.manage",
    scope: (input: { circleId: string }) => circleScope(input.circleId),
    intent: "write",
    audit: "education.progress.mark",
    handler: async (
      input: MarkProgressInput,
      { actor, request },
    ): Promise<EducationResult<ProgressCorrection>> =>
      markProgress(store, contextOf(actor, request), input),
  })

  // ④ دروسُ الحلقة وتقدّمُها — اطّلاعٌ بلا إدخال (ق-٨٤) ────────────────────────
  const circleLessonsFn = defineServerFn({
    name: "education.circle.lessons.view",
    capability: "circle.view",
    scope: (input: { circleId: string }) => circleScope(input.circleId),
    intent: "read",
    audit: "education.circle.lessons.view",
    handler: async (
      input: { circleId: string },
      { actor, request },
    ): Promise<CircleLessonsView> => {
      const ctx = contextOf(actor, request)
      const circle = ports.circleOf(input.circleId)!
      const progress = curriculumProgress(store, ctx, circle.id)
      return {
        circleId: circle.id,
        unitPath: circle.unitPath,
        curriculumAr: progress.ok ? progress.value.curriculumAr : "",
        lessons: lessonsOfCircle(ctx, circle.id).map(rowOf),
        progress: progress.ok
          ? progress.value
          : {
              circleId: circle.id,
              curriculumId: "",
              curriculumAr: "",
              sessions: [],
              rows: [],
              completedCells: 0,
              totalCells: 0,
            },
      }
    },
  })

  // ⑤ «دروسي» — نطاقٌ شخصيٌّ من معرّف الجلسة (عدسةُ المعلّم §٢.٦) ──────────────
  const mineFn = defineServerFn({
    name: "education.mine.lessons.view",
    capability: "circle.teach",
    scope: (input: { personId: string }) => selfScope(input.personId, "lesson", input.personId),
    intent: "read",
    audit: "education.mine.lessons.view",
    handler: async (
      _input: { personId: string },
      { actor, request },
    ): Promise<MyLessonsView> => ({
      // والقراءةُ **بمعرّف الجلسة** لا بالمدخل — فلا تُقرأ دروسُ غيرك ولو مرّ الفحص.
      personId: actor.personId,
      lessons: lessonsOfTeacher(contextOf(actor, request), actor.personId).map(rowOf),
    }),
  })

  // ⑥⑦ المنهاجُ بابٌ مرجعيٌّ في عدسة المدير (قب-٢٢) — بلا قدرةٍ جديدة ──────────
  const manhajViewFn = defineServerFn({
    name: "education.manhaj.view",
    capability: "activityCatalog.manage",
    // قدرةٌ **جذرية**: نطاقُها الجذر صراحةً — فلا يكون الشمولُ سهواً (المادة ٤/٣).
    scope: () => rootScope(),
    intent: "read",
    audit: "education.manhaj.view",
    handler: async (input: Record<string, never>): Promise<readonly ManhajCurriculum[]> => {
      void input
      return manhajTree(store)
    },
  })

  const manhajUpsertFn = defineServerFn({
    name: "education.manhaj.upsert",
    capability: "activityCatalog.manage",
    scope: () => rootScope(),
    intent: "write",
    audit: "education.manhaj.upsert",
    handler: async (input: ManhajUpsertInput, { actor, request }) => {
      const ctx = contextOf(actor, request)
      switch (input.kind) {
        case "curriculum":
          return upsertCurriculum(store, ctx, input)
        case "level":
          return upsertLevel(store, ctx, input)
        case "book":
          return upsertBook(store, ctx, input)
        case "session":
          return upsertSession(store, ctx, input)
      }
    },
  })

  return {
    record: recordFn,
    recordByOwner: recordByOwnerFn,
    markProgress: markProgressFn,
    circleLessons: circleLessonsFn,
    mine: mineFn,
    manhajView: manhajViewFn,
    manhajUpsert: manhajUpsertFn,
  }
}
