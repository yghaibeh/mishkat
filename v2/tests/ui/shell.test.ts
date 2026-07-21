/**
 * القشرة والتنقّل — SPEC_information_architecture §٢ + SPEC_design_system §٣-١٠ (ق-١١٤/ق-١١٥/ق-١١٦).
 *
 * الثابتُ الأكبر: **التنقّل إسقاطٌ للقدرات المحسوبة** — تُبنى قشرةٌ واحدةٌ تتكيّف، لا عشرون
 * واجهةً يدوية (سرُّ التوسّع ٢٠×). فتوقيعُ `navProjection` نفسُه لا يستقبل دوراً أصلاً: يستقبل
 * قدراتٍ محسوبةً على الخادم وترتيباً مُمرَّراً — فيستحيل `if role` في الواجهة (المادة ٤/٦، G6).
 */
import { describe, it, expect } from "vitest"
import {
  SURFACES,
  SURFACE_IDS,
  SURFACE_GATE_CAPS,
  ROLE_NAV_ORDER,
  navPriorityForRoles,
  type SurfaceId,
} from "../../src/ui/shell/surfaces.js"
import { navProjection, appShell, MOBILE_PRIMARY_SLOTS } from "../../src/ui/shell/shell.js"
import { walkNodes, declaredCapabilities } from "../../src/ui/components/kernel.js"
import { tabs } from "../../src/ui/components/organisms.js"
import { can, type DecisionContext } from "../../src/authorization/can.js"
import { unitScope, selfScope } from "../../src/authorization/scope.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { ROLE_IDS, ROLES } from "../../src/authorization/generated/roles.generated.js"
import { CAPS, type CapId } from "../../src/authorization/generated/capabilities.generated.js"
import { roleBundleOwnership } from "../../src/features/home/screens/caps.js"

const CTX: DecisionContext = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "read",
  isFeatureEnabled: () => true,
}

const world = buildCanonicalWorld()
const person = (id: string) => world.people.find((p) => p.personId === id)!

/**
 * قشرةُ القدرات المحسوبة على الخادم لسطوح القشرة — تُرسل للواجهة كما هي (§٤.٥).
 * القدرةُ الشخصية تمرّ بمِجسّ ملكيةٍ (لا بنطاقِ ملكيةٍ مُصطنع) وإلا ظهر للطالب بابُ «حلقاتي».
 */
function surfaceCaps(personId: string, scopePath: string): ReadonlySet<CapId> {
  const actor = person(personId)
  const owns = roleBundleOwnership(actor, CTX.now)
  const granted = new Set<CapId>()
  for (const cap of SURFACE_GATE_CAPS) {
    if (CAPS[cap].type === "personal") {
      if (owns(cap) && can(actor, cap, selfScope(personId, "surface", cap), CTX).allowed) {
        granted.add(cap)
      }
      continue
    }
    if (can(actor, cap, unitScope(scopePath), CTX).allowed) granted.add(cap)
  }
  return granted
}

const AMIR_SCOPE = "/men/homs/sq2/khalid/"

describe("معجمُ السطوح — «البيان» ومعجم التسمية المعتمد (قب-٢٢، IA §٢.٢)", () => {
  it("سطحُ الاستكشاف اسمُه «البيان» لا «الشبكة» (قرار المالك قب-٢٢)", () => {
    const bayan = SURFACES.find((s) => s.id === "bayan")
    expect(bayan).toBeDefined()
    expect(SURFACE_IDS).not.toContain("network")
  })

  it("كلُّ سطحٍ يعلن مساره وبابَه (قدرةٌ أو أكثر بـ`anyOf` — ق-٢٨)", () => {
    for (const s of SURFACES) {
      expect(s.route.startsWith("/"), s.id).toBe(true)
      expect(Array.isArray(s.openedBy), s.id).toBe(true)
    }
  })

  it("«المنهاج» قارئٌ عامٌّ بلا حارس، و«الرئيسية» و«حسابي» لكل مسجَّل", () => {
    expect(SURFACES.find((s) => s.id === "manhaj")?.openedBy).toEqual([])
    expect(SURFACES.find((s) => s.id === "home")?.openedBy).toEqual([])
  })

  it("خريطةُ ترتيب الشريط **واحدةٌ محروسة** تغطّي كلَّ دورٍ في السجل (ق-١١٥)", () => {
    expect(Object.keys(ROLE_NAV_ORDER).sort()).toEqual([...ROLE_IDS].sort())
    for (const role of ROLE_IDS) {
      expect(SURFACE_IDS, role).toContain(ROLE_NAV_ORDER[role])
    }
  })

  it("الدورُ الأعلى رتبةً يغلب عند تعدّد الأدوار (IA §٢.٣)", () => {
    expect(navPriorityForRoles(["teacher", "admin"])).toBe(ROLE_NAV_ORDER.admin)
    expect(navPriorityForRoles(["teacher"])).toBe(ROLE_NAV_ORDER.teacher)
    expect(ROLES.admin.rank).toBeLessThan(ROLES.teacher.rank)
  })

  it("وبلا أدوارٍ فعّالة: لا أولويةَ مخترعة — الرئيسيةُ وحدها", () => {
    expect(navPriorityForRoles([])).toBeNull()
  })
})

