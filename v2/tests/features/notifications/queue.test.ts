/**
 * ق-٧٥ وت-٨/ت-٩ — **طابورٌ موحّدٌ بحمولةٍ مهيكلة، ومفتاحٌ طبيعيٌّ يمنع المضاعفة**
 * (عقدُ الوحدة §١ و§٣).
 *
 * الاعترافُ الذي وُلدت منه ق-٧٥ في v1 صريحٌ في السجل: «كان ناقصاً — صراحةً». فالحارسُ هنا
 * يقيس ثلاثة أشياء لا تُقاس بالنيّة: أنّ **البابَ واحد**، وأنّ **الحالةَ تولد `queued`**،
 * وأنّ **إعادةَ الحدث لا تُضاعف**.
 */
import { describe, it, expect } from "vitest"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { drainQueue } from "../../../src/features/notifications/services/queue.js"
import { linkChannel, startTelegramLink } from "../../../src/features/notifications/services/channels.js"
import {
  SQUARE_LAYER_TARGETS,
  channelsOverride,
  LINK_TTL,
  notificationContext,
  payload,
  personEvent,
  seedNotificationStore,
  submissionEvent,
} from "./_seed.js"

/** إشعارُ شخصٍ بعينه — تُستعمل حيث يُقاس سلوكُ الطابور على مستهدَفٍ واحدٍ معلوم. */
function notificationOf(store: ReturnType<typeof seedNotificationStore>, ownerId: string) {
  return store.notificationsFor(ownerId)[0]!
}

describe("ق-٧٥ — الحمولةُ مهيكلةٌ والحالةُ تولد `queued`", () => {
  it("الإشعارُ يُدرَج **queued** بحمولةٍ مهيكلةٍ كاملةِ الحقول — لا نصَّ خامٍّ عامّاً", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir"))

    const r = intake(
      personEvent("u-square", {
        kindId: "record.submitted",
        payload: payload({
          amount: { minor: 250_00, currency: "USD" },
          outcomeAr: "قُدِّم",
          reasonAr: "بلغ الهدف",
        }),
      }),
    )
    expect(r.ok).toBe(true)

    const n = notificationOf(store, "u-square")
    expect(n!.status).toBe("queued")
    expect(n!.kindId).toBe("record.submitted")
    expect(n!.payload.summaryAr.length).toBeGreaterThan(0)
    expect(n!.payload.amount).toEqual({ minor: 250_00, currency: "USD" })
    expect(n!.payload.outcomeAr).toBe("قُدِّم")
    expect(n!.payload.reasonAr).toBe("بلغ الهدف")
  })

  it("وخلاصةٌ فارغةٌ تُردّ — **لا إشعارَ بلا معنى** (وهو عينُ «لديك إشعارٌ جديد» في v1)", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir"))
    for (const summaryAr of ["", "   "]) {
      const r = intake(submissionEvent({ payload: payload({ summaryAr }) }))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("EMPTY_SUMMARY")
    }
    expect(store.notifications().length).toBe(0)
  })

  it("والقنواتُ **من الإعداد الحيّ** لا من قائمةٍ في الكود: سطرُ تسليمٍ لكل قناةٍ متاحة", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-amir", {
      settings: [LINK_TTL, channelsOverride(["bell"])],
    })
    const r = makeIntake(store, ctx)(personEvent())
    expect(r.ok).toBe(true)

    const deliveries = store.deliveriesOf(notificationOf(store, "u-square").id)
    expect(deliveries.map((d) => d.channel)).toEqual(["bell"])
    expect(deliveries.every((d) => d.status === "queued")).toBe(true)
  })

  it("وتيليغرام لا يُسلَّم إليه إلا لمن ربطه — **القناةُ تفصيلٌ خلف واجهة والمنطقُ واحد**", () => {
    const store = seedNotificationStore()
    const linker = notificationContext("u-square")
    const started = startTelegramLink(store, linker)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(
      linkChannel(store, linker, {
        channel: "telegram",
        externalId: "tg-777",
        token: started.value.token,
      }).ok,
    ).toBe(true)

    const r = makeIntake(store, notificationContext("u-amir"))(personEvent())
    expect(r.ok).toBe(true)
    const channels = store.deliveriesOf(notificationOf(store, "u-square").id).map((d) => d.channel)
    expect(channels).toContain("bell")
    expect(channels).toContain("telegram")
    expect(channels).not.toContain("push")
  })
})

