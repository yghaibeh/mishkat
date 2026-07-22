/**
 * **الاختبارُ الإلزاميّ العاشر** (T18) — الطبقةُ الثانية من E2E: **مصفوفةُ شاشات السجلّ
 * اليوميّ** (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ الزر
 * وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org`/`box`/`custody`/`circles`): لا إطارَ
 * واجهةٍ في v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض**
 * + رفضِ الخادم.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { makeCircleLogEndpoints } from "../../src/features/circleLog/server/endpoints.js"
import { circleModelFrom } from "../../src/features/circleLog/services/circlesPort.js"
import {
  computeCircleLogCaps,
  teachesAnyCircle,
} from "../../src/features/circleLog/screens/caps.js"
import {
  logDayScreenNodes,
  myLogScreenNodes,
  notesScreenNodes,
  EMPTY_CIRCLE_LOG_SNAPSHOT,
  LOG_DAY_CONTRACT,
  MY_LOG_CONTRACT,
  NOTES_CONTRACT,
} from "../../src/features/circleLog/screens/screens.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { Actor } from "../../src/authorization/can.js"
import {
  canonicalActor,
  DECISION,
  KHALID_PATH,
  mosqueTeacher,
  NOW,
  seedWorld,
  sequentialTokens,
  WRITE,
  type World,
} from "../features/circleLog/_seed.js"

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

type RoleFixture = { readonly label: string; readonly actor: () => Actor }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ من العشرة + **محفّظُ المسجد** (تكوينٌ ميدانيٌّ مشروع). */
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", actor: () => canonicalActor("u-admin") },
  { label: "section_head", actor: () => canonicalActor("u-section-head") },
  { label: "rabita", actor: () => canonicalActor("u-rabita") },
  { label: "square", actor: () => canonicalActor("u-square") },
  { label: "amir", actor: () => canonicalActor("u-amir") },
  { label: "teacher", actor: () => mosqueTeacher() },
  { label: "committee_head", actor: () => canonicalActor("u-committee-head") },
  { label: "media", actor: () => canonicalActor("u-media") },
  { label: "finance_officer", actor: () => canonicalActor("u-finance") },
  { label: "student", actor: () => canonicalActor("u-student") },
]

type Ep = ReturnType<typeof makeCircleLogEndpoints>

function endpointsFor(world: World): Ep {
  return makeCircleLogEndpoints({
    store: world.log,
    circles: circleModelFrom(world.circles),
    settings: createSettingsResolver([]),
    newToken: sequentialTokens(),
  })
}

function capsFor(world: World, actor: Actor): ReadonlySet<CapId> {
  const port = circleModelFrom(world.circles)
  return computeCircleLogCaps(actor, KHALID_PATH, DECISION, teachesAnyCircle(port, actor.personId))
}

/**
 * **القياسُ على شاشات الوحدة الثلاث مجتمعةً** لا على واحدةٍ بعينها — لأنّ البابَ الواحد
 * يعيش في شاشةِ عدسته: رابطُ وليّ الأمر عند الأمير في «سجلّ الحلقة» وعند المعلّم في
 * «سجلّ حلقاتي». والسؤالُ المطروح هنا هو الصحيح: **أيبلغ هذا الدورُ هذا المِقبضَ في وحدتنا
 * أصلاً؟** — والغيابُ عن شاشةٍ بعينها يحرسه فحصُ الفراغ أدناه وG20 الدلاليّة.
 */
function reaches(caps: ReadonlySet<CapId>, cap: CapId): boolean {
  const seen = new Set([
    ...visibleCaps(logDayScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT)),
    ...visibleCaps(notesScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT)),
    ...visibleCaps(myLogScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT)),
  ])
  return seen.has(cap)
}

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, w: World, actor: Actor) => Promise<{ ok: boolean }>
}

