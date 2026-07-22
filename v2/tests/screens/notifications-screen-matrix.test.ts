/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات الإشعارات والإعلانات**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — الاختبارُ الإلزاميُّ التاسع في T21.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **وخصوصيةُ هذه الوحدة**: أكثرُ سطوحها **شخصيّ** (`account.self` يملكه كلُّ دور)، فالسلبُ
 * فيها ليس «لا يملك القدرة» بل **«ليس صاحبَ الكيان»** — ولذلك تُستدعى الأفعالُ الشخصية
 * **بالنيابة عن غير صاحبها** فتُردّ من الخادم (ق-٢٧/قب-٣٨). وهذا هو الشكلُ الحقيقيُّ لسلبِ
 * القدرة الشخصية، وقياسُه بـ«لا يملكها» كان سيُخضِر اختباراً بلا حراسة.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`box` و`media`): لا إطارَ واجهةٍ في v2
 * بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم،
 * لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { makeNotificationEndpoints } from "../../src/features/notifications/server/endpoints.js"
import { makeIntake } from "../../src/features/notifications/services/intake.js"
import { publishAnnouncement } from "../../src/features/notifications/services/announcements.js"
import { computeNotificationCaps } from "../../src/features/notifications/screens/caps.js"
import {
  ANNOUNCEMENTS_CONTRACT,
  EMPTY_NOTIFY_SNAPSHOT,
  NOTIFICATIONS_CONTRACT,
  announcementsScreenNodes,
  notificationsScreenNodes,
} from "../../src/features/notifications/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { NotificationStore } from "../../src/features/notifications/data/store.js"
import {
  DECISION,
  KHALID_PATH,
  LINK_TTL,
  SQUARE_PATH,
  WRITE,
  canonicalActor,
  notificationContext,
  notificationPorts,
  seedNotificationStore,
  submissionEvent,
} from "../features/notifications/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول (`guardedBy`). و`derived` **ليست قدرةً** بل حقٌّ مشتقّ، فتُستثنى (§٢.١٢/٣).
 */
function visibleCaps(root: UiNode): readonly string[] {
  const out = new Set<string>()
  for (const block of screenContentNodes(root)) {
    for (const n of walkNodes(block)) {
      if (n.capability !== null && n.capability !== "derived") out.add(n.capability)
      const guarded = n.meta.guardedBy
      if (guarded !== undefined) {
        for (const cap of guarded.split(",")) if (cap !== "derived") out.add(cap)
      }
    }
  }
  return [...out]
}

const SETTINGS = createSettingsResolver([LINK_TTL])

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

type Ep = ReturnType<typeof makeNotificationEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  /** استدعاءٌ يجب أن يُردّ لمن غاب عنه العنصر (أو **لغير صاحب الكيان** في الشخصيّ). */
  readonly serverInvoke: (ep: Ep, f: RoleFixture) => Promise<{ ok: boolean }>
}

/** عالمٌ فيه إشعارٌ لـ`u-square` وإعلانٌ على المربع الثاني — كيانانِ لهما صاحبٌ معلوم. */
function seedWorld(): { store: NotificationStore; announcementId: string; notificationId: string } {
  const store = seedNotificationStore()
  const emitted = makeIntake(store, notificationContext("u-amir"))(submissionEvent())
  if (!emitted.ok) throw new Error(emitted.error.code)
  const published = publishAnnouncement(store, notificationContext("u-square"), {
    unitId: "sq2",
    titleAr: "اجتماعُ أمراء المربع",
    bodyAr: "الخميس بعد العشاء",
    audience: "subtree",
  })
  if (!published.ok) throw new Error(published.error.code)
  const mine = store.notificationsFor("u-square")[0]
  if (mine === undefined) throw new Error("لم يصل الإشعارُ صاحبَه المتوقَّع")
  return { store, announcementId: published.value.id, notificationId: mine.id }
}

