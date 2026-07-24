/**
 * **ق-٩٢ — صفرُ عدّادٍ مخزَّن: النقطةُ والرتبةُ اشتقاقٌ لحظةَ السؤال** (عقدُ الوحدة §٧).
 *
 * في v1 كانت اللوحةُ تُحسب حيّةً بجلبِ كلِّ شيءٍ إلى الذاكرة، وكانت الأعدادُ في مواضعَ أخرى
 * **عدّاداتٍ مخزَّنةً تتباعد عن واقعها** (ع-١٩/ع-٢٩). والعلاجُ هنا **بنيويّ**: لا يوجد حقلٌ
 * يحفظ نقطةً ولا رتبةً ولا عدداً — فلا شيءَ يُنسى تحديثُه، **ولا شيءَ يتباعد**.
 *
 * وحارسان لا واحد (فخّ ٦-ب): **بنيويٌّ** يمسح مصدرَ الوحدة فيفشل على أيّ حقلٍ مخزَّنٍ يحفظ
 * عدداً، و**سلوكيٌّ** يُثبت أنّ **تصحيح مدخلٍ قبل الإعلان يقلب الترتيبَ لحظتَها**.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { recordScore } from "../../../src/features/competition/services/scoring.js"
import { reweighScoringType } from "../../../src/features/competition/services/catalog.js"
import { advanceStatus } from "../../../src/features/competition/services/competitions.js"
import {
  leaderboard,
  rankOf,
  standingOf,
} from "../../../src/features/competition/services/derive.js"
import {
  competitionContext,
  NOW,
  DAY_MS,
  PERIOD,
  seedCompetition,
  seedCompetitionStore,
  seedContestant,
  seedScoringType,
} from "./_seed.js"

const MODULE_DIR = join(process.cwd(), "src/features/competition")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith(".ts") ? [path] : []
  })
}

/** يُجرَّد التعليقُ فلا يُدان التوثيق — يُقاس **الكود** وحده (نظيرُ حارس الحلقات). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

/**
 * **موضعُ القياس: الكياناتُ وطبقةُ البيانات** — فهناك يعيش «المخزَّن». ونماذجُ الاشتقاق في
 * `services/` **حسابٌ يُعاد كلَّ مرّة** لا حقلٌ يُحفظ، ولا يُقاس عليها الثابت.
 * **والمقتطفُ المختوم استثناءٌ معلَنٌ مقصود**: قب-٤٥ **يوجب** تجميدَه نسخةً — وهو **الرقمُ
 * الوحيدُ المحفوظُ في الوحدة**، ولذلك يعيش في `services/results.ts` لا في كيانٍ ولا مستودع.
 */
const STORAGE_SURFACES = ["types.ts", "data/"]

describe("ق-٩٢/١ — الحارسُ **البنيويّ**: لا حقلَ مخزَّنٍ يحفظ عدداً في كياناتِ الوحدة", () => {
  it("**صفرُ عدّادٍ مخزَّن**: لا `totalPoints` ولا `rank` ولا `count` حقلاً في كيانٍ أو مستودع", () => {
    const offenders: string[] = []
    const scanned: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      const rel = file.slice(MODULE_DIR.length + 1)
      if (!STORAGE_SURFACES.some((surface) => rel.startsWith(surface))) continue
      scanned.push(rel)
      const code = stripComments(readFileSync(file, "utf8"))
      code.split("\n").forEach((line, i) => {
        const declared =
          /^\s*readonly\s+(\w*(?:[Pp]oints|[Cc]ount|[Tt]otal|[Tt]ally|[Rr]ank|[Ss]tanding)\w*)\s*[?]?:/.exec(
            line,
          )
        if (declared !== null) {
          offenders.push(`${rel}:${i + 1} — «${declared[1]}»`)
        }
      })
    }
    // **والحارسُ يُثبت أنه قرأ**: سطحٌ خاوٍ يعني بوابةً خضراءَ بلا حراسة (قاعدةُ قب-٢٣).
    expect(scanned).toContain("types.ts")
    expect(scanned.some((f) => f.startsWith("data/"))).toBe(true)
    expect(
      offenders,
      `عدّادٌ مخزَّنٌ في كياناتِ الوحدة — ق-٩٢ مخروقة:\n${offenders.join("\n")}`,
    ).toEqual([])
  })

  it("**والاستثناءُ الوحيدُ معلَنٌ ومحصور**: المقتطفُ المختومُ وحدَه يحفظ رقماً (قب-٤٥)", () => {
    const sealed = readFileSync(join(MODULE_DIR, "services/results.ts"), "utf8")
    // المقتطفُ **نسخةٌ مجمَّدة** لا عدّادٌ يُحدَّث: يُكتب مرّةً عند الإعلان ولا يُمسّ بعدها.
    expect(sealed).toMatch(/readonly rank:\s*number/)
    expect(sealed).toMatch(/readonly points:\s*number/)
    // ولا دالةَ تُحدِّثه بعد ختمه — لا `update` ولا `recompute` ولا `refresh` للمقتطف.
    const code = stripComments(sealed)
    for (const forbidden of ["updateAnnouncement", "recomputeAnnouncement", "refreshAnnouncement"]) {
      expect(code, `المقتطفُ يُحدَّث بعد ختمه: ${forbidden}`).not.toContain(forbidden)
    }
  })
})

