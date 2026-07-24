/**
 * **مصفوفةُ شاشات المسابقة** — الطبقةُ الثانية من E2E (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ الزر
 * وحده ليس نجاحاً. **وحالاتُ السلب أكثرُ من الإيجاب** (النظامُ الآمنُ يُعرَّف بما يمنعه).
 *
 * **وأخطرُ خليّةٍ هنا خليّةُ المدير**: `admin` يرى ولا يعمل (ق-٢٧/ق-٣/ق-٤) — وv1 كان العكسَ
 * تماماً (كلُّ دوالّ المسابقة خلف `isGlobalAdmin`). فغيابُ زرَّي البتّ والرصد عنه **مقرونٌ
 * برفض الخادم** في هذه المصفوفة بعينها.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org`/`box`/`circles`): لا إطارَ واجهةٍ في v2
 * بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCompetitionEndpoints } from "../../src/features/competition/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { computeCompetitionCaps } from "../../src/features/competition/screens/caps.js"
import {
  competitionScopeScreenNodes,
  enrollmentInboxScreenNodes,
  COMPETITION_SCOPE_CONTRACT,
  COMPETITION_INBOX_CONTRACT,
  EMPTY_COMPETITION_SNAPSHOT,
} from "../../src/features/competition/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { CompetitionStore } from "../../src/features/competition/data/store.js"
import {
  canonicalActor,
  DAY_MS,
  DECISION,
  END_MONTH,
  KHALID_PATH,
  NOW,
  PERIOD,
  seedCompetition,
  seedCompetitionStore,
  seedContestant,
  seedScoringType,
  START_MONTH,
  WINDOW_CLOSES,
  WINDOW_OPENS,
  WRITE,
} from "../features/competition/_seed.js"

beforeEach(() => clearRegistryForTests())

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

type Ep = ReturnType<typeof makeCompetitionEndpoints>
type World = {
  readonly store: CompetitionStore
  readonly competitionId: string
  readonly contestantId: string
  readonly enrollmentId: string
  readonly typeKey: string
}

/** عالمُ المصفوفة: مسابقةُ مسجد خالد، بمتبارٍ ونوعِ تنقيطٍ وطلبٍ معلَّق. */
function seedWorld(): World {
  const store = seedCompetitionStore()
  const competition = seedCompetition(store, {
    unitId: "khalid",
    actorPersonId: "u-amir",
    advanceTo: ["enrolling", "running"],
  })
  const type = seedScoringType(store, competition.id)
  const contestant = seedContestant(store, { competitionId: competition.id })
  const pending = seedContestant.length // يُستهلك أدناه لطلبٍ معلَّقٍ حقيقيّ
  void pending
  return {
    store,
    competitionId: competition.id,
    contestantId: contestant.id,
    enrollmentId: store.enrollments()[0]!.id,
    typeKey: type.key,
  }
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
    screen: "/competition",
    element: "جدولُ مسابقات النطاق بقاعدة التقاطع",
    cap: "competition.view",
    shown: (caps) =>
      visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.view",
      ),
    serverInvoke: (ep, _w, f) =>
      ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/competition",
    element: "نموذجُ إنشاء مسابقةٍ على نطاق الوحدة (ت-١)",
    cap: "competition.manage",
    shown: (caps) =>
      visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.manage",
      ),
    serverInvoke: (ep, _w, f) =>
      ep.create.invoke(
        {
          unitId: "khalid",
          titleAr: "مسابقةٌ من المصفوفة",
          startMonthHijri: START_MONTH,
          endMonthHijri: END_MONTH,
          enrollmentOpensAt: WINDOW_OPENS,
          enrollmentClosesAt: WINDOW_CLOSES,
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/competition",
    element: "نموذجُ تعريف نوعِ تنقيطٍ في الكتالوج",
    cap: "competition.manage",
    shown: (caps) =>
      visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.manage",
      ),
    serverInvoke: (ep, w, f) =>
      ep.scoringTypeDefine.invoke(
        {
          competitionId: w.competitionId,
          key: "matrix_type",
          titleAr: "نوعٌ من المصفوفة",
          track: "أنشطة",
          valueKind: "count",
          weight: 5,
          period: "hijri_month",
          excusable: false,
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/competition",
    element: "زرُّ إعلان الفائزين — **فعلٌ لا رجعة فيه** بقدرةٍ مستقلّة (ق-٥٤)",
    cap: "competition.result.declare",
    shown: (caps) =>
      visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.result.declare",
      ),
    serverInvoke: (ep, w, f) =>
      ep.resultDeclare.invoke({ competitionId: w.competitionId }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/competition/enrollments",
    element: "صندوقُ طلبات الالتحاق — **لأمير المسجد بعينه** (ق-١٤)",
    cap: "competition.enroll.approve",
    shown: (caps) =>
      visibleCaps(enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.enroll.approve",
      ),
    serverInvoke: (ep, _w, f) =>
      ep.enrollmentInbox.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/competition/enrollments",
    element: "نموذجُ رصد أحداث التنقيط (ب-٣٧ب: الراصدُ أميرُ المسجد)",
    cap: "competition.score.record",
    shown: (caps) =>
      visibleCaps(enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.score.record",
      ),
    serverInvoke: (ep, w, f) =>
      ep.scoreRecord.invoke(
        { contestantId: w.contestantId, typeKey: w.typeKey, periodKey: PERIOD, value: 1 },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/competition/enrollments",
    element: "زرُّ إصدار رابط الدعوة (قب-١٣ زيادةُ المالك)",
    cap: "competition.enroll.approve",
    shown: (caps) =>
      visibleCaps(enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)).includes(
        "competition.enroll.approve",
      ),
    serverInvoke: (ep, w, f) =>
      ep.inviteIssue.invoke(
        {
          competitionId: w.competitionId,
          mosquePath: KHALID_PATH,
          expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
]

describe("مصفوفةُ شاشات المسابقة — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const w = seedWorld()
        const ep = makeCompetitionEndpoints(w.store)
        const actor = canonicalActor(f.personId)
        const caps = computeCompetitionCaps(actor, KHALID_PATH, DECISION)

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

    console.log(`[مصفوفة شاشات المسابقة] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**ق-٢٧ بعينها**: المديرُ يرى المسابقةَ ويعلن، **ولا يبتّ ولا يرصد** — وv1 كان العكس", async () => {
    const w = seedWorld()
    const ep = makeCompetitionEndpoints(w.store)
    const admin = canonicalActor("u-admin")
    const caps = computeCompetitionCaps(admin, KHALID_PATH, DECISION)

    const shown = visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))
    expect(shown).toContain("competition.view")
    expect(shown).toContain("competition.result.declare")

    const inbox = visibleCaps(enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))
    expect(inbox, "المديرُ يرى زرَّ بتٍّ").not.toContain("competition.enroll.approve")
    expect(inbox, "المديرُ يرى زرَّ رصد").not.toContain("competition.score.record")

    // والغيابُ **مقرونٌ برفض الخادم** — الطبقتان معاً.
    const approved = await ep.enrollmentApprove.invoke(
      { enrollmentId: w.enrollmentId },
      admin,
      WRITE,
    )
    expect(approved.ok).toBe(false)
    const scored = await ep.scoreRecord.invoke(
      { contestantId: w.contestantId, typeKey: w.typeKey, periodKey: PERIOD, value: 1 },
      admin,
      WRITE,
    )
    expect(scored.ok).toBe(false)
  })

  it("**والأميرُ وحدَه يبتّ ويرصد على مسجده** — وهو جوابُ ب-٣٧ب البنيويّ", () => {
    const caps = computeCompetitionCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION)
    const inbox = visibleCaps(enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))
    expect(inbox).toContain("competition.enroll.approve")
    expect(inbox).toContain("competition.score.record")

    for (const personId of ["u-rabita", "u-square", "u-section-head"]) {
      const other = computeCompetitionCaps(canonicalActor(personId), KHALID_PATH, DECISION)
      const seen = visibleCaps(enrollmentInboxScreenNodes(other, EMPTY_COMPETITION_SNAPSHOT))
      expect(seen, `${personId} يبتّ طلبَ مسجدٍ ليس مسجدَه`).not.toContain(
        "competition.enroll.approve",
      )
    }
  })

  it("**والإعلاميُّ لا يرى ضبطَ المسابقة** — خليّةُ الغياب الحارسة في §٣", () => {
    const caps = computeCompetitionCaps(canonicalActor("u-media"), KHALID_PATH, DECISION)
    const shown = visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))
    expect(shown).not.toContain("competition.manage")
  })

  it("**والطالبُ والمعلّمُ والماليُّ لا يرون شيئاً**: الشاشتان فراغٌ مُشخِّص (ق-١١٢)", () => {
    for (const personId of ["u-student", "u-teacher", "u-finance"]) {
      const caps = computeCompetitionCaps(canonicalActor(personId), KHALID_PATH, DECISION)
      for (const nodes of [
        competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT),
        enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT),
      ]) {
        expect(nodes.component, personId).toBe("EmptyState")
        expect(nodes.meta.diagnostic).toBe("true")
      }
    }
  })

  it("**والموطنُ واحد**: المسابقةُ موطنُها الشاشةُ الأولى، والمشترِكُ موطنُه الثانية (ك-٢١/ك-٢٢)", () => {
    expect([...COMPETITION_SCOPE_CONTRACT.canonicalHome]).toEqual(["competition"])
    expect([...COMPETITION_INBOX_CONTRACT.canonicalHome]).toEqual(["competitionEnrollment"])
    expect(COMPETITION_SCOPE_CONTRACT.dataSource).toBe("competition.scopeView")
    expect(COMPETITION_INBOX_CONTRACT.dataSource).toBe("competition.inbox")
    expect(COMPETITION_SCOPE_CONTRACT.surface).toBe("competition")
  })

  it("**والحجبُ يغلب** (§١.٤): محجوبُ `competition.manage` لا يرى نموذجَ الضبط ولو حمله دورُه", () => {
    const blocked = {
      ...canonicalActor("u-rabita"),
      overrides: [
        {
          capId: "competition.manage" as const,
          scopePath: "/",
          effect: "deny" as const,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "حجبٌ مؤقّتٌ أثناء تحقيقٍ في أوزان المسابقة",
        },
      ],
    }
    const caps = computeCompetitionCaps(blocked, KHALID_PATH, DECISION)
    expect(caps.has("competition.manage")).toBe(false)
    expect(
      visibleCaps(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)),
    ).not.toContain("competition.manage")
  })

  it("**والجدولُ يقول حالتَه**: صفوفٌ ⇒ «data»، وفراغٌ ⇒ «empty» بفراغٍ مُشخِّص (ق-١١٢)", () => {
    const caps = computeCompetitionCaps(canonicalActor("u-rabita"), KHALID_PATH, DECISION)
    const filled = {
      ...EMPTY_COMPETITION_SNAPSHOT,
      competitionRows: [
        { title: "مسابقةُ المسجد المؤثّر", scope: "/men/homs/", status: "جارية", contestants: "٣", pending: "١" },
      ],
      totalAr: "١",
    }
    const tables = [...walkNodes(competitionScopeScreenNodes(caps, filled))].filter(
      (n) => n.component === "DataTable",
    )
    expect(tables).toHaveLength(1)
    expect(tables[0]?.meta.state).toBe("data")

    const empty = [...walkNodes(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))].filter(
      (n) => n.component === "DataTable",
    )
    expect(empty[0]?.meta.state).toBe("empty")
  })

  it("**وكلُّ رقمٍ على الشاشة منطوقٌ على نطاقها** (ق-١١٠): البطاقةُ تعلن نطاقَها", () => {
    const caps = computeCompetitionCaps(canonicalActor("u-rabita"), KHALID_PATH, DECISION)
    const stats = [...walkNodes(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT))].filter(
      (n) => n.component === "StatCard",
    )
    expect(stats.length).toBeGreaterThan(0)
    for (const card of stats) expect(card.meta.scopeDeclared).toBe("true")
  })

  it("**وفراغُ المطّلع تشخيصٌ لا دعوةُ فعل** (ق-١٠٩): مَن يرى ولا يضبط يرى سببَ الفراغ", () => {
    const caps = computeCompetitionCaps(canonicalActor("u-media"), KHALID_PATH, DECISION)
    const empties = [
      ...walkNodes(competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT)),
    ].filter((n) => n.component === "EmptyState")
    expect(empties.length).toBeGreaterThan(0)
    expect(empties[0]?.meta.diagnostic).toBe("true")
  })
})
