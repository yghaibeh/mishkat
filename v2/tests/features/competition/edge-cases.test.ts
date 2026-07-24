/**
 * **حالاتُ الحواف** — العقدُ الأمّ §٦-٣ بند ٤ يسمّيها إلزاميةً، و`TESTING_POLICY` §٤ يجعل
 * **السلبيّات أكثر من الإيجابيّات** قاعدةً ذهبية: *النظامُ الآمنُ يُعرَّف بما يمنعه*.
 *
 * وهذا الملفُّ يقصد **الأفرعَ التي لا يمرّ بها المسارُ السعيد**: معاييرُ الصعود الثلاثة
 * وسقفُ المسجد · النسخُ المختومة · الرمزُ المُبطَل مرّتين · السنُّ على حافّة الميلاد ·
 * والسطوحُ التي لا تُنادى إلا حين يخطئ أحدٌ.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCompetitionEndpoints } from "../../../src/features/competition/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { CompetitionTenantRegistry } from "../../../src/features/competition/data/tenant.js"
import { naturalKey } from "../../../src/features/competition/data/store.js"
import {
  activeVersionAt,
  defineScoringType,
  openVersion,
  reweighScoringType,
  versionsOf,
} from "../../../src/features/competition/services/catalog.js"
import {
  advanceStatus,
  cancelCompetition,
  declareAward,
  defineCategory,
  defineStage,
} from "../../../src/features/competition/services/competitions.js"
import { issueInvite, revokeInvite } from "../../../src/features/competition/services/invites.js"
import { addByLeader } from "../../../src/features/competition/services/enrollment.js"
import {
  declareResults,
  runAdvancement,
} from "../../../src/features/competition/services/results.js"
import { recordScore } from "../../../src/features/competition/services/scoring.js"
import {
  contestantsIn,
  eventsOf,
  leaderboard,
  rankOf,
  standingOf,
  viewOf,
} from "../../../src/features/competition/services/derive.js"
import { ageAt, daysAfter, personRefOf } from "../../../src/features/competition/services/shared.js"
import {
  BILAL_PATH,
  canonicalActor,
  competitionContext,
  DAY_MS,
  DECISION,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  OMAR_PATH,
  PERIOD,
  SECOND_TENANT_ID,
  seedCompetition,
  seedCompetitionStore,
  seedContestant,
  seedScoringType,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

const EXPIRES = new Date(NOW.getTime() + 7 * DAY_MS)

/** ملتحقٌ **بلحظةٍ لاحقة** — لاختبار كاسر «أسبقيّة الالتحاق» بلا عشوائيّةٍ ولا ساعةِ تشغيل. */
function addByLeaderLater(
  store: ReturnType<typeof seedCompetitionStore>,
  competitionId: string,
  nameAr: string,
  phone: string,
) {
  const done = addByLeader(
    store,
    competitionContext("u-amir", { now: new Date(NOW.getTime() + DAY_MS) }),
    {
      competitionId,
      mosquePath: KHALID_PATH,
      nameAr,
      phone,
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    },
  )
  if (!done.ok) throw new Error(done.error.code)
  return done.value
}

/** عالمٌ جارٍ بأربعة متبارين من مسجدين — مادّةُ معايير الصعود وسقفِ المسجد. */
function runningWorld() {
  const store = seedCompetitionStore()
  const competition = seedCompetition(store, {
    unitId: "sq2",
    advanceTo: ["enrolling", "running"],
  })
  const type = seedScoringType(store, competition.id, { weight: 10 })
  const contestants = [
    { nameAr: "خالدُ الأول", mosquePath: KHALID_PATH, value: 9, actor: "u-amir" },
    { nameAr: "خالدُ الثاني", mosquePath: KHALID_PATH, value: 7, actor: "u-amir" },
    { nameAr: "بلالُ الأول", mosquePath: BILAL_PATH, value: 5, actor: "u-amir-bilal" },
    { nameAr: "بلالُ الثاني", mosquePath: BILAL_PATH, value: 3, actor: "u-amir-bilal" },
  ].map((row, i) => {
    const c = seedContestant(store, {
      competitionId: competition.id,
      nameAr: row.nameAr,
      mosquePath: row.mosquePath,
      phone: `098000000${i}`,
      actorPersonId: row.actor,
    })
    recordScore(store, competitionContext(row.actor), {
      contestantId: c.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: row.value,
    })
    return c
  })
  return { store, competition, type, contestants }
}

