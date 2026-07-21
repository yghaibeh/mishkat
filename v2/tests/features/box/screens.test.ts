/**
 * شاشاتُ الصندوق ومالية المسجد — عقودُها (G20) وطابعُها (قب-٢٥) ووجهُها المبسَّط (قب-٨).
 *
 * الشاشةُ **إسقاطٌ للقدرات المحسوبة**: تُظهر ما يملكه الفاعلُ وتُغيب ما لا يملكه، ولا تقرر
 * صلاحيةً ولا تفحص دوراً (المادة ٤/٦). وما يظهر منها كلُّه **مشتقٌّ من نموذج الصفحة الواحد**.
 */
import { describe, it, expect } from "vitest"
import {
  BOX_CONTRACT,
  BOX_HANDOVERS_CONTRACT,
  MOSQUE_FINANCE_CONTRACT,
  boxScreenNodes,
  boxHandoversScreenNodes,
  mosqueFinanceScreenNodes,
  projectBoxSnapshot,
  EMPTY_BOX_SNAPSHOT,
} from "../../../src/features/box/screens/screens.js"
import { computeBoxCaps, SCREEN_SURFACE_CAPS } from "../../../src/features/box/screens/caps.js"
import { unitBoxView } from "../../../src/features/box/services/boxViews.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"
import { validateContract } from "../../../src/ui/screens/contract.js"
import { declaredCapabilities, screenContentNodes, walkNodes } from "../../../src/ui/components/kernel.js"
import { TEXT_KEYS } from "../../../src/ui/text/dictionary.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"
import { boxContext, c, canonicalActor, DECISION, seedBoxStores } from "./_seed.js"

const KHALID_PATH = "/men/homs/sq2/khalid/"
const CONTRACTS = [BOX_CONTRACT, BOX_HANDOVERS_CONTRACT, MOSQUE_FINANCE_CONTRACT]

function capsOf(list: readonly CapId[]): ReadonlySet<CapId> {
  return new Set(list)
}

describe("عقودُ الشاشات الثلاث صالحةٌ ومواطنُها من تصنيف IA §١", () => {
  it("كلُّ عقدٍ يمرّ مُحقِّقَ العقد بلا مخالفة", () => {
    for (const contract of CONTRACTS) {
      expect(validateContract(contract), contract.route).toEqual([])
    }
  })

  it("وموطنُ «الصندوق» شاشتُه، وموطنُ «مالية المسجد» شاشتُها، والتسليماتُ عرضٌ منسوب", () => {
    expect(BOX_CONTRACT.canonicalHome).toEqual(["box"])
    expect(MOSQUE_FINANCE_CONTRACT.canonicalHome).toEqual(["mosqueFinance"])
    expect(BOX_HANDOVERS_CONTRACT.canonicalHome).toEqual([])
  })

  it("ومصدرُ بياناتٍ **واحدٌ** لكل شاشة (ق-١١١)", () => {
    for (const contract of CONTRACTS) {
      expect(contract.dataSource.length).toBeGreaterThan(0)
    }
    expect(new Set(CONTRACTS.map((x) => x.dataSource)).size).toBe(CONTRACTS.length)
  })
})

