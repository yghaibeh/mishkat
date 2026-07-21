/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات الإشراف الثلاث**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — وهي **الاختبارُ السابع الإلزاميّ** في T11.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة **على نطاق الشاشة**، ويُفحص
 * **حضورُ العنصر بعدسة الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** —
 * الطبقتان معاً؛ إخفاءُ الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`ledger` و`box` و`dailyLog`): لا إطارَ
 * واجهةٍ في v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** +
 * رفض الخادم، لا على متصفحٍ حيّ.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { ApprovalStore } from "../../src/features/approval/data/store.js"
import { makeVisitApprovalEndpoints } from "../../src/features/approval/server/supervisionVisit.js"
import { makeSupervisionEndpoints } from "../../src/features/supervision/server/endpoints.js"
import { computeSupervisionCaps } from "../../src/features/supervision/screens/caps.js"
import {
  EMPTY_BOARD_SNAPSHOT,
  EMPTY_MOSQUE_VISITS_SNAPSHOT,
  EMPTY_OVERVIEW_SNAPSHOT,
  mosqueVisitsScreenNodes,
  supervisionBoardScreenNodes,
  supervisionOverviewScreenNodes,
  type BoardSnapshot,
  type MosqueVisitsSnapshot,
  type OverviewSnapshot,
} from "../../src/features/supervision/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import {
  C1,
  CORE,
  KHALID_PATH,
  NOW,
  READ,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  WRITE,
  canonicalActor,
  canonicalPeople,
  canonicalResponsibleOf,
  PENDING_VERDICT,
  seedSupervisionStore,
} from "../features/supervision/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول (`guardedBy`). وتُستثنى القشرةُ فلها حارسُها المستقلّ (ق-١١٤).
 */
function visibleCaps(root: UiNode): readonly string[] {
  const out = new Set<string>()
  for (const block of screenContentNodes(root)) {
    for (const n of walkNodes(block)) {
      if (n.capability !== null && n.capability !== "derived") out.add(n.capability)
      const guarded = n.meta.guardedBy
      if (guarded !== undefined) for (const cap of guarded.split(",")) out.add(cap)
    }
  }
  return [...out]
}

const SETTINGS = createSettingsResolver([])
const PORTS = { verdictOf: () => PENDING_VERDICT, responsibleOf: canonicalResponsibleOf }

/** لقطاتٌ **ذاتُ محتوى** — بها وحدَها تظهر عناصرُ العمل (لا فوق فراغ). */
const BOARD: BoardSnapshot = Object.freeze({
  ...EMPTY_BOARD_SNAPSHOT,
  scopePath: SQ2_PATH,
  targetRows: Object.freeze([{ target: "c1", status: "متأخرة", lastVisit: "—", cadence: "٣٠" }]),
  pendingRows: Object.freeze([{ target: "c1", supervisor: "u-square", visitedAt: "٢٠" }]),
  hasPending: true,
})

const OVERVIEW: OverviewSnapshot = Object.freeze({
  ...EMPTY_OVERVIEW_SNAPSHOT,
  scopePath: SQ2_PATH,
  rows: Object.freeze([
    { unit: "sq2", responsible: "u-square", visited: "١", targets: "٣", coverage: "٣٣" },
  ]),
})

const MOSQUE: MosqueVisitsSnapshot = Object.freeze({
  ...EMPTY_MOSQUE_VISITS_SNAPSHOT,
  scopePath: KHALID_PATH,
  rows: Object.freeze([{ date: "٢٠", curriculum: "تحفيظ", rating: "٨٠", approvedBy: "u-rabita" }]),
})

type RoleFixture = { readonly label: string; readonly personId: string }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ من العشرة — من العالم القانونيّ لا من عالمٍ ثانٍ. */
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", personId: "u-admin" },
  { label: "section_head", personId: "u-section-head" },
  { label: "rabita", personId: "u-rabita" },
  { label: "square", personId: "u-square" },
  { label: "amir", personId: "u-amir" },
  { label: "teacher", personId: "u-teacher" },
  { label: "committee_head", personId: "u-committee-head" },
  { label: "media", personId: "u-media" },
  { label: "finance_officer", personId: "u-finance" },
  { label: "student", personId: "u-student" },
]

