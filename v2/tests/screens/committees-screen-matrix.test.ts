/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات اللجان والاجتماعات**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — وهي الاختبارُ الإلزاميّ السابع في T12.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`ledger` و`box`): لا إطارَ واجهةٍ في
 * v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم،
 * لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { makeCommitteeEndpoints } from "../../src/features/committees/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import {
  computeCommitteeCaps,
  computeCommitteeScreenCaps,
} from "../../src/features/committees/screens/caps.js"
import {
  committeesScreenNodes,
  myCommitteeScreenNodes,
  meetingsScreenNodes,
  projectCommitteesSnapshot,
  projectMeetingsSnapshot,
  projectMyCommitteeSnapshot,
  EMPTY_COMMITTEE_SNAPSHOT,
} from "../../src/features/committees/screens/screens.js"
import { formCommittee } from "../../src/features/committees/services/committees.js"
import { can } from "../../src/authorization/can.js"
import { unitScope } from "../../src/authorization/scope.js"
import { recordMeeting } from "../../src/features/committees/services/meetings.js"
import { addMember } from "../../src/features/committees/services/members.js"
import { recordActivity } from "../../src/features/committees/services/activities.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { CommitteeStore } from "../../src/features/committees/data/store.js"
import {
  KHALID,
  KHALID_PATH,
  NOW,
  PERIOD,
  READ,
  RELIEF,
  WRITE,
  canonicalActor,
  committeeContext,
  seedCommitteeStore,
} from "../features/committees/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول (`guardedBy`) — فالجدولُ المحروسُ بقدرةٍ عنصرٌ يظهر لصاحبها.
 * وتُستثنى القشرةُ (شريطُ التنقّل) فلها حارسُها المستقلّ (ق-١١٤).
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

type Ep = ReturnType<typeof makeCommitteeEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, f: RoleFixture) => Promise<{ ok: boolean }>
}

function seedWorld(): CommitteeStore {
  const store = seedCommitteeStore()
  formCommittee(store, committeeContext("u-amir"), {
    id: RELIEF.id,
    mosqueUnitId: KHALID,
    labelAr: RELIEF.labelAr,
    headPersonId: RELIEF.headPersonId,
    headNameAr: RELIEF.headNameAr,
  })
  addMember(store, committeeContext(RELIEF.headPersonId), {
    committeeId: RELIEF.id,
    nameAr: "عبد الله",
  })
  recordActivity(store, committeeContext(RELIEF.headPersonId), {
    committeeId: RELIEF.id,
    periodId: PERIOD,
    titleAr: "توزيعُ سلال",
    participantCount: 1,
    participantNamesAr: ["عبد الله"],
    completedAt: new Date("2026-07-19T00:00:00.000Z"),
  })
  recordMeeting(store, committeeContext("u-amir"), {
    mosqueUnitId: KHALID,
    heldAt: new Date("2026-07-18T00:00:00.000Z"),
    minutesAr: "محضرُ الجلسة",
    decisionsAr: ["قرارٌ أول", "قرارٌ ثانٍ"],
  })
  return store
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/family/committees",
    element: "لوحُ لجان المسجد (العدّادُ والجدول)",
    cap: "committees.view",
    shown: (caps) =>
      visibleCaps(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT)).includes("committees.view"),
    serverInvoke: (ep, f) => ep.list.invoke({ unitId: KHALID }, canonicalActor(f.personId), READ),
  },
  {
    screen: "/family/committees",
    element: "نموذجُ «تشكيلُ لجنة»",
    cap: "committees.manage",
    shown: (caps) =>
      visibleCaps(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT)).includes("committees.manage"),
    serverInvoke: (ep, f) =>
      ep.form.invoke(
        {
          unitId: KHALID,
          committeeId: `cm-${f.personId}`,
          labelAr: "لجنةٌ جديدة",
          headPersonId: null,
          headNameAr: "فلان",
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/my-committee",
    element: "لوحُ «لجنتي» بأنشطتها وأعضائها",
    cap: "committee.own",
    shown: (caps) =>
      visibleCaps(myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT)).includes("committee.own"),
    serverInvoke: (ep, f) =>
      ep.myCommittee.invoke({ committeeId: RELIEF.id }, canonicalActor(f.personId), READ),
  },
  {
    screen: "/family/meetings",
    element: "لوحُ الاجتماعات (المحاضرُ والقرارات)",
    cap: "meetings.view",
    shown: (caps) =>
      visibleCaps(meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT)).includes("meetings.view"),
    serverInvoke: (ep, f) => ep.meetings.invoke({ unitId: KHALID }, canonicalActor(f.personId), READ),
  },
  {
    screen: "/family/meetings",
    element: "نموذجُ «تسجيلُ محضر»",
    cap: "meetings.manage",
    shown: (caps) =>
      visibleCaps(meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT)).includes("meetings.manage"),
    serverInvoke: (ep, f) =>
      ep.recordMeeting.invoke(
        { unitId: KHALID, heldAt: NOW, minutesAr: "محضر", decisionsAr: ["قرار"] },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
]

