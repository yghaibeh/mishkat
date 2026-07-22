/**
 * حالاتُ الحواف — **الأطرافُ التي تُكتشف في الإنتاج إن لم تُقَس هنا** (TESTING_POLICY §٤ الطبقة
 * الثالثة: «تُكتب يدوياً فهي أذكى من التوليد»).
 *
 * وأكثرُها هنا **مساراتُ الفشل الصامت**: إعدادٌ لا يُقرأ · قناةٌ ترفض بلا رمي · تسليمٌ يتيم ·
 * قاموسان يتباعدان. كلُّها حالاتٌ **تمرّ صامتةً** لو لم يُقَس أثرُها — وهي عين ما جعل ت-٨/ت-٩
 * دروساً مدفوعةَ الثمن في v1 («ابتلاعٌ صامتٌ يحجب الطابور»).
 */
import { describe, it, expect } from "vitest"
import { NotificationStore } from "../../../src/features/notifications/data/store.js"
import { channelDrift, enabledChannels, linkChannel, myChannels, startTelegramLink } from "../../../src/features/notifications/services/channels.js"
import { drainQueue } from "../../../src/features/notifications/services/queue.js"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { myNotifications } from "../../../src/features/notifications/services/inbox.js"
import { makeCapabilityAnswer } from "../../../src/features/notifications/services/targeting.js"
import {
  projectAnnouncementsSnapshot,
  projectInboxSnapshot,
} from "../../../src/features/notifications/screens/screens.js"
import { publishAnnouncement } from "../../../src/features/notifications/services/announcements.js"
import { notifyErr, notifyOk } from "../../../src/features/notifications/types.js"
import type { NotificationContext } from "../../../src/features/notifications/services/context.js"
import type { SettingsResolver } from "../../../src/settings/resolver.js"
import {
  DECISION,
  KINDS,
  NOW,
  channelsOverride,
  notificationContext,
  notificationPorts,
  personEvent,
  seedNotificationStore,
} from "./_seed.js"

/** سياقٌ بمُحلِّلِ إعداداتٍ **يرمي** — يحاكي إعداداً غيرَ مسجَّلٍ أو بلا قيمة (ق-م-٢). */
function contextWithBlindSettings(actorPersonId: string): NotificationContext {
  const blind: SettingsResolver = () => {
    throw new Error("إعدادٌ بلا قيمةٍ مضبوطة")
  }
  return {
    now: NOW,
    settings: blind,
    actorPersonId,
    holdsCapability: makeCapabilityAnswer(DECISION),
    ports: notificationPorts(),
  }
}

