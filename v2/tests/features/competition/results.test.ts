/**
 * **قب-٤٥ — «يُنشَر ولا يُكشَف»، والجائزةُ تُعلَن ولا تُصرف** (عقدُ الوحدة §٨).
 *
 * الإعلانُ **دفعٌ باتجاهٍ واحد**: مقتطفٌ مختومٌ لا يتغيّر بأيّ إعادة حساب، **ولا منفذَ قراءةٍ
 * عامٌّ له** — فالنظامُ يدفع والخارجُ لا يسأل، و**صفرُ سطح هجومٍ لأنّ الطريقَ غيرُ موجود**.
 * ومعه ثابتُ المال: صفرُ قدرةٍ ماليةٍ تُستهلَك، وصفرُ استيرادٍ من الدفتر أو الصندوق أو الرواتب.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { declareAward, defineStage } from "../../../src/features/competition/services/competitions.js"
import {
  declareResults,
  runAdvancement,
} from "../../../src/features/competition/services/results.js"
import { recordScore } from "../../../src/features/competition/services/scoring.js"
import { leaderboard } from "../../../src/features/competition/services/derive.js"
import {
  competitionContext,
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

/** عالمٌ جاهزٌ للإعلان: ثلاثةُ متبارين برصيدٍ متفاوتٍ ومسابقةٌ في التصفية. */
function readyToDeclare() {
  const store = seedCompetitionStore()
  const ctx = competitionContext("u-amir")
  const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
  const type = seedScoringType(store, competition.id, { weight: 10 })
  const contestants = ["الأول", "الثاني", "الثالث"].map((nameAr, i) =>
    seedContestant(store, {
      competitionId: competition.id,
      nameAr,
      phone: `097000000${i}`,
    }),
  )
  contestants.forEach((c, i) => {
    recordScore(store, ctx, {
      contestantId: c.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: (contestants.length - i) * 3,
    })
  })
  const award = declareAward(store, competitionContext("u-rabita"), {
    competitionId: competition.id,
    titleAr: "الجائزةُ الكبرى",
    kind: "cash",
    amountCents: 10_000_000,
    currency: "USD",
    place: 1,
  })
  if (!award.ok) throw new Error(award.error.code)
  return { store, competition, type, contestants, award: award.value }
}

describe("§٨ — الإعلانُ **فعلٌ لا رجعة فيه**، ومقتطفُه مختوم", () => {
  it("الإعلانُ يُنتج مقتطفاً بالفائزين ورتبِهم وأرصدتِهم، **ويُغلق المسابقة**", () => {
    const { store, competition } = readyToDeclare()
    const ctx = competitionContext("u-rabita")
    const declared = declareResults(store, ctx, { competitionId: competition.id })
    if (!declared.ok) throw new Error(declared.error.code)

    expect(declared.value.rows).toHaveLength(3)
    expect(declared.value.rows[0]?.rank).toBe(1)
    expect(declared.value.declaredBy).toBe("u-rabita")
    expect(store.getCompetition(competition.id)?.status).toBe("closed")
  })

  it("**والجوائزُ المعلنةُ تُرفَق بالمقتطف** — معلومةُ برنامجٍ لا قيدٌ ماليّ", () => {
    const { store, competition, award } = readyToDeclare()
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
    })
    if (!declared.ok) throw new Error(declared.error.code)
    expect(declared.value.awards.map((a) => a.id)).toEqual([award.id])
    expect(declared.value.awards[0]?.kind).toBe("cash")
  })

  it("**وإعلانٌ ثانٍ مرفوض** ⇒ `ALREADY_DECLARED` (لا ختمٌ ثانٍ يمحو الأول)", () => {
    const { store, competition } = readyToDeclare()
    const ctx = competitionContext("u-rabita")
    declareResults(store, ctx, { competitionId: competition.id })
    const again = declareResults(store, ctx, { competitionId: competition.id })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("ALREADY_DECLARED")
  })

  it("**ولا يُعلَن على مسابقةٍ ملغاة** — الإلغاءُ يُنهي ولا يُتوَّج", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { advanceTo: [] })
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
    })
    expect(declared.ok).toBe(false)
    if (!declared.ok) expect(declared.error.code).toBe("NOT_QUALIFYING")
  })

  it("**ومسابقةٌ مجهولةٌ** ⇒ `UNKNOWN_COMPETITION` لا انهيارٌ صامت", () => {
    const store = seedCompetitionStore()
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: "لا-وجود-لها",
    })
    expect(declared.ok).toBe(false)
    if (!declared.ok) expect(declared.error.code).toBe("UNKNOWN_COMPETITION")
  })
})