describe("الإسقاطُ بالقدرات: يظهر ما يملكه الفاعلُ ويغيب ما لا يملكه", () => {
  it("بلا `box.view` ⇒ **فراغٌ مُشخِّصٌ** لا شاشةٌ بيضاء ولا زرٌّ واحد", () => {
    const view = boxScreenNodes(capsOf([]), EMPTY_BOX_SNAPSHOT)
    expect(declaredCapabilities(view).filter((x) => x.startsWith("box."))).toEqual([])
    const nodes = walkNodes(view)
    expect(nodes.some((n) => n.component === "EmptyState")).toBe(true)
    expect(nodes.some((n) => n.component === "Button")).toBe(false)
  })

  it("بـ`box.view` وحدها ⇒ أرقامٌ وحركاتٌ **بلا أزرارِ قبضٍ أو صرفٍ أو تسليم** (المطّلع)", () => {
    const view = boxScreenNodes(capsOf(["box.view"]), EMPTY_BOX_SNAPSHOT)
    const caps = declaredCapabilities(screenContentNodes(view).length ? view : view)
    expect(caps).toContain("box.view")
    expect(caps).not.toContain("box.receive")
    expect(caps).not.toContain("box.spend")
    expect(caps).not.toContain("box.handover")
  })

  it("وبقدرات الأمين ⇒ تظهر أفعالُه الثلاثة بمفرداته «قبضتُ · صرفتُ · سلّمتُ» (قب-٨)", () => {
    const view = boxScreenNodes(
      capsOf(["box.view", "box.receive", "box.spend", "box.handover"]),
      EMPTY_BOX_SNAPSHOT,
    )
    const caps = declaredCapabilities(view)
    expect(caps).toEqual(expect.arrayContaining(["box.receive", "box.spend", "box.handover"]))
    // **ولا مصطلحَ محاسبةٍ في الوجه**: لا مدينَ ولا دائنَ ولا يوميّة.
    const keys = walkNodes(view).flatMap((n) => n.textKeys)
    expect(keys.some((k) => k.startsWith("box."))).toBe(true)
  })

  it("وكلُّ قدرةٍ تظهر في محتوى الشاشة معلنةٌ في عقدها (نظيرُ G7 على الواجهة)", () => {
    const all = capsOf(SCREEN_SURFACE_CAPS)
    const pairs: readonly [ReturnType<typeof boxScreenNodes>, readonly CapId[]][] = [
      [boxScreenNodes(all, EMPTY_BOX_SNAPSHOT), BOX_CONTRACT.capabilities],
      [boxHandoversScreenNodes(all, EMPTY_BOX_SNAPSHOT), BOX_HANDOVERS_CONTRACT.capabilities],
      [mosqueFinanceScreenNodes(all, EMPTY_BOX_SNAPSHOT), MOSQUE_FINANCE_CONTRACT.capabilities],
    ]
    for (const [node, declared] of pairs) {
      for (const block of screenContentNodes(node)) {
        for (const cap of declaredCapabilities(block)) expect(declared).toContain(cap)
      }
    }
  })

  it("**والإقرارُ لا يظهر لمن لا يملكه**، ويظهر لحامله وحده", () => {
    const without = boxHandoversScreenNodes(capsOf(["box.view"]), EMPTY_BOX_SNAPSHOT)
    const with_ = boxHandoversScreenNodes(
      capsOf(["box.view", "box.handover.acknowledge"]),
      EMPTY_BOX_SNAPSHOT,
    )
    expect(declaredCapabilities(without)).not.toContain("box.handover.acknowledge")
    expect(declaredCapabilities(with_)).toContain("box.handover.acknowledge")
  })

  it("**ومالية المسجد**: العرضُ بقدرته والتسجيلُ بقدرته — والمطّلعُ يرى بلا زرّ", () => {
    const viewer = mosqueFinanceScreenNodes(capsOf(["mosqueFinance.view"]), EMPTY_BOX_SNAPSHOT)
    const owner = mosqueFinanceScreenNodes(
      capsOf(["mosqueFinance.view", "mosqueFinance.manage"]),
      EMPTY_BOX_SNAPSHOT,
    )
    expect(declaredCapabilities(viewer)).not.toContain("mosqueFinance.manage")
    expect(declaredCapabilities(owner)).toContain("mosqueFinance.manage")
    expect(walkNodes(mosqueFinanceScreenNodes(capsOf([]), EMPTY_BOX_SNAPSHOT)).some((n) => n.component === "EmptyState")).toBe(true)
  })
})

