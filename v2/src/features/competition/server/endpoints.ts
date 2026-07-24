/**
 * دوالُّ خادم المسابقة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٣.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **إعلانٌ إلزاميّ** — قدرةٌ من الخمس، أو `PUBLIC_DECLARED` **للعضو القائم وحده**
 *     (`competition.publicEnroll`): لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة، ولا مسارَ
 *     عامٌّ ثالث (G16 تبقى ٢/٢).
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من إسقاطها، والمسابقةُ من نطاقها،
 *     والالتحاقُ والدعوةُ من مسجدهما، والحدثُ من **مسجد متبارِيه** — والغائبُ ⇒ `NO_SCOPE`
 *     ⇒ **رفضٌ يُقفل ولا يُفتح** (يقتل صنف خ: كتابةٌ على معرّفٍ غير متحقَّق).
 *  ٣. **«ذ» تفعل عملَها بلا سطرِ منطق**: `enroll.approve` و`score.record` نطاقُهما مطابقةٌ
 *     تامّة ⇒ أميرُ المسجد بعينه — لا جارُه ولا مربعُه ولا المدير (ق-١٤/ق-٢٧).
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن يبتّ ومَن يرصد ومَن يعلن يُؤخذون من `actor`.
 *
 * **والمسارُ العامُّ لا يستقبل المستودع** — يستقبل المنفذَ الضيّق ذا المِقبض الواحد (§٤-٢).
 */