describe("§٨ — الحارسُ **السلوكيّ**: اللوحةُ الحيّةُ تتغيّر، والمقتطفُ لا يتغيّر", () => {
  it("**قب-٤٥ يُنشَر ولا يُكشَف: المقتطفُ المختومُ لا يتغيّر بأيّ إعادة حساب**", () => {
    const { store, competition, type, contestants } = readyToDeclare()
    const ctx = competitionContext("u-amir")
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
    })
    if (!declared.ok) throw new Error(declared.error.code)
    const sealedOrder = declared.value.rows.map((r) => r.contestantId)
    const sealedPoints = declared.value.rows.map((r) => r.points)

    // مسابقةٌ مغلقةٌ لا تقبل رصداً — وهذا نفسُه أحدُ وجهي الختم.
    const late = recordScore(store, ctx, {
      contestantId: contestants[2]!.id,
      typeKey: type.key,
      periodKey: PERIOD,
      value: 99,
    })
    expect(late.ok).toBe(false)

    // …ولو أُعيد بناءُ اللوحة الآن فالمقتطفُ **نسخةٌ مجمَّدة** لا مرجعٌ يُقرأ.
    const stored = store.getAnnouncement(competition.id)
    expect(stored?.rows.map((r) => r.contestantId)).toEqual(sealedOrder)
    expect(stored?.rows.map((r) => r.points)).toEqual(sealedPoints)
  })

  it("**والمقتطفُ نسخةٌ لا مرجع**: تغيُّرُ اللوحة الحيّة في مسابقةٍ نظيرةٍ لا يمسّه", () => {
    const { store, competition } = readyToDeclare()
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
    })
    if (!declared.ok) throw new Error(declared.error.code)
    const sealed = JSON.stringify(declared.value.rows)

    // مسابقةٌ ثانيةٌ حيّةٌ يتغيّر ترتيبُها — والمقتطفُ الأول ثابتٌ حرفاً بحرف.
    const other = seedCompetition(store, {
      unitId: "khalid",
      titleAr: "نظيرةٌ حيّة",
      advanceTo: ["enrolling", "running"],
    })
    const otherType = seedScoringType(store, other.id, { key: "other_type", weight: 10 })
    const runner = seedContestant(store, {
      competitionId: other.id,
      nameAr: "متبارٍ نظير",
      phone: "0979999999",
    })
    recordScore(store, competitionContext("u-amir"), {
      contestantId: runner.id,
      typeKey: otherType.key,
      periodKey: PERIOD,
      value: 7,
    })
    expect(leaderboard(store, other.id, runner.categoryId)).toHaveLength(1)
    expect(JSON.stringify(store.getAnnouncement(competition.id)?.rows)).toBe(sealed)
  })
})

