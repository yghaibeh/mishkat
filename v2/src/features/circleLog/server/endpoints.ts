/**
 * دوالُّ خادم السجلّ اليوميّ — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §١٠.
 *
 * خمسةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة (خمسٌ لا سادسة).
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الحلقةُ من موطنها، والرابطُ من حلقته، والوحدةُ
 *     من إسقاطها — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **ق-٨٤ بابان لا بابٌ فضفاض** (ق-٩٠: «المعلّمُ نفسُه أو الأمير»): `circle.manage` على
 *     وحدة الحلقة بعينها، و`circle.teach` **الشخصيةُ** على حلقته — والمشرفُ والمديرُ **يريان
 *     بـ`circle.view` ولا يُدخلان** لأنّ أيّاً من البابين ليس لهما.
 *  ٤. **الشخصيُّ نطاقُه ملكيّةٌ من الإسناد المخزَّن**: حلقةٌ معلّمُها غيرُك ⇒
 *     `DENIED_PERSONAL_NOT_OWNER`، ودورٌ لا يحملها ⇒ `DENIED_PERSONAL_NOT_IN_ROLE` (قب-٣٨).
 *  ٥. **الفاعلُ من الجلسة لا من المدخل**: مَن يسجّل ومَن يقرأ حلقاته يُؤخذان من `actor` حصراً.
 *
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨)، فعزلُ الشبكة يقع قبل المحرّك.
 * و**صفر سطرِ اعتمادٍ هنا** (G22): اعتمادُ الدرس (ق-٨٥) خارجُ النطاق ومرفوعٌ لا مُخترَع.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { CircleLogStore } from "../data/store.js"
import type { CircleModelPort } from "../services/circleModel.js"
import type { CircleLogContext } from "../services/context.js"
import {
  NEVER_LOCKED,
  RECITATION_SHAPE_ONLY,
  type SessionLockPort,
  type SessionShapePort,
} from "../services/sessionShape.js"
import {
  recordSession,
  type RecordSessionInput,
  type SessionRowInput,
} from "../services/sessions.js"
import {
  circleDayView,
  studentRecordView,
  type CircleDayView,
  type StudentRecordView,
} from "../services/derive.js"
import { circleRanking, type RankingView } from "../services/ranking.js"
import { notesForTeacher, notesOf, recordNote } from "../services/notes.js"
import {
  issueLink,
  linksOfCircle,
  renewLink,
  revokeLink,
  type LinkSummary,
} from "../services/guardian.js"
import type { DayLogResult, SupervisionNote } from "../types.js"

export type CircleLogDeps = {
  readonly store: CircleLogStore
  readonly circles: CircleModelPort
  readonly settings: SettingsResolver
  readonly newToken: () => string
  /**
   * CR-016 — **شكلُ الجلسة يتبع نوعَ الحلقة**، ويصله المُركِّبُ بصاحب كتالوج المنهاج.
   * وغيابُه **تركيبٌ مشروعٌ لا سهو**: شبكةٌ بلا مناهجَ ⇒ كلُّ جلساتها تحفيظ (§١-ب).
   */
  readonly shape?: SessionShapePort
  /** ق-٨ — منفذُ القفل؛ وغيابُه ⇒ لا جلسةَ مقفلة (سلوكُ T18 قبل التوحيد بحرفه). */
  readonly isSessionLocked?: SessionLockPort
}

/** نموذجُ صفحة «ملاحظات الإشراف» — مصدرُ بياناتٍ واحدٌ للصفحة (ق-١١١). */
export type CircleNotesView = {
  readonly circleId: string
  readonly notes: readonly SupervisionNote[]
}

/** نموذجُ صفحة «سجلُّ حلقاتي» — عدسةُ ملكيةٍ على الكيان نفسِه، لا موطنٌ ثانٍ (ز-٢). */
export type MyCirclesLogView = {
  readonly personId: string
  readonly circles: readonly { readonly circleId: string; readonly typeId: string }[]
}