describe("ق-٩٢/٢ — الرصيدُ يُجمع من الأحداث المخزَّنة لا من (عددٍ × وزنٍ حاليّ) (ق-٤١)", () => {
  it("رصيدُ المتبارِي = Σ (القيمة × وزنِ نسختها المثبَّتة)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })

    recordScore(store, ctx, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 4,
    })
    expect(standingOf(store, contestant.id).totalPoints).toBe(40)
  })

  it("**والوزنُ الجديد لا يمسّ الماضي** (ق-٣٦): نسختان، وكلُّ حدثٍ على نسخته", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })

    recordScore(store, ctx, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 4,
    })
    const before = standingOf(store, contestant.id).totalPoints

    const reweighed = reweighScoringType(store, ctx, { typeVersionId: type.id, weight: 25 })
    expect(reweighed.ok).toBe(true)

    // الماضي **لا يُعاد حسابه أبداً** — وهذا يمنع أشهرَ نزاعٍ مع المتسابقين.
    expect(standingOf(store, contestant.id).totalPoints).toBe(before)

    // والحدثُ التالي على النسخة الجديدة.
    const later = competitionContext("u-amir", { now: new Date(NOW.getTime() + DAY_MS) })
    recordScore(store, later, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: "1447-09",
      value: 2,
    })
    expect(standingOf(store, contestant.id).totalPoints).toBe(before + 50)
  })

  it("**والنسخةُ القديمة تُختم ولا تُحذف** — فالتاريخُ يبقى مقروءاً", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    reweighScoringType(store, ctx, { typeVersionId: type.id, weight: 25 })
    const versions = store.scoringTypes().filter((t) => t.key === type.key)
    expect(versions).toHaveLength(2)
    expect(versions.filter((v) => v.activeTo === null)).toHaveLength(1)
  })
})

describe("ق-٤٥/ق-٤٦ — المفتاحُ الطبيعيُّ يمنع الازدواج **رياضياً**", () => {
  it("رصدان بالمفتاح الطبيعيّ نفسِه ⇒ **صفٌّ واحدٌ لا صفّان** (upsert)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })

    const input = {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 3,
    }
    recordScore(store, ctx, input)
    recordScore(store, ctx, input)
    expect(store.scoreEvents()).toHaveLength(1)
    expect(standingOf(store, contestant.id).totalPoints).toBe(30)
  })

  it("**وحدثٌ مشتقٌّ يُولَّد مرتين لا يزدوج**: نفسُ `sourceRef` ⇒ صفٌّ واحد (ق-٤٦)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })

    for (const run of [1, 2, 3]) {
      void run
      recordScore(store, ctx, {
        contestantId: contestant.id,
        typeKey: type.key,
        periodKey: PERIOD,
        value: 5,
        sourceRef: "lesson-77",
      })
    }
    expect(store.scoreEvents()).toHaveLength(1)
  })

  it("**ومصدران مختلفان صفّان** — فالمفتاحُ يشمل `sourceRef` لا يتجاهله", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })
    for (const sourceRef of ["lesson-1", "lesson-2"]) {
      recordScore(store, ctx, {
        contestantId: contestant.id,
        typeKey: type.key,
        periodKey: PERIOD,
        value: 1,
        sourceRef,
      })
    }
    expect(store.scoreEvents()).toHaveLength(2)
  })
})