type Ep = ReturnType<typeof makeSupervisionEndpoints>
type ApprovalEp = ReturnType<typeof makeVisitApprovalEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly scopePath: string
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (
    ep: Ep,
    approvalEp: ApprovalEp,
    requestId: string,
    f: RoleFixture,
  ) => Promise<{ ok: boolean }>
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/supervision/board",
    element: "لوحُ الأهداف المستحقة ونموذجُ تسجيل الزيارة (ق-٩٩/ق-١٠٠)",
    cap: "visit.conduct",
    scopePath: SQ2_PATH,
    shown: (caps) => visibleCaps(supervisionBoardScreenNodes(caps, BOARD)).includes("visit.conduct"),
    serverInvoke: (ep, _a, _r, f) =>
      ep.record.invoke(
        { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/supervision/board",
    element: "صندوقُ «بانتظار اعتمادك» وزرُّ اعتماد الزيارة (ق-١٦)",
    cap: "visit.approve",
    scopePath: SQ2_PATH,
    shown: (caps) => visibleCaps(supervisionBoardScreenNodes(caps, BOARD)).includes("visit.approve"),
    serverInvoke: (_e, approvalEp, requestId, f) =>
      approvalEp.approve.invoke({ requestId }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/supervision/overview",
    element: "العرضُ القياديّ بالوحدة التالية (ق-١٠١)",
    cap: "visit.view",
    scopePath: SQ2_PATH,
    shown: (caps) =>
      visibleCaps(supervisionOverviewScreenNodes(caps, OVERVIEW)).includes("visit.view"),
    serverInvoke: (ep, _a, _r, f) =>
      ep.overview.invoke({ unitId: "sq2" }, canonicalActor(f.personId), READ),
  },
  {
    screen: "/mosque/supervision",
    element: "زياراتُ مسجدي باسم معتمِدها (ق-١٠٢)",
    cap: "visit.view",
    scopePath: KHALID_PATH,
    shown: (caps) => visibleCaps(mosqueVisitsScreenNodes(caps, MOSQUE)).includes("visit.view"),
    serverInvoke: (ep, _a, _r, f) =>
      ep.visits.invoke({ unitId: "khalid" }, canonicalActor(f.personId), READ),
  },
]

/** عالمٌ فيه زيارةٌ مرفوعةٌ فعلاً — كي يكون لزرِّ الاعتماد طلبٌ حقيقيٌّ يُستدعى عليه. */
async function worldWithPendingVisit() {
  const store = seedSupervisionStore()
  const approval = new ApprovalStore("t-main")
  const ep = makeSupervisionEndpoints(store, SETTINGS, PORTS)
  const approvalEp = makeVisitApprovalEndpoints(
    { supervision: store, approval },
    SETTINGS,
    canonicalPeople(),
  )

  const recorded = await ep.record.invoke(
    { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
    canonicalActor("u-square"),
    WRITE,
  )
  if (!recorded.ok || !recorded.value.ok) throw new Error("تعذّر تسجيلُ زيارة البذرة")
  const submitted = await approvalEp.submit.invoke(
    { visitId: recorded.value.value.id },
    canonicalActor("u-square"),
    WRITE,
  )
  if (!submitted.ok || !submitted.value.ok) throw new Error("تعذّر رفعُ زيارة البذرة")

  return { ep, approvalEp, requestId: submitted.value.value.id }
}

beforeEach(() => clearRegistryForTests())

describe("مصفوفةُ شاشات الإشراف — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const { ep, approvalEp, requestId } = await worldWithPendingVisit()
        const caps = computeSupervisionCaps(canonicalActor(f.personId), a.scopePath, READ)

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, approvalEp, requestId, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات الإشراف] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى ولا يزور** (ق-٣/ق-٤): العرضُ القياديُّ له، ولوحةُ العمل غائبةٌ عنه", async () => {
    const { ep } = await worldWithPendingVisit()
    const caps = computeSupervisionCaps(canonicalActor("u-admin"), SQ2_PATH, READ)

    expect(visibleCaps(supervisionOverviewScreenNodes(caps, OVERVIEW))).toContain("visit.view")
    expect(visibleCaps(supervisionBoardScreenNodes(caps, BOARD))).not.toContain("visit.conduct")
    expect(visibleCaps(supervisionBoardScreenNodes(caps, BOARD))).not.toContain("visit.approve")

    const viewed = await ep.overview.invoke({ unitId: "sq2" }, canonicalActor("u-admin"), READ)
    expect(viewed.ok).toBe(true)
  })

  it("**والأميرُ يرى زياراتِ مسجده ولا ينفّذ ولا يعتمد** (عدسة §٢.٥ بابُ ٨)", () => {
    const atMosque = computeSupervisionCaps(canonicalActor("u-amir"), KHALID_PATH, READ)
    expect(visibleCaps(mosqueVisitsScreenNodes(atMosque, MOSQUE))).toContain("visit.view")

    const board = supervisionBoardScreenNodes(atMosque, BOARD)
    expect(board.component).toBe("EmptyState")
    expect(board.meta.diagnostic).toBe("true")
  })

  it("**والمكلَّفُ وحده يرى صندوقَ اعتماده**: المربعُ يراه، والأميرُ والمعلّمُ لا", () => {
    const square = computeSupervisionCaps(canonicalActor("u-square"), SQ2_PATH, READ)
    expect(visibleCaps(supervisionBoardScreenNodes(square, BOARD))).toContain("visit.approve")

    for (const personId of ["u-amir", "u-teacher", "u-student", "u-media", "u-finance"]) {
      const caps = computeSupervisionCaps(canonicalActor(personId), SQ2_PATH, READ)
      expect(visibleCaps(supervisionBoardScreenNodes(caps, BOARD)), personId).not.toContain(
        "visit.approve",
      )
    }
  })

  it("**ولا زرَّ اعتمادٍ فوق صندوقٍ فارغ** — مكانَه سطرٌ يقول إنه فارغ (ق-١١٢)", () => {
    const square = computeSupervisionCaps(canonicalActor("u-square"), SQ2_PATH, READ)
    const empty = supervisionBoardScreenNodes(square, { ...BOARD, hasPending: false, pendingRows: [] })

    expect(visibleCaps(empty)).not.toContain("visit.approve")
    expect(visibleCaps(empty)).toContain("visit.conduct")
  })

  it("**والمعلّمُ والطالبُ لا يريان شاشةَ إشرافٍ أصلاً**: فراغٌ مُشخِّصٌ لا شاشةٌ بيضاء", () => {
    for (const personId of ["u-teacher", "u-student", "u-committee-head"]) {
      const caps = computeSupervisionCaps(canonicalActor(personId), SQ2_PATH, READ)
      for (const nodes of [
        supervisionBoardScreenNodes(caps, BOARD),
        supervisionOverviewScreenNodes(caps, OVERVIEW),
        mosqueVisitsScreenNodes(caps, MOSQUE),
      ]) {
        expect(nodes.component, personId).toBe("EmptyState")
        expect(nodes.meta.diagnostic).toBe("true")
      }
    }
  })
})
