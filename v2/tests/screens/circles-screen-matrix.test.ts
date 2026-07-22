/**
 * **الاختبارُ الإلزاميّ العاشر** (T16) — الطبقةُ الثانية من E2E: **مصفوفةُ شاشات الحلقات**
 * (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ الزر
 * وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org`/`box`/`custody`): لا إطارَ واجهةٍ في v2
 * بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم.
 */
import { describe, it, expect } from "vitest"
import { makeCirclesEndpoints } from "../../src/features/circles/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { computeCirclesCaps, teachesAnyCircle } from "../../src/features/circles/screens/caps.js"
import {
  circlesScopeScreenNodes,
  myCirclesScreenNodes,
  EMPTY_CIRCLES_SNAPSHOT,
  CIRCLES_SCOPE_CONTRACT,
  MY_CIRCLES_CONTRACT,
} from "../../src/features/circles/screens/screens.js"
import { assignTeacher } from "../../src/features/circles/services/circles.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { CirclesStore } from "../../src/features/circles/data/store.js"
import {
  canonicalActor,
  canonicalDirectory,
  circlesContext,
  DECISION,
  KHALID_PATH,
  seedCircle,
  seedCirclesStore,
  WRITE,
} from "../features/circles/_seed.js"

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

type Ep = ReturnType<typeof makeCirclesEndpoints>
type World = { readonly store: CirclesStore; readonly circleId: string }

/** عالمُ المصفوفة: حلقةٌ في مسجد خالد **مُسنَدةٌ إلى المعلّم**. */
function seedWorld(): World {
  const store = seedCirclesStore()
  const circleId = seedCircle(store)
  const done = assignTeacher(store, circlesContext("u-amir"), {
    circleId,
    teacherPersonId: "u-teacher",
  })
  if (!done.ok) throw new Error(done.error.code)
  return { store, circleId }
}

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, w: World, f: RoleFixture) => Promise<{ ok: boolean }>
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/mosque/circles",
    element: "جدولُ حلقات المسجد بمرشّح النوع الواحد",
    cap: "circle.view",
    shown: (caps) =>
      visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.view"),
    serverInvoke: (ep, _w, f) =>
      ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/circles",
    element: "بطاقةُ إحصاء الحلقات (كلُّ الأنواع)",
    cap: "circle.view",
    shown: (caps) =>
      visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.view"),
    serverInvoke: (ep, _w, f) =>
      ep.statsView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/circles",
    element: "نموذجُ إنشاء حلقةٍ من أيّ نوعٍ قائم (ع-٥/ع-٨)",
    cap: "circle.manage",
    shown: (caps) =>
      visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.manage"),
    serverInvoke: (ep, _w, f) =>
      ep.create.invoke(
        { unitId: "khalid", typeId: "scientific", nameAr: "حلقةٌ علمية", capacity: 12 },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/mosque/circles",
    element: "نموذجُ إسناد المعلّم",
    cap: "circle.manage",
    shown: (caps) =>
      visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.manage"),
    serverInvoke: (ep, w, f) =>
      ep.assignTeacher.invoke(
        { circleId: w.circleId, teacherPersonId: "u-teacher" },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/mosque/circles",
    element: "نموذجُ إدخال طالبٍ باسمٍ حرّ (ق-٨٤/ق-٣١)",
    cap: "circle.manage",
    shown: (caps) =>
      visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.manage"),
    serverInvoke: (ep, w, f) =>
      ep.enroll.invoke({ circleId: w.circleId, nameAr: "طالب" }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/my-circles",
    element: "جدولُ «حلقاتي» (عدسةُ ملكيةٍ لا موطنٌ ثانٍ — ز-٢)",
    cap: "circle.teach",
    shown: (caps) =>
      visibleCaps(myCirclesScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)).includes("circle.teach"),
    // السلبُ هنا **صفحةُ المعلّم بعينها**: «حلقاتي» صفحةُ صاحبها وحده (نطاقٌ شخصيّ).
    serverInvoke: (ep, _w, f) =>
      ep.mine.invoke({ personId: "u-teacher" }, canonicalActor(f.personId), DECISION),
  },
]

