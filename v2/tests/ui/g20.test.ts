/**
 * بوابة G20 — عقد الشاشة (IA §الحوكمة + SPEC_role_lenses §١.٣/§٣ + SPEC_design_system §٦-١).
 *
 * خمسةُ فحوصٍ تُشتقّ من **المصفوفة الذهبية** والعدستين، لا من رأي كاتبها:
 *  ١. لا شاشة بلا عقد صالح.
 *  ٢. موطنٌ واحدٌ لكل كيان — كيانٌ في شاشتين يُفشل البناء (ز-١…ز-١٣).
 *  ٣. كل عنصرٍ تفاعليٍّ يعلن قدرتَه من الكتالوج (نظيرُ G7 على الواجهة).
 *  ٤. **لا دور يرى ما خارج عدسته** — يُشتقّ من §٣ (فحص الغياب) والمصفوفة.
 *  ٥. **لكل قدرةٍ باب** يصل حاملَها (ق-٢٨) — وإلا «قدرةٌ ميتة».
 *
 * الجسرُ ثنائيُّ الاتجاه: العدسة ⟷ المصفوفة ⟷ المواطن. أيُّ تباعدٍ بين الثلاثة أحمرُ هنا.
 */
import { describe, it, expect } from "vitest"
import { ENTITY_IDS } from "../../src/ui/screens/entities.js"
import { validateContract, type ScreenContract } from "../../src/ui/screens/contract.js"
import { DOORS, doorCapabilities, reachableDoorsFor } from "../../src/ui/screens/doors.js"
import { ABSENCE_BY_ROLE } from "../../src/ui/screens/absence.js"
import { registeredScreens } from "../../src/ui/screens/registry.js"
import "../../src/screens.js"
import {
  walkNodes,
  declaredCapabilities,
  screenContentNodes,
} from "../../src/ui/components/kernel.js"
import { CAP_IDS, type CapId } from "../../src/authorization/generated/capabilities.generated.js"
import { ROLES, ROLE_CAPABILITIES, ROLE_IDS, type RoleId } from "../../src/authorization/generated/roles.generated.js"

const ACTIVE_ROLES: readonly RoleId[] = ROLE_IDS.filter((r) => ROLES[r].state === "active")

describe("G20/١ — لا شاشة بلا عقد (ق-١١٣: قائمةُ LEGACY فارغةٌ وتبقى فارغة)", () => {
  it("كلُّ شاشةٍ مسجَّلة تحمل عقداً صالحاً (مسار · سطح · عدسات · موطن · مصدرُ بياناتٍ واحد · فراغان)", () => {
    const screens = registeredScreens()
    expect(screens.length).toBeGreaterThan(0)
    for (const s of screens) {
      const violations = validateContract(s.contract)
      expect(violations, `${s.contract.route}: ${violations.join(" · ")}`).toEqual([])
    }
  })

  it("العقدُ الناقص يُرفض صراحةً — البوابةُ تمسك الخرق لا تدّعيه", () => {
    const broken: ScreenContract = {
      route: "bad-route",
      surface: "bayan",
      lenses: [],
      canonicalHome: [],
      capabilities: [],
      dataSource: "",
      emptyStates: { owner: "state.emptyOwnerTitle", viewer: "state.emptyViewerVacant" },
    }
    const violations = validateContract(broken)
    expect(violations.length).toBeGreaterThanOrEqual(3)
    expect(violations.join(" ")).toMatch(/المسار/)
    expect(violations.join(" ")).toMatch(/عدسة/)
    expect(violations.join(" ")).toMatch(/مصدر/)
  })

  it("ولا مسارَ مكرَّرٌ بين شاشتين (المسارُ الوحيد في العقد)", () => {
    const routes = registeredScreens().map((s) => s.contract.route)
    expect(new Set(routes).size).toBe(routes.length)
  })
})

describe("G20/٢ — موطنٌ واحدٌ لكل كيان (IA §١، سجلّ ز-١…ز-١٣)", () => {
  it("لا كيانٌ يُعلَن موطنُه القانونيّ في شاشتين", () => {
    const home = new Map<string, string>()
    const clashes: string[] = []
    for (const s of registeredScreens()) {
      for (const entity of s.contract.canonicalHome) {
        const prior = home.get(entity)
        if (prior !== undefined) clashes.push(`«${entity}» موطنُه ${prior} و${s.contract.route}`)
        else home.set(entity, s.contract.route)
      }
    }
    expect(clashes).toEqual([])
  })

  it("وكلُّ كيانٍ يُعلَن موطناً هو من تصنيف IA §١ (٣٧ كياناً) لا اسمٌ مرتجل", () => {
    for (const s of registeredScreens()) {
      for (const entity of s.contract.canonicalHome) {
        expect(ENTITY_IDS, `${s.contract.route} يعلن كياناً مجهولاً: ${entity}`).toContain(entity)
      }
    }
  })

  it("تصنيفُ الكيانات ٣٧ كياناً بلا تكرار (فحصُ الشمول في IA §١.٥)", () => {
    expect(ENTITY_IDS.length).toBe(37)
    expect(new Set(ENTITY_IDS).size).toBe(37)
  })
})