/** الأفعالُ المنطاقة: الحضورُ = القدرةُ على نطاق الشاشة، والغيابُ مقرونٌ برفض الخادم. */
const SCOPED_AFFORDANCES: readonly Affordance[] = [
  {
    screen: ANNOUNCEMENTS_CONTRACT.route,
    element: "نموذجُ «أنشرُ إعلاناً»",
    cap: "announcement.publish",
    shown: (caps) =>
      visibleCaps(announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)).includes(
        "announcement.publish",
      ),
    serverInvoke: (ep, f) =>
      ep.publish.invoke(
        { unitId: "sq2", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: NOTIFICATIONS_CONTRACT.route,
    element: "نموذجُ ربط القناة",
    cap: "account.self",
    shown: (caps) =>
      visibleCaps(notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)).includes("account.self"),
    // الشخصيُّ يُستدعى **بالنيابة عن صاحبه** — فيُردّ لكل من ليس هو (ق-٢٧/قب-٣٨).
    serverInvoke: (ep, f) =>
      ep.linkStart.invoke({ personId: "u-square" }, canonicalActor(f.personId), WRITE),
  },
]

/** أفعالٌ **سلبيةٌ بالتعريف**: كلُّ من ليس صاحبَ الكيان يُردّ — والصاحبُ وحده يمرّ. */
type OwnershipProbe = {
  readonly element: string
  readonly owner: string
  readonly invoke: (
    ep: Ep,
    f: RoleFixture,
    ids: { readonly announcementId: string; readonly notificationId: string },
  ) => Promise<{ ok: boolean }>
}

const OWNERSHIP_PROBES: readonly OwnershipProbe[] = [
  {
    element: "«إشعاراتي» لصاحبها",
    owner: "u-square",
    invoke: (ep, f) => ep.mine.invoke({ personId: "u-square" }, canonicalActor(f.personId), DECISION),
  },
  {
    element: "وسمُ إشعارٍ مقروءاً",
    owner: "u-square",
    invoke: (ep, f, ids) =>
      ep.read.invoke({ notificationId: ids.notificationId }, canonicalActor(f.personId), WRITE),
  },
  {
    element: "«قنواتي» لصاحبها",
    owner: "u-square",
    invoke: (ep, f) =>
      ep.myChannels.invoke({ personId: "u-square" }, canonicalActor(f.personId), DECISION),
  },
]

