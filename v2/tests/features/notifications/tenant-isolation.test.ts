/**
 * قب-١٨ — **عزلُ الشبكة بنيويّ** (عقدُ الوحدة §١٠).
 *
 * الشبكتان في هذا الاختبار **بنفس المسارات النسبيّة عمداً**: فلو كان العزلُ شرطاً في `if`
 * لتسرّب عند التطابق. وهو هنا **بنية**: الطلبُ يُوجَّه إلى مستودع شبكته، و`tenantId` مشتقٌّ
 * من المستودع لا من مدخل العميل — **صفر قدرةٍ جديدة وصفر فرعِ شبكةٍ في المحرّك**.
 */
import { describe, it, expect } from "vitest"
import { NotificationTenantRegistry } from "../../../src/features/notifications/data/tenant.js"
import { NotificationStore } from "../../../src/features/notifications/data/store.js"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { myNotifications } from "../../../src/features/notifications/services/inbox.js"
import {
  myAnnouncements,
  openAnnouncement,
  publishAnnouncement,
} from "../../../src/features/notifications/services/announcements.js"
import { linkChannel, myChannels } from "../../../src/features/notifications/services/channels.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import {
  KINDS,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
  notificationContext,
  seedNotificationStore,
  submissionEvent,
} from "./_seed.js"

function seedInto(store: NotificationStore): NotificationStore {
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: store.tenantId, id: u.id, ar: u.ar, path: u.path })
  }
  for (const k of KINDS) store.saveKind({ tenantId: store.tenantId, ...k })
  return store
}

describe("قب-١٨ — لا مِقبضَ عابرٌ بين شبكتين", () => {
  it("مستودعُ الشبكة يُنشأ مرةً ويُعاد هو نفسُه، وشبكتان مستودعان مختلفان", () => {
    const registry = new NotificationTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(a)
    expect(registry.storeFor(SECOND_TENANT_ID)).not.toBe(a)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has("t-ghayr")).toBe(false)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID].sort())
  })

  it("**والشبكةُ تُختم من المستودع لا من المدخل**: كيانٌ يدّعي شبكةً أخرى يُكتب بشبكة مستودعه", () => {
    const store = new NotificationStore(SECOND_TENANT_ID)
    store.saveUnit({ tenantId: MAIN_TENANT_ID, id: "khalid", ar: "مسجد", path: "/men/homs/sq2/khalid/" })
    expect(store.getUnit("khalid")!.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**إشعارُ شبكةٍ لا يظهر في «إشعاراتي» بأخرى** ولو تطابق المسارُ والشخص", () => {
    const main = seedNotificationStore(MAIN_TENANT_ID)
    const second = seedInto(new NotificationStore(SECOND_TENANT_ID))

    const r = makeIntake(main, notificationContext("u-amir"))(submissionEvent())
    expect(r.ok).toBe(true)

    expect(myNotifications(main, notificationContext("u-square")).items.length).toBe(1)
    expect(myNotifications(second, notificationContext("u-square")).items.length).toBe(0)
    expect(main.notifications()[0]!.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("**وإعلانُ شبكةٍ لا يُقرأ من أخرى** ولو كان القارئُ في جمهور نطاقه المطابق", () => {
    const main = seedNotificationStore(MAIN_TENANT_ID)
    const second = seedInto(new NotificationStore(SECOND_TENANT_ID))
    const ctx = notificationContext("u-square")

    const published = publishAnnouncement(main, ctx, {
      unitId: "sq2",
      titleAr: "شأنُ الشبكة الأولى",
      bodyAr: "لا يخصّ غيرَها",
      audience: "subtree",
    })
    if (!published.ok) throw new Error(published.error.code)

    expect(myAnnouncements(main, ctx).length).toBe(1)
    expect(myAnnouncements(second, ctx).length).toBe(0)

    const crossed = openAnnouncement(second, ctx, { announcementId: published.value.id })
    expect(crossed.ok).toBe(false)
    if (!crossed.ok) expect(crossed.error.code).toBe("ANNOUNCEMENT_NOT_FOUND")
  })

  it("**وقناةٌ مملوكةٌ في شبكةٍ لا تُعدّ مملوكةً في أخرى** — الملكيةُ داخل الشبكة (خ-٣ + قب-١٨)", () => {
    const main = seedNotificationStore(MAIN_TENANT_ID)
    const second = seedInto(new NotificationStore(SECOND_TENANT_ID))
    const owner = notificationContext("u-square")
    const other = notificationContext("u-amir")

    expect(linkChannel(main, owner, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(true)
    expect(linkChannel(main, other, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(false)
    // وفي الشبكة الثانية المعرّفُ نفسُه حرٌّ — فلا حالةَ عابرةٌ بين المستودعين.
    expect(linkChannel(second, other, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(true)

    expect(myChannels(main, owner).length).toBe(1)
    expect(myChannels(second, owner).length).toBe(0)
  })
})