describe("§٨ — معاييرُ الصعود الثلاثة **بياناتٌ**، وسقفُ المسجد عدالةٌ جغرافية", () => {
  it("`topPercent` يأخذ نسبةً من الفئة — والكسرُ يُجبَر لأعلى فلا تضيع مقعدٌ", () => {
    const { store, competition, contestants } = runningWorld()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "نصفُ النهائيّ",
      advancement: { basis: "category", take: { topPercent: 50 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    const advanced = runAdvancement(store, competitionContext("u-rabita"), {
      stageId: stage.value.id,
    })
    if (!advanced.ok) throw new Error(advanced.error.code)
    expect(advanced.value.map((c) => c.id)).toEqual([contestants[0]!.id, contestants[1]!.id])
  })

  it("`minScore` معيارٌ **بالرصيد لا بالعدد** — فمن بلغ العتبةَ صعد ولو كانوا كثيرين", () => {
    const { store, competition, contestants } = runningWorld()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "بلوغُ العتبة",
      advancement: { basis: "category", take: { minScore: 70 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    const advanced = runAdvancement(store, competitionContext("u-rabita"), {
      stageId: stage.value.id,
    })
    if (!advanced.ok) throw new Error(advanced.error.code)
    expect(advanced.value.map((c) => c.id)).toEqual([contestants[0]!.id, contestants[1]!.id])
  })

  it("**وسقفُ المسجد يوزّع الفرص** (ق-م-٩): بلا سقفٍ يحتكر مسجدٌ النهائيَّ فينسحب الباقون", () => {
    const { store, competition, contestants } = runningWorld()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "النهائيُّ بسقفِ مسجد",
      advancement: { basis: "category", take: { topN: 2 }, perMosqueCap: 1 },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    const advanced = runAdvancement(store, competitionContext("u-rabita"), {
      stageId: stage.value.id,
    })
    if (!advanced.ok) throw new Error(advanced.error.code)
    // الأولُ من خالد، ثم **بلالٌ الأول** — لا «خالدُ الثاني» ولو كان رصيدُه أعلى.
    expect(advanced.value.map((c) => c.mosquePath)).toEqual([KHALID_PATH, BILAL_PATH])
    expect(advanced.value.map((c) => c.id)).toEqual([contestants[0]!.id, contestants[2]!.id])
  })

  it("**وتنفيذُ المرحلة مرّتين مرفوض** ⇒ `ALREADY_DECIDED` (لا قائمتان لمرحلةٍ واحدة)", () => {
    const { store, competition } = runningWorld()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "مرحلةٌ تُنفَّذ مرّة",
      advancement: { basis: "category", take: { topN: 1 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    const ctx = competitionContext("u-rabita")
    expect(runAdvancement(store, ctx, { stageId: stage.value.id }).ok).toBe(true)
    const again = runAdvancement(store, ctx, { stageId: stage.value.id })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("ALREADY_DECIDED")
  })

  it("**ولا تأهيلَ على مسابقةٍ مغلقةٍ أو ملغاة** — الإغلاقُ يُنهي التنفيذَ كما يُنهي الرصد", () => {
    const { store, competition } = runningWorld()
    const ctx = competitionContext("u-rabita")
    const stage = defineStage(store, ctx, {
      competitionId: competition.id,
      order: 1,
      titleAr: "مرحلةٌ متأخّرة",
      advancement: { basis: "category", take: { topN: 1 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    cancelCompetition(store, ctx, { competitionId: competition.id, reason: "سببٌ معلن" })
    const late = runAdvancement(store, ctx, { stageId: stage.value.id })
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.error.code).toBe("COMPETITION_CLOSED")
  })

  it("**والصاعدُ يبقى في اللوحة**: `advanced` تُحتسب كـ`active` فلا يختفي من رتّب نفسه", () => {
    const { store, competition, contestants } = runningWorld()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "مرحلة",
      advancement: { basis: "category", take: { topN: 1 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    runAdvancement(store, competitionContext("u-rabita"), { stageId: stage.value.id })
    const categoryId = contestants[0]!.categoryId
    expect(contestantsIn(store, competition.id, categoryId)).toHaveLength(4)
    expect(leaderboard(store, competition.id, categoryId)[0]?.contestantId).toBe(contestants[0]!.id)
  })
})

describe("§٧ — الاشتقاقُ على الحواف: مجهولٌ، وصفحةٌ، وحدثٌ بلا نسخة", () => {
  it("رتبةُ متبارٍ مجهولٍ **صفرٌ لا انهيار** — والمجهولُ لا يُلفَّق له موضعٌ في اللوحة", () => {
    const store = seedCompetitionStore()
    expect(rankOf(store, "لا-وجود-له")).toBe(0)
    expect(eventsOf(store, "لا-وجود-له")).toHaveLength(0)
  })

  it("**ورصيدُ مجهولٍ صفرٌ بلحظةِ صفرٍ حتميّة** — لا تاريخٌ من ساعة التشغيل", () => {
    const store = seedCompetitionStore()
    const standing = standingOf(store, "لا-وجود-له")
    expect(standing.totalPoints).toBe(0)
    expect(standing.joinedAt.getTime()).toBe(0)
  })

  it("**وصفحةُ اللوحة تقصّ ولا تسقط**: `pageSize` يحدّ الصفوفَ وترتيبُها كما هو", () => {
    const { store, competition, contestants } = runningWorld()
    const categoryId = contestants[0]!.categoryId
    const page = leaderboard(store, competition.id, categoryId, 2)
    expect(page).toHaveLength(2)
    expect(page.map((r) => r.rank)).toEqual([1, 2])
  })

  it("**والمفتاحُ الطبيعيُّ يُركَّب في موضعٍ واحد** — فلا صيغتان تتباعدان (المادة ١/٢)", () => {
    expect(naturalKey("c-1", "t", "1447-08", null)).toBe("c-1|t|1447-08|")
    expect(naturalKey("c-1", "t", "1447-08", "src-9")).toBe("c-1|t|1447-08|src-9")
    expect(naturalKey("c-1", "t", "1447-08", null)).not.toBe(naturalKey("c-1", "t", "1447-08", "x"))
  })

  it("**ونموذجُ الصفّ يعدّ المعلَّقَ والمشاركَ منفصلَين** — الرقمان مصدرُهما واحد (ق-١١١)", () => {
    const { store, competition } = runningWorld()
    const view = viewOf(store, store.getCompetition(competition.id)!)
    expect(view.contestants).toBe(4)
    expect(view.pendingEnrollments).toBe(0)
  })
})

describe("§٧-٢ — الكتالوجُ على الحواف: النسخُ المختومةُ والمجهولة", () => {
  it("**إعادةُ توزينِ نسخةٍ مختومةٍ مرفوضة** — التاريخُ يُقرأ ولا يُحرَّر", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const second = reweighScoringType(store, ctx, { typeVersionId: type.id, weight: 20 })
    expect(second.ok).toBe(true)
    const stale = reweighScoringType(store, ctx, { typeVersionId: type.id, weight: 30 })
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.code).toBe("UNKNOWN_SCORING_TYPE")
  })

  it("**ونسخةٌ مجهولةٌ ووزنٌ سالبٌ** يُردّان بسببين مميِّزين", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id)

    const unknown = reweighScoringType(store, ctx, { typeVersionId: "لا-وجود-لها", weight: 5 })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_SCORING_TYPE")

    const negative = reweighScoringType(store, ctx, { typeVersionId: type.id, weight: -1 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.error.code).toBe("INVALID_WEIGHT")
  })

  it("**ولا نسخةَ فعّالةٌ قبل ميلاد النوع** — فالماضي السحيقُ بلا وزنٍ لا بوزنٍ ملفَّق", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id)
    expect(activeVersionAt(store, competition.id, type.key, new Date(NOW.getTime() - DAY_MS))).toBeNull()
    expect(activeVersionAt(store, competition.id, "لا-وجود-له", NOW)).toBeNull()
    expect(openVersion(store, competition.id, type.key)?.id).toBe(type.id)
    expect(openVersion(store, competition.id, "لا-وجود-له")).toBeNull()
    expect(versionsOf(store, competition.id, type.key)).toHaveLength(1)
  })

  it("**ومفتاحٌ فارغٌ وسقفُ فترةٍ سالبٌ مرفوضان** عند التعريف", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ctx = competitionContext("u-rabita")
    const base = {
      competitionId: competition.id,
      titleAr: "نوع",
      track: "علمي",
      valueKind: "count" as const,
      weight: 5,
      period: "hijri_month" as const,
      excusable: false,
    }
    const empty = defineScoringType(store, ctx, { ...base, key: "  " })
    expect(empty.ok).toBe(false)
    const negativeCap = defineScoringType(store, ctx, { ...base, key: "k", maxPerPeriod: -1 })
    expect(negativeCap.ok).toBe(false)
  })
})

describe("§٥-٢ — الدعوةُ على الحواف", () => {
  it("**إبطالُ رمزٍ مُبطَلٍ مرفوض**، **ورمزٌ مجهولٌ يُردّ** — لا ختمٌ ثانٍ ولا صمت", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ctx = competitionContext("u-amir")
    const invite = issueInvite(store, ctx, {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      expiresAt: EXPIRES,
    })
    if (!invite.ok) throw new Error(invite.error.code)
    expect(revokeInvite(store, ctx, { inviteId: invite.value.id }).ok).toBe(true)
    const twice = revokeInvite(store, ctx, { inviteId: invite.value.id })
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error.code).toBe("INVITE_REVOKED")

    const unknown = revokeInvite(store, ctx, { inviteId: "لا-وجود-له" })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_INVITE")
  })

  it("**ولا يُصدَر رمزٌ على مسابقةٍ ملغاةٍ ولا لمسجدٍ مجهول**", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store)
    const ghost = issueInvite(store, ctx, {
      competitionId: competition.id,
      mosquePath: "/men/homs/sq2/لا-وجود-له/",
      expiresAt: EXPIRES,
    })
    expect(ghost.ok).toBe(false)
    if (!ghost.ok) expect(ghost.error.code).toBe("MOSQUE_OUT_OF_COMPETITION_SCOPE")

    cancelCompetition(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      reason: "سببٌ معلن",
    })
    const late = issueInvite(store, ctx, {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      expiresAt: EXPIRES,
    })
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.error.code).toBe("COMPETITION_CLOSED")
  })

  it("**ومسجدٌ خارج نطاق المسابقة**: مسابقةُ المربع الثاني لا تُدعى إليها مساجدُ السابع", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { unitId: "sq2" })
    const done = issueInvite(store, competitionContext("u-amir-omar"), {
      competitionId: competition.id,
      mosquePath: OMAR_PATH,
      expiresAt: EXPIRES,
    })
    expect(done.ok).toBe(false)
  })
})

