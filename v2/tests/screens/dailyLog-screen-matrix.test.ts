/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشتَي سجل اليوم وكتالوج الأنشطة**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — وهي الاختبارُ الإلزاميّ الخامسَ عشرَ في T10.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`ledger` و`box`): لا إطارَ واجهةٍ في
 * v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض
 * الخادم، لا على متصفحٍ حيّ.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { makeDailyLogEndpoints } from "../../src/features/dailyLog/server/endpoints.js"
import { computeDailyLogCaps } from "../../src/features/dailyLog/screens/caps.js"
import {
  activityCatalogScreenNodes,
  dailyLogScreenNodes,
  EMPTY_CATALOG_SNAPSHOT,
  EMPTY_DAILY_LOG_SNAPSHOT,
  type DailyLogSnapshot,
} from "../../src/features/dailyLog/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import {
  KHALID,
  KHALID_PATH,
  NOW,
  READ,
  WEEK,
  WRITE,
  canonicalActor,
  seedDailyLogStore,
} from "../features/dailyLog/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول (`guardedBy`). وتُستثنى القشرةُ فلها حارسُها المستقلّ (ق-١١٤).
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
const SPAN = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }

/** لقطةٌ **ذاتُ حصيلة** — بها وحدَها يظهر زرُّ التقديم (ق-١٠). */
const WITH_HARVEST: DailyLogSnapshot = Object.freeze({
  ...EMPTY_DAILY_LOG_SNAPSHOT,
  scopePath: KHALID_PATH,
  entryRows: Object.freeze([{ activity: "lesson", count: "٢", points: "١٠" }]),
  rosterUnset: false,
  submittable: true,
})

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

