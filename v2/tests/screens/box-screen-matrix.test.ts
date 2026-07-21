/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات الصندوق ومالية المسجد**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — وهي الاختبارُ الإلزاميّ العاشر في T8.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفتا `org` و`ledger`): لا إطارَ واجهةٍ في v2 بعد
 * (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم،
 * لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { makeBoxEndpoints } from "../../src/features/box/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { computeBoxCaps } from "../../src/features/box/screens/caps.js"
import {
  boxHandoversScreenNodes,
  boxScreenNodes,
  mosqueFinanceScreenNodes,
  EMPTY_BOX_SNAPSHOT,
} from "../../src/features/box/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import { handoverDown } from "../../src/features/box/services/handover.js"
import { receiveIntoBox } from "../../src/features/box/services/operations.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { BoxStores } from "../../src/features/box/data/store.js"
import {
  boxContext,
  c,
  canonicalActor,
  canonicalDirectory,
  DECISION,
  seedBoxStores,
  WRITE,
} from "../features/box/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول والأشجار (`guardedBy`) — فالجدولُ المحروسُ بقدرةٍ عنصرٌ يظهر لصاحبها.
 * وتُستثنى القشرةُ (شريطُ التنقّل) فلها حارسُها المستقلّ (ق-١١٤).
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
const KHALID = "khalid"

type RoleFixture = { readonly label: string; readonly personId: string; readonly scopePath: string }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ من العشرة — من العالم القانونيّ لا من عالمٍ ثانٍ. */
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", personId: "u-admin", scopePath: "/" },
  { label: "section_head", personId: "u-section-head", scopePath: "/men/" },
  { label: "rabita", personId: "u-rabita", scopePath: "/men/homs/" },
  { label: "square", personId: "u-square", scopePath: "/men/homs/sq2/" },
  { label: "amir", personId: "u-amir", scopePath: "/men/homs/sq2/khalid/" },
  { label: "teacher", personId: "u-teacher", scopePath: "/men/homs/sq2/khalid/c1/" },
  { label: "committee_head", personId: "u-committee-head", scopePath: "/men/homs/sq2/khalid/" },
  { label: "media", personId: "u-media", scopePath: "/" },
  { label: "finance_officer", personId: "u-finance", scopePath: "/" },
  { label: "student", personId: "u-student", scopePath: "/men/homs/sq2/khalid/c1/" },
]

type Ep = ReturnType<typeof makeBoxEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, stores: BoxStores, f: RoleFixture) => Promise<{ ok: boolean }>
}