describe("الإعدادُ الذي لا يُقرأ **يُقفل ولا يُفتح** (ق-م-٢)", () => {
  it("مُحلِّلٌ يرمي ⇒ لا رمزَ ربطٍ يُصدَر — استثناءٌ يُترجَم قيمةَ رفضٍ لا يعبر الحدّ", () => {
    const store = seedNotificationStore()
    const r = startTelegramLink(store, contextWithBlindSettings("u-square"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("LINK_TTL_UNSET")
  })

  it("**وحجمُ الصفحةِ غيرُ المقروء يعني لا صفحة** — لا رقمَ يُخترع عند الغياب", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const view = myNotifications(store, contextWithBlindSettings("u-square"))
    expect(view.items).toEqual([])
    // **والعدّادُ يبقى صادقاً**: الطابورُ فيه إشعارٌ ينتظر ولو تعذّر عرضُ صفحته.
    expect(view.unreadCount).toBe(1)
  })

  it("وقيمةُ إعدادٍ ليست قائمةً ⇒ **لا قناةَ مفعَّلة** — فلا ربطَ ولا تسليم", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square", {
      settings: [{ ...channelsOverride([]), value: "bell" }],
    })
    expect(enabledChannels(ctx)).toEqual([])
    const r = linkChannel(store, ctx, { channel: "push", externalId: "ep-a", token: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("CHANNEL_NOT_ENABLED")
  })

  it("و**عمرٌ مضبوطٌ بغير عدد** يُعدّ غيرَ مضبوط — لا تأويلَ لقيمةٍ من نوعٍ آخر", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square", {
      settings: [
        {
          settingId: "notify.telegram_link_ttl_minutes",
          scopePath: "/",
          value: "ربعُ ساعة",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const r = startTelegramLink(store, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("LINK_TTL_UNSET")
  })

  it("وقيمةٌ فيها قناةٌ خارج القاموس المشتقّ ⇒ **تُسقَط ولا تُقبل**", () => {
    const ctx = notificationContext("u-square", {
      settings: [channelsOverride(["bell", "fax"])],
    })
    expect(enabledChannels(ctx)).toEqual(["bell"])
  })
})

describe("ت-٩ — الفشلُ يُعلَن بكل صوره: رميٌ · رفضٌ · يتيم", () => {
  it("**قناةٌ ترفض بلا رمي** تُوسَم `failed` بسببٍ منصوص — لا نجاحٌ صامت", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const report = drainQueue(store, { bell: () => false })
    expect(report.failed).toBe(1)
    const delivery = store.deliveries()[0]!
    expect(delivery.status).toBe("failed")
    expect(delivery.lastErrorAr).not.toBeNull()
    expect(delivery.attempts).toBe(1)
  })

  it("و**رميةٌ ليست خطأً** تُسجَّل نصّاً كما هي — لا `[object Object]` في السجل", () => {
    const store = seedNotificationStore()
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)
    drainQueue(store, {
      bell: () => {
        throw "انقطاعُ شبكة"
      },
    })
    expect(store.deliveries()[0]!.lastErrorAr).toBe("انقطاعُ شبكة")
  })

  it("**وسطرُ تسليمٍ يتيمٌ يُتخطّى ولا يُسقط التصريف** — عزلُ الخطوات (ت-٩)", () => {
    const store = seedNotificationStore()
    store.saveDelivery({
      tenantId: store.tenantId,
      id: "orphan|bell",
      notificationId: "لا-إشعار",
      channel: "bell",
      status: "queued",
      attempts: 0,
      lastErrorAr: null,
    })
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)

    const report = drainQueue(store, { bell: () => true })
    expect(report.delivered).toBe(1)
    expect(report.skipped).toBe(1)
  })
})

describe("مستودعُ الوحدة — مراجعُه ومفاتيحُه", () => {
  it("كتالوجُ الأنواع يُقرأ كاملاً (بياناتٌ مرجعية)، والمفتاحُ الطبيعيُّ المجهولُ يعيد `null`", () => {
    const store = seedNotificationStore()
    expect(store.kinds().length).toBe(KINDS.length)
    expect(store.findByNaturalKey("لا-مفتاح")).toBeNull()
    expect(store.getKind("لا-نوع")).toBeNull()
    expect(store.getUnit("لا-وحدة")).toBeNull()
    expect(store.getAnnouncement("لا-إعلان")).toBeNull()
    expect(store.tokenById("لا-رمز")).toBeNull()
  })

  it("و**قنواتي مرتَّبةٌ حتمياً** حين تتعدّد — فلا يختلف ترتيبُ لوحةٍ بين تشغيلين", () => {
    const store = new NotificationStore("t-main")
    const ctx = notificationContext("u-square")
    expect(linkChannel(store, ctx, { channel: "push", externalId: "ep-b", token: null }).ok).toBe(true)
    const started = startTelegramLink(store, ctx)
    if (!started.ok) throw new Error(started.error.code)
    expect(
      linkChannel(store, ctx, {
        channel: "telegram",
        externalId: "tg-1",
        token: started.value.token,
      }).ok,
    ).toBe(true)

    const listed = myChannels(store, ctx)
    expect(listed.length).toBe(2)
    expect(listed.map((c) => c.id)).toEqual([...listed.map((c) => c.id)].sort())
  })

  it("ورمزٌ **لقناةٍ أخرى** لا يُقبل لهذه — الرمزُ يعرف قناتَه (ع-١٦)", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    const started = startTelegramLink(store, ctx)
    if (!started.ok) throw new Error(started.error.code)
    const r = linkChannel(store, ctx, {
      channel: "push",
      externalId: "ep-a",
      token: started.value.token,
    })
    // القناةُ لا تطلب إثباتاً أصلاً، فالرمزُ يُهمَل ولا يُستهلَك: الحارسُ لقناته وحدها.
    expect(r.ok).toBe(true)
    expect(store.tokenById(started.value.token)!.consumedAt).toBeNull()
  })
})