describe("أدواتُ الوحدة: السنُّ والتقويمُ والمعياريّ", () => {
  it("**السنُّ بالتقويم لا بالقسمة**: قبل عيد الميلاد بيومٍ سنةٌ أقلّ، وبعده بيومٍ سنةٌ تامّة", () => {
    const birth = new Date("2004-07-24T00:00:00.000Z")
    expect(ageAt(birth, new Date("2026-07-23T00:00:00.000Z"))).toBe(21)
    expect(ageAt(birth, new Date("2026-07-24T00:00:00.000Z"))).toBe(22)
    expect(ageAt(birth, new Date("2026-07-25T00:00:00.000Z"))).toBe(22)
    // وشهرٌ سابقٌ في السنة نفسِها ⇒ سنةٌ أقلّ (فرعُ الشهر لا اليوم).
    expect(ageAt(birth, new Date("2026-06-30T00:00:00.000Z"))).toBe(21)
  })

  it("**والتقويمُ يُزيح الأيامَ بلا ثابتٍ زمنيٍّ صلب** — والشهرُ يُعبَر بلا حساب", () => {
    expect(daysAfter(new Date("2026-01-30T00:00:00.000Z"), 2).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    )
  })

  it("**والمعياريُّ يطوي المسافات** — فلا يصير «محمّدٌ  عليّ» شخصاً ثانياً غيرَ «محمّدٌ عليّ»", () => {
    expect(personRefOf("  محمّدٌ   عليّ ", " 0911 ")).toBe(personRefOf("محمّدٌ عليّ", "0911"))
    expect(personRefOf("محمّد", "0911")).not.toBe(personRefOf("محمّد", "0922"))
  })

  it("**وسجلُّ الشبكات يقول ما عنده**: `has` و`tenantIds` — فالعزلُ مرئيٌّ لا مزعوم", () => {
    const registry = new CompetitionTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)
    registry.storeFor(MAIN_TENANT_ID)
    registry.storeFor(SECOND_TENANT_ID)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID].sort())
  })
})

