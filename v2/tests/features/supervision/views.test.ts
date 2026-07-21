/**
 * ق-١٠١/ق-١٠٢ — **عدستان لا شاشةٌ واحدة، وكلُّ معتمَدٍ باسم معتمِده** (عقدُ الوحدة §٤).
 *
 * سؤالُ المالك الذي وُلدت منه ق-١٠١: «ما الذي يهمّني حقاً؟ **كيف تقوم لي منطقتك؟**» ثم:
 * «هل أصلحتَها للمدير فقط أم على جميع المستويات؟» — ولذلك يُختبر التجميعُ **بقاعدةٍ واحدة**
 * على ثلاثة مستويات: الجذرُ يرى أقسامَه، والقسمُ مناطقَه، والمنطقةُ مربعاتِها.
 */
import { describe, it, expect } from "vitest"
import { recordVisit } from "../../../src/features/supervision/services/visits.js"
import {
  supervisionBoard,
  supervisionOverview,
  visitsInScope,
} from "../../../src/features/supervision/services/views.js"
import type { VisitVerdict } from "../../../src/features/supervision/types.js"
import {
  BASEERA_DETAILS,
  C1,
  C1B,
  C1_PATH,
  C2,
  C3,
  CORE,
  HOMS_PATH,
  MEN_PATH,
  NOW,
  SQ2_PATH,
  SQ7_PATH,
  TAHFEEZ_DETAILS,
  seedSupervisionStore,
  supervisionContext,
} from "./_seed.js"

const DAY_MS = 24 * 60 * 60 * 1000
const daysBefore = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS)
const ROOT_PATH = "/"

/** زيارةٌ مسجَّلةٌ بالمسار المشروع — لا حقنَ في المستودع. */
function visit(
  store: ReturnType<typeof seedSupervisionStore>,
  personId: string,
  targetId: string,
  daysAgo: number,
): string {
  const details = targetId === C1B || targetId === C2 ? BASEERA_DETAILS : TAHFEEZ_DETAILS
  const at = daysBefore(daysAgo)
  const result = recordVisit(store, supervisionContext(personId, { now: at }), {
    targetId,
    visitedAt: at,
    core: CORE,
    details,
  })
  if (!result.ok) throw new Error(`تعذّر تسجيلُ زيارةِ البذرة: ${result.error.code}`)
  return result.value.id
}

describe("ق-١٠١ — العرضُ القياديّ: تجميعٌ بالوحدة التالية مرتَّبٌ بالأسوأ", () => {
  it("**مسؤولُ المنطقة يرى مربعاتِه** — صفٌّ لكل مربعٍ بعدد أهدافه وما زاره مشرفوه", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)

    const rows = supervisionOverview(store, supervisionContext("u-rabita"), HOMS_PATH)

    expect(rows.map((r) => r.unitPath).sort()).toEqual([SQ2_PATH, SQ7_PATH].sort())
    const sq2 = rows.find((r) => r.unitPath === SQ2_PATH)
    expect(sq2?.targetCount).toBe(3)
    expect(sq2?.visitedInCycle).toBe(1)
  })

  it("**والأسوأُ أولاً**: المربعُ الذي لم يُزَر فيه شيءٌ يتصدّر القائمة", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)

    const rows = supervisionOverview(store, supervisionContext("u-rabita"), HOMS_PATH)

    expect(rows[0]?.unitPath).toBe(SQ7_PATH)
    expect(rows[0]?.coveragePct).toBe(0)
    expect(rows[1]?.unitPath).toBe(SQ2_PATH)
  })

  it("**والمسؤولُ باسمه، والشاغرُ يُعلَن شاغراً** (ق-١٠١: «المسؤول فلان»)", () => {
    const store = seedSupervisionStore()
    const rows = supervisionOverview(store, supervisionContext("u-rabita"), HOMS_PATH)

    expect(rows.find((r) => r.unitPath === SQ2_PATH)?.responsiblePersonId).toBe("u-square")
    // المربعُ السابع شاغرٌ عمداً في العالم القانونيّ — فلا يُخترع له اسم.
    expect(rows.find((r) => r.unitPath === SQ7_PATH)?.responsiblePersonId).toBeNull()
  })

  it("**والتغطيةُ «ضمن الدورة» لا مطلقاً**: زيارةٌ تجاوزت الدورةَ لا تُحتسب", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 45)

    const rows = supervisionOverview(store, supervisionContext("u-rabita"), HOMS_PATH)
    expect(rows.find((r) => r.unitPath === SQ2_PATH)?.visitedInCycle).toBe(0)
  })

  it("**قاعدةٌ واحدةٌ لا حالتان**: من الجذر يُجمَّع بالأقسام، ومن القسم بالمناطق", () => {
    const store = seedSupervisionStore()

    const fromRoot = supervisionOverview(store, supervisionContext("u-admin"), ROOT_PATH)
    expect(fromRoot.map((r) => r.unitPath)).toContain(MEN_PATH)

    const fromSection = supervisionOverview(store, supervisionContext("u-section-head"), MEN_PATH)
    expect(fromSection.map((r) => r.unitPath)).toEqual([HOMS_PATH])
    expect(fromSection[0]?.targetCount).toBe(4)
  })

  it("**والوحدةُ التي لا حلقةَ فيها تظهر صفراً ولا تختفي** — «ما لم يُدخَل لا يُرى» مرضُ v1", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)

    const fromRoot = supervisionOverview(store, supervisionContext("u-admin"), ROOT_PATH)

    // القسمُ النسائيّ في العالم القانونيّ بلا حلقاتٍ مُسنَدة — فهو أسوأُ الحالات لا حالةٌ غائبة.
    const women = fromRoot.find((r) => r.unitPath === "/women/")
    expect(women?.targetCount).toBe(0)
    expect(women?.coveragePct).toBe(0)
    // وقد تصدّر القائمةَ على قسمٍ زُوِّرت فيه حلقةٌ — الترتيبُ بالأسوأ لا بالاسم.
    expect(fromRoot[0]?.unitPath).toBe("/women/")
    expect(fromRoot[1]?.unitPath).toBe(MEN_PATH)
  })
})