/** قشرةُ قدرات الشاشة لهذا الدور — **من دالة الإنتاج نفسِها** لا من نسخةٍ في الاختبار. */
function screenCaps(store: CommitteeStore, personId: string): ReadonlySet<CapId> {
  return computeCommitteeScreenCaps(store, canonicalActor(personId), KHALID_PATH, READ)
}

describe("مصفوفةُ شاشات اللجان — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const store = seedWorld()
        const ep = makeCommitteeEndpoints(store, SETTINGS)
        const caps = screenCaps(store, f.personId)

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

    console.log(`[مصفوفة شاشات اللجان] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى ولا يشغّل**: اللجانُ والاجتماعاتُ تظهر له، ونموذجاهما غائبان", async () => {
    clearRegistryForTests()
    const store = seedWorld()
    const ep = makeCommitteeEndpoints(store, SETTINGS)
    const caps = screenCaps(store, "u-admin")

    expect(visibleCaps(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).toContain(
      "committees.view",
    )
    expect(visibleCaps(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).not.toContain(
      "committees.manage",
    )
    expect(visibleCaps(meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).not.toContain(
      "meetings.manage",
    )
    const listed = await ep.list.invoke({ unitId: KHALID }, canonicalActor("u-admin"), READ)
    expect(listed.ok).toBe(true)
  })

  it("**ومسؤولُ اللجنة لا يرى قائمةَ لجان المسجد** — يرى «لجنتي» وحدها (§٢.٧ محظورُه #٣٠)", () => {
    const store = seedWorld()
    const caps = screenCaps(store, "u-committee-head")
    expect(caps.has("committee.own")).toBe(true)
    expect(caps.has("committees.view")).toBe(false)
    expect(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT).component).toBe("EmptyState")
    expect(meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT).component).toBe("EmptyState")
    expect(visibleCaps(myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).toContain(
      "committee.own",
    )
  })

  it("**والأميرُ لا يرى «لجنتي»** — القدرةُ الشخصيةُ ملكيةٌ لا سلطة (عيبُ T5 المُصطاد)", () => {
    const store = seedWorld()
    const caps = screenCaps(store, "u-amir")
    expect(caps.has("committee.own")).toBe(false)
    expect(myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT).component).toBe("EmptyState")
  })

  it("**والقدرةُ الشخصيةُ لا تُسأل بنطاقٍ أصلاً**: `can()` يردّها لصاحبها نفسِه بنطاق وحدة", () => {
    const decision = can(
      canonicalActor(RELIEF.headPersonId),
      "committee.own",
      unitScope(KHALID_PATH),
      READ,
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
    // ولذلك لا تدخل الحسابَ المنطاق أصلاً — ومصدرُها الوحيد الملكية.
    expect(computeCommitteeCaps(canonicalActor(RELIEF.headPersonId), KHALID_PATH, READ)).not.toContain(
      "committee.own",
    )
  })

  it("**ومَن قاد لجنةً نالها، ومَن لم يقد فلا** — الملكيةُ هي المصدر", () => {
    const store = seedWorld()
    expect(screenCaps(store, RELIEF.headPersonId).has("committee.own")).toBe(true)
    for (const personId of ["u-amir", "u-admin", "u-teacher", "u-student"]) {
      expect(screenCaps(store, personId).has("committee.own"), personId).toBe(false)
    }
  })

  it("**والطالبُ والمعلّمُ والإعلاميُّ والماليُّ: ثلاثُ شاشاتٍ كلُّها فراغٌ مُشخِّص**", () => {
    const store = seedWorld()
    for (const personId of ["u-student", "u-teacher", "u-media", "u-finance"]) {
      const caps = screenCaps(store, personId)
      for (const nodes of [
        committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
        myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
        meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
      ]) {
        expect(nodes.component, personId).toBe("EmptyState")
        expect(nodes.meta.diagnostic).toBe("true")
      }
    }
  })
})

describe("إسقاطُ اللقطة — تنسيقٌ لا حساب، ومصدرٌ واحدٌ لكل شاشة (ق-١١١)", () => {
  it("لجانُ النطاق تُسقَط باسمها ومسؤولها، وعدّادُها من طول القائمة نفسِها", () => {
    const store = seedWorld()
    const snapshot = projectCommitteesSnapshot({
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      committees: [...store.committees()],
    })
    expect(snapshot.committeeRows).toHaveLength(1)
    expect(snapshot.committeeRows[0]!.head).toBe(RELIEF.headNameAr)
    expect(snapshot.activeCommitteesAr).toBe("١")
  })

  it("و«لجنتي» تُسقط أنشطتَها بتاريخٍ هجريّ (ق-١١٧) وأعضاءَها بأسمائهم الحرّة", () => {
    const store = seedWorld()
    const committee = store.getCommittee(RELIEF.id)!
    const snapshot = projectMyCommitteeSnapshot({
      committee,
      members: store.members(),
      activities: store.activities(),
    })
    expect(snapshot.memberRows[0]!.name).toBe("عبد الله")
    expect(snapshot.activityRows[0]!.completedAt).toMatch(/هـ/)
    expect(snapshot.participantsAr).toBe("١")
    expect(snapshot.scopePath).toBe(committee.path)
  })

  it("والمحاضرُ تُسقط بتاريخها وعددِ قراراتها، والعدّادُ مجموعُ القرارات", () => {
    const store = seedWorld()
    const snapshot = projectMeetingsSnapshot({
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      meetings: [...store.meetings()],
    })
    expect(snapshot.meetingRows).toHaveLength(1)
    expect(snapshot.decisionsCountAr).toBe("٢")
  })

  it("واللقطةُ الفارغةُ تعرض محرفَ الغياب لا صفراً وهمياً (ق-١١٢: قاعدةُ الصفر)", () => {
    expect(EMPTY_COMMITTEE_SNAPSHOT.activeCommitteesAr).toBe("—")
    expect(EMPTY_COMMITTEE_SNAPSHOT.decisionsCountAr).toBe("—")
  })
})

describe("حالةُ الجدول تتبع بياناتَه — «فارغ» بلا صفوف و«بيانات» معها (§٣-١)", () => {
  /** حالاتُ الجداول في محتوى الشاشة — الفراغُ المُشخِّص شرطٌ في كليهما (G20). */
  function tableStates(root: UiNode): readonly string[] {
    const out: string[] = []
    for (const block of screenContentNodes(root)) {
      for (const n of walkNodes(block)) {
        if (n.component === "DataTable") out.push(n.meta.state!)
      }
    }
    return out
  }

  it("لجانُ المسجد: «فارغ» بلا لجان و«بيانات» مع لجنة — وفراغُ صاحب العمل دعوةُ فعل", () => {
    const store = seedWorld()
    const caps = screenCaps(store, "u-amir")
    expect(tableStates(committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).toEqual(["empty"])

    const filled = projectCommitteesSnapshot({
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      committees: [...store.committees()],
    })
    expect(tableStates(committeesScreenNodes(caps, filled))).toEqual(["data"])
  })

  it("و«لجنتي»: جدولا الأنشطة والأعضاء يتبعان صفوفَهما", () => {
    const store = seedWorld()
    const caps = screenCaps(store, "u-committee-head")
    expect(tableStates(myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT))).toEqual([
      "empty",
      "empty",
    ])

    const filled = projectMyCommitteeSnapshot({
      committee: store.getCommittee(RELIEF.id)!,
      members: store.members(),
      activities: store.activities(),
    })
    expect(tableStates(myCommitteeScreenNodes(caps, filled))).toEqual(["data", "data"])
  })

  it("والاجتماعاتُ كذلك — وللمطّلع بلا إدارةٍ فراغٌ تشخيصيٌّ لا دعوةُ فعل", () => {
    const store = seedWorld()
    const owner = screenCaps(store, "u-amir")
    const viewer = screenCaps(store, "u-admin")
    expect(tableStates(meetingsScreenNodes(owner, EMPTY_COMMITTEE_SNAPSHOT))).toEqual(["empty"])

    const filled = projectMeetingsSnapshot({
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      meetings: [...store.meetings()],
    })
    expect(tableStates(meetingsScreenNodes(viewer, filled))).toEqual(["data"])

    const emptyForViewer = screenContentNodes(meetingsScreenNodes(viewer, EMPTY_COMMITTEE_SNAPSHOT))
      .flatMap((b) => walkNodes(b))
      .find((n) => n.component === "EmptyState")
    expect(emptyForViewer?.meta.audience).toBe("viewer")
  })
})