describe("§٣ — السطوحُ التي لا تُنادى إلا حين يخطئ أحد", () => {
  it("**الإلغاءُ والفئةُ والجائزةُ والرفضُ** تمرّ بقدراتها وتعيد أخطاءَها مصنَّفة", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { unitId: "homs" })
    const ep = makeCompetitionEndpoints(store)
    const rabita = canonicalActor("u-rabita")

    const category = await ep.categoryDefine.invoke(
      { competitionId: competition.id, titleAr: "١٥–٢٥", ageMin: 15, ageMax: 25 },
      rabita,
      WRITE,
    )
    if (!category.ok) throw new Error(category.decision.reason)
    expect(category.value.ok).toBe(true)

    const award = await ep.awardDeclare.invoke(
      { competitionId: competition.id, titleAr: "شهادةُ تقدير", kind: "honorary" },
      rabita,
      WRITE,
    )
    if (!award.ok) throw new Error(award.decision.reason)
    expect(award.value.ok).toBe(true)

    const cancelled = await ep.cancel.invoke(
      { competitionId: competition.id, reason: "تأجيلٌ ميدانيّ" },
      rabita,
      WRITE,
    )
    if (!cancelled.ok) throw new Error(cancelled.decision.reason)
    expect(cancelled.value.ok).toBe(true)
    expect(store.getCompetition(competition.id)?.status).toBe("cancelled")
  })

  it("**والرفضُ وإصدارُ الدعوة وإبطالُها ومسارُ القائد** سطوحٌ لأمير المسجد بعينه", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const amir = canonicalActor("u-amir")

    const added = await ep.enrollmentAddByLeader.invoke(
      {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        nameAr: "مضافٌ مباشرةً",
        phone: "0917171717",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      amir,
      WRITE,
    )
    if (!added.ok) throw new Error(added.decision.reason)
    expect(added.value.ok).toBe(true)

    const invite = await ep.inviteIssue.invoke(
      { competitionId: competition.id, mosquePath: KHALID_PATH, expiresAt: EXPIRES },
      amir,
      WRITE,
    )
    if (!invite.ok) throw new Error(invite.decision.reason)
    if (!invite.value.ok) throw new Error(invite.value.error.code)

    const revoked = await ep.inviteRevoke.invoke({ inviteId: invite.value.value.id }, amir, WRITE)
    if (!revoked.ok) throw new Error(revoked.decision.reason)
    expect(revoked.value.ok).toBe(true)

    await ep.publicEnroll.invoke(
      {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        nameAr: "مقدَّمٌ يُرفض",
        phone: "0918181818",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      amir,
      WRITE,
    )
    const pending = store.enrollments().find((e) => e.state === "requested")!
    const rejected = await ep.enrollmentReject.invoke(
      { enrollmentId: pending.id, reason: "السنُّ خارج الفئة المعلنة" },
      amir,
      WRITE,
    )
    if (!rejected.ok) throw new Error(rejected.decision.reason)
    expect(rejected.value.ok).toBe(true)
  })

  it("**وإعادةُ التوزين والتأهيلُ سطحان بقدرتين مختلفتين** — فصلُ المهام يُقاس لا يُدّعى", async () => {
    const { store, competition, type } = runningWorld()
    const ep = makeCompetitionEndpoints(store)
    const rabita = canonicalActor("u-rabita")

    const reweighed = await ep.scoringTypeReweigh.invoke(
      { typeVersionId: type.id, weight: 20 },
      rabita,
      WRITE,
    )
    if (!reweighed.ok) throw new Error(reweighed.decision.reason)
    expect(reweighed.value.ok).toBe(true)

    const stage = await ep.stageDefine.invoke(
      {
        competitionId: competition.id,
        order: 1,
        titleAr: "مرحلةٌ عبر السطح",
        advancement: { basis: "category", take: { topN: 1 } },
      },
      rabita,
      WRITE,
    )
    if (!stage.ok) throw new Error(stage.decision.reason)
    if (!stage.value.ok) throw new Error(stage.value.error.code)

    // **والأميرُ لا يعلن ولا يؤهّل**: قدرةُ الإعلان ليست في حزمته على هذا النطاق.
    const byAmir = await ep.resultAdvance.invoke(
      { stageId: stage.value.value.id },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(byAmir.ok).toBe(false)
  })

  it("**ولوحةُ فئةٍ مجهولةٍ فارغةٌ لا منهارة** — المدخلُ لا يُسقط الصفحة", async () => {
    const { store, competition } = runningWorld()
    const ep = makeCompetitionEndpoints(store)
    const board = await ep.leaderboardView.invoke(
      { unitId: "sq2", competitionId: competition.id, categoryId: "لا-وجود-لها" },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!board.ok) throw new Error(board.decision.reason)
    if (!board.value.ok) throw new Error(board.value.error.code)
    expect(board.value.value.rows).toHaveLength(0)
  })

  it("**ومسابقةٌ مجهولةٌ في اللوحة** ⇒ `UNKNOWN_COMPETITION` بعد موافقة المحرّك", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const board = await ep.leaderboardView.invoke(
      { unitId: "homs", competitionId: "لا-وجود-لها" },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!board.ok) throw new Error(board.decision.reason)
    expect(board.value.ok).toBe(false)
    if (!board.value.ok) expect(board.value.error.code).toBe("UNKNOWN_COMPETITION")
  })

  it("**والإعلانُ عبر سطحه يُغلق ويختم** — ثم كلُّ كتابةٍ بعده مرفوضة", async () => {
    const { store, competition, contestants, type } = runningWorld()
    const ep = makeCompetitionEndpoints(store)
    const rabita = canonicalActor("u-rabita")
    const declared = await ep.resultDeclare.invoke({ competitionId: competition.id }, rabita, WRITE)
    if (!declared.ok) throw new Error(declared.decision.reason)
    if (!declared.value.ok) throw new Error(declared.value.error.code)
    expect(declared.value.value.rows).toHaveLength(4)

    const late = await ep.scoreRecord.invoke(
      { contestantId: contestants[0]!.id, typeKey: type.key, periodKey: PERIOD, value: 1 },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!late.ok) throw new Error(late.decision.reason)
    expect(late.value.ok).toBe(false)

    const moved = await ep.statusAdvance.invoke(
      { competitionId: competition.id, to: "qualifying" },
      rabita,
      WRITE,
    )
    if (!moved.ok) throw new Error(moved.decision.reason)
    expect(moved.value.ok).toBe(false)
  })

  it("**وانتقالٌ صريحٌ إلى `qualifying` ثم الإعلانُ منها** — المسارُ الكاملُ للتصفية", () => {
    const { store, competition } = runningWorld()
    const ctx = competitionContext("u-rabita")
    const moved = advanceStatus(store, ctx, { competitionId: competition.id, to: "qualifying" })
    expect(moved.ok).toBe(true)
    const declared = declareResults(store, ctx, { competitionId: competition.id })
    expect(declared.ok).toBe(true)
  })

  it("**والجائزةُ لفئةٍ ومرحلةٍ ومركزٍ** — حقولٌ اختيارية، والنقديّةُ وحدَها تحمل مبلغاً", () => {
    const { store, competition, contestants } = runningWorld()
    const ctx = competitionContext("u-rabita")
    const stage = defineStage(store, ctx, {
      competitionId: competition.id,
      order: 1,
      titleAr: "مرحلةُ الجائزة",
      advancement: { basis: "overall", take: { topN: 1 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    const award = declareAward(store, ctx, {
      competitionId: competition.id,
      titleAr: "جائزةُ المركز الأول",
      kind: "cash",
      categoryId: contestants[0]!.categoryId,
      stageId: stage.value.id,
      place: 1,
      amountCents: 500_000,
      currency: "USD",
    })
    if (!award.ok) throw new Error(award.error.code)
    expect(award.value.place).toBe(1)
    expect(award.value.amountCents).toBe(500_000)

    // والعينيّةُ **تُسقط المبلغَ ولو مُرِّر** — فلا رقمٌ يوهم بمسارٍ ماليّ (قب-٤٥).
    const inKind = declareAward(store, ctx, {
      competitionId: competition.id,
      titleAr: "جائزةٌ عينيّة",
      kind: "in_kind",
      amountCents: 900_000,
      currency: "USD",
    })
    if (!inKind.ok) throw new Error(inKind.error.code)
    expect(inKind.value.amountCents).toBeNull()
    expect(inKind.value.currency).toBeNull()
  })

  it("**وفئةٌ بعنوانٍ فارغٍ مرفوضة**، وحدّاها الافتراضيان من السجل", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store)
    const empty = defineCategory(store, ctx, { competitionId: competition.id, titleAr: "  " })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.code).toBe("EMPTY_TITLE")

    const defaults = defineCategory(store, ctx, {
      competitionId: competition.id,
      titleAr: "بالافتراضيّين",
      level: "خمسةُ أجزاء",
    })
    if (!defaults.ok) throw new Error(defaults.error.code)
    expect(defaults.value.ageMin).toBe(15)
    expect(defaults.value.ageMax).toBe(40)
    expect(defaults.value.level).toBe("خمسةُ أجزاء")
  })
})