describe("§٨ — التأهيلُ **بمعيارٍ معلنٍ** لا باختيارٍ يدويّ", () => {
  it("معيارُ «أعلى اثنين» يُنفَّذ ذرّياً فيُثبِّت الصاعدين — ولا تأهيلَ يدويٌّ بلا معيار", () => {
    const { store, competition, contestants } = readyToDeclare()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "التصفيةُ الأولى",
      advancement: { basis: "category", take: { topN: 2 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)

    const advanced = runAdvancement(store, competitionContext("u-rabita"), { stageId: stage.value.id })
    if (!advanced.ok) throw new Error(advanced.error.code)
    expect(advanced.value.map((c) => c.id)).toEqual([contestants[0]!.id, contestants[1]!.id])
    expect(store.getContestant(contestants[0]!.id)?.status).toBe("advanced")
    expect(store.getContestant(contestants[2]!.id)?.status).toBe("active")
  })

  it("**والمعيارُ يُعرض قبل تنفيذه** — المرحلةُ تحمل معيارَها بياناتٍ لا شيفرةً مخفيّة", () => {
    const { store, competition } = readyToDeclare()
    const stage = defineStage(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      order: 1,
      titleAr: "النهائيّ",
      advancement: { basis: "category", take: { topPercent: 50 } },
    })
    if (!stage.ok) throw new Error(stage.error.code)
    expect(store.getStage(stage.value.id)?.advancement.take).toEqual({ topPercent: 50 })
  })

  it("**ومرحلةٌ مجهولةٌ** ⇒ `UNKNOWN_STAGE`؛ **وترتيبٌ غيرُ موجبٍ مرفوض**", () => {
    const { store, competition } = readyToDeclare()
    const ctx = competitionContext("u-rabita")
    const missing = runAdvancement(store, ctx, { stageId: "لا-وجود-لها" })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe("UNKNOWN_STAGE")

    const bad = defineStage(store, ctx, {
      competitionId: competition.id,
      order: 0,
      titleAr: "مرحلةٌ بترتيبٍ صفر",
      advancement: { basis: "category", take: { topN: 1 } },
    })
    expect(bad.ok).toBe(false)
  })
})

describe("قب-٤٥ — **الجائزةُ تُعلَن ولا تُصرف**: صفرُ مسارٍ ماليّ في الوحدة", () => {
  it("إعلانُ الجائزة **لا يُنشئ مستحقّاً ولا قيداً** — تُنتج طلباً ولا تُنتج قيداً", () => {
    const { store, competition } = readyToDeclare()
    const declared = declareResults(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
    })
    expect(declared.ok).toBe(true)
    // المقتطفُ والجوائزُ والمتبارون — ولا كيانَ ماليٍّ واحدٍ في المستودع كلِّه.
    const handles = Object.getOwnPropertyNames(Object.getPrototypeOf(store))
    for (const handle of handles) {
      expect(handle, `مِقبضٌ ماليٌّ في مستودع المسابقة: ${handle}`).not.toMatch(
        /payout|entitlement|journal|ledger|voucher|salary/i,
      )
    }
  })

  it("**وصفرُ قدرةٍ ماليةٍ تُستهلَك، وصفرُ استيرادٍ من وحدةِ ميزةٍ أخرى**", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      const source = readFileSync(file, "utf8")
      const rel = file.slice(MODULE_DIR.length + 1)
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
      code.split("\n").forEach((line, i) => {
        for (const cap of [
          // **قدراتُ الاعتماد لا تُسرد هنا**: G22 تحرسها مركزياً بقائمةٍ **مشتقّة**،
          // وسردُها في اختبارٍ يُفشلها بنفسه (قاعدةُ CR-011: تُشتقّ لا تُسرد).
          "finance.payout",
          "finance.supervise",
          "budget.manage",
          "ledger.journal.entry",
          "records.correct",
          "report.export",
          "audit.view",
        ]) {
          if (line.includes(`"${cap}"`)) offenders.push(`${rel}:${i + 1} — قدرةٌ خارج الخمس: ${cap}`)
        }
        const foreign = /from\s+"\.\.\/\.\.\/(\w+)\//.exec(line)
        if (foreign !== null && foreign[1] !== "competition") {
          offenders.push(`${rel}:${i + 1} — استيرادٌ من وحدةٍ أخرى: ${foreign[1]}`)
        }
      })
    }
    expect(offenders, offenders.join("\n")).toEqual([])
  })

  it("**والجائزةُ تلزمها هويّةٌ**: عنوانٌ فارغٌ مرفوض، والعينيّةُ والمعنويّةُ بلا مبلغ", () => {
    const { store, competition } = readyToDeclare()
    const ctx = competitionContext("u-rabita")
    const empty = declareAward(store, ctx, {
      competitionId: competition.id,
      titleAr: "  ",
      kind: "honorary",
    })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.code).toBe("EMPTY_TITLE")

    const honorary = declareAward(store, ctx, {
      competitionId: competition.id,
      titleAr: "شهادةُ تقدير",
      kind: "honorary",
    })
    if (!honorary.ok) throw new Error(honorary.error.code)
    expect(honorary.value.amountCents).toBeNull()
    expect(honorary.value.currency).toBeNull()
  })
})