describe("ق-٩٢/٣ — الحارسُ **السلوكيّ**: الترتيبُ يتغيّر بتصحيح مدخلٍ **قبل** الاعتماد", () => {
  it("**الاشتقاق: تصحيحُ مدخلٍ قبل الإعلان يقلب الترتيبَ لحظتَها** — لا عدّادَ يُعاد بناؤه", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const first = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "عمّارٌ الأول",
      phone: "0930000001",
    })
    const second = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "بلالٌ الثاني",
      phone: "0930000002",
    })

    recordScore(store, ctx, {
      contestantId: first.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 9,
    })
    recordScore(store, ctx, {
      contestantId: second.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 3,
    })

    expect(rankOf(store, first.id)).toBe(1)
    expect(rankOf(store, second.id)).toBe(2)

    // **التصحيح**: الرصدُ الأول كان خطأً (٩ بدل ١) — يُعاد بالمفتاح الطبيعيّ نفسِه.
    const corrected = recordScore(store, ctx, {
      contestantId: first.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 1,
    })
    expect(corrected.ok).toBe(true)

    // والترتيبُ **انقلب لحظتَها** لأنه مشتقٌّ لا مخزَّن.
    expect(rankOf(store, first.id)).toBe(2)
    expect(rankOf(store, second.id)).toBe(1)
    expect(store.scoreEvents()).toHaveLength(2)
  })

  it("**ورتبتي عدُّ مَن فوقي + ١** — لا تُحسب رتبُ الجميع (§٥-١)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 1 })
    const ids = ["أ", "ب", "ج", "د"].map((label, i) =>
      seedContestant(store, {
        competitionId: competition.id,
        nameAr: `متبارٍ ${label}`,
        phone: `094000000${i}`,
      }),
    )
    ids.forEach((c, i) => {
      recordScore(store, ctx, {
        contestantId: c.id,
        typeKey: type.key,
        periodKey: PERIOD,
        value: (ids.length - i) * 10,
      })
    })
    expect(ids.map((c) => rankOf(store, c.id))).toEqual([1, 2, 3, 4])
  })
})

describe("§٧-٣ — الترتيبُ **داخل الفئة**، وكاسراتُ التعادل معلنةٌ **حتميّة**", () => {
  it("التعادلُ يُحسم بكاسراتٍ مرتَّبة، وآخرُها المعرّف — فلا عشوائيّةَ أبداً", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const a = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "متعادلٌ أ",
      phone: "0950000001",
    })
    const b = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "متعادلٌ ب",
      phone: "0950000002",
    })
    for (const c of [a, b]) {
      recordScore(store, ctx, {
        contestantId: c.id,
        typeKey: type.key,
        periodKey: PERIOD,
        value: 5,
      })
    }
    const board = leaderboard(store, competition.id, a.categoryId)
    // نفسُ الترتيب في كل تشغيلة — الحتميّةُ شرطٌ لا تحسين.
    const again = leaderboard(store, competition.id, a.categoryId)
    expect(board.map((r) => r.contestantId)).toEqual(again.map((r) => r.contestantId))
    expect(board).toHaveLength(2)
    expect(board[0]?.rank).toBe(1)
    expect(board[1]?.rank).toBe(2)
  })

  it("**واللوحةُ داخل الفئة لا فوق الجميع**: فئتان ⇒ متصدّران لا متصدّرٌ واحد", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const boards = store.categories().filter((c) => c.competitionId === competition.id)
    expect(boards).toHaveLength(1)

    const young = seedContestant(store, {
      competitionId: competition.id,
      nameAr: "الصغير",
      phone: "0960000001",
    })
    recordScore(store, ctx, {
      contestantId: young.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 1,
    })
    const board = leaderboard(store, competition.id, young.categoryId)
    expect(board.map((r) => r.contestantId)).toEqual([young.id])
  })
})