export function makeCircleLogEndpoints(deps: CircleLogDeps) {
  const { store, circles } = deps

  const contextOf = (actor: Actor, request: DecisionContext): CircleLogContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings: deps.settings,
    circles,
    newToken: deps.newToken,
    shape: deps.shape ?? RECITATION_SHAPE_ONLY,
    isSessionLocked: deps.isSessionLocked ?? NEVER_LOCKED,
  })

  /** نطاقٌ من **موطن الحلقة المخزَّن** — لا من مسارٍ يمرّره العميل (يقتل صنف خ). */
  const circleScope = (circleId: string | undefined): Scope => {
    const circle = circleId === undefined ? null : circles.circleOf(circleId)
    return circle === null ? NO_SCOPE : unitScope(circle.unitPath)
  }

  /** النطاقُ الشخصيّ **من الإسناد المخزَّن**: حلقةٌ بلا معلّمٍ ⇒ لا مالكَ ⇒ لا باب. */
  const teacherScope = (circleId: string | undefined): Scope => {
    const circle = circleId === undefined ? null : circles.circleOf(circleId)
    if (circle === null || circle.teacherPersonId === null) return NO_SCOPE
    return selfScope(circle.teacherPersonId, "circleLog", circle.id)
  }

  /** نطاقُ الرابط **موطنُ حلقته** — فالرابطُ ابنُ التسجيل داخل الحلقة (IA ك-٦). */
  const linkScope = (linkId: string | undefined): Scope => {
    const link = linkId === undefined ? null : store.getLink(linkId)
    return link === null ? NO_SCOPE : circleScope(link.circleId)
  }

  /** نطاقُ وحدةٍ من إسقاطها المخزَّن — والمجهولةُ ⇒ `NO_SCOPE`. */
  const unitById = (unitId: string | undefined): Scope => {
    const path = unitId === undefined ? null : circles.unitPathOf(unitId)
    return path === null ? NO_SCOPE : unitScope(path)
  }

  type RecordInput = {
    readonly circleId: string
    readonly at: Date
    /** **CR-٠٢٠** — فترةُ اليوم من القائمة المحصورة؛ وغيابُها يُحسم في الخدمة لا هنا. */
    readonly periodId?: string
    readonly rows: readonly SessionRowInput[]
  }

  const write = (
    input: RecordInput,
    actor: Actor,
    request: DecisionContext,
  ): DayLogResult<unknown> =>
    recordSession(store, contextOf(actor, request), input as RecordSessionInput)

  // ── ق-٩٠/ق-٨٤ — بابا الإدخال ────────────────────────────────────────────────
  const recordFn = defineServerFn({
    name: "circle.log.record",
    capability: "circle.manage",
    // نطاقُ «ذ» (مطابقةٌ تامّة) ⇒ **أميرُ المكان وحده**، لا مَن فوقه (ق-٨٤).
    scope: (input: RecordInput) => circleScope(input.circleId),
    intent: "write",
    audit: "circle.log.record",
    handler: async (input: RecordInput, { actor, request }) => write(input, actor, request),
  })

  const recordMineFn = defineServerFn({
    name: "circle.log.record.mine",
    capability: "circle.teach",
    // **المعلّمُ نفسُه** (ق-٩٠): نطاقٌ شخصيٌّ من الإسناد المخزَّن — لا من مدخل العميل.
    scope: (input: RecordInput) => teacherScope(input.circleId),
    intent: "write",
    audit: "circle.log.record.mine",
    handler: async (input: RecordInput, { actor, request }) => write(input, actor, request),
  })

  // ── العرض (ق-٨٤: المشرفُ والمديرُ **يريان** ولا يُدخلان) ─────────────────────
  type DayInput = { readonly circleId: string; readonly at: Date; readonly periodId?: string }

  const dayViewFn = defineServerFn({
    name: "circle.log.day.view",
    capability: "circle.view",
    scope: (input: DayInput) => circleScope(input.circleId),
    intent: "read",
    audit: "circle.log.day.view",
    handler: async (input: DayInput, { actor, request }): Promise<DayLogResult<CircleDayView>> =>
      circleDayView(store, contextOf(actor, request), input),
  })

  const mineViewFn = defineServerFn({
    name: "circle.log.mine.view",
    capability: "circle.teach",
    // **صفحةُ صاحبها وحده**: طلبُها بمعرّف غيرك ⇒ `DENIED_PERSONAL_NOT_OWNER`؛ ودورٌ لا
    // يحملها ⇒ `DENIED_PERSONAL_NOT_IN_ROLE` (قب-٣٨) — سببان مميِّزان لا سببٌ مبهم.
    scope: (input: { personId: string }) => selfScope(input.personId, "circleLog", input.personId),
    intent: "read",
    audit: "circle.log.mine.view",
    handler: async (_input: { personId: string }, { actor }): Promise<MyCirclesLogView> => ({
      // والقراءةُ **بمعرّف الجلسة** لا بالمدخل — فلا تُقرأ حلقاتُ غيرك ولو مرّ الفحص.
      personId: actor.personId,
      circles: circles
        .circlesOfTeacher(actor.personId)
        .map((c) => ({ circleId: c.id, typeId: c.typeId })),
    }),
  })

  const rankingViewFn = defineServerFn({
    name: "circle.ranking.view",
    capability: "circle.view",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "read",
    audit: "circle.ranking.view",
    handler: async (input: { unitId: string }, { actor, request }): Promise<RankingView> =>
      circleRanking(store, contextOf(actor, request), {
        // الوحدةُ مضمونةُ الوجود: النطاقُ الغائبُ ردّه المحرّكُ قبل بلوغ الجسم (`NO_SCOPE`).
        unitPath: circles.unitPathOf(input.unitId)!,
      }),
  })

  type StudentInput = { readonly circleId: string; readonly enrollmentId: string }

  const studentRecordFn = defineServerFn({
    name: "circle.student.record.view",
    capability: "circle.view",
    scope: (input: StudentInput) => circleScope(input.circleId),
    intent: "read",
    audit: "circle.student.record.view",
    handler: async (
      input: StudentInput,
      { actor, request },
    ): Promise<DayLogResult<StudentRecordView>> =>
      studentRecordView(store, contextOf(actor, request), input),
  })

  // ── ق-٨٧ + ب-٣٥أ — ملاحظاتُ الإشراف ────────────────────────────────────────
  type NoteInput = { readonly circleId: string; readonly bodyAr: string }

  const noteRecordFn = defineServerFn({
    name: "circle.notes.record",
    capability: "circle.notes.supervise",
    scope: (input: NoteInput) => circleScope(input.circleId),
    intent: "write",
    audit: "circle.notes.record",
    handler: async (input: NoteInput, { actor, request }) =>
      recordNote(store, contextOf(actor, request), input),
  })

  const notesViewFn = defineServerFn({
    name: "circle.notes.view",
    capability: "circle.view",
    scope: (input: { circleId: string }) => circleScope(input.circleId),
    intent: "read",
    audit: "circle.notes.view",
    handler: async (input: { circleId: string }): Promise<CircleNotesView> => ({
      circleId: input.circleId,
      notes: notesOf(store, input.circleId),
    }),
  })

  const notesMineViewFn = defineServerFn({
    name: "circle.notes.mine.view",
    capability: "circle.teach",
    // **يقرأ ولا يحرّر** (ب-٣٥أ): بابُ القراءة شخصيٌّ على حلقته، وبابُ الكتابة قدرةٌ أخرى
    // ليست في حزمته — فالطبقتان معاً، لا إخفاءُ زرٍّ وحده.
    scope: (input: { circleId: string }) => teacherScope(input.circleId),
    intent: "read",
    audit: "circle.notes.mine.view",
    handler: async (
      input: { circleId: string },
      { actor, request },
    ): Promise<CircleNotesView> => ({
      circleId: input.circleId,
      notes: notesForTeacher(store, contextOf(actor, request), input.circleId),
    }),
  })

  // ── ق-٩٣ + ب-٣٦أ — رابطُ وليّ الأمر ────────────────────────────────────────
  type IssueInput = { readonly circleId: string; readonly enrollmentId: string }

  const linkIssueFn = defineServerFn({
    name: "guardianLink.issue",
    capability: "guardianLink.manage",
    scope: (input: IssueInput) => circleScope(input.circleId),
    intent: "write",
    audit: "guardianLink.issue",
    handler: async (input: IssueInput, { actor, request }) =>
      issueLink(store, contextOf(actor, request), input),
  })

  const linkRenewFn = defineServerFn({
    name: "guardianLink.renew",
    capability: "guardianLink.manage",
    scope: (input: { linkId: string }) => linkScope(input.linkId),
    intent: "write",
    audit: "guardianLink.renew",
    handler: async (input: { linkId: string }, { actor, request }) =>
      renewLink(store, contextOf(actor, request), input),
  })

  const linkRevokeFn = defineServerFn({
    name: "guardianLink.revoke",
    capability: "guardianLink.manage",
    scope: (input: { linkId: string }) => linkScope(input.linkId),
    intent: "write",
    audit: "guardianLink.revoke",
    handler: async (input: { linkId: string }, { actor, request }) =>
      revokeLink(store, contextOf(actor, request), input),
  })

  const linkListFn = defineServerFn({
    name: "guardianLink.list",
    capability: "guardianLink.manage",
    scope: (input: { circleId: string }) => circleScope(input.circleId),
    intent: "read",
    audit: "guardianLink.list",
    handler: async (
      input: { circleId: string },
      { actor, request },
    ): Promise<readonly LinkSummary[]> =>
      linksOfCircle(store, contextOf(actor, request), input.circleId),
  })

  return {
    record: recordFn,
    recordMine: recordMineFn,
    dayView: dayViewFn,
    mineView: mineViewFn,
    rankingView: rankingViewFn,
    studentRecordView: studentRecordFn,
    noteRecord: noteRecordFn,
    notesView: notesViewFn,
    notesMineView: notesMineViewFn,
    linkIssue: linkIssueFn,
    linkRenew: linkRenewFn,
    linkRevoke: linkRevokeFn,
    linkList: linkListFn,
  }
}
