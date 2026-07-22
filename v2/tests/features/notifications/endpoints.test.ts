/**
 * سطوحُ الوحدة الثمانية — `SPEC_authorization` §٥.٢ وعقدُ الوحدة §٧.
 *
 * ثلاثةُ ثوابتٍ تُقاس هنا:
 *  ١. **الإعلانُ إلزاميّ** (G7): قدرةٌ ونطاقٌ ونيّةٌ واسمُ تدقيقٍ على كل نقطة.
 *  ٢. **النيابةُ مستحيلةٌ قبل جسم الدالة** (ق-٢٧/قب-٣٨): القدرةُ شخصيةٌ ونطاقُها ملكيّة —
 *     والمديرُ كغيره، بلا فرعٍ يقول «إن كان مديراً».
 *  ٣. **`NO_SCOPE` يُقفل ولا يُفتح**: الكيانُ غيرُ الموجود رفضٌ لا فراغ.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeNotificationEndpoints } from "../../../src/features/notifications/server/endpoints.js"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  DECISION,
  LINK_TTL,
  WRITE,
  canonicalActor,
  notificationContext,
  notificationPorts,
  personEvent,
  seedNotificationStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([LINK_TTL])

function endpointsWithInbox() {
  const store = seedNotificationStore()
  const seeded = makeIntake(store, notificationContext("u-amir"))(personEvent("u-square"))
  if (!seeded.ok) throw new Error(seeded.error.code)
  return { store, ep: makeNotificationEndpoints(store, SETTINGS, notificationPorts()) }
}

beforeEach(() => clearRegistryForTests())

describe("الإعلانُ الإلزاميّ على كل سطح (G7)", () => {
  it("ثمانيةُ سطوحٍ، كلٌّ بقدرةٍ ونطاقٍ ونيّةٍ واسمِ تدقيق — ولا سطحَ تاسع", () => {
    const { ep } = endpointsWithInbox()
    const declared = Object.values(ep).map((fn) => fn.declaration)

    expect(declared.length).toBe(8)
    for (const d of declared) {
      expect(d.capability, d.name).toBeDefined()
      expect(d.scope, d.name).toBeDefined()
      expect(d.audit.length, d.name).toBeGreaterThan(0)
    }
    expect(declared.map((d) => d.name).sort()).toEqual(
      [
        "announcements.inbox",
        "announcements.open",
        "announcements.publish",
        "notifications.channel.link",
        "notifications.channels.mine",
        "notifications.mine",
        "notifications.read",
        "notifications.telegram.linkStart",
      ].sort(),
    )
    // القدراتُ المستهلَكةُ اثنتان لا ثالثة (عقدُ الوحدة §٧).
    expect([...new Set(declared.map((d) => d.capability))].sort()).toEqual([
      "account.self",
      "announcement.publish",
    ])
  })
})

describe("«إشعاراتي» ملكيةٌ لا نيابة (ك-٣٥ + ق-٢٧ + قب-٣٨)", () => {
  it("صاحبُها يقرؤها، **والمديرُ لا يقرأ إشعاراتِ غيره** — رفضٌ قبل جسم الدالة", async () => {
    const { ep } = endpointsWithInbox()

    const own = await ep.mine.invoke({ personId: "u-square" }, canonicalActor("u-square"), DECISION)
    expect(own.ok).toBe(true)

    const byProxy = await ep.mine.invoke({ personId: "u-square" }, canonicalActor("u-admin"), DECISION)
    expect(byProxy.ok).toBe(false)
    if (!byProxy.ok) expect(byProxy.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("**ووسمُ إشعارِ غيرك يُردّ من نطاق الخادم** — النطاقُ مشتقٌّ من الإشعار المخزَّن", async () => {
    const { store, ep } = endpointsWithInbox()
    const target = store.notifications()[0]!

    const stranger = await ep.read.invoke(
      { notificationId: target.id },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(stranger.ok).toBe(false)
    if (!stranger.ok) expect(stranger.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")

    const owner = await ep.read.invoke({ notificationId: target.id }, canonicalActor("u-square"), WRITE)
    expect(owner.ok).toBe(true)
  })

  it("**وإشعارٌ مجهولٌ ⇒ `NO_SCOPE` ⇒ رفض** — يُقفل ولا يُفتح", async () => {
    const { ep } = endpointsWithInbox()
    const r = await ep.read.invoke({ notificationId: "لا-إشعار" }, canonicalActor("u-square"), WRITE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })
})

describe("**النطاقُ الغائبُ رفضٌ لا فراغ** — `NO_SCOPE` على كل مُحلِّلٍ في الوحدة", () => {
  it("مدخلٌ بلا دعوى ملكيةٍ وبلا كيانٍ ⇒ رفضٌ في كل السطوح — لا مسارَ يفتح عند النقص", async () => {
    const { ep } = endpointsWithInbox()
    const actor = canonicalActor("u-square")
    const blanks: readonly { readonly name: string; readonly call: () => Promise<{ ok: boolean }> }[] = [
      { name: "notifications.mine", call: () => ep.mine.invoke({} as never, actor, DECISION) },
      { name: "notifications.read", call: () => ep.read.invoke({} as never, actor, WRITE) },
      { name: "notifications.telegram.linkStart", call: () => ep.linkStart.invoke({} as never, actor, WRITE) },
      { name: "notifications.channel.link", call: () => ep.link.invoke({} as never, actor, WRITE) },
      { name: "notifications.channels.mine", call: () => ep.myChannels.invoke({} as never, actor, DECISION) },
      { name: "announcements.publish", call: () => ep.publish.invoke({} as never, actor, WRITE) },
      { name: "announcements.inbox", call: () => ep.inbox.invoke({} as never, actor, DECISION) },
      { name: "announcements.open", call: () => ep.open.invoke({} as never, actor, DECISION) },
    ]
    for (const blank of blanks) {
      const r = await blank.call()
      expect(r.ok, blank.name).toBe(false)
    }
  })
})

describe("قنواتي: إصدارُ الرمز وربطُ القناة بنطاقٍ شخصيّ", () => {
  it("الرمزُ يُصدَر لصاحبه وحده — والطلبُ باسم غيره مرفوضٌ قبل الجسم (خ-٣ الطبقةُ الأولى)", async () => {
    const { ep } = endpointsWithInbox()

    const mine = await ep.linkStart.invoke({ personId: "u-square" }, canonicalActor("u-square"), WRITE)
    expect(mine.ok).toBe(true)

    const proxy = await ep.linkStart.invoke({ personId: "u-square" }, canonicalActor("u-admin"), WRITE)
    expect(proxy.ok).toBe(false)
    if (!proxy.ok) expect(proxy.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("والربطُ يمرّ بالخدمة فيعيد **قيمةَ خطأٍ مصنَّفة** لا استثناءً عابراً للحدّ", async () => {
    const { ep } = endpointsWithInbox()
    const r = await ep.link.invoke(
      { personId: "u-square", channel: "telegram", externalId: "tg-1", token: null },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.ok).toBe(false)
      if (!r.value.ok) expect(r.value.error.code).toBe("LINK_PROOF_REQUIRED")
    }
  })

  it("و«قنواتي» تعرض المفعَّلَ والمربوطَ لصاحبها — مصدرُ لوحة الشاشة الواحد", async () => {
    const { ep } = endpointsWithInbox()
    const r = await ep.myChannels.invoke({ personId: "u-square" }, canonicalActor("u-square"), DECISION)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.enabled.length).toBeGreaterThan(0)
      expect(r.value.linked).toEqual([])
    }
  })
})

describe("الإعلانات: النشرُ منطاقٌ والقراءةُ مفلترة (ح-٥)", () => {
  it("النشرُ نطاقُه **من الوحدة المخزَّنة** — ووحدةٌ مجهولةٌ ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const { ep } = endpointsWithInbox()
    const r = await ep.publish.invoke(
      { unitId: "لا-وحدة", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**ومسؤولُ مربعٍ لا ينشر على مربعٍ ليس نطاقَه** — الفرضُ في الخادم لا في الواجهة", async () => {
    const { ep } = endpointsWithInbox()
    const inside = await ep.publish.invoke(
      { unitId: "sq2", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(inside.ok).toBe(true)

    const outside = await ep.publish.invoke(
      { unitId: "sq7", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(outside.ok).toBe(false)
    if (!outside.ok) expect(outside.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**والطالبُ لا ينشر** — لا يملك القدرةَ أصلاً (جدولُ الغياب §٣)", async () => {
    const { ep } = endpointsWithInbox()
    const r = await ep.publish.invoke(
      { unitId: "sq2", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
      canonicalActor("u-student"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**وفتحُ إعلانِ نطاقٍ آخر يُردّ من الخادم** (ح-٥ الطبقةُ الثانية)", async () => {
    const { ep } = endpointsWithInbox()
    const published = await ep.publish.invoke(
      { unitId: "sq2", titleAr: "عنوان", bodyAr: "نصّ", audience: "subtree" },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(published.ok).toBe(true)
    if (!published.ok || !published.value.ok) throw new Error("تعذّر النشر")
    const id = published.value.value.id

    const outsider = await ep.open.invoke(
      { personId: "u-amir-omar", announcementId: id },
      canonicalActor("u-amir-omar"),
      DECISION,
    )
    expect(outsider.ok).toBe(true)
    if (outsider.ok) {
      expect(outsider.value.ok).toBe(false)
      if (!outsider.value.ok) expect(outsider.value.error.code).toBe("OUT_OF_ANNOUNCEMENT_AUDIENCE")
    }

    const inboxOfOutsider = await ep.inbox.invoke(
      { personId: "u-amir-omar" },
      canonicalActor("u-amir-omar"),
      DECISION,
    )
    expect(inboxOfOutsider.ok).toBe(true)
    if (inboxOfOutsider.ok) expect(inboxOfOutsider.value).toEqual([])
  })
})