describe("G20/٣ — كل عنصرٍ يعلن قدرته (المادة ٤/٦ — نظيرُ G7 على الواجهة)", () => {
  it("لا عنصرَ تفاعليٍّ في أي شاشةٍ مبنيّةٍ بلا إعلانِ قدرة", () => {
    for (const s of registeredScreens()) {
      for (const role of ACTIVE_ROLES) {
        const view = s.buildForRole(role)
        if (view === null) continue
        for (const n of walkNodes(view)) {
          if (n.interactive) {
            expect(n.capability, `${s.contract.route} · ${role} · ${n.component}`).not.toBeNull()
          }
        }
      }
    }
  })

  it("وكلُّ قدرةٍ تظهر في **محتوى** الشاشة معلنةٌ في عقدها (لا زرٌّ خارج العقد)", () => {
    // القشرةُ إطارٌ لا محتوى: لها حارسُها (أبوابُ السطوح + إعلانُ الوجهة) — ق-١١٤.
    for (const s of registeredScreens()) {
      for (const role of ACTIVE_ROLES) {
        const view = s.buildForRole(role)
        if (view === null) continue
        for (const block of screenContentNodes(view)) {
          for (const cap of declaredCapabilities(block)) {
            expect(s.contract.capabilities, `${s.contract.route} · ${role} · ${cap}`).toContain(cap)
          }
        }
      }
    }
  })

  it("وكلُّ قدرةٍ في العقد موجودةٌ في الكتالوج (لا قدرةٌ مخترعة)", () => {
    for (const s of registeredScreens()) {
      for (const cap of s.contract.capabilities) {
        expect(CAP_IDS, `${s.contract.route}: ${cap}`).toContain(cap)
      }
    }
  })
})

describe("G20/٤ — لا دور يرى ما خارج عدسته (SPEC_role_lenses §٣ فحصُ الغياب)", () => {
  it("لكل دورٍ حيّ: كلُّ قدرةٍ تظهر له على أي شاشةٍ **يملكها فعلاً** في المصفوفة", () => {
    const leaks: string[] = []
    for (const s of registeredScreens()) {
      for (const role of ACTIVE_ROLES) {
        const view = s.buildForRole(role)
        if (view === null) continue
        for (const cap of declaredCapabilities(view)) {
          if (!ROLE_CAPABILITIES[role].has(cap)) {
            leaks.push(`${role} يرى «${cap}» على ${s.contract.route} وليست له`)
          }
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it("ولا يظهر لدورٍ ما نصَّت §٣ على غيابه عنه (الخلايا `·` الحارسة)", () => {
    const leaks: string[] = []
    for (const [role, forbidden] of Object.entries(ABSENCE_BY_ROLE) as [RoleId, readonly CapId[]][]) {
      // أولاً: الغيابُ مُثبَتٌ في المصفوفة نفسها (وإلا فالمواصفةُ والمصفوفة تباعدتا).
      for (const cap of forbidden) {
        if (ROLE_CAPABILITIES[role].has(cap)) leaks.push(`المصفوفة تمنح «${cap}» لـ${role} خلافاً لـ§٣`)
      }
      // ثانياً: لا شاشةَ تُظهره له.
      for (const s of registeredScreens()) {
        const view = s.buildForRole(role)
        if (view === null) continue
        for (const cap of declaredCapabilities(view)) {
          if (forbidden.includes(cap)) leaks.push(`${role} يرى المحظور «${cap}» على ${s.contract.route}`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it("وجدولُ الغياب يغطّي كلَّ دورٍ حيّ (لا دورَ بلا محظورات مكتوبة)", () => {
    for (const role of ACTIVE_ROLES) {
      expect(Object.keys(ABSENCE_BY_ROLE), role).toContain(role)
    }
  })
})

describe("G20/٥ — لكل قدرةٍ باب (ق-٢٨) — لا قدرةٌ ميتة", () => {
  it("القدراتُ الـ٨٧ كلُّها لها بابٌ في معجم الأبواب", () => {
    const covered = doorCapabilities()
    const dead = CAP_IDS.filter((c) => !covered.has(c))
    expect(dead, `قدراتٌ ميتة بلا باب: ${dead.join("، ")}`).toEqual([])
  })

  it("ولا بابٌ يعلن قدرةً خارج الكتالوج", () => {
    for (const door of DOORS) {
      for (const cap of door.capabilities) expect(CAP_IDS, `${door.surface}: ${cap}`).toContain(cap)
    }
  })

  it("**ولكل دورٍ حيّ: كلُّ قدرةٍ يحملها لها بابٌ يصله** (الجسر العكسيّ)", () => {
    const orphans: string[] = []
    for (const role of ACTIVE_ROLES) {
      const caps = ROLE_CAPABILITIES[role]
      const reachable = reachableDoorsFor(caps)
      const reachableCaps = new Set(reachable.flatMap((d) => [...d.capabilities]))
      for (const cap of caps) {
        if (!reachableCaps.has(cap)) orphans.push(`${role}: «${cap}» بلا بابٍ يصله`)
      }
    }
    expect(orphans).toEqual([])
  })

  it("والأدوارُ الموقوفة لا تُحاكَم حتى تُفعَّل (§٢.١٢/٢ — `state: suspended`)", () => {
    const suspended = ROLE_IDS.filter((r) => ROLES[r].state !== "active")
    expect(suspended.length).toBe(6)
    for (const role of suspended) {
      expect(ACTIVE_ROLES).not.toContain(role)
    }
  })
})