describe("قب-٢٥ — الطابعُ: الفراغُ **مِحرابٌ ينتظر** لا مثلثَ خطأ، و**صفر صورة**", () => {
  it("كلُّ حالةٍ فارغةٍ في شاشات الوحدة تحمل طابعَ المحراب ولا تحمل نبرةَ خطأ", () => {
    const views = [
      boxScreenNodes(capsOf([]), EMPTY_BOX_SNAPSHOT),
      boxHandoversScreenNodes(capsOf(["box.view"]), EMPTY_BOX_SNAPSHOT),
      mosqueFinanceScreenNodes(capsOf(["mosqueFinance.view"]), EMPTY_BOX_SNAPSHOT),
    ]
    let seen = 0
    for (const view of views) {
      for (const n of walkNodes(view)) {
        if (n.component !== "EmptyState") continue
        seen += 1
        expect(n.meta.motif).toBe("mihrab")
        expect(n.meta.assets).toBe("none")
        expect(n.meta.tone).not.toBe("danger")
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it("**وصفر صورة** في كل شجرة العرض: لا رفعَ ولا صورةَ شخصية في شاشات المال", () => {
    const view = boxScreenNodes(capsOf(SCREEN_SURFACE_CAPS), EMPTY_BOX_SNAPSHOT)
    const components = walkNodes(view).map((n) => n.component)
    expect(components).not.toContain("Uploader")
    expect(components).not.toContain("Avatar")
  })
})

describe("الشاشةُ تقرأ من **نموذج الصفحة الواحد** — لا حسابَ في طبقة العرض (ق-١١١)", () => {
  it("لقطةُ الشاشة مُسقَطةٌ من نموذج الصندوق: الأرقامُ نفسُها في كل موضع", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-amir"), {
      unitId: "khalid",
      operationId: "rcv-screen",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(12_300) }],
    })
    const snapshot = projectBoxSnapshot(unitBoxView(stores, KHALID_PATH), {
      unitLabelAr: "مسجد خالد",
      currencyCode: "USD",
      fractionDigits: 2,
    })
    expect(snapshot.balanceRows).toHaveLength(1)
    expect(snapshot.balanceRows[0]?.currency).toBe("USD")
    expect(snapshot.balanceRows[0]?.netAr).toContain("١٢٣")
    expect(snapshot.movementRows).toHaveLength(1)
    expect(snapshot.flowRows[0]).toMatchObject({ currency: "USD" })
  })

  it("ونصوصُ الشاشات كلُّها **مفاتيحُ مسجَّلةٌ** في الطبقة المركزية (لا حرفَ في مكوّن)", () => {
    const view = boxScreenNodes(capsOf(SCREEN_SURFACE_CAPS), EMPTY_BOX_SNAPSHOT)
    for (const n of walkNodes(view)) {
      for (const key of n.textKeys) expect(TEXT_KEYS).toContain(key)
    }
  })
})

describe("قشرةُ القدرات المحسوبة — الخادمُ يحسب والواجهةُ تعرض (§٤.٥)", () => {
  it("الأميرُ على مسجده يملك قدرات الأمانة ومالية مسجده", () => {
    const caps = computeBoxCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION)
    expect([...caps].sort()).toEqual(
      [
        "box.handover",
        "box.receive",
        "box.spend",
        "box.view",
        "mosqueFinance.manage",
        "mosqueFinance.view",
      ].sort(),
    )
  })

  it("**ومشرفُ القسم على مسجدٍ تحته**: اطّلاعٌ فقط — لا قبضَ ولا صرفَ (نطاق «ذ»)", () => {
    const caps = computeBoxCaps(canonicalActor("u-section-head"), KHALID_PATH, DECISION)
    expect(caps.has("box.view")).toBe(true)
    expect(caps.has("box.receive")).toBe(false)
    expect(caps.has("box.spend")).toBe(false)
    expect(caps.has("mosqueFinance.manage")).toBe(false)
  })

  it("**والمديرُ يرى ولا يشغّل** (ق-٣/ق-٤)، **والطالبُ لا يرى شيئاً**", () => {
    const admin = computeBoxCaps(canonicalActor("u-admin"), KHALID_PATH, DECISION)
    expect(admin.has("box.view")).toBe(true)
    expect(admin.has("box.receive")).toBe(false)
    expect(admin.has("box.handover")).toBe(false)

    const student = computeBoxCaps(canonicalActor("u-student"), KHALID_PATH, DECISION)
    expect(student.size).toBe(0)
  })
})
