/**
 * الطبقة الثانية من E2E — مصفوفةُ شاشة «رئيسية أمير المسجد» (TESTING_POLICY §٤).
 *
 * لكل دورٍ حيّ × كل عنصرٍ على الشاشة: **حضورُه = قدرتُه**، و**غيابُه مقرونٌ برفضٍ من نقطة
 * الفرض** — لا بإخفاء الزر وحده (الطبقتان معاً؛ إخفاءُ الزر تجربةُ استخدامٍ لا حماية).
 * وحيثُ توجد دالةُ خادمٍ حقيقية (التوفير) يُستدعى الخادمُ مباشرةً ويُرفض فعلاً.
 *
 * **ملاحظة صدقٍ منهجيّة** (تُعلَن كما أُعلنت في T4-A): لا إطارَ واجهةٍ في v2 بعد (قرارُه
 * ADR-002 مرفوعٌ للاعتماد)، فهذه المصفوفة على **مستوى شجرة العرض + رفض المحرّك/الخادم** لا
 * على متصفحٍ حيّ. تفعيلُ Playwright يُضاف مع اعتماد الإطار، وحتى ذلك الحين هذه هي المفروضة.
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "../features/org/_seed.js"
import { buildActor } from "../../src/features/org/services/session.js"
import { makeOrgEndpoints } from "../../src/features/org/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { amirHomeScreen, EMPTY_SNAPSHOT } from "../../src/features/home/screens/screens.js"
import {
  computeHomeCaps,
  computeNavPriority,
  roleBundleOwnership,
} from "../../src/features/home/screens/caps.js"
import {
  declaredCapabilities,
  screenContentNodes,
  walkNodes,
} from "../../src/ui/components/kernel.js"
import { can, type DecisionContext } from "../../src/authorization/can.js"
import { unitScope, selfScope } from "../../src/authorization/scope.js"
import { CAPS, type CapId } from "../../src/authorization/generated/capabilities.generated.js"

const CTX: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const MOSQUE = "/men/homs/sq2/khalid/"

/** المستخدمُ القانونيّ لكل دورٍ حيّ ونطاقُ الصفحة التي يفتحها (العالم القانوني §٥). */
const ROLE_FIXTURES = [
  { label: "admin", personId: "u-admin", scope: "/" },
  { label: "section_head", personId: "u-section-head", scope: "/men/" },
  { label: "rabita", personId: "u-rabita", scope: "/men/homs/" },
  { label: "square", personId: "u-square", scope: "/men/homs/sq2/" },
  { label: "amir", personId: "u-amir", scope: MOSQUE },
  { label: "teacher", personId: "u-teacher", scope: "/men/homs/sq2/khalid/c1/" },
  { label: "committee_head", personId: "u-committee-head", scope: MOSQUE },
  { label: "media", personId: "u-media", scope: "/" },
  { label: "finance_officer", personId: "u-finance", scope: "/" },
  { label: "student", personId: "u-student", scope: "/men/homs/sq2/khalid/c1/" },
] as const

/** عناصرُ الشاشة وقدراتُها الحارسة (من عقد الشاشة). */
const AFFORDANCES: readonly { readonly element: string; readonly cap: CapId }[] = [
  { element: "بطاقة هدف الأسبوع + إدخال سجل اليوم", cap: "dailyLog.edit" },
  { element: "تقديم سجل المسجد", cap: "report.submit" },
  { element: "سحب الإقرار", cap: "report.retract" },
  { element: "بانتظار إقراري", cap: "report.approve" },
  { element: "حلقات مسجدي", cap: "circle.manage" },
  { element: "لجان مسجدي", cap: "committees.manage" },
  { element: "رصيد صندوق المسجد", cap: "box.view" },
  { element: "تمكين حساب عاملٍ في مسجدي", cap: "users.provision" },
  { element: "تسليم عهدة", cap: "custody.grant" },
]

const SNAPSHOT = {
  ...EMPTY_SNAPSHOT,
  mosqueLabelAr: "مسجد خالد",
  scopePath: MOSQUE,
  boxBalance: { amount: 125_000, currencyCode: "SYP", fractionDigits: 0 },
}