describe("مصفوفةُ شاشتَي الإشعارات — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة، والغياب (أو غيابُ الملكية) مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      const caps = computeNotificationCaps(canonicalActor(f.personId), SQUARE_PATH, DECISION)

      for (const a of SCOPED_AFFORDANCES) {
        clearRegistryForTests()
        const seeded = seedWorld()
        const ep = makeNotificationEndpoints(seeded.store, SETTINGS, notificationPorts())

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)

        const r = await a.serverInvoke(ep, f)
        // الشخصيُّ: يمرّ لصاحبه وحده. والمنطاق: يمرّ لمن يملك القدرةَ على نطاق الوحدة.
        if (r.ok) {
          positives += 1
        } else {
          negatives += 1
        }
        if (!allowed) {
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }

      for (const probe of OWNERSHIP_PROBES) {
        clearRegistryForTests()
        const seeded = seedWorld()
        const ep = makeNotificationEndpoints(seeded.store, SETTINGS, notificationPorts())
        const r = await probe.invoke(ep, f, seeded)
        const isOwner = f.personId === probe.owner
        expect(r.ok, `${probe.element} · ${f.label}`).toBe(isOwner)
        if (isOwner) positives += 1
        else negatives += 1
      }
    }

    console.log(`[مصفوفة شاشات الإشعارات] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**«إشعاراتي» بابٌ لكل مسجَّل** — الجدولُ حقٌّ مشتقّ يظهر لكل دورٍ حيّ (ك-٣٥)", () => {
    for (const f of ROLE_FIXTURES) {
      const caps = computeNotificationCaps(canonicalActor(f.personId), KHALID_PATH, DECISION)
      expect(caps.has("account.self"), f.label).toBe(true)
      const nodes = notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)
      const guards = walkNodes(nodes)
        .map((n) => n.meta.guardedBy)
        .filter((g): g is string => g !== undefined)
      expect(guards, f.label).toContain("derived")
    }
  })

  it("**والقراءةُ بلا قدرةٍ عمداً**: لا شاشةَ تُعلن قدرةَ عرضٍ للإشعار أو للإعلان", () => {
    const caps = computeNotificationCaps(canonicalActor("u-admin"), SQUARE_PATH, DECISION)
    const declared = [
      ...visibleCaps(notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)),
      ...visibleCaps(announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)),
    ]
    for (const cap of declared) {
      expect(cap).not.toMatch(/(?:notification|announcement)s?\.view/)
    }
    expect([...new Set(declared)].sort()).toEqual(["account.self", "announcement.publish"])
  })

  it("**ومن لا ينشر يقرأ ولا يجد نموذجاً معطَّلاً** (ق-١٠٩): الطالبُ يرى القائمةَ لا النموذج", () => {
    const caps = computeNotificationCaps(canonicalActor("u-student"), SQUARE_PATH, DECISION)
    const nodes = announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT)
    expect(visibleCaps(nodes)).not.toContain("announcement.publish")
    const forms = walkNodes(nodes).filter((n) => n.component === "Form")
    expect(forms).toEqual([])
  })

  it("**والفراغُ مِحرابٌ مُشخِّصٌ بصفر صورة** (قب-٢٥/ق-١١٢) على الشاشتين", () => {
    const caps = computeNotificationCaps(canonicalActor("u-square"), SQUARE_PATH, DECISION)
    for (const nodes of [
      notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
      announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
    ]) {
      const empties = walkNodes(nodes).filter((n) => n.component === "EmptyState")
      expect(empties.length).toBeGreaterThan(0)
      for (const e of empties) {
        expect(e.meta.diagnostic).toBe("true")
        expect(e.meta.motif).toBe("mihrab")
        expect(e.meta.assets).toBe("none")
      }
    }
  })

  it("**والجدولُ يقول حالَه**: صفوفٌ ⇒ «بيانات»، وفراغٌ ⇒ «فارغٌ مُشخِّص» — لا حالةَ صامتة", () => {
    const caps = computeNotificationCaps(canonicalActor("u-square"), SQUARE_PATH, DECISION)
    const filled = {
      ...EMPTY_NOTIFY_SNAPSHOT,
      unreadCountAr: "١",
      notificationRows: [{ kind: "record.submitted", summary: "سجلٌّ ينتظر بتَّك", when: "٢٩" }],
      channelRows: [{ channel: "telegram", externalId: "tg-1", linkedAt: "٢٩" }],
      announcementRows: [{ title: "اجتماع", unit: "sq2", publishedAt: "٢٩" }],
    }
    for (const nodes of [
      notificationsScreenNodes(caps, filled),
      announcementsScreenNodes(caps, filled),
    ]) {
      const tables = walkNodes(nodes).filter((n) => n.component === "DataTable")
      expect(tables.length).toBeGreaterThan(0)
      for (const t of tables) expect(t.meta.state).toBe("data")
    }
    for (const nodes of [
      notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
      announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
    ]) {
      for (const t of walkNodes(nodes).filter((n) => n.component === "DataTable")) {
        expect(t.meta.state).toBe("empty")
      }
    }
  })

  it("**ومن لا يملك الخدمةَ الذاتية أصلاً يرى تشخيصاً** لا شاشةً بيضاء", () => {
    const nodes = notificationsScreenNodes(new Set<CapId>(), EMPTY_NOTIFY_SNAPSHOT)
    expect(nodes.component).toBe("EmptyState")
    expect(nodes.meta.diagnostic).toBe("true")
  })
})
