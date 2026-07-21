/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات العُهد** (TESTING_POLICY §٤، G9) — وهي الاختبارُ
 * الإلزاميّ الثامن في T14.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org`/`ledger`/`box`): لا إطارَ واجهةٍ في v2
 * بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم.
 */
import { describe, it, expect } from "vitest"
import { makeCustodyEndpoints } from "../../src/features/custody/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { computeCustodyCaps, hasOwnCustody } from "../../src/features/custody/screens/caps.js"
import {
  custodyScopeScreenNodes,
  myCustodyScreenNodes,
  statusBadge,
  EMPTY_CUSTODY_SNAPSHOT,
} from "../../src/features/custody/screens/screens.js"
import type { CustodyStatus } from "../../src/features/custody/services/derive.js"
import { recordCustodyMove } from "../../src/features/custody/services/chain.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { CustodyStore } from "../../src/features/custody/data/store.js"
import {
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  DECISION,
  KHALID_PATH,
  seedAsset,
  seedCustodyStore,
  WRITE,
} from "../features/custody/_seed.js"

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

type Ep = ReturnType<typeof makeCustodyEndpoints>
type World = { readonly store: CustodyStore; readonly assetId: string; readonly moveId: string }

/** عالمُ المصفوفة: أصلٌ في مسجد خالد **بيد المعلّم بانتظار إقراره**. */
function seedWorld(): World {
  const store = seedCustodyStore()
  const assetId = seedAsset(store, "khalid", "حاسوبٌ محمول")
  const handed = recordCustodyMove(store, custodyContext("u-amir"), {
    assetId,
    action: "hand",
    toPersonId: "u-teacher",
    conditionAr: "سليم",
  })
  if (!handed.ok) throw new Error(handed.error.code)
  return { store, assetId, moveId: handed.value.id }
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
    screen: "/custody",
    element: "لوحُ عُهد النطاق (الأصولُ وحائزوها وحالاتُهم)",
    cap: "custody.view",
    shown: (caps) =>
      visibleCaps(custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("custody.view"),
    serverInvoke: (ep, _w, f) =>
      ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/custody",
    element: "نموذجُ تسجيل أصلٍ جديد",
    cap: "asset.manage",
    shown: (caps) =>
      visibleCaps(custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("asset.manage"),
    serverInvoke: (ep, _w, f) =>
      ep.register.invoke(
        { unitId: "khalid", labelAr: "كاميرا" },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/custody",
    element: "تحريرُ سجلّ الأصل الوصفيّ",
    cap: "asset.manage",
    shown: (caps) =>
      visibleCaps(custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("asset.manage"),
    serverInvoke: (ep, w, f) =>
      ep.amend.invoke(
        { assetId: w.assetId, fields: { noteAr: "ملاحظة" } },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/custody",
    element: "نموذجُ حركة السلسلة (تسليم/نقل/إعادة/تلف/فقد/إخراج)",
    cap: "custody.grant",
    shown: (caps) =>
      visibleCaps(custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("custody.grant"),
    serverInvoke: (ep, w, f) =>
      ep.move.invoke(
        {
          assetId: w.assetId,
          action: "hand",
          toPersonId: "u-committee-head",
          conditionAr: "سليم",
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/custody/mine",
    element: "جدولُ «عُهدتي»",
    cap: "custody.own",
    shown: (caps) =>
      visibleCaps(myCustodyScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("custody.own"),
    // السلبُ هنا **صفحةُ غيره**: «عُهدتي» صفحةُ صاحبها وحده (نطاقٌ شخصيّ).
    serverInvoke: (ep, _w, f) =>
      ep.mine.invoke({ personId: "u-teacher" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/custody/mine",
    element: "زرُّ «استلمتُ» (ق-٧٩)",
    cap: "custody.own",
    shown: (caps) =>
      visibleCaps(myCustodyScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT)).includes("custody.own"),
    serverInvoke: (ep, w, f) =>
      ep.acknowledge.invoke({ moveId: w.moveId }, canonicalActor(f.personId), WRITE),
  },
]

describe("مصفوفةُ شاشات العُهد — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const w = seedWorld()
        const ep = makeCustodyEndpoints(w.store, canonicalDirectory)
        const actor = canonicalActor(f.personId)
        const caps = computeCustodyCaps(actor, KHALID_PATH, DECISION, hasOwnCustody(w.store, actor.personId))

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

    console.log(`[مصفوفة شاشات العُهد] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى ولا يشغّل**: لوحُ العُهد يظهر له، وكلُّ فعلٍ غائبٌ — و«عُهدتي» ليست بابَه", async () => {
    clearRegistryForTests()
    const w = seedWorld()
    const ep = makeCustodyEndpoints(w.store, canonicalDirectory)
    const actor = canonicalActor("u-admin")
    const caps = computeCustodyCaps(actor, KHALID_PATH, DECISION, hasOwnCustody(w.store, actor.personId))
    const shown = visibleCaps(custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT))

    expect(shown).toContain("custody.view")
    expect(shown).not.toContain("custody.grant")
    expect(shown).not.toContain("asset.manage")
    expect(visibleCaps(myCustodyScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT))).not.toContain("custody.own")

    const viewed = await ep.scopeView.invoke({ unitId: "khalid" }, actor, DECISION)
    expect(viewed.ok).toBe(true)
  })

  it("**و«عُهدتي» لا تظهر لمن لا عهدةَ بيده** — القدرةُ الشخصية تُسقَط بالملكية لا بالدور", () => {
    const w = seedWorld()
    // الأميرُ يملك `custody.own` في المصفوفة، ولا عهدةَ بيده ⇒ لا بابَ شخصيّ.
    const amir = canonicalActor("u-amir")
    const amirCaps = computeCustodyCaps(amir, KHALID_PATH, DECISION, hasOwnCustody(w.store, amir.personId))
    expect(amirCaps.has("custody.own")).toBe(false)

    // والمعلّمُ بيده عهدةٌ ⇒ البابُ له وحده.
    const teacher = canonicalActor("u-teacher")
    const teacherCaps = computeCustodyCaps(
      teacher,
      KHALID_PATH,
      DECISION,
      hasOwnCustody(w.store, teacher.personId),
    )
    expect(teacherCaps.has("custody.own")).toBe(true)
    expect(visibleCaps(myCustodyScreenNodes(teacherCaps, EMPTY_CUSTODY_SNAPSHOT))).toContain(
      "custody.own",
    )
  })

  it("**والحجبُ يغلب حتى على صاحب العهدة** (§١.٤): بابُه الشخصيُّ يُقفل وإن كانت بيده", () => {
    const w = seedWorld()
    const teacher = canonicalActor("u-teacher")
    const blocked = {
      ...teacher,
      overrides: [
        {
          capId: "custody.own" as const,
          scopePath: "/",
          effect: "deny" as const,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "حجبٌ مؤقّتٌ أثناء تحقيقٍ في عهدةٍ مفقودة",
        },
      ],
    }
    expect(hasOwnCustody(w.store, blocked.personId)).toBe(true)
    const caps = computeCustodyCaps(blocked, KHALID_PATH, DECISION, true)
    expect(caps.has("custody.own")).toBe(false)
  })

  it("**والحالُ لا يُحمَل بلونٍ وحده**: لكل حالةٍ شارةٌ بنصٍّ وأيقونةٍ معاً (§٤-٥)", () => {
    const statuses: readonly CustodyStatus[] = [
      "inUnit",
      "pendingAck",
      "held",
      "damaged",
      "lost",
      "retired",
    ]
    const seen = new Set<string>()
    for (const status of statuses) {
      const node = statusBadge(status)
      expect(node.component).toBe("Badge")
      expect(node.textKeys.length).toBeGreaterThan(0)
      expect((node.meta.icon ?? "").length).toBeGreaterThan(0)
      seen.add(node.textKeys[0] ?? "")
    }
    // ولكل حالةٍ نصُّها هي — لا حالتان تُقرآن سواءً.
    expect(seen.size).toBe(statuses.length)
  })

  it("والشارةُ تظهر في لوح النطاق لمن يرى العُهد", () => {
    const teacherless = { ...EMPTY_CUSTODY_SNAPSHOT, statuses: ["pendingAck"] as const }
    const caps = computeCustodyCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION, false)
    const nodes = custodyScopeScreenNodes(caps, teacherless)
    const badges = [...walkNodes(nodes)].filter((n) => n.component === "Badge")
    expect(badges).toHaveLength(1)
  })

  it("**والطالبُ لا يرى شيئاً من العُهد**: الشاشتان فراغٌ مُشخِّص", () => {
    const w = seedWorld()
    const actor = canonicalActor("u-student")
    const caps = computeCustodyCaps(actor, KHALID_PATH, DECISION, hasOwnCustody(w.store, actor.personId))
    for (const nodes of [
      custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT),
      myCustodyScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })
})
