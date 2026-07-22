/**
 * **الاختبارُ الإلزاميّ السابع** (T19، شقُّ الشاشات) — الطبقةُ الثانية من E2E: **مصفوفةُ شاشات
 * «على بصيرة»** (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ الزر
 * وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت سائرُ المصفوفات): لا إطارَ واجهةٍ في v2 بعد (قب-٢٦)،
 * فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم.
 */
import { describe, it, expect } from "vitest"
import { makeEducationEndpoints } from "../../src/features/education/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { computeEducationCaps } from "../../src/features/education/screens/caps.js"
import {
  circleLessonsScreenNodes,
  myLessonsScreenNodes,
  manhajScreenNodes,
  EMPTY_EDUCATION_SNAPSHOT,
  CIRCLE_LESSONS_CONTRACT,
  MY_LESSONS_CONTRACT,
  MANHAJ_CONTRACT,
} from "../../src/features/education/screens/screens.js"
import { lessonsOfTeacher } from "../../src/features/education/services/lessons.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import {
  canonicalActor,
  DECISION,
  educationPorts,
  HELD_AT,
  KHALID_PATH,
  SESSION_A,
  SETTINGS,
  seedWorld,
  WRITE,
  type EduWorld,
  circleDays,
  educationContext,} from "../features/education/_seed.js"

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

type Ep = ReturnType<typeof makeEducationEndpoints>

function endpointsOf(w: EduWorld): Ep {
  return makeEducationEndpoints(w.education, educationPorts(w), SETTINGS, () => false, circleDays(w))
}