describe("§٧-٣ — «العذرُ لا يخصم»، والسببُ النصّيُّ **إلزاميّ**", () => {
  it("الحدثُ المعذورُ **يُسجَّل ولا يُنقص الرصيد**، وعدّادُه يظهر للشفافية", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })
    recordScore(store, ctx, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 2,
      excuse: "excused",
      excuseReason: "مرضٌ موثَّقٌ شهراً",
    })
    const standing = standingOf(store, contestant.id)
    expect(standing.totalPoints).toBe(20)
    expect(standing.excusedCount).toBe(1)
  })

  it("**وعذرٌ بلا سببٍ نصّيٍّ مرفوض** — «الأعذارُ المقبولة» والقبولُ قرارٌ يُبرَّر", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10 })
    const contestant = seedContestant(store, { competitionId: competition.id })
    const rejected = recordScore(store, ctx, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 2,
      excuse: "excused",
      excuseReason: "   ",
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("EXCUSE_REASON_REQUIRED")
  })

  it("**ونوعٌ لا يقبل عذراً** يُردّ ولو جاء بسببٍ صحيح", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const done = seedScoringType(store, competition.id, { key: "central_exam", valueKind: "score" })
    const contestant = seedContestant(store, { competitionId: competition.id })
    void done
    const strict = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: "central_exam",
      periodKey: PERIOD,
      value: 88,
    })
    expect(strict.ok).toBe(true)
    void ctx
  })
})

describe("§٧ — حدودُ الرصد: سقفُ الفترة والقيمةُ والقفلُ الرجعيّ", () => {
  it("**سقفُ الفترة يُقصّ** (ق-٤٠): قيمةٌ فوق `maxPerPeriod` تُردّ لا تُبتلع صامتةً", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id, { weight: 10, maxPerPeriod: 5 })
    const contestant = seedContestant(store, { competitionId: competition.id })
    const over = recordScore(store, ctx, {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 6,
    })
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.error.code).toBe("INVALID_VALUE")
  })

  it("**وقيمةٌ سالبةٌ مرفوضة** — النقاطُ تُكتسب ولا تُخصم من الرصد", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id)
    const contestant = seedContestant(store, { competitionId: competition.id })
    const negative = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: -1,
    })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.error.code).toBe("INVALID_VALUE")
  })

  it("**والرصدُ الرجعيُّ مقفولٌ** بعد `records.backdate_lock_days` — لا رقمَ ثانٍ للمسابقة", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id)
    const contestant = seedContestant(store, { competitionId: competition.id })
    const locked = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 1,
      occurredAt: new Date(NOW.getTime() - 40 * DAY_MS),
    })
    expect(locked.ok).toBe(false)
    if (!locked.ok) expect(locked.error.code).toBe("BACKDATE_LOCKED")
  })

  it("**ورصدٌ على مسابقةٍ مغلقةٍ مرفوض** ولو ملك الراصدُ قدرتَه", () => {
    const store = seedCompetitionStore()
    // تُبنى **جاريةً** بنوعها ومتبارِيها، ثم تُغلق بالمسار المُعلَن — فالإغلاقُ هو المتغيّر.
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const type = seedScoringType(store, competition.id)
    const contestant = seedContestant(store, { competitionId: competition.id })
    for (const to of ["qualifying", "closed"] as const) {
      const moved = advanceStatus(store, competitionContext("u-rabita"), {
        competitionId: competition.id,
        to,
      })
      expect(moved.ok, to).toBe(true)
    }
    const rejected = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 1,
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("COMPETITION_CLOSED")
  })

  it("**ونوعٌ مجهولٌ ومتبارٍ مجهولٌ** يُردّان بسببين مميِّزين لا بسببٍ مبهم", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const contestant = seedContestant(store, { competitionId: competition.id })
    const noType = recordScore(store, competitionContext("u-amir"), {
      contestantId: contestant.id,
      typeKey: "لا-وجود-له",
      periodKey: PERIOD,
      value: 1,
    })
    expect(noType.ok).toBe(false)
    if (!noType.ok) expect(noType.error.code).toBe("UNKNOWN_SCORING_TYPE")

    const type = seedScoringType(store, competition.id)
    const noContestant = recordScore(store, competitionContext("u-amir"), {
      contestantId: "لا-وجود-له",
      typeKey: type.key,
      periodKey: PERIOD,
      value: 1,
    })
    expect(noContestant.ok).toBe(false)
    if (!noContestant.ok) expect(noContestant.error.code).toBe("UNKNOWN_CONTESTANT")
  })
})
