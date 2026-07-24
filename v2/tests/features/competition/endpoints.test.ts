/**
 * **سطوحُ الخادم الإحدى والعشرون** — عقدُ الوحدة §٣: *قدرةٌ معلنة · نطاقٌ من الكيان المخزَّن ·
 * فاعلٌ من الجلسة*. وهذا الملفُّ يفحص السطوحَ نفسَها: الإعلانَ والنيّةَ ونماذجَ العرض.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCompetitionEndpoints } from "../../../src/features/competition/server/endpoints.js"
import { clearRegistryForTests, registeredServerFns } from "../../../src/server/defineServerFn.js"
import { recordScore } from "../../../src/features/competition/services/scoring.js"
import {
  canonicalActor,
  competitionContext,
  DAY_MS,
  DECISION,
  END_MONTH,
  KHALID_PATH,
  NOW,
  PERIOD,
  seedCompetition,
  seedCompetitionStore,
  seedContestant,
  seedScoringType,
  START_MONTH,
  WINDOW_CLOSES,
  WINDOW_OPENS,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("§٣ — **كلُّ سطحٍ يعلن قدرتَه ونيّتَه ونطاقَه** (G7)", () => {
  it("إحدى وعشرون دالةً مسجَّلةً بأسمائها — ولا سطحَ بلا إعلان", () => {
    const store = seedCompetitionStore()
    makeCompetitionEndpoints(store)
    const mine = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.name.startsWith("competition."))
    expect(mine).toHaveLength(21)
    expect(new Set(mine.map((d) => d.name)).size).toBe(21)
  })

  it("**والقراءةُ نيّتُها قراءةٌ والكتابةُ كتابة** — فجلسةُ الانتحال القرائيّ توقف الكاتبات", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    for (const name of ["scopeView", "leaderboardView", "enrollmentInbox"] as const) {
      expect(ep[name].declaration.intent, name).toBe("read")
    }
    for (const name of [
      "create",
      "statusAdvance",
      "cancel",
      "categoryDefine",
      "scoringTypeDefine",
      "scoringTypeReweigh",
      "stageDefine",
      "awardDeclare",
      "enrollmentApprove",
      "enrollmentReject",
      "enrollmentAddByLeader",
      "inviteIssue",
      "inviteRevoke",
      "enrollmentAddByInvite",
      "scoreRecord",
      "resultAdvance",
      "resultDeclare",
      "publicEnroll",
    ] as const) {
      expect(ep[name].declaration.intent, name).toBe("write")
    }
  })

  it("**وكلُّ سطحٍ يحمل اسمَ فعله في سجل التدقيق** — التدوينُ جزءٌ من التعريف لا خطوةٌ تُنسى", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    for (const fn of Object.values(ep)) {
      expect(fn.declaration.audit, fn.declaration.name).toBe(fn.declaration.name)
    }
  })

  it("**والقدرةُ الواحدة تحرس صنفَها**: البتُّ بـ`enroll.approve` والرصدُ بـ`score.record`", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    expect(ep.enrollmentApprove.declaration.capability).toBe("competition.enroll.approve")
    expect(ep.enrollmentReject.declaration.capability).toBe("competition.enroll.approve")
    expect(ep.inviteIssue.declaration.capability).toBe("competition.enroll.approve")
    expect(ep.scoreRecord.declaration.capability).toBe("competition.score.record")
    expect(ep.resultDeclare.declaration.capability).toBe("competition.result.declare")
    expect(ep.resultAdvance.declaration.capability).toBe("competition.result.declare")
    expect(ep.create.declaration.capability).toBe("competition.manage")
    expect(ep.scopeView.declaration.capability).toBe("competition.view")
  })

  it("**وفصلُ المهام حقيقيّ** (ق-٥٤): الإعلانُ قدرةٌ غيرُ قدرة الضبط", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    expect(ep.resultDeclare.declaration.capability).not.toBe(
      ep.scoringTypeReweigh.declaration.capability,
    )
  })
})

describe("§١١ — نموذجُ العرض: **مصدرُ بياناتٍ واحدٌ للصفحة** (ق-١١١)", () => {
  it("`competition.scope.view` تعطي مسابقاتِ التقاطع بأعدادها المشتقّة من نداءٍ واحد", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, {
      unitId: "homs",
      advanceTo: ["enrolling", "running"],
    })
    seedScoringType(store, competition.id)
    seedContestant(store, { competitionId: competition.id })
    const ep = makeCompetitionEndpoints(store)

    const seen = await ep.scopeView.invoke(
      { unitId: "homs" },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.unitPath).toBe("/men/homs/")
    expect(seen.value.competitions).toHaveLength(1)
    expect(seen.value.competitions[0]?.contestants).toBe(1)
    expect(seen.value.competitions[0]?.pendingEnrollments).toBe(0)
  })

  it("**واللوحةُ تحمل رتبةَ كلِّ صفٍّ ورصيدَه** — لا رقمَ من مصدرٍ ثانٍ", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })
    recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 6,
    })
    const ep = makeCompetitionEndpoints(store)
    const board = await ep.leaderboardView.invoke(
      { unitId: "homs", competitionId: competition.id },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!board.ok) throw new Error(board.decision.reason)
    if (!board.value.ok) throw new Error(board.value.error.code)
    expect(board.value.value.rows[0]?.rank).toBe(1)
    expect(board.value.value.rows[0]?.points).toBe(60)
  })

  it("**وصندوقُ الأمير يعطي المعلَّقَ وحدَه** بمسجده — لا طلبَ جارٍ ولا مبتوت", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    await ep.publicEnroll.invoke(
      {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        nameAr: "مقدَّمٌ أول",
        phone: "0901010101",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    const inbox = await ep.enrollmentInbox.invoke(
      { unitId: "khalid" },
      canonicalActor("u-amir"),
      DECISION,
    )
    if (!inbox.ok) throw new Error(inbox.decision.reason)
    expect(inbox.value.mosquePath).toBe(KHALID_PATH)
    expect(inbox.value.pending).toHaveLength(1)
    expect(inbox.value.pending[0]?.nameAr).toBe("مقدَّمٌ أول")
  })
})

describe("§٣ — الرحلةُ الكاملةُ **عبر السطوح** لا بالحقن في المستودع", () => {
  it("إنشاءٌ ← فئةٌ ← نوعُ تنقيطٍ ← دعوةٌ ← رصدٌ ← تأهيلٌ ← إعلان — كلُّها بقدراتها", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const rabita = canonicalActor("u-rabita")
    const amir = canonicalActor("u-amir")

    const created = await ep.create.invoke(
      {
        unitId: "homs",
        titleAr: "مسابقةُ الرحلة الكاملة",
        startMonthHijri: START_MONTH,
        endMonthHijri: END_MONTH,
        enrollmentOpensAt: WINDOW_OPENS,
        enrollmentClosesAt: WINDOW_CLOSES,
      },
      rabita,
      WRITE,
    )
    if (!created.ok) throw new Error(created.decision.reason)
    if (!created.value.ok) throw new Error(created.value.error.code)
    const competitionId = created.value.value.id

    for (const to of ["enrolling", "running"] as const) {
      const moved = await ep.statusAdvance.invoke({ competitionId, to }, rabita, WRITE)
      if (!moved.ok) throw new Error(moved.decision.reason)
      expect(moved.value.ok).toBe(true)
    }

    const type = await ep.scoringTypeDefine.invoke(
      {
        competitionId,
        key: "monthly_program",
        titleAr: "البرنامجُ الشهريّ",
        track: "تعبدي",
        valueKind: "count",
        weight: 10,
        period: "hijri_month",
        excusable: true,
      },
      rabita,
      WRITE,
    )
    if (!type.ok) throw new Error(type.decision.reason)
    expect(type.value.ok).toBe(true)

    const invite = await ep.inviteIssue.invoke(
      {
        competitionId,
        mosquePath: KHALID_PATH,
        expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
      },
      amir,
      WRITE,
    )
    if (!invite.ok) throw new Error(invite.decision.reason)
    if (!invite.value.ok) throw new Error(invite.value.error.code)

    const joined = await ep.enrollmentAddByInvite.invoke(
      {
        inviteId: invite.value.value.id,
        nameAr: "مدعوُّ الرحلة",
        phone: "0902020202",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      amir,
      WRITE,
    )
    if (!joined.ok) throw new Error(joined.decision.reason)
    if (!joined.value.ok) throw new Error(joined.value.error.code)
    const contestantId = joined.value.value.id

    const scored = await ep.scoreRecord.invoke(
      { contestantId, typeKey: "monthly_program", periodKey: PERIOD, value: 5 },
      amir,
      WRITE,
    )
    if (!scored.ok) throw new Error(scored.decision.reason)
    expect(scored.value.ok).toBe(true)

    const stage = await ep.stageDefine.invoke(
      {
        competitionId,
        order: 1,
        titleAr: "النهائيّ",
        advancement: { basis: "category", take: { topN: 1 } },
      },
      rabita,
      WRITE,
    )
    if (!stage.ok) throw new Error(stage.decision.reason)
    if (!stage.value.ok) throw new Error(stage.value.error.code)

    const advanced = await ep.resultAdvance.invoke(
      { stageId: stage.value.value.id },
      rabita,
      WRITE,
    )
    if (!advanced.ok) throw new Error(advanced.decision.reason)
    expect(advanced.value.ok).toBe(true)

    const declared = await ep.resultDeclare.invoke({ competitionId }, rabita, WRITE)
    if (!declared.ok) throw new Error(declared.decision.reason)
    if (!declared.value.ok) throw new Error(declared.value.error.code)
    expect(declared.value.value.rows).toHaveLength(1)
    expect(store.getCompetition(competitionId)?.status).toBe("closed")
  })

  it("**والأميرُ ينشئ مسابقةَ مسجده** (ت-١/قب-٤): كلُّ قائدٍ داخل نطاقه", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const created = await ep.create.invoke(
      {
        unitId: "khalid",
        titleAr: "مسابقةُ مسجدي",
        startMonthHijri: START_MONTH,
        endMonthHijri: END_MONTH,
        enrollmentOpensAt: WINDOW_OPENS,
        enrollmentClosesAt: WINDOW_CLOSES,
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!created.ok) throw new Error(created.decision.reason)
    if (!created.value.ok) throw new Error(created.value.error.code)
    expect(created.value.value.scopePath).toBe(KHALID_PATH)
  })

  it("**ولا ينشئها خارج نطاقه** — رفضٌ في المحرّك قبل جسم الدالة", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const created = await ep.create.invoke(
      {
        unitId: "root",
        titleAr: "مسابقةُ الشبكة بيد أمير",
        startMonthHijri: START_MONTH,
        endMonthHijri: END_MONTH,
        enrollmentOpensAt: WINDOW_OPENS,
        enrollmentClosesAt: WINDOW_CLOSES,
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**والمعلّمُ والطالبُ والمالي لا يبلغون شيئاً من المسابقة** — سلبٌ صريحٌ لا صفحةٌ فارغة", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    for (const personId of ["u-teacher", "u-student", "u-finance", "u-committee-head"]) {
      const actor = canonicalActor(personId)
      const seen = await ep.scopeView.invoke({ unitId: "khalid" }, actor, DECISION)
      expect(seen.ok, `${personId} يرى مسابقاتٍ وليست له`).toBe(false)
      const declared = await ep.resultDeclare.invoke({ competitionId: competition.id }, actor, WRITE)
      expect(declared.ok, `${personId} يعلن فائزاً`).toBe(false)
    }
  })
})