const ROW = { attendance: "present" as const }

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "سجلُّ الحلقة اليوميّ",
    element: "نموذجُ تسجيل اليوم (ق-٨٤ — الإدخالُ لمالكه)",
    cap: "circle.manage",
    shown: (caps) => reaches(caps, "circle.manage"),
    serverInvoke: (ep, w, actor) =>
      ep.record.invoke(
        { circleId: w.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: w.studentA }] },
        actor,
        WRITE,
      ),
  },
  {
    screen: "سجلُّ الحلقة اليوميّ",
    element: "كشفُ اليوم (اطّلاعٌ هابط — ق-١٧)",
    cap: "circle.view",
    shown: (caps) => reaches(caps, "circle.view"),
    serverInvoke: (ep, w, actor) =>
      ep.dayView.invoke({ circleId: w.circleId, at: NOW }, actor, DECISION),
  },
  {
    screen: "سجلُّ الحلقة اليوميّ",
    element: "إصدارُ رابط وليّ الأمر (ق-٩٣)",
    cap: "guardianLink.manage",
    shown: (caps) => reaches(caps, "guardianLink.manage"),
    serverInvoke: (ep, w, actor) =>
      ep.linkIssue.invoke({ circleId: w.circleId, enrollmentId: w.studentA }, actor, WRITE),
  },
  {
    screen: "ملاحظاتُ الإشراف",
    element: "نموذجُ كتابة الملاحظة (ق-٨٧ — المعلّمُ يقرأ ولا يحرّر)",
    cap: "circle.notes.supervise",
    shown: (caps) => reaches(caps, "circle.notes.supervise"),
    serverInvoke: (ep, w, actor) =>
      ep.noteRecord.invoke({ circleId: w.circleId, bodyAr: "ملاحظة" }, actor, WRITE),
  },
  {
    screen: "سجلُّ حلقاتي",
    element: "تسجيلُ المعلّم يومَ حلقته (ق-٩٠)",
    cap: "circle.teach",
    shown: (caps) => reaches(caps, "circle.teach"),
    serverInvoke: (ep, w, actor) =>
      ep.recordMine.invoke(
        { circleId: w.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: w.studentA }] },
        actor,
        WRITE,
      ),
  },
]

beforeEach(() => clearRegistryForTests())

describe("مصفوفةُ شاشات السجلّ اليوميّ — الغيابُ مقرونٌ برفض الخادم (G9/TESTING_POLICY §٤)", () => {
  for (const affordance of AFFORDANCES) {
    for (const fixture of ROLE_FIXTURES) {
      it(`${affordance.screen} · ${affordance.element} · ${fixture.label}`, async () => {
        const world = seedWorld()
        const ep = endpointsFor(world)
        const actor = fixture.actor()
        const caps = capsFor(world, actor)

        const shown = affordance.shown(caps)
        const server = await affordance.serverInvoke(ep, world, actor)

        // **الطبقتان معاً**: ما لا يظهر في الشاشة يُرفض في الخادم — والعكس بالعكس.
        expect(shown, `عرضُ «${affordance.element}» لـ${fixture.label}`).toBe(caps.has(affordance.cap))
        expect(server.ok, `خادمُ «${affordance.element}» لـ${fixture.label}`).toBe(
          caps.has(affordance.cap),
        )
      })
    }
  }
})

describe("عدساتُ الشاشات وعقودُها (G20 — لا دور يرى ما خارج عدسته)", () => {
  it("**فراغُ المطّلع مُشخِّصٌ لمن لا يملك بابَ الشاشة** — لا شاشةٌ بيضاء (ق-١١٢)", () => {
    const world = seedWorld()
    for (const fixture of ROLE_FIXTURES) {
      const caps = capsFor(world, fixture.actor())
      if (caps.has("circle.view")) continue
      const view = logDayScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT)
      expect(visibleCaps(view), fixture.label).toEqual([])
    }
  })

  it("**والمعلّمُ لا يجد مِقبضَ تحريرِ ملاحظةِ المشرف على شاشته** (ب-٣٥أ — الطبقةُ الأولى)", () => {
    const world = seedWorld()
    const caps = capsFor(world, mosqueTeacher())
    const view = myLogScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT)
    expect(visibleCaps(view)).not.toContain("circle.notes.supervise")
  })

  it("وكلُّ قدرةٍ في عقود الشاشات الثلاثة من الخمس المعلنة في العقد — لا قدرةٌ مخترعة", () => {
    const ALLOWED: readonly CapId[] = [
      "circle.view",
      "circle.manage",
      "circle.teach",
      "circle.notes.supervise",
      "guardianLink.manage",
    ]
    for (const contract of [LOG_DAY_CONTRACT, NOTES_CONTRACT, MY_LOG_CONTRACT]) {
      for (const cap of contract.capabilities) {
        expect(ALLOWED, `${contract.route}: ${cap}`).toContain(cap)
      }
    }
  })

  it("ومواطنُ الكيانات معلنةٌ حيث ينصّ IA §١ (ك-٣ · ك-٥ · ك-٦) — و«حلقاتي» عرضٌ منسوبٌ بلا موطن", () => {
    expect(LOG_DAY_CONTRACT.canonicalHome).toEqual(["lesson", "guardianLink"])
    expect(NOTES_CONTRACT.canonicalHome).toEqual(["supervisionNote"])
    expect(MY_LOG_CONTRACT.canonicalHome).toEqual([])
  })
})