describe("ت-٨ — idempotency: إعادةُ الحدث نفسِه ⇒ إشعارٌ واحد", () => {
  it("الحدثُ نفسُه ثلاثَ مرات ⇒ **إشعارٌ واحد**، والإعادةُ تُعلَن `deduplicated` لا تُبتلع", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir"))

    const first = intake(personEvent())
    const second = intake(personEvent())
    const third = intake(personEvent())

    expect(first.ok && second.ok && third.ok).toBe(true)
    if (first.ok) expect(first.value.deduplicated).toBe(false)
    if (second.ok) expect(second.value.deduplicated).toBe(true)
    if (third.ok) expect(third.value.deduplicated).toBe(true)
    expect(store.notifications().length).toBe(1)
  })

  it("والمفتاحُ الطبيعيُّ **أربعةُ أركان**: تغيّرُ أيٍّ منها حدثٌ آخر يستحقّ إشعاره", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir"))

    intake(personEvent())
    intake(personEvent("u-square", { refId: "act-2" }))
    intake(personEvent("u-square", { windowKey: "w30" }))
    intake(personEvent("u-square", { kindId: "visit.due" }))
    expect(store.notifications().length).toBe(4)

    // والركنُ الأول (الشخص) يُميّز كذلك: **مستهدَفان ⇒ إشعاران** بمفتاحين مختلفين.
    const twoTargets = seedNotificationStore()
    const r = makeIntake(twoTargets, notificationContext("u-amir"))(submissionEvent())
    expect(r.ok).toBe(true)
    expect(twoTargets.notifications().length).toBe(SQUARE_LAYER_TARGETS.length)
    expect(new Set(twoTargets.notifications().map((n) => n.naturalKey)).size).toBe(
      twoTargets.notifications().length,
    )
  })

  it("**وإعادةُ محاولة التسليم لا تُضاعف**: المُسلَّمُ لا يُسلَّم مرتين", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const sent: string[] = []
    const deliverers = { bell: () => { sent.push("bell"); return true } }

    drainQueue(store, deliverers)
    drainQueue(store, deliverers)
    drainQueue(store, deliverers)

    expect(sent.length).toBe(1)
    expect(store.deliveriesOf(notificationOf(store, "u-square").id)[0]!.status).toBe("delivered")
  })
})

describe("ت-٩ — عزلُ الخطوات: تعثُّرُ قناةٍ لا يمنع إيصالَ البواقي", () => {
  it("قناةٌ ترمي ⇒ تُوسَم `failed` بسببها، **والأخرى تُسلَّم** في التصريف نفسِه", () => {
    const store = seedNotificationStore()
    const linker = notificationContext("u-square")
    const started = startTelegramLink(store, linker)
    if (!started.ok) throw new Error(started.error.code)
    linkChannel(store, linker, {
      channel: "telegram",
      externalId: "tg-777",
      token: started.value.token,
    })
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const report = drainQueue(store, {
      bell: () => true,
      telegram: () => {
        throw new Error("مزوّدٌ غيرُ متاح")
      },
    })

    expect(report.delivered).toBe(1)
    expect(report.failed).toBe(1)
    const byChannel = new Map(
      store.deliveriesOf(notificationOf(store, "u-square").id).map((d) => [d.channel, d]),
    )
    expect(byChannel.get("bell")!.status).toBe("delivered")
    expect(byChannel.get("telegram")!.status).toBe("failed")
    expect(byChannel.get("telegram")!.lastErrorAr).toContain("مزوّد")
    expect(byChannel.get("telegram")!.attempts).toBe(1)
  })

  it("وقناةٌ بلا منفذٍ محقون تبقى في الطابور — **لا تُبتلع ولا تُوسَم مُسلَّمة**", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)
    const report = drainQueue(store, {})
    expect(report.delivered).toBe(0)
    expect(report.skipped).toBeGreaterThan(0)
    expect(store.deliveriesOf(notificationOf(store, "u-square").id)[0]!.status).toBe("queued")
  })

  it("**والفشلُ يبقى فشلاً حتى يُعالَج**: التصريفُ الثاني لا يُعيد محاولةَ ما فشل صامتاً", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const first = drainQueue(store, {
      bell: () => {
        throw new Error("تعذّر الإيصال")
      },
    })
    expect(first.failed).toBe(1)

    // لا **إعادةَ آلية** هنا: الطابورُ لا يُجدوِل نفسه (بند المهمة ٧) — الحالُ معلنةٌ لمن يقرؤها.
    const second = drainQueue(store, { bell: () => true })
    expect(second.delivered).toBe(0)
    expect(notificationOf(store, "u-square").status).toBe("queued")
  })
})