describe("التنقّل إسقاطٌ للقدرات — لا `if role` في الواجهة (المادة ٤/٦)", () => {
  it("المدير: «الإدارة» أولُ ما بعد «الرئيسية» (ق-١١٥)", () => {
    const nav = navProjection({ caps: surfaceCaps("u-admin", "/"), priority: ROLE_NAV_ORDER.admin })
    expect(nav.destinations[0]?.id).toBe("home")
    expect(nav.destinations[1]?.id).toBe("admin")
  })

  it("المعلّم: «حلقاتي» أولُ ما بعد الرئيسية، ولا يرى الإدارةَ ولا البيان", () => {
    const nav = navProjection({
      caps: surfaceCaps("u-teacher", "/men/homs/sq2/khalid/c1/"),
      priority: ROLE_NAV_ORDER.teacher,
    })
    expect(nav.destinations[1]?.id).toBe("myCircles")
    expect(nav.destinations.map((d) => d.id)).not.toContain("admin")
    expect(nav.destinations.map((d) => d.id)).not.toContain("bayan")
  })

  it("المسؤول الماليّ: «المالية المركزية» أولاً", () => {
    const nav = navProjection({
      caps: surfaceCaps("u-finance", "/"),
      priority: ROLE_NAV_ORDER.finance_officer,
    })
    expect(nav.destinations[1]?.id).toBe("centralFinance")
  })

  it("**أميرُ المسجد لا يرى «البيان» إطلاقاً** — لا يملك `network.view` (§٢.٥ ثابتٌ حاسم)", () => {
    const caps = surfaceCaps("u-amir", AMIR_SCOPE)
    expect(caps.has("network.view")).toBe(false)
    const nav = navProjection({ caps, priority: ROLE_NAV_ORDER.amir })
    expect(nav.destinations.map((d) => d.id)).not.toContain("bayan")
    expect(nav.destinations[1]?.id).toBe("myMosque")
  })

  it("الطالب: أبوابه الشخصية فقط — لا إدارةَ ولا ماليةَ ولا بيان (§٣ فحصُ الغياب)", () => {
    const nav = navProjection({
      caps: surfaceCaps("u-student", "/men/homs/sq2/khalid/c1/"),
      priority: ROLE_NAV_ORDER.student,
    })
    const ids = nav.destinations.map((d) => d.id)
    for (const forbidden of [
      "admin",
      "bayan",
      "centralFinance",
      "custody",
      "media",
      "box",
      "myCircles",
      "myCommittee",
      "myMosque",
    ]) {
      expect(ids, `الطالب يرى «${forbidden}»`).not.toContain(forbidden as SurfaceId)
    }
    expect(ids).toContain("home")
    expect(ids).toContain("personal")
  })

  it("كلُّ الأدوار تهبط على «الرئيسية» أولاً (ق-١١٥، ق-ب٤)", () => {
    for (const [pid, scope] of [
      ["u-admin", "/"],
      ["u-section-head", "/men/"],
      ["u-rabita", "/men/homs/"],
      ["u-square", "/men/homs/sq2/"],
      ["u-amir", AMIR_SCOPE],
      ["u-teacher", "/men/homs/sq2/khalid/c1/"],
      ["u-media", "/"],
      ["u-finance", "/"],
      ["u-student", "/men/homs/sq2/khalid/c1/"],
    ] as const) {
      const nav = navProjection({ caps: surfaceCaps(pid, scope), priority: null })
      expect(nav.destinations[0]?.id, pid).toBe("home")
      expect(nav.landingRoute, pid).toBe("/home")
    }
  })

  it("الترتيبُ وحدَه يتغيّر بالأولوية — **مجموعةُ** الوجهات إسقاطُ قدراتٍ لا دور", () => {
    const caps = surfaceCaps("u-admin", "/")
    const a = navProjection({ caps, priority: "admin" })
    const b = navProjection({ caps, priority: "media" })
    expect([...a.destinations.map((d) => d.id)].sort()).toEqual(
      [...b.destinations.map((d) => d.id)].sort(),
    )
    expect(a.destinations[1]?.id).not.toBe(b.destinations[1]?.id)
  })

  it("وجهةٌ لا يملك حاملُها قدرتَها لا تظهر — وكلُّ ظاهرةٍ لها قدرةٌ معلنة", () => {
    const caps = surfaceCaps("u-media", "/")
    const nav = navProjection({ caps, priority: ROLE_NAV_ORDER.media })
    for (const d of nav.destinations) {
      const surface = SURFACES.find((s) => s.id === d.id)!
      if (surface.openedBy.length === 0) continue
      expect(surface.openedBy.some((c) => caps.has(c)), d.id).toBe(true)
    }
  })
})

