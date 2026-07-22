/**
 * ك-٣٥ — **الإشعارُ كيانٌ مشتقٌّ بلا قدرة عرض** (عقدُ الوحدة §٧، `SPEC_authorization` §٢.١٣).
 *
 * «إشعاراتي» **حقٌّ مشتقّ**: لا `notification.view` تُخترع، والحراسةُ **ملكيةٌ** لا قدرةُ عرض.
 * ومقاومةُ التضخّم قاعدةٌ معلنة: *قدرةٌ لا يحرسها سيناريو منعٍ حقيقيّ لا تُخترع.*
 */
import { describe, it, expect } from "vitest"
import { CAP_IDS } from "../../../src/authorization/generated/capabilities.generated.js"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { markRead, myNotifications } from "../../../src/features/notifications/services/inbox.js"
import {
  BILAL_PATH,
  notificationContext,
  payload,
  seedNotificationStore,
  submissionEvent,
} from "./_seed.js"

const AUDIENCE_CAP = "report.view" as const

function seedInbox() {
  const store = seedNotificationStore()
  const emitter = makeIntake(store, notificationContext("u-amir"))
  const first = emitter(submissionEvent())
  if (!first.ok) throw new Error(first.error.code)
  const second = emitter({
    kindId: "visit.due",
    refId: "bilal",
    windowKey: "w29",
    audience: { mode: "capabilityOnScope", scopePath: BILAL_PATH, capability: AUDIENCE_CAP },
    payload: payload({ summaryAr: "مسجد بلال يستحقّ زيارة" }),
  })
  if (!second.ok) throw new Error(second.error.code)
  return store
}

describe("ك-٣٥ — «إشعاراتي» حقٌّ مشتقّ: لا قدرةَ عرضٍ تُخترع", () => {
  it("**الكتالوجُ خالٍ من `notification.view` و`announcement.view`** — والنفيُ يُقاس لا يُوعَد", () => {
    for (const invented of ["notification.view", "notifications.view", "announcement.view"]) {
      expect(CAP_IDS as readonly string[], invented).not.toContain(invented)
    }
  })

  it("والحراسةُ **ملكيةٌ**: كلٌّ يرى طابورَه هو لا طابورَ غيره", () => {
    const store = seedInbox()
    expect(myNotifications(store, notificationContext("u-square")).items.length).toBe(1)
    expect(myNotifications(store, notificationContext("u-amir-bilal")).items.length).toBe(1)
    expect(myNotifications(store, notificationContext("u-admin")).items.length).toBe(0)
  })

  it("وعددُ غير المقروء **مشتقٌّ عند القراءة** لا عدّادٌ مخزَّن (درسُ ق-٦٠)", () => {
    const store = seedInbox()
    const owner = notificationContext("u-square")
    const before = myNotifications(store, owner)
    expect(before.unreadCount).toBe(1)

    const target = before.items[0]!
    expect(markRead(store, owner, { notificationId: target.id }).ok).toBe(true)
    const after = myNotifications(store, owner)
    expect(after.unreadCount).toBe(0)
    expect(after.items[0]!.status).toBe("read")
  })

  it("**ووسمُ إشعارِ غيرك مرفوض** — دفاعٌ في العمق خلف النطاق الشخصيّ (خ-٣ نظيراً)", () => {
    const store = seedInbox()
    const mine = myNotifications(store, notificationContext("u-square")).items[0]!
    const r = markRead(store, notificationContext("u-amir"), { notificationId: mine.id })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("NOT_NOTIFICATION_OWNER")
    expect(myNotifications(store, notificationContext("u-square")).unreadCount).toBe(1)
  })

  it("ووسمُ المقروءِ ثانيةً **عمليةٌ خاملة**، والمجهولُ يُردّ بسببه", () => {
    const store = seedInbox()
    const owner = notificationContext("u-square")
    const target = myNotifications(store, owner).items[0]!
    expect(markRead(store, owner, { notificationId: target.id }).ok).toBe(true)
    expect(markRead(store, owner, { notificationId: target.id }).ok).toBe(true)
    expect(myNotifications(store, owner).unreadCount).toBe(0)

    const missing = markRead(store, owner, { notificationId: "لا-إشعار" })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe("NOTIFICATION_NOT_FOUND")
  })

  it("والترتيبُ حتميّ والحجمُ **إعدادٌ حيّ** — لا رقمَ صفحةٍ صلب (قب-٦/G14)", () => {
    const store = seedNotificationStore()
    const emitter = makeIntake(store, notificationContext("u-amir"))
    for (let i = 0; i < 4; i += 1) {
      const r = emitter(submissionEvent({ refId: `khalid|w${i}`, windowKey: `w${i}` }))
      if (!r.ok) throw new Error(r.error.code)
    }

    const owner = notificationContext("u-square", {
      settings: [
        {
          settingId: "platform.page_size.default",
          scopePath: "/",
          value: 2,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const page = myNotifications(store, owner)
    expect(page.items.length).toBe(2)
    // الأحدثُ أولاً، والتعادلُ يُكسر بالمعرّف — فناتجُ تشغيلين واحد.
    expect(page.items.map((n) => n.refId)).toEqual(["khalid|w3", "khalid|w2"])
    // والعددُ غيرُ المقروء **على الطابور كلِّه** لا على الصفحة (وإلا كذب الجرس).
    expect(page.unreadCount).toBe(4)
  })
})
