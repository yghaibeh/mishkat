/**
 * الطبقة الثانية من E2E — مصفوفة الشاشات لوحدة الشجرة (TESTING_POLICY §٤ الطبقة الثانية).
 *
 * لكل دورٍ حيّ × كل شاشة: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ كل عنصرٍ
 * من عدسة الدور و«غيابُ» ما ليس من حقه صراحةً** — والزرُّ الغائب يُقرَن بـ**رفض استدعاء
 * الخادم المباشر** (الطبقتان معاً؛ إخفاء الزر وحده ليس نجاحاً). حالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظة صدق منهجيّة** (تُعلَن كما أعلن T3-B نظائرها): لا يوجد إطار واجهةٍ في v2 بعد
 * (قرارُه ADR مؤجَّل)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى نموذج العرض** —
 * حضورُ/غيابُ العنصر + رفضُ الخادم — لا على متصفحٍ حيّ. تشغيلُ Playwright يُضاف مع أول
 * إطار واجهة، وحتى ذلك الحين هذه هي الطبقةُ الثانية القابلة للفرض، وG9 تحرسها.
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "../features/org/_seed.js"
import { OrgStore } from "../../src/features/org/data/store.js"
import { makeOrgEndpoints } from "../../src/features/org/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import {
  computeScreenCaps,
  computeProvisionableRoles,
} from "../../src/features/org/screens/caps.js"
import {
  orgTreeScreen,
  createAccountScreen,
  assignmentsScreen,
} from "../../src/features/org/screens/screens.js"
import { buildActor } from "../../src/features/org/services/session.js"
import type { DecisionContext } from "../../src/authorization/can.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { UnitTypeId } from "../../src/authorization/generated/roles.generated.js"

const CTX: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }

type RoleFixture = {
  readonly label: string
  readonly personId: string
  readonly scopePath: string
  readonly unitId: string
  readonly unitType: UnitTypeId
}

// مستخدمٌ قانونيّ لكل دورٍ حيّ من العشرة (من العالم القانوني).
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", personId: "u-admin", scopePath: "/", unitId: "root", unitType: "root" },
  { label: "section_head", personId: "u-section-head", scopePath: "/men/", unitId: "men", unitType: "section" },
  { label: "rabita", personId: "u-rabita", scopePath: "/men/homs/", unitId: "homs", unitType: "region" },
  { label: "square", personId: "u-square", scopePath: "/men/homs/sq2/", unitId: "sq2", unitType: "square" },
  { label: "amir", personId: "u-amir", scopePath: "/men/homs/sq2/khalid/", unitId: "khalid", unitType: "mosque" },
  { label: "teacher", personId: "u-teacher", scopePath: "/men/homs/sq2/khalid/c1/", unitId: "c1", unitType: "circle" },
  { label: "committee_head", personId: "u-committee-head", scopePath: "/men/homs/sq2/khalid/", unitId: "khalid", unitType: "mosque" },
  { label: "media", personId: "u-media", scopePath: "/", unitId: "root", unitType: "root" },
  { label: "finance_officer", personId: "u-finance", scopePath: "/", unitId: "root", unitType: "root" },
  { label: "student", personId: "u-student", scopePath: "/men/homs/sq2/khalid/c1/", unitId: "c1", unitType: "circle" },
]

type Ep = ReturnType<typeof makeOrgEndpoints>

/** عنصرٌ على شاشة: قدرتُه الحارسة، حضورُه في العرض، واستدعاءُ خادمه للرفض. */
type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (store: OrgStore, caps: ReadonlySet<CapId>, f: RoleFixture) => boolean
  readonly serverInvoke: (ep: Ep, store: OrgStore, f: RoleFixture, personId: string) => Promise<{ ok: boolean }>
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "orgTree",
    element: "زر إنشاء وحدة",
    cap: "orgUnit.manage",
    shown: (store, caps) => {
      const v = orgTreeScreen(caps, [...store.units.values()])
      return v.kind === "granted" && v.actions.createUnit
    },
    serverInvoke: (ep, _s, f, actorId) =>
      ep.createUnit.invoke({ parentId: f.unitId, id: "probe", type: "region", labelAr: "x" }, endpointActor(actorId), CTX),
  },
  {
    screen: "orgTree",
    element: "زر أرشفة وحدة",
    cap: "orgUnit.manage",
    shown: (store, caps) => {
      const v = orgTreeScreen(caps, [...store.units.values()])
      return v.kind === "granted" && v.actions.archiveUnit
    },
    serverInvoke: (ep, _s, f, actorId) => ep.archiveUnit.invoke({ unitId: f.unitId }, endpointActor(actorId), CTX),
  },
  {
    // شاشةُ التمكين قائمةٌ بذاتها (مغلقةٌ بقدرة `users.provision` وحدها، لا بـ network.view):
    // فأميرٌ يملك التمكين دون عرض الشبكة يراها، ومَن لا يملكه لا يراها ولا يمرّ خادمُه.
    screen: "createAccount",
    element: "شاشة إنشاء الحساب",
    cap: "users.provision",
    shown: (_store, caps) => createAccountScreen(caps, []).kind === "granted",
    serverInvoke: (ep, _s, f, actorId) =>
      ep.provision.invoke({ targetUnitId: f.unitId, targetRoleId: "teacher", username: `p-${f.label}` }, endpointActor(actorId), CTX),
  },
  {
    screen: "assignments",
    element: "زر إنهاء تكليف",
    cap: "user.manage",
    shown: (store, caps) => {
      const v = assignmentsScreen(caps, store.assignments)
      return v.kind === "granted" && v.actions.endAssignment
    },
    serverInvoke: (ep, store, f, actorId) => {
      const own = store.assignmentsForPerson(f.personId)[0]
      return ep.endAssignment.invoke({ assignmentId: own?.id ?? "none" }, endpointActor(actorId), CTX)
    },
  },
]