describe("§٧-٣ — **كاسراتُ التعادل رُتبةً رُتبة**: كلُّ كاسرٍ يُختبر وحدَه", () => {
  /** عالمٌ بنوعَي تنقيط: عدٌّ عاديّ و**اختبارٌ** (`score`) — وهو الكاسرُ الثاني المعلن. */
  function tieWorld() {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const counted = seedScoringType(store, competition.id, { key: "counted", weight: 10 })
    const exam = seedScoringType(store, competition.id, {
      key: "central_exam",
      valueKind: "score",
      weight: 1,
    })
    return { store, competition, counted, exam }
  }

  it("**الكاسرُ الثاني: رصيدُ الاختبارات** — تعادلٌ في الرصيد يُحسم لصاحب الاختبار", () => {
    const { store, competition, counted, exam } = tieWorld()
    const ctx = competitionContext("u-amir")
    const plain = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "بلا اختبار",
      phone: "0960000011",
    })
    const examined = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "صاحبُ الاختبار",
      phone: "0960000012",
    })
    // رصيدان متساويان (٢٠)، لكنّ نصفَ رصيد الثاني **من اختبار**.
    recordScore(store, ctx, { contestantId: plain.id, typeKey: counted.key, periodKey: PERIOD, value: 2 })
    recordScore(store, ctx, { contestantId: examined.id, typeKey: counted.key, periodKey: PERIOD, value: 1 })
    recordScore(store, ctx, { contestantId: examined.id, typeKey: exam.key, periodKey: PERIOD, value: 10 })

    expect(standingOf(store, plain.id).totalPoints).toBe(standingOf(store, examined.id).totalPoints)
    expect(standingOf(store, examined.id).examPoints).toBe(10)
    expect(rankOf(store, examined.id)).toBe(1)
    expect(rankOf(store, plain.id)).toBe(2)
  })

  it("**الكاسرُ الثالث: أقلُّ أعذار** — فالحاضرُ يتقدّم على المعذور عند التساوي", () => {
    const { store, competition, counted } = tieWorld()
    const ctx = competitionContext("u-amir")
    const present = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "حاضرٌ دائماً",
      phone: "0960000021",
    })
    const excused = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "معذورٌ مرّة",
      phone: "0960000022",
    })
    recordScore(store, ctx, { contestantId: present.id, typeKey: counted.key, periodKey: PERIOD, value: 2 })
    recordScore(store, ctx, { contestantId: excused.id, typeKey: counted.key, periodKey: PERIOD, value: 2 })
    recordScore(store, ctx, {
      contestantId: excused.id,
      typeKey: counted.key,
      periodKey: "1447-09",
      value: 0,
      excuse: "excused",
      excuseReason: "مرضٌ موثَّق",
    })
    // **العذرُ لا يخصم** — الرصيدان متساويان، والكاسرُ وحدَه هو الذي رتّب.
    expect(standingOf(store, present.id).totalPoints).toBe(standingOf(store, excused.id).totalPoints)
    expect(standingOf(store, excused.id).excusedCount).toBe(1)
    expect(rankOf(store, present.id)).toBe(1)
    expect(rankOf(store, excused.id)).toBe(2)
  })

  it("**الكاسرُ الرابع: أسبقيّةُ الالتحاق** — فالأسبقُ يتقدّم، والمعرّفُ آخرُ حَكَم", () => {
    const { store, competition, counted } = tieWorld()
    const early = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "الملتحقُ الأسبق",
      phone: "0960000031",
    })
    const late = addByLeaderLater(store, competition.id, "الملتحقُ الأحدث", "0960000032")
    const ctx = competitionContext("u-amir")
    for (const c of [early, late]) {
      recordScore(store, ctx, { contestantId: c.id, typeKey: counted.key, periodKey: PERIOD, value: 1 })
    }
    expect(early.joinedAt.getTime()).toBeLessThan(late.joinedAt.getTime())
    expect(rankOf(store, early.id)).toBe(1)
    expect(rankOf(store, late.id)).toBe(2)
  })
})