describe("القشرةُ الواحدة (ق-١١٤) والجوال أولاً (§٣-١٠/§٤-١)", () => {
  const caps = surfaceCaps("u-amir", AMIR_SCOPE)
  const nav = navProjection({ caps, priority: ROLE_NAV_ORDER.amir })

  it("القشرةُ تحمل الشريطَ في كل صفحة — **وحتى مع تبويباتِ كيانٍ مزار** (ق-١١٤)", () => {
    const shell = appShell({
      nav,
      scopePath: AMIR_SCOPE,
      scopeLabelAr: "مسجد خالد",
      content: [
        tabs({
          items: [
            { labelKey: "nav.education", capability: "circle.view", routeSegment: "education" },
            { labelKey: "nav.box", capability: "box.view", routeSegment: "box" },
          ],
        }),
      ],
    })
    const kinds = walkNodes(shell).map((n) => n.component)
    expect(kinds).toContain("NavBar")
    expect(kinds).toContain("Tabs")
    expect(shell.meta.shellReplaced).toBe("false")
  })

  it("الزائرُ غيرُ المسجَّل: ترويسةٌ عامةٌ خفيفة بلا شريط دور", () => {
    const visitor = appShell({
      nav: navProjection({ caps: new Set<CapId>(), priority: null }),
      scopePath: "/",
      scopeLabelAr: "مِشكاة",
      content: [],
      visitor: true,
    })
    expect(visitor.meta.variant).toBe("visitor")
    expect(walkNodes(visitor).some((n) => n.component === "SearchBox")).toBe(false)
  })

  it("الجوال: شريطٌ سفليٌّ بأهمّ الوجهات والباقي في «المزيد» (§٣-١٠)", () => {
    const admin = navProjection({ caps: surfaceCaps("u-admin", "/"), priority: "admin" })
    expect(admin.mobilePrimary.length).toBeLessThanOrEqual(MOBILE_PRIMARY_SLOTS)
    expect(admin.mobilePrimary.length + admin.mobileOverflow.length).toBe(admin.destinations.length)
    expect(admin.mobilePrimary[0]?.id).toBe("home")
  })

  it("كلُّ عنصرٍ في القشرة يعلن قدرتَه (G20) — والجرسُ حقٌّ مشتقّ", () => {
    const shell = appShell({
      nav,
      scopePath: AMIR_SCOPE,
      scopeLabelAr: "مسجد خالد",
      content: [],
    })
    for (const n of walkNodes(shell)) {
      if (n.interactive) expect(n.capability, n.component).not.toBeNull()
    }
    const bell = walkNodes(shell).find((n) => n.component === "NotificationBell")
    expect(bell?.capability).toBe("derived")
    expect(declaredCapabilities(shell).length).toBeGreaterThan(0)
  })

  it("البحثُ في القشرة محكومٌ بنطاق الصفحة لا شبكياً (ثغرةُ بحث v1)", () => {
    const withSearch = appShell({
      nav,
      scopePath: AMIR_SCOPE,
      scopeLabelAr: "مسجد خالد",
      content: [],
      showSearch: true,
    })
    expect(walkNodes(withSearch).find((n) => n.component === "SearchBox")?.meta.scopePath).toBe(
      AMIR_SCOPE,
    )

    // وأميرُ المسجد لا يملك `network.view` ⇒ **لا بحثَ في قشرته أصلاً** (غيابٌ صريح).
    const amirShell = appShell({
      nav,
      scopePath: AMIR_SCOPE,
      scopeLabelAr: "مسجد خالد",
      content: [],
      showSearch: caps.has("network.view"),
    })
    expect(walkNodes(amirShell).some((n) => n.component === "SearchBox")).toBe(false)
  })
})