import { defineServerFn, PUBLIC_DECLARED } from "../../../server/defineServerFn.js"
import { NO_SCOPE, ROOT_PATH, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import { createSettingsResolver, type SettingsResolver } from "../../../settings/resolver.js"
import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "../services/context.js"
import {
  advanceStatus,
  cancelCompetition,
  createCompetition,
  declareAward,
  defineCategory,
  defineStage,
  type CreateCompetitionInput,
  type DeclareAwardInput,
  type DefineCategoryInput,
  type DefineStageInput,
} from "../services/competitions.js"
import { defineScoringType, type DefineScoringTypeInput } from "../services/catalog.js"
import { reweighScoringType } from "../services/catalog.js"
import {
  addByInvite,
  addByLeader,
  approveEnrollment,
  inboxOf,
  rejectEnrollment,
  type AddByInviteInput,
  type AddByLeaderInput,
} from "../services/enrollment.js"
import { issueInvite, revokeInvite, type IssueInviteInput } from "../services/invites.js"
import { recordScore, type RecordScoreInput } from "../services/scoring.js"
import { declareResults, runAdvancement } from "../services/results.js"
import {
  leaderboard,
  viewsOf,
  visibleCompetitions,
  type CompetitionView,
  type LeaderboardRow,
} from "../services/derive.js"
import { scopesIntersect } from "../services/shared.js"
import { makePublicEnrollPort, type PublicEnrollReceipt, type PublicEnrollRequest } from "../services/publicPort.js"
import {
  competitionErr,
  competitionOk,
  type CompetitionResult,
  type CompetitionStatus,
  type Enrollment,
} from "../types.js"

/** نموذجُ صفحة «المسابقة» — **مصدرُ بياناتٍ واحد** لكل رقمٍ فيها (ق-١١١). */
export type CompetitionScopeView = {
  readonly unitPath: string
  readonly competitions: readonly CompetitionView[]
}

/** نموذجُ لوحة الترتيب — الرتبةُ والرصيدُ **مشتقّان لحظتَها** (ق-٩٢). */
export type LeaderboardView = {
  readonly competitionId: string
  readonly categoryId: string
  readonly rows: readonly LeaderboardRow[]
}

/** نموذجُ صندوق الأمير — **المعلَّقُ وحدَه** بمسجده (ق-١٤). */
export type EnrollmentInboxView = {
  readonly mosquePath: string
  readonly pending: readonly Enrollment[]
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (قب-١٨ + §٥.٢). */
function unitById(store: CompetitionStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ المسابقة **من نطاقها المخزَّن** — لا من مسارٍ يمرّره العميل. */
function competitionScope(store: CompetitionStore, competitionId: string | undefined): Scope {
  const competition = competitionId === undefined ? null : store.getCompetition(competitionId)
  return competition === null ? NO_SCOPE : unitScope(competition.scopePath)
}

/** نطاقُ المرحلة **نطاقُ مسابقتها** — فالمرحلةُ ابنةٌ لا كيانٌ طليق. */
function stageScope(store: CompetitionStore, stageId: string | undefined): Scope {
  const stage = stageId === undefined ? null : store.getStage(stageId)
  return stage === null ? NO_SCOPE : competitionScope(store, stage.competitionId)
}

/** نطاقُ نسخة النوع **نطاقُ مسابقتها** كذلك. */
function scoringTypeScope(store: CompetitionStore, typeVersionId: string | undefined): Scope {
  const type = typeVersionId === undefined ? null : store.getScoringType(typeVersionId)
  return type === null ? NO_SCOPE : competitionScope(store, type.competitionId)
}

/** **نطاقُ الالتحاق مسجدُه** — و«ذ» تجعله أميرَ ذلك المسجد بعينه لا مَن فوقه (ق-١٤). */
function enrollmentScope(store: CompetitionStore, enrollmentId: string | undefined): Scope {
  const enrollment = enrollmentId === undefined ? null : store.getEnrollment(enrollmentId)
  return enrollment === null ? NO_SCOPE : unitScope(enrollment.mosquePath)
}

/** **نطاقُ الدعوة مسجدُها المخزَّن** — فلا يُبطلها أميرُ مسجدٍ آخر. */
function inviteScope(store: CompetitionStore, inviteId: string | undefined): Scope {
  const invite = inviteId === undefined ? null : store.getInvite(inviteId)
  return invite === null ? NO_SCOPE : unitScope(invite.mosquePath)
}

/** **نطاقُ الرصد مسجدُ المتبارِي المخزَّن** — ب-٣٧ب: الراصدُ أميرُ مسجده (ق-٨٤ نظيراً). */
function contestantScope(store: CompetitionStore, contestantId: string | undefined): Scope {
  const contestant = contestantId === undefined ? null : store.getContestant(contestantId)
  return contestant === null ? NO_SCOPE : unitScope(contestant.mosquePath)
}

export function makeCompetitionEndpoints(
  store: CompetitionStore,
  settings: SettingsResolver = createSettingsResolver([]),
) {
  const contextOf = (actor: Actor, request: DecisionContext): CompetitionContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    isFeatureEnabled: request.isFeatureEnabled,
  })
  const publicPort = makePublicEnrollPort(store)

  // ── قراءةٌ بقاعدة التقاطع ───────────────────────────────────────────────────
  const scopeViewFn = defineServerFn({
    name: "competition.scope.view",
    capability: "competition.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "competition.scope.view",
    handler: async (input: { unitId: string }): Promise<CompetitionScopeView> => {
      const unit = store.getUnit(input.unitId)!
      return {
        unitPath: unit.path,
        competitions: viewsOf(store, visibleCompetitions(store, unit.path)),
      }
    },
  })

  const leaderboardViewFn = defineServerFn({
    name: "competition.leaderboard.view",
    capability: "competition.view",
    // الإذنُ على **نطاق الفاعل**، والتقاطعُ يُفحص بعده (منطقُ عملٍ لا صلاحية — §٩).
    scope: (input: { unitId: string; competitionId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "competition.leaderboard.view",
    handler: async (
      input: { unitId: string; competitionId: string; categoryId?: string },
      { request },
    ): Promise<CompetitionResult<LeaderboardView>> => {
      const unit = store.getUnit(input.unitId)!
      const competition = store.getCompetition(input.competitionId)
      if (competition === null) return competitionErr("UNKNOWN_COMPETITION", input.competitionId)
      // **قاعدةُ التقاطع**: تشملني أو تحتي — وإلا فرفضُ منطقِ عملٍ مُشخِّص لا صفحةٌ فارغة.
      if (!scopesIntersect(competition.scopePath, unit.path)) {
        return competitionErr("COMPETITION_OUT_OF_VIEW_SCOPE", competition.scopePath)
      }
      const categoryId =
        input.categoryId ??
        store.categories().find((c) => c.competitionId === competition.id)?.id ??
        ""
      // **حجمُ الصفحة إعدادٌ مسجَّل** لا رقمٌ صلب (قب-٦): صفحةٌ ثابتةُ الكلفة مهما كبر العدد.
      const pageSize = Number(settings("platform.page_size.default", ROOT_PATH, request.now))
      return competitionOk({
        competitionId: competition.id,
        categoryId,
        rows: leaderboard(store, competition.id, categoryId, pageSize),
      })
    },
  })

  const enrollmentInboxFn = defineServerFn({
    name: "competition.enrollment.inbox",
    capability: "competition.enroll.approve",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "competition.enrollment.inbox",
    handler: async (input: { unitId: string }): Promise<EnrollmentInboxView> => {
      const unit = store.getUnit(input.unitId)!
      return { mosquePath: unit.path, pending: inboxOf(store, unit.path) }
    },
  })

  // ── ضبطُ المسابقة (`competition.manage`) ────────────────────────────────────
  const createFn = defineServerFn({
    name: "competition.create",
    capability: "competition.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "competition.create",
    handler: async (input: CreateCompetitionInput, { actor, request }) =>
      createCompetition(store, contextOf(actor, request), input),
  })

  const statusAdvanceFn = defineServerFn({
    name: "competition.status.advance",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.status.advance",
    handler: async (
      input: { competitionId: string; to: CompetitionStatus },
      { actor, request },
    ) => advanceStatus(store, contextOf(actor, request), input),
  })

  const cancelFn = defineServerFn({
    name: "competition.cancel",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.cancel",
    handler: async (input: { competitionId: string; reason: string }, { actor, request }) =>
      cancelCompetition(store, contextOf(actor, request), input),
  })

  const categoryDefineFn = defineServerFn({
    name: "competition.category.define",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.category.define",
    handler: async (input: DefineCategoryInput, { actor, request }) =>
      defineCategory(store, contextOf(actor, request), input),
  })

  const scoringTypeDefineFn = defineServerFn({
    name: "competition.scoringType.define",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.scoringType.define",
    handler: async (input: DefineScoringTypeInput, { actor, request }) =>
      defineScoringType(store, contextOf(actor, request), input),
  })

  const scoringTypeReweighFn = defineServerFn({
    name: "competition.scoringType.reweigh",
    capability: "competition.manage",
    scope: (input: { typeVersionId: string }) => scoringTypeScope(store, input.typeVersionId),
    intent: "write",
    audit: "competition.scoringType.reweigh",
    handler: async (input: { typeVersionId: string; weight: number }, { actor, request }) =>
      reweighScoringType(store, contextOf(actor, request), input),
  })

  const stageDefineFn = defineServerFn({
    name: "competition.stage.define",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.stage.define",
    handler: async (input: DefineStageInput, { actor, request }) =>
      defineStage(store, contextOf(actor, request), input),
  })

  const awardDeclareFn = defineServerFn({
    name: "competition.award.declare",
    capability: "competition.manage",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.award.declare",
    handler: async (input: DeclareAwardInput, { actor, request }) =>
      declareAward(store, contextOf(actor, request), input),
  })

  // ── بتُّ الالتحاق والدعوة (`competition.enroll.approve`، نطاقُها «ذ») ─────────
  const enrollmentApproveFn = defineServerFn({
    name: "competition.enrollment.approve",
    capability: "competition.enroll.approve",
    scope: (input: { enrollmentId: string }) => enrollmentScope(store, input.enrollmentId),
    intent: "write",
    audit: "competition.enrollment.approve",
    handler: async (input: { enrollmentId: string }, { actor, request }) =>
      approveEnrollment(store, contextOf(actor, request), input),
  })

  const enrollmentRejectFn = defineServerFn({
    name: "competition.enrollment.reject",
    capability: "competition.enroll.approve",
    scope: (input: { enrollmentId: string }) => enrollmentScope(store, input.enrollmentId),
    intent: "write",
    audit: "competition.enrollment.reject",
    handler: async (input: { enrollmentId: string; reason: string }, { actor, request }) =>
      rejectEnrollment(store, contextOf(actor, request), input),
  })

  const enrollmentAddByLeaderFn = defineServerFn({
    name: "competition.enrollment.addByLeader",
    capability: "competition.enroll.approve",
    // نطاقُه **المسجدُ المستهدَف**: فالقائدُ يضيف إلى مسجده بعينه لا إلى ما تحته.
    scope: (input: { mosquePath: string }) =>
      input.mosquePath === undefined ? NO_SCOPE : unitScope(input.mosquePath),
    intent: "write",
    audit: "competition.enrollment.addByLeader",
    handler: async (input: AddByLeaderInput, { actor, request }) =>
      addByLeader(store, contextOf(actor, request), input),
  })

  const inviteIssueFn = defineServerFn({
    name: "competition.invite.issue",
    capability: "competition.enroll.approve",
    scope: (input: { mosquePath: string }) =>
      input.mosquePath === undefined ? NO_SCOPE : unitScope(input.mosquePath),
    intent: "write",
    audit: "competition.invite.issue",
    handler: async (input: IssueInviteInput, { actor, request }) =>
      issueInvite(store, contextOf(actor, request), input),
  })

  const inviteRevokeFn = defineServerFn({
    name: "competition.invite.revoke",
    capability: "competition.enroll.approve",
    scope: (input: { inviteId: string }) => inviteScope(store, input.inviteId),
    intent: "write",
    audit: "competition.invite.revoke",
    handler: async (input: { inviteId: string }, { actor, request }) =>
      revokeInvite(store, contextOf(actor, request), input),
  })

  const enrollmentAddByInviteFn = defineServerFn({
    name: "competition.enrollment.addByInvite",
    capability: "competition.enroll.approve",
    // **النطاقُ من الرمز المخزَّن** لا من مدخل العميل — نفسُ حرز المسار العامّ.
    scope: (input: { inviteId: string }) => inviteScope(store, input.inviteId),
    intent: "write",
    audit: "competition.enrollment.addByInvite",
    handler: async (input: AddByInviteInput, { actor, request }) =>
      addByInvite(store, contextOf(actor, request), input),
  })

  // ── الرصد (`competition.score.record`، نطاقُها «ذ») ──────────────────────────
  const scoreRecordFn = defineServerFn({
    name: "competition.score.record",
    capability: "competition.score.record",
    scope: (input: { contestantId: string }) => contestantScope(store, input.contestantId),
    intent: "write",
    audit: "competition.score.record",
    handler: async (input: RecordScoreInput, { actor, request }) =>
      recordScore(store, contextOf(actor, request), input),
  })

  // ── النتائج (`competition.result.declare` — فصلُ مهامٍ على فعلٍ لا رجعة فيه) ──
  const resultAdvanceFn = defineServerFn({
    name: "competition.result.advance",
    capability: "competition.result.declare",
    scope: (input: { stageId: string }) => stageScope(store, input.stageId),
    intent: "write",
    audit: "competition.result.advance",
    handler: async (input: { stageId: string }, { actor, request }) =>
      runAdvancement(store, contextOf(actor, request), input),
  })

  const resultDeclareFn = defineServerFn({
    name: "competition.result.declare",
    capability: "competition.result.declare",
    scope: (input: { competitionId: string }) => competitionScope(store, input.competitionId),
    intent: "write",
    audit: "competition.result.declare",
    handler: async (input: { competitionId: string }, { actor, request }) =>
      declareResults(store, contextOf(actor, request), input),
  })

  // ── المسارُ العامُّ المعلن (قب-١٣) — **بلا مستودعٍ وبلا نطاق** ────────────────
  const publicEnrollFn = defineServerFn({
    name: "competition.publicEnroll",
    capability: PUBLIC_DECLARED,
    intent: "write",
    audit: "competition.publicEnroll",
    // **المنفذُ الضيّق وحدَه**: لا `store` هنا ⇒ لا قائمةَ ولا بحثَ يمكن استدعاؤه أصلاً.
    handler: async (
      input: PublicEnrollRequest,
      { actor, request },
    ): Promise<PublicEnrollReceipt> => publicPort.submit(contextOf(actor, request), input),
  })

  return {
    scopeView: scopeViewFn,
    leaderboardView: leaderboardViewFn,
    enrollmentInbox: enrollmentInboxFn,
    create: createFn,
    statusAdvance: statusAdvanceFn,
    cancel: cancelFn,
    categoryDefine: categoryDefineFn,
    scoringTypeDefine: scoringTypeDefineFn,
    scoringTypeReweigh: scoringTypeReweighFn,
    stageDefine: stageDefineFn,
    awardDeclare: awardDeclareFn,
    enrollmentApprove: enrollmentApproveFn,
    enrollmentReject: enrollmentRejectFn,
    enrollmentAddByLeader: enrollmentAddByLeaderFn,
    inviteIssue: inviteIssueFn,
    inviteRevoke: inviteRevokeFn,
    enrollmentAddByInvite: enrollmentAddByInviteFn,
    scoreRecord: scoreRecordFn,
    resultAdvance: resultAdvanceFn,
    resultDeclare: resultDeclareFn,
    publicEnroll: publicEnrollFn,
  }
}