describe("ق-١٠١ — لوحةُ المكلَّف التشغيلية: عملُه هو لا تقييمُ غيره", () => {
  it("لوحةُ المربع: أهدافُه بحالاتها + زياراتُه الأخيرة — ونطاقُه منطوقٌ فيها", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)

    const board = supervisionBoard(store, supervisionContext("u-square"), SQ2_PATH)

    expect(board.scopePath).toBe(SQ2_PATH)
    expect(board.targets).toHaveLength(3)
    expect(board.recentVisits).toHaveLength(1)
    expect(board.recentVisits[0]?.visit.targetId).toBe(C1)
  })

  it("**والعزلُ بالنطاق**: لوحةُ المربع الثاني لا تحمل زيارةَ المربع السابع", () => {
    const store = seedSupervisionStore()
    visit(store, "u-rabita", C2, 2)

    const board = supervisionBoard(store, supervisionContext("u-square"), SQ2_PATH)
    expect(board.recentVisits).toHaveLength(0)
    expect(board.targets.map((t) => t.targetId)).not.toContain(C2)
  })

  it("**والاطّلاعُ الهابطُ مباح** (ق-١٧): المنطقةُ ترى زياراتِ مربعاتها كلِّها", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)
    visit(store, "u-rabita", C2, 2)

    const seen = visitsInScope(store, supervisionContext("u-rabita"), HOMS_PATH)
    expect(seen.map((r) => r.visit.targetId).sort()).toEqual([C1, C2].sort())
  })

  it("والزياراتُ بالأحدث أولاً — قائمةٌ تُقرأ لا كومةٌ بلا ترتيب", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 20)
    visit(store, "u-square", C3, 2)

    const seen = visitsInScope(store, supervisionContext("u-square"), SQ2_PATH)
    expect(seen.map((r) => r.visit.targetId)).toEqual([C3, C1])
  })

  it("**وزيارتان في اليوم نفسِه تُرتَّبان حتميّاً** — لا ترتيبَ يتبدّل بين تشغيلين", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 4)
    visit(store, "u-square", C3, 4)

    const first = visitsInScope(store, supervisionContext("u-square"), SQ2_PATH)
    const second = visitsInScope(store, supervisionContext("u-square"), SQ2_PATH)
    expect(first.map((r) => r.visit.id)).toEqual(["vst-2", "vst-1"])
    expect(second.map((r) => r.visit.id)).toEqual(first.map((r) => r.visit.id))
  })

  it("**والعرضُ القياديُّ على مستوى الحلقة نفسِها لا وحدةَ تاليةَ فيه** — صفٌّ لا يُخترع", () => {
    const store = seedSupervisionStore()
    expect(supervisionOverview(store, supervisionContext("u-square"), C1_PATH)).toEqual([])
  })
})

describe("ق-١٠٢ — كلُّ معتمَدٍ يحمل اسمَ معتمِده (الاختبار الثامن الإلزاميّ)", () => {
  it("**المعتمَدةُ تحمل اسمَ مَن اعتمدها** — والاسمُ من منفذ الحكم لا من حقلٍ يُملأ", () => {
    const store = seedSupervisionStore()
    const visitId = visit(store, "u-square", C1, 3)
    const approved: VisitVerdict = { approved: true, approvedByPersonId: "u-rabita" }

    const seen = visitsInScope(
      store,
      supervisionContext("u-rabita", { verdictOf: (id) => (id === visitId ? approved : { approved: false, approvedByPersonId: null }) }),
      HOMS_PATH,
    )

    expect(seen[0]?.verdict.approved).toBe(true)
    expect(seen[0]?.verdict.approvedByPersonId).toBe("u-rabita")
  })

  it("**والمعلَّقةُ بلا اسمٍ مخترع**: ما لم يُعتمَد يبقى بلا معتمِد", () => {
    const store = seedSupervisionStore()
    visit(store, "u-square", C1, 3)

    const seen = visitsInScope(store, supervisionContext("u-rabita"), HOMS_PATH)
    expect(seen[0]?.verdict.approved).toBe(false)
    expect(seen[0]?.verdict.approvedByPersonId).toBeNull()
  })

  it("**واللوحةُ تحمل الحُكمَ كذلك** — لا سطحَ يعرض زيارةً بلا حكمها", () => {
    const store = seedSupervisionStore()
    const visitId = visit(store, "u-square", C1, 3)

    const board = supervisionBoard(
      store,
      supervisionContext("u-square", {
        verdictOf: (id) => ({
          approved: id === visitId,
          approvedByPersonId: id === visitId ? "u-rabita" : null,
        }),
      }),
      SQ2_PATH,
    )

    expect(board.recentVisits[0]?.verdict.approvedByPersonId).toBe("u-rabita")
  })
})