function recordInput(w: EduWorld) {
  return {
    circleId: w.circleId,
    sessionId: SESSION_A,
    heldAt: HELD_AT,
    durationMinutes: 60,
    presentEnrollmentIds: [w.enrollmentIds[0]!],
  }
}

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, w: EduWorld, f: RoleFixture) => Promise<{ ok: boolean }>
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/mosque/circles/lessons",
    element: "جدولُ دروس الحلقة بحالها",
    cap: "circle.view",
    shown: (caps) =>
      visibleCaps(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.view"),
    serverInvoke: (ep, w, f) =>
      ep.circleLessons.invoke({ circleId: w.circleId }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/circles/lessons",
    element: "بطاقةُ تقدّم المنهج المشتقّة (ق-٩٢)",
    cap: "circle.view",
    shown: (caps) =>
      visibleCaps(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.view"),
    serverInvoke: (ep, w, f) =>
      ep.circleLessons.invoke({ circleId: w.circleId }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/mosque/circles/lessons",
    element: "نموذجُ تسجيل درسٍ لأمير المكان (ق-٨٤)",
    cap: "circle.manage",
    shown: (caps) =>
      visibleCaps(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.manage"),
    serverInvoke: (ep, w, f) =>
      ep.recordByOwner.invoke(recordInput(w), canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/mosque/circles/lessons",
    element: "نموذجُ التصحيح اليدويّ لخليّة تقدّم (قب-٩)",
    cap: "circle.manage",
    shown: (caps) =>
      visibleCaps(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.manage"),
    serverInvoke: (ep, w, f) =>
      ep.markProgress.invoke(
        {
          circleId: w.circleId,
          enrollmentId: w.enrollmentIds[0]!,
          sessionId: SESSION_A,
          completed: true,
          reasonAr: "سبب",
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/my-circles/lessons",
    element: "جدولُ «دروسي» (عدسةُ ملكيةٍ لا موطنٌ ثانٍ — ز-٢)",
    cap: "circle.teach",
    shown: (caps) =>
      visibleCaps(myLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.teach"),
    // السلبُ هنا **صفحةُ المعلّم بعينها**: «دروسي» صفحةُ صاحبها وحده (نطاقٌ شخصيّ).
    serverInvoke: (ep, _w, f) =>
      ep.mine.invoke({ personId: "u-teacher" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/my-circles/lessons",
    element: "نموذجُ تسجيل درسٍ للمعلّم المالك (ق-٨٤)",
    cap: "circle.teach",
    shown: (caps) =>
      visibleCaps(myLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("circle.teach"),
    serverInvoke: (ep, w, f) => ep.record.invoke(recordInput(w), canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/admin/manhaj",
    element: "شجرةُ المنهاج المرجعية (قب-٢٢)",
    cap: "activityCatalog.manage",
    shown: (caps) =>
      visibleCaps(manhajScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("activityCatalog.manage"),
    serverInvoke: (ep, _w, f) => ep.manhajView.invoke({}, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/admin/manhaj",
    element: "نموذجُ إضافة بندٍ للمنهاج بياناً",
    cap: "activityCatalog.manage",
    shown: (caps) =>
      visibleCaps(manhajScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT)).includes("activityCatalog.manage"),
    serverInvoke: (ep, _w, f) =>
      ep.manhajUpsert.invoke(
        { kind: "curriculum", id: "cur-x", ar: "منهاجٌ جديد", circleTypeId: "scientific" },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
]

describe("مصفوفةُ شاشات «على بصيرة» — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const w = seedWorld()
        const ep = endpointsOf(w)
        const actor = canonicalActor(f.personId)
        const caps = computeEducationCaps(
          actor,
          KHALID_PATH,
          DECISION,
          lessonsOfTeacher(educationContext(w, { actorPersonId: actor.personId }), actor.personId).length > 0 ||
            actor.personId === "u-teacher",
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

    console.log(`[مصفوفة شاشات على بصيرة] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**ق-٨٤ بعينه**: الأميرُ يرى نموذجَ الإدخال، والمشرفُ والمديرُ يريان الجدولَ بلا نموذج", () => {
    const amirCaps = computeEducationCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const amirShown = visibleCaps(circleLessonsScreenNodes(amirCaps, EMPTY_EDUCATION_SNAPSHOT))
    expect(amirShown).toContain("circle.view")
    expect(amirShown).toContain("circle.manage")

    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square"]) {
      const caps = computeEducationCaps(canonicalActor(personId), KHALID_PATH, DECISION, false)
      const shown = visibleCaps(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT))
      expect(shown, personId).toContain("circle.view")
      expect(shown, `${personId} يرى نموذجاً يُدخل به درساً`).not.toContain("circle.manage")
    }
  })

  it("**و«دروسي» لا تظهر لمن لا حلقةَ له** — الشخصيةُ تُسقَط بالملكية لا بالدور وحده", () => {
    const amir = canonicalActor("u-amir")
    expect(computeEducationCaps(amir, KHALID_PATH, DECISION, true).has("circle.teach")).toBe(false)

    const teacher = canonicalActor("u-teacher")
    expect(computeEducationCaps(teacher, KHALID_PATH, DECISION, false).has("circle.teach")).toBe(false)
    expect(computeEducationCaps(teacher, KHALID_PATH, DECISION, true).has("circle.teach")).toBe(true)
  })

  it("**والطالبُ لا يرى شيئاً من الثلاث**: فراغٌ مُشخِّص (ق-١١٢) لا شاشةٌ بيضاء", () => {
    const caps = computeEducationCaps(canonicalActor("u-student"), KHALID_PATH, DECISION, false)
    for (const nodes of [
      circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
      myLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
      manhajScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })

  it("**والمواطنُ القانونية معلنةٌ بلا ازدواج**: التقدّمُ والمنهاج، والدرسُ في موطنه، و«دروسي» بلا موطن", () => {
    // **CR-016**: «الدرس/الجلسة اليومية» (ك-٣) موطنُه `/mosque/circles/log` — كيانٌ واحدٌ
    // صاحبُه وحدةُ سجل الحلقة اليوميّ. وهذه الشاشةُ موطنُ **مصفوفة التقدّم** (ك-٤) وحدها،
    // والدروسُ فيها **عرضٌ منسوب** (نظيرُ ز-٢) لا موطنٌ ثانٍ.
    expect([...CIRCLE_LESSONS_CONTRACT.canonicalHome]).toEqual(["curriculumProgress"])
    expect([...CIRCLE_LESSONS_CONTRACT.canonicalHome]).not.toContain("lesson")
    expect([...MY_LESSONS_CONTRACT.canonicalHome]).toEqual([])
    expect([...MANHAJ_CONTRACT.canonicalHome]).toEqual(["manhaj"])
    // **«دروسي» على سطح «حلقاتي» القائم لا سطحٍ ثانٍ** (بند المهمّة ٨).
    expect(MY_LESSONS_CONTRACT.surface).toBe("myCircles")
    expect(CIRCLE_LESSONS_CONTRACT.dataSource).toBe("education.circleLessons")
    expect(MY_LESSONS_CONTRACT.dataSource).toBe("education.mineLessons")
    expect(MANHAJ_CONTRACT.dataSource).toBe("education.manhaj")
  })

  it("**ولا تبويباتٍ بحسب نوع الحلقة** (ب-٢٨/ع-٦): صفر `Tabs` في الشاشات الثلاث", () => {
    const caps = computeEducationCaps(canonicalActor("u-admin"), KHALID_PATH, DECISION, false)
    const amirCaps = computeEducationCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    for (const nodes of [
      circleLessonsScreenNodes(amirCaps, EMPTY_EDUCATION_SNAPSHOT),
      manhajScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
    ]) {
      expect([...walkNodes(nodes)].filter((n) => n.component === "Tabs")).toHaveLength(0)
    }
  })

  it("**والجدولُ يقول حالتَه**: صفوفٌ ⇒ «data»، وفراغٌ ⇒ «empty» بفراغٍ مُشخِّص (ق-١١٢)", () => {
    const amirCaps = computeEducationCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const filled = {
      ...EMPTY_EDUCATION_SNAPSHOT,
      lessonRows: [
        { session: "المجلسُ الأول", heldAt: "١٤٤٧/١/١", duration: "٩٠", present: "٢", photos: "١", state: "معتمَد" },
      ],
      lessonTotalAr: "١",
    }
    const tables = [...walkNodes(circleLessonsScreenNodes(amirCaps, filled))].filter(
      (n) => n.component === "DataTable",
    )
    expect(tables[0]?.meta.state).toBe("data")
    expect(tables[0]?.meta.rows).toBe("1")
    // وجدولُ التقدّمِ فارغٌ في اللقطة نفسِها — فالحالتان مستقلّتان لا واحدةٌ تغطّي أختها.
    expect(tables[1]?.meta.state).toBe("empty")

    const empty = [...walkNodes(circleLessonsScreenNodes(amirCaps, EMPTY_EDUCATION_SNAPSHOT))].filter(
      (n) => n.component === "DataTable",
    )
    expect(empty[0]?.meta.state).toBe("empty")
  })

  it("**وكلُّ رقمٍ على الشاشة منطوقٌ على نطاقها** (ق-١١٠): كلُّ بطاقةٍ تعلن نطاقَها", () => {
    const caps = computeEducationCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const stats = [...walkNodes(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT))].filter(
      (n) => n.component === "StatCard",
    )
    expect(stats.length).toBeGreaterThan(0)
    for (const card of stats) expect(card.meta.scopeDeclared).toBe("true")
  })

  it("**وفراغُ المطّلع تشخيصٌ لا دعوةُ فعل** (ق-١٠٩): المشرفُ يرى سببَ الفراغ لا زرّاً", () => {
    const caps = computeEducationCaps(canonicalActor("u-rabita"), KHALID_PATH, DECISION, false)
    const empties = [...walkNodes(circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT))].filter(
      (n) => n.component === "EmptyState",
    )
    expect(empties.length).toBeGreaterThan(0)
    for (const e of empties) {
      expect(e.meta.diagnostic).toBe("true")
      expect(e.meta.audience).toBe("viewer")
    }
  })
})