describe("§٧ — العذرُ على نوعٍ لا يقبله، والمدخلاتُ الفارغة", () => {
  it("**نوعٌ `excusable: false` يردّ العذرَ** ولو جاء بسببٍ صحيح — الكتالوجُ يقرّر لا الراصد", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const strict = defineScoringType(store, ctx, {
      competitionId: competition.id,
      key: "no_excuse",
      titleAr: "لا عذرَ فيه",
      track: "علمي",
      valueKind: "boolean",
      weight: 5,
      period: "once",
      excusable: false,
    })
    if (!strict.ok) throw new Error(strict.error.code)
    const contestant = seedContestant(store, { competitionId: competition.id })
    const rejected = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: "no_excuse",
      periodKey: PERIOD,
      value: 1,
      excuse: "excused",
      excuseReason: "سببٌ وجيهٌ لكنّ النوعَ لا يقبله",
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("INVALID_VALUE")
  })

  it("**واسمٌ أو هاتفٌ فارغٌ يُردّ عند الحدّ** — لا متبارِيَ بلا هوية يُتابَع بها", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    for (const applicant of [
      { nameAr: "   ", phone: "0911111111" },
      { nameAr: "اسمٌ صحيح", phone: "  " },
    ]) {
      const done = addByLeader(store, competitionContext("u-amir"), {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
        ...applicant,
      })
      expect(done.ok, JSON.stringify(applicant)).toBe(false)
    }
  })

  it("**ولا يُضيف قائدٌ إلى مسابقةٍ مسودةٍ** — النافذةُ حالةٌ قبل أن تكون تاريخاً", () => {
    const store = seedCompetitionStore()
    const draft = seedCompetition(store, { advanceTo: [] })
    const done = addByLeader(store, competitionContext("u-amir"), {
      competitionId: draft.id,
      mosquePath: KHALID_PATH,
      nameAr: "مبكِّرٌ جداً",
      phone: "0919191919",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("ENROLLMENT_WINDOW_CLOSED")
  })

  it("**ومرحلةٌ بعنوانٍ فارغٍ مرفوضة**، **وجائزةٌ نقديّةٌ بلا مبلغٍ تُقبل بلا رقمٍ ملفَّق**", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store)
    const empty = defineStage(store, ctx, {
      competitionId: competition.id,
      order: 1,
      titleAr: "   ",
      advancement: { basis: "category", take: { topN: 1 } },
    })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.code).toBe("EMPTY_TITLE")

    const cashless = declareAward(store, ctx, {
      competitionId: competition.id,
      titleAr: "جائزةٌ نقديةٌ يُحدَّد مبلغُها لاحقاً",
      kind: "cash",
    })
    if (!cashless.ok) throw new Error(cashless.error.code)
    expect(cashless.value.amountCents).toBeNull()
    expect(cashless.value.currency).toBeNull()
  })
})