describe("حارسُ تباعد المصدرين يُجرَّب على مدخلٍ متباعدٍ فعليّ (قب-١٥)", () => {
  it("قناةٌ في السجل بلا مقابلٍ في الاتحاد — والعكس — كلاهما **يُرصد**", () => {
    expect(channelDrift(["bell", "telegram"], ["bell", "telegram"])).toEqual([])
    expect(channelDrift(["bell", "sms"], ["bell"])).toEqual(["sms"])
    expect(channelDrift(["bell"], ["bell", "push"])).toEqual(["push"])
  })
})

describe("طبقةُ العرض: إسقاطٌ لا حساب (ق-١١١)", () => {
  it("لقطةُ «إشعاراتي وقنواتي» تُسقِط النموذجَ كما هو — بلا رقمٍ يُعاد حسابُه", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    expect(makeIntake(store, notificationContext("u-amir"))(personEvent()).ok).toBe(true)
    expect(linkChannel(store, ctx, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(true)

    const snapshot = projectInboxSnapshot(myNotifications(store, ctx), myChannels(store, ctx), {
      unitLabelAr: "المربع الثاني",
      scopePath: "/men/homs/sq2/",
    })
    expect(snapshot.notificationRows.length).toBe(1)
    expect(snapshot.notificationRows[0]!.summary).toBe("نتيجةُ فعلك وصلت")
    expect(snapshot.channelRows.length).toBe(1)
    expect(snapshot.channelRows[0]!.channel).toBe("push")
    expect(snapshot.unreadCountAr.length).toBeGreaterThan(0)
    expect(snapshot.scopePath).toBe("/men/homs/sq2/")
  })

  it("ولقطةُ «الإعلانات» كذلك — والعنوانُ يصل كما كُتب لا كما يُعاد صوغُه", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    const published = publishAnnouncement(store, ctx, {
      unitId: "sq2",
      titleAr: "اجتماعُ أمراء المربع",
      bodyAr: "الخميس بعد العشاء",
      audience: "subtree",
    })
    if (!published.ok) throw new Error(published.error.code)

    const snapshot = projectAnnouncementsSnapshot([published.value], {
      unitLabelAr: "المربع الثاني",
      scopePath: "/men/homs/sq2/",
    })
    expect(snapshot.announcementRows.length).toBe(1)
    expect(snapshot.announcementRows[0]!.title).toBe("اجتماعُ أمراء المربع")
    expect(snapshot.announcementRows[0]!.unit).toBe("sq2")
  })
})

describe("قيمُ النتيجة المعلنة (المادة ٣/٤)", () => {
  it("الخطأُ بلا تفصيلٍ وبتفصيل شكلان معلنان — والنجاحُ يحمل قيمتَه", () => {
    expect(notifyErr("NO_TARGETS")).toEqual({ ok: false, error: { code: "NO_TARGETS" } })
    expect(notifyErr("NO_TARGETS", "س")).toEqual({
      ok: false,
      error: { code: "NO_TARGETS", detail: "س" },
    })
    expect(notifyOk("ق")).toEqual({ ok: true, value: "ق" })
  })
})