// حاملُ الفاعل بين البناء والاستدعاء (يُملأ لكل دور).
let currentStore: OrgStore | null = null
function endpointActor(personId: string) {
  return buildActor(currentStore!, personId)
}

describe("مصفوفة الشاشات — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  let positives = 0
  let negatives = 0

  it("لكل دورٍ × كل عنصر: الحضور = القدرة، والغياب مقرونٌ برفض الخادم", async () => {
    for (const f of ROLE_FIXTURES) {
      clearRegistryForTests()
      const w = seedWorld()
      currentStore = w.store
      const ep = makeOrgEndpoints(w.store)
      const actor = buildActor(w.store, f.personId)
      const caps = computeScreenCaps(actor, f.scopePath, CTX)

      for (const a of AFFORDANCES) {
        const allowed = caps.has(a.cap)
        const shown = a.shown(w.store, caps, f)
        // الطبقة الأولى: العنصر يظهر إن وفقط إن ملك الدورُ قدرتَه.
        expect(shown, `${a.screen}/${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          // الطبقة الثانية: الزرُّ الغائبُ يُقرَن برفض استدعاء الخادم المباشر.
          const r = await a.serverInvoke(ep, w.store, f, f.personId)
          expect(r.ok, `استدعاء ${a.element} المباشر نجح رغم غياب الزر · ${f.label}`).toBe(false)
        }
      }
    }

    // القاعدة الذهبية: السلبيات أكثر من الإيجابيات (النظام يُعرَّف بما يمنعه).
    console.log(`[مصفوفة شاشات الوحدة] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("منتقي الدور في «إنشاء حساب» لا يعرض دوراً أعلى ولا موقوفاً (أمير المسجد)", () => {
    const w = seedWorld()
    currentStore = w.store
    const amir = buildActor(w.store, "u-amir")
    const roles = computeProvisionableRoles(amir, "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(roles).toContain("teacher")
    expect(roles).toContain("committee_head")
    expect(roles).not.toContain("amir") // ليس أعلى ولا مساوياً
    expect(roles).not.toContain("square") // أعلى رتبة
    expect(roles).not.toContain("secretary") // موقوف
  })

  it("أمير المسجد لا يرى شاشة الشجرة الشبكية (لا يملك network.view) — غيابٌ صريح", () => {
    const w = seedWorld()
    const amir = buildActor(w.store, "u-amir")
    const caps = computeScreenCaps(amir, "/men/homs/sq2/khalid/", CTX)
    const v = orgTreeScreen(caps, [...w.store.units.values()])
    expect(v.kind).toBe("denied")
  })
})