describe("مصفوفةُ شاشات الحلقات — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const w = seedWorld()
        const ep = makeCirclesEndpoints(w.store, canonicalDirectory)
        const actor = canonicalActor(f.personId)
        const caps = computeCirclesCaps(
          actor,
          KHALID_PATH,
          DECISION,
          teachesAnyCircle(w.store, actor.personId),
        )

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, w, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات الحلقات] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**ع-٧ بعينه**: الأميرُ يرى **وينشئ ويدير**، والمشرفُ يرى ولا يُدخل (ق-٨٤)", () => {
    const w = seedWorld()
    const amirCaps = computeCirclesCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const amirShown = visibleCaps(circlesScopeScreenNodes(amirCaps, EMPTY_CIRCLES_SNAPSHOT))
    expect(amirShown).toContain("circle.view")
    expect(amirShown).toContain("circle.manage")

    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square"]) {
      const caps = computeCirclesCaps(canonicalActor(personId), KHALID_PATH, DECISION, false)
      const shown = visibleCaps(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT))
      expect(shown, personId).toContain("circle.view")
      expect(shown, `${personId} يرى زرّاً يُدخل به`).not.toContain("circle.manage")
    }
    void w
  })

  it("**و«حلقاتي» لا تظهر لمن لا حلقةَ له** — الشخصيةُ تُسقَط بالملكية لا بالدور وحده", () => {
    const w = seedWorld()
    // الأميرُ لا يملك `circle.teach` أصلاً في المصفوفة.
    const amir = canonicalActor("u-amir")
    expect(
      computeCirclesCaps(amir, KHALID_PATH, DECISION, teachesAnyCircle(w.store, amir.personId)).has(
        "circle.teach",
      ),
    ).toBe(false)

    // والمعلّمُ بلا حلقةٍ مُسنَدة: لا بابَ شخصيّ.
    const emptyStore = seedCirclesStore()
    const teacher = canonicalActor("u-teacher")
    expect(
      computeCirclesCaps(
        teacher,
        KHALID_PATH,
        DECISION,
        teachesAnyCircle(emptyStore, teacher.personId),
      ).has("circle.teach"),
    ).toBe(false)

    // وبحلقةٍ مُسنَدة: البابُ له وحده.
    const caps = computeCirclesCaps(
      teacher,
      KHALID_PATH,
      DECISION,
      teachesAnyCircle(w.store, teacher.personId),
    )
    expect(caps.has("circle.teach")).toBe(true)
    expect(visibleCaps(myCirclesScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT))).toContain("circle.teach")
  })

  it("**والطالبُ لا يرى شيئاً من الحلقات**: الشاشتان فراغٌ مُشخِّص (ق-١١٢)", () => {
    const w = seedWorld()
    const actor = canonicalActor("u-student")
    const caps = computeCirclesCaps(
      actor,
      KHALID_PATH,
      DECISION,
      teachesAnyCircle(w.store, actor.personId),
    )
    for (const nodes of [
      circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT),
      myCirclesScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })

  it("**ومرشّحُ النوع واحدٌ لا تبويبات** (ب-٢٨/ع-٦): صفر `Tabs` وحقلُ مرشّحٍ واحد", () => {
    const caps = computeCirclesCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const nodes = circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)
    const all = [...walkNodes(nodes)]
    expect(all.filter((n) => n.component === "Tabs")).toHaveLength(0)
    const filters = all.filter((n) => n.meta.name === "typeId" && n.meta.kind === "select")
    expect(filters.length).toBeGreaterThan(0)
  })

  it("**والموطنُ واحد**: عقدُ «حلقات المسجد» يعلن الحلقةَ والتسجيل، و«حلقاتي» لا تعلن موطناً (ز-٢)", () => {
    expect([...CIRCLES_SCOPE_CONTRACT.canonicalHome]).toEqual(["circle", "enrollment"])
    expect([...MY_CIRCLES_CONTRACT.canonicalHome]).toEqual([])
    expect(CIRCLES_SCOPE_CONTRACT.dataSource).toBe("circle.scopeView")
    expect(MY_CIRCLES_CONTRACT.dataSource).toBe("circle.mine")
  })

  it("**والحجبُ يغلب حتى على المعلّم صاحب الحلقة** (§١.٤): بابُه الشخصيُّ يُقفل وإن أُسنِدت له", () => {
    const w = seedWorld()
    const teacher = canonicalActor("u-teacher")
    expect(teachesAnyCircle(w.store, teacher.personId)).toBe(true)
    const blocked = {
      ...teacher,
      overrides: [
        {
          capId: "circle.teach" as const,
          scopePath: "/",
          effect: "deny" as const,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "حجبٌ مؤقّتٌ أثناء تحقيقٍ في سجل الحلقة",
        },
      ],
    }
    const caps = computeCirclesCaps(blocked, KHALID_PATH, DECISION, true)
    expect(caps.has("circle.teach")).toBe(false)
    expect(visibleCaps(myCirclesScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT))).not.toContain(
      "circle.teach",
    )
  })

  it("**والجدولُ يقول حالتَه**: صفوفٌ ⇒ «data»، وفراغٌ ⇒ «empty» بفراغٍ مُشخِّص (ق-١١٢)", () => {
    const amirCaps = computeCirclesCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const filled = {
      ...EMPTY_CIRCLES_SNAPSHOT,
      circleRows: [{ name: "حلقةُ الفجر", type: "تحفيظ", teacher: "—", capacity: "٢٠", enrolled: "٣", remaining: "١٧" }],
      totalAr: "١",
    }
    const tables = [...walkNodes(circlesScopeScreenNodes(amirCaps, filled))].filter(
      (n) => n.component === "DataTable",
    )
    expect(tables).toHaveLength(1)
    expect(tables[0]?.meta.state).toBe("data")
    expect(tables[0]?.meta.rows).toBe("1")

    const teacherCaps = computeCirclesCaps(canonicalActor("u-teacher"), KHALID_PATH, DECISION, true)
    const mineFilled = { ...EMPTY_CIRCLES_SNAPSHOT, mineRows: filled.circleRows, mineTotalAr: "١" }
    const mineTables = [...walkNodes(myCirclesScreenNodes(teacherCaps, mineFilled))].filter(
      (n) => n.component === "DataTable",
    )
    expect(mineTables[0]?.meta.state).toBe("data")

    const empty = [...walkNodes(circlesScopeScreenNodes(amirCaps, EMPTY_CIRCLES_SNAPSHOT))].filter(
      (n) => n.component === "DataTable",
    )
    expect(empty[0]?.meta.state).toBe("empty")
  })

  it("**وفراغُ المطّلع تشخيصٌ لا دعوةُ فعل** (ق-١٠٩): المشرفُ يرى سببَ الفراغ لا زرّاً", () => {
    const caps = computeCirclesCaps(canonicalActor("u-rabita"), KHALID_PATH, DECISION, false)
    const tables = [...walkNodes(circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT))].filter(
      (n) => n.component === "EmptyState",
    )
    expect(tables.length).toBeGreaterThan(0)
    expect(tables[0]?.meta.diagnostic).toBe("true")
  })

  it("**وكلُّ رقمٍ على الشاشة منطوقٌ على نطاقها** (ق-١١٠): البطاقةُ تعلن نطاقَها", () => {
    const caps = computeCirclesCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const nodes = circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT)
    const stats = [...walkNodes(nodes)].filter((n) => n.component === "StatCard")
    expect(stats.length).toBeGreaterThan(0)
    for (const card of stats) expect(card.meta.scopeDeclared).toBe("true")
  })
})