function seedWithMoney(): BoxStores {
  const stores = seedBoxStores()
  receiveIntoBox(stores, boxContext("u-square"), {
    unitId: "sq2",
    operationId: "seed-cash",
    memoAr: "قبضتُ",
    lines: [{ currency: "USD", amount: c(30_000) }],
  })
  return stores
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/box",
    element: "لوحُ الصندوق (الأرصدة والصناديق الثلاثة والحركات والصناديق السُّفلية)",
    cap: "box.view",
    shown: (caps) => visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes("box.view"),
    serverInvoke: (ep, _s, f) =>
      ep.unitView.invoke({ unitId: KHALID }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/box",
    element: "زرُّ «قبضتُ»",
    cap: "box.receive",
    shown: (caps) =>
      visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes("box.receive"),
    serverInvoke: (ep, _s, f) =>
      ep.receive.invoke(
        {
          unitId: KHALID,
          operationId: `m-rcv-${f.personId}`,
          memoAr: "قبضتُ",
          lines: [{ currency: "USD", amount: c(100) }],
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/box",
    element: "زرُّ «صرفتُ» بفئةٍ من القاموس المغلق",
    cap: "box.spend",
    shown: (caps) =>
      visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes("box.spend"),
    serverInvoke: (ep, _s, f) =>
      ep.spend.invoke(
        {
          unitId: KHALID,
          operationId: `m-spd-${f.personId}`,
          memoAr: "صرفتُ",
          categoryId: "fuel",
          currency: "USD",
          amount: c(100),
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/box",
    element: "زرُّ «سلّمتُ نازلاً»",
    cap: "box.handover",
    shown: (caps) =>
      visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes("box.handover"),
    serverInvoke: (ep, _s, f) =>
      ep.handover.invoke(
        {
          // **نطاقُ الشاشة هو نطاقُ الاستدعاء**: التسليمُ من صندوق هذه الوحدة بعينها،
          // فيكون الرفضُ رفضَ قدرةٍ لا اختلافَ هدف.
          fromUnitId: KHALID,
          toUnitId: "c1",
          toCustodianPersonId: "u-amir",
          operationId: `m-hnd-${f.personId}`,
          memoAr: "سلّمتُ",
          currency: "USD",
          amount: c(100),
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/box/handovers",
    element: "سجلُّ التسليمات",
    cap: "box.view",
    shown: (caps) =>
      visibleCaps(boxHandoversScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes("box.view"),
    serverInvoke: (ep, _s, f) =>
      ep.handovers.invoke({ unitId: KHALID }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/finance",
    element: "لوحُ مالية المسجد",
    cap: "mosqueFinance.view",
    shown: (caps) =>
      visibleCaps(mosqueFinanceScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes(
        "mosqueFinance.view",
      ),
    serverInvoke: (ep, _s, f) =>
      ep.mosqueFinanceView.invoke({ unitId: KHALID }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/finance",
    element: "زرُّ تسجيل عملية مالية المسجد (بلا طابور — ق-٦٣)",
    cap: "mosqueFinance.manage",
    shown: (caps) =>
      visibleCaps(mosqueFinanceScreenNodes(caps, EMPTY_BOX_SNAPSHOT)).includes(
        "mosqueFinance.manage",
      ),
    serverInvoke: (ep, _s, f) =>
      ep.mosqueFinanceRecord.invoke(
        {
          verb: "received",
          unitId: KHALID,
          operationId: `m-mf-${f.personId}`,
          memoAr: "قبضتُ",
          lines: [{ currency: "USD", amount: c(100) }],
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
]

describe("مصفوفةُ شاشات الصندوق — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const stores = seedWithMoney()
        const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
        // القدراتُ تُحسب على **نطاق المسجد** — وهو نطاقُ الشاشة المفحوصة.
        const caps = computeBoxCaps(canonicalActor(f.personId), "/men/homs/sq2/khalid/", DECISION)

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, stores, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات الصندوق] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى ولا يشغّل**: لوحُ الصندوق يظهر له، وأزرارُ القبض والصرف والتسليم غائبة", async () => {
    clearRegistryForTests()
    const stores = seedWithMoney()
    const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
    const caps = computeBoxCaps(canonicalActor("u-admin"), "/men/homs/sq2/khalid/", DECISION)
    const shown = visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT))

    expect(shown).toContain("box.view")
    expect(shown).not.toContain("box.receive")
    expect(shown).not.toContain("box.spend")
    expect(shown).not.toContain("box.handover")

    const viewed = await ep.unitView.invoke({ unitId: KHALID }, canonicalActor("u-admin"), DECISION)
    expect(viewed.ok).toBe(true)
  })

  it("**والمسؤولُ الماليُّ مطّلعٌ على الصندوق لا أمينٌ فيه** (جدولُ الغياب §٣)", () => {
    const caps = computeBoxCaps(canonicalActor("u-finance"), "/men/homs/sq2/khalid/", DECISION)
    const shown = visibleCaps(boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT))
    expect(shown).toContain("box.view")
    expect(shown).not.toContain("box.receive")
    expect(shown).not.toContain("box.spend")
  })

  it("**والإقرارُ لا يظهر إلا لصاحبه**، واستدعاؤه من غيره مرفوضٌ في الخادم (خ-٧)", async () => {
    clearRegistryForTests()
    const stores = seedWithMoney()
    const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
    const done = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "sq2",
      toUnitId: KHALID,
      toCustodianPersonId: "u-amir",
      operationId: "hnd-matrix",
      memoAr: "سلّمتُ",
      currency: "USD",
      amount: c(1_000),
    })
    if (!done.ok) throw new Error(done.error.code)

    for (const personId of ["u-admin", "u-square", "u-amir-bilal", "u-finance", "u-student"]) {
      const r = await ep.acknowledge.invoke(
        { handoverId: done.value.handover.id },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, `«${personId}» أقرّ استلامَ غيره`).toBe(false)
    }
    const owner = await ep.acknowledge.invoke(
      { handoverId: done.value.handover.id },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(owner.ok).toBe(true)
  })

  it("**والطالبُ لا يرى شيئاً من المال**: ثلاثُ شاشاتٍ كلُّها فراغٌ مُشخِّص", () => {
    const caps = computeBoxCaps(canonicalActor("u-student"), "/men/homs/sq2/khalid/c1/", DECISION)
    for (const nodes of [
      boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT),
      boxHandoversScreenNodes(caps, EMPTY_BOX_SNAPSHOT),
      mosqueFinanceScreenNodes(caps, EMPTY_BOX_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })
})