describe("مصفوفةُ رئيسية الأمير — حضورٌ بعدسة الدور وغيابٌ مقرونٌ بالرفض", () => {
  it("لكل دورٍ حيّ × كل عنصر: الحضور = القدرة، والغياب مقرونٌ برفض نقطة الفرض", () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      const w = seedWorld()
      const actor = buildActor(w.store, f.personId)
      const caps = computeHomeCaps(actor, f.scope, CTX, roleBundleOwnership(actor, NOW))
      const view = amirHomeScreen(caps, SNAPSHOT)
      const shown = new Set(
        screenContentNodes(view).flatMap((b) => [...declaredCapabilities(b)]),
      )

      for (const a of AFFORDANCES) {
        const allowed = caps.has(a.cap)
        expect(shown.has(a.cap), `${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          // الطبقة الثانية: الغيابُ يقابله **رفضُ نقطة الفرض** على نطاق الصفحة نفسه.
          const scope =
            CAPS[a.cap].type === "personal"
              ? selfScope(actor.personId, "surface", a.cap)
              : unitScope(f.scope)
          expect(can(actor, a.cap, scope, CTX).allowed, `${a.element} · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة رئيسية الأمير] إيجاب=${positives} · سلب=${negatives}`)
    // القاعدة الذهبية: السلبيات أكثر من الإيجابيات (النظام يُعرَّف بما يمنعه).
    expect(negatives).toBeGreaterThan(positives)
  })

  it("والزرُّ الغائبُ يُقرَن برفضِ **استدعاءِ الخادم المباشر** (لا يكفي إخفاء الزر)", async () => {
    clearRegistryForTests()
    const w = seedWorld()
    const ep = makeOrgEndpoints(w.store)
    const teacher = buildActor(w.store, "u-teacher")

    // المعلّم لا يملك `users.provision` ⇒ لا يظهر له الزرّ…
    const caps = computeHomeCaps(teacher, "/men/homs/sq2/khalid/c1/", CTX, roleBundleOwnership(teacher, NOW))
    expect(declaredCapabilities(amirHomeScreen(caps, SNAPSHOT))).not.toContain("users.provision")
    // …وتجاوزُ الواجهة إلى الخادم مباشرةً **يُرفض** كذلك.
    const r = await ep.provision.invoke(
      { targetUnitId: "khalid", targetRoleId: "teacher", username: "sneak" },
      teacher,
      CTX,
    )
    expect(r.ok).toBe(false)
  })

  it("أميرُ المسجد يرى رئيسيتَه كاملةً: أسئلةُ صباحه الثلاثة وأفعالُها", () => {
    const w = seedWorld()
    const amir = buildActor(w.store, "u-amir")
    const caps = computeHomeCaps(amir, MOSQUE, CTX, roleBundleOwnership(amir, NOW))
    const view = amirHomeScreen(caps, SNAPSHOT)
    const shown = declaredCapabilities(view)

    expect(shown).toContain("dailyLog.edit") // ١) أين أنا من هدف الأسبوع
    expect(shown).toContain("report.submit") // ٢) ماذا بقي عليّ اليوم
    expect(shown).toContain("circle.manage") // ٣) حال حلقاتي ولجاني
    expect(shown).toContain("committees.manage")
    expect(shown).toContain("box.view")
    // القشرةُ حاضرةٌ على الشاشة (ق-١١٤) والوجهةُ الأولى بعد الرئيسية «مسجدي» (ق-١١٥).
    const components = walkNodes(view).map((n) => n.component)
    expect(components[0]).toBe("AppShell")
    expect(components).toContain("NavBar")
    expect(computeNavPriority(amir, NOW)).toBe("myMosque")
  })

  it("**والأميرُ لا يرى «البيان» ولا بحثَ القشرة** — لا يملك `network.view` (§٣ فحصُ الغياب)", () => {
    const w = seedWorld()
    const amir = buildActor(w.store, "u-amir")
    const caps = computeHomeCaps(amir, MOSQUE, CTX, roleBundleOwnership(amir, NOW))
    const view = amirHomeScreen(caps, SNAPSHOT)
    expect(caps.has("network.view")).toBe(false)
    expect(walkNodes(view).some((n) => n.component === "SearchBox")).toBe(false)
    expect(String(view.meta.navDestinations ?? "")).not.toContain("bayan")
    const navBar = walkNodes(view).find((n) => n.component === "NavBar")
    expect(String(navBar?.meta.destinations)).not.toContain("bayan")
  })

  it("والمطّلعُ الذي لا يملك أفعال المسجد يرى **تشخيصاً لا زرّاً** (ق-١٠٩)", () => {
    const w = seedWorld()
    const student = buildActor(w.store, "u-student")
    const caps = computeHomeCaps(student, "/men/homs/sq2/khalid/c1/", CTX, roleBundleOwnership(student, NOW))
    const view = amirHomeScreen(caps, SNAPSHOT)
    const components = walkNodes(view).map((n) => n.component)
    expect(components).toContain("DiagnosisBlock")
    expect(components).toContain("EmptyState")
    // ولا فعلَ تشغيلياً واحداً من أفعال المسجد في **محتوى** الشاشة (القشرةُ إطارٌ لا محتوى).
    const contentCaps = screenContentNodes(view).flatMap((b) => [...declaredCapabilities(b)])
    expect(contentCaps).toEqual([])
  })
})