type Ep = ReturnType<typeof makeDailyLogEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, f: RoleFixture) => Promise<{ ok: boolean }>
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/mosque/record",
    element: "لوحُ السجل (النقاط والهدف والتصنيف والقيود)",
    cap: "dailyLog.view",
    shown: (caps) => visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST)).includes("dailyLog.view"),
    serverInvoke: (ep, f) =>
      ep.view.invoke({ unitId: KHALID, periodKey: WEEK, span: SPAN }, canonicalActor(f.personId), READ),
  },
  {
    screen: "/mosque/record",
    element: "نموذجُ «أدخلتُ نشاطاً»",
    cap: "dailyLog.edit",
    shown: (caps) => visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST)).includes("dailyLog.edit"),
    serverInvoke: (ep, f) =>
      ep.record.invoke(
        { unitId: KHALID, clientUuid: `m-${f.personId}`, activityId: "lesson", count: 1, date: NOW },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/mosque/record",
    element: "ضبطُ عدد طلاب الأسرة (ب-٣٢)",
    cap: "familyRoster.manage",
    shown: (caps) =>
      visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST)).includes("familyRoster.manage"),
    serverInvoke: (ep, f) =>
      ep.roster.invoke({ unitId: KHALID, studentCount: 10 }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/admin/activity-catalog",
    element: "جدولُ الكتالوج ونموذجُ إضافة نشاط (ب-٣٩ج)",
    cap: "activityCatalog.manage",
    shown: (caps) =>
      visibleCaps(activityCatalogScreenNodes(caps, EMPTY_CATALOG_SNAPSHOT)).includes(
        "activityCatalog.manage",
      ),
    serverInvoke: (ep, f) =>
      ep.catalogUpsert.invoke(
        {
          schemeId: "scheme-men",
          activityId: `probe-${f.personId}`,
          ar: "نشاطُ فحص",
          weight: 1,
          maxPerDay: null,
          requiresParticipation: false,
          active: true,
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
]

beforeEach(() => clearRegistryForTests())

describe("مصفوفةُ شاشتَي سجل اليوم والكتالوج — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const store = seedDailyLogStore()
        const ep = makeDailyLogEndpoints(store, SETTINGS, () => false)
        const caps = computeDailyLogCaps(canonicalActor(f.personId), KHALID_PATH, READ)

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات سجل اليوم] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى ولا يُدخل** (ق-٤): اللوحُ يظهر له ونموذجُ الإدخال غائب", async () => {
    const store = seedDailyLogStore()
    const ep = makeDailyLogEndpoints(store, SETTINGS, () => false)
    const caps = computeDailyLogCaps(canonicalActor("u-admin"), KHALID_PATH, READ)
    const shown = visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST))

    expect(shown).toContain("dailyLog.view")
    expect(shown).not.toContain("dailyLog.edit")
    expect(shown).not.toContain("report.submit")

    const viewed = await ep.view.invoke(
      { unitId: KHALID, periodKey: WEEK, span: SPAN },
      canonicalActor("u-admin"),
      READ,
    )
    expect(viewed.ok).toBe(true)
  })

  it("**والكتالوجُ بابٌ للمدير وحده** — بقيةُ الأدوار ترى فراغاً مُشخِّصاً لا جدولاً", () => {
    for (const personId of ["u-amir", "u-square", "u-rabita", "u-section-head", "u-finance"]) {
      const caps = computeDailyLogCaps(canonicalActor(personId), KHALID_PATH, READ)
      const nodes = activityCatalogScreenNodes(caps, EMPTY_CATALOG_SNAPSHOT)
      expect(nodes.component, personId).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
    const admin = computeDailyLogCaps(canonicalActor("u-admin"), KHALID_PATH, READ)
    expect(visibleCaps(activityCatalogScreenNodes(admin, EMPTY_CATALOG_SNAPSHOT))).toContain(
      "activityCatalog.manage",
    )
  })

  it("**ق-١٠: لا زرَّ تقديمٍ فوق حصيلةٍ صفرية** — ويظهر فور وجود قيد", () => {
    const caps = computeDailyLogCaps(canonicalActor("u-amir"), KHALID_PATH, READ)
    expect(caps.has("report.submit")).toBe(true)

    const zero = visibleCaps(dailyLogScreenNodes(caps, EMPTY_DAILY_LOG_SNAPSHOT))
    expect(zero).not.toContain("report.submit")

    const withWork = visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST))
    expect(withWork).toContain("report.submit")
  })

  it("**وسحبُ الإقرار لا يظهر إلا بعد وجود ما يُسحب**", () => {
    const caps = computeDailyLogCaps(canonicalActor("u-amir"), KHALID_PATH, READ)
    expect(visibleCaps(dailyLogScreenNodes(caps, EMPTY_DAILY_LOG_SNAPSHOT))).not.toContain(
      "report.retract",
    )
    expect(visibleCaps(dailyLogScreenNodes(caps, WITH_HARVEST))).toContain("report.retract")
  })

  it("**والطالبُ والمعلّمُ لا يريان السجلَ أصلاً**: فراغٌ مُشخِّصٌ لا شاشةٌ بيضاء", () => {
    for (const personId of ["u-student", "u-teacher", "u-media"]) {
      const caps = computeDailyLogCaps(canonicalActor(personId), KHALID_PATH, READ)
      const nodes = dailyLogScreenNodes(caps, WITH_HARVEST)
      expect(nodes.component, personId).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })

  it("**وسببُ منع النقاط منطوقٌ لصاحبه** (ب-٣٢): دعوةُ ضبط العدد تظهر للأمير وحده", () => {
    const amir = computeDailyLogCaps(canonicalActor("u-amir"), KHALID_PATH, READ)
    expect(visibleCaps(dailyLogScreenNodes(amir, EMPTY_DAILY_LOG_SNAPSHOT))).toContain(
      "familyRoster.manage",
    )
    const admin = computeDailyLogCaps(canonicalActor("u-admin"), KHALID_PATH, READ)
    expect(visibleCaps(dailyLogScreenNodes(admin, EMPTY_DAILY_LOG_SNAPSHOT))).not.toContain(
      "familyRoster.manage",
    )
  })
})
