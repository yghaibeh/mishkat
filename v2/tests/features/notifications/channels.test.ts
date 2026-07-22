/**
 * ع-١٦ وخ-٣ — **عمرٌ معلنٌ يشرح نفسه، وملكيةٌ لا يُستولى عليها** (عقدُ الوحدة §٤).
 *
 * ع-١٦ بلاغُ ميدانٍ بلسان العميل: «دخلت للبوت فقال: رابط منتهٍ أو غير صحيح». وجذرُه أن
 * العمرَ لم يكن **معلناً** ولا **مشروحاً**. فالحارسُ هنا يقيس ثلاثاً: أن العمرَ **من الإعداد**،
 * وأن الرسالةَ **تحمل المدة**، وأن غيرَ المضبوط **يُقفل ولا يُفتح**.
 *
 * وخ-٣ ثغرةُ v1 الحمراء: `set({personId})` على قناةٍ قائمة = **استيلاءٌ بمعرّفٍ منقول**.
 */
import { describe, it, expect } from "vitest"
import {
  enabledChannels,
  linkChannel,
  myChannels,
  startTelegramLink,
} from "../../../src/features/notifications/services/channels.js"
import {
  LINK_TTL,
  NOW,
  TTL_MINUTES,
  channelsOverride,
  notificationContext,
  seedNotificationStore,
  ttlOverride,
} from "./_seed.js"

/** لحظةٌ بعد انقضاء العمر المضبوط — تُبنى بجبرِ الدقائق لا بثابتٍ زمنيّ مكتوب. */
function minutesAfter(at: Date, minutes: number): Date {
  const out = new Date(at.getTime())
  out.setUTCMinutes(out.getUTCMinutes() + minutes)
  return out
}

describe("ع-١٦ — رمزُ الربط: عمرٌ من الإعداد، ورسالةٌ تشرح المدة", () => {
  it("الرمزُ يُصدَر بعمرٍ **من الإعداد الحيّ** — والانتهاءُ يُحسب منه لا من رقمٍ صلب", () => {
    const store = seedNotificationStore()
    const r = startTelegramLink(store, notificationContext("u-square"))
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.value.ttlMinutes).toBe(TTL_MINUTES)
    expect(r.value.expiresAt).toEqual(minutesAfter(NOW, TTL_MINUTES))
  })

  it("**وتغييرُ الإعداد يغيّر العمرَ والرسالةَ معاً** — فالمدةُ ليست رقماً في الكود", () => {
    for (const minutes of [5, 45]) {
      const store = seedNotificationStore()
      const ctx = notificationContext("u-square", { settings: [ttlOverride(minutes)] })
      const issued = startTelegramLink(store, ctx)
      expect(issued.ok).toBe(true)
      if (!issued.ok) return
      expect(issued.value.ttlMinutes).toBe(minutes)
      expect(issued.value.expiresAt).toEqual(minutesAfter(NOW, minutes))

      // ثم يُستعمل **بعد** انقضائه: الرسالةُ تحمل **المدةَ المضبوطة** فتشرح لماذا انتهى.
      const late = notificationContext("u-square", {
        settings: [ttlOverride(minutes)],
        now: minutesAfter(NOW, minutes + 1),
      })
      const used = linkChannel(store, late, {
        channel: "telegram",
        externalId: "tg-1",
        token: issued.value.token,
      })
      expect(used.ok).toBe(false)
      if (!used.ok) {
        expect(used.error.code).toBe("LINK_TOKEN_EXPIRED")
        expect(used.error.detail).toBe(String(minutes))
      }
    }
  })

  it("والرمزُ **قبل** انقضائه يُقبل — فالحدُّ حدُّ انقضاءٍ لا حدُّ إصدار", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    const issued = startTelegramLink(store, ctx)
    if (!issued.ok) throw new Error(issued.error.code)

    const justBefore = notificationContext("u-square", { now: minutesAfter(NOW, TTL_MINUTES - 1) })
    expect(
      linkChannel(store, justBefore, {
        channel: "telegram",
        externalId: "tg-1",
        token: issued.value.token,
      }).ok,
    ).toBe(true)
  })

  it("**والعمرُ غيرُ المضبوط يُقفل ولا يُفتح**: لا رمزَ بعمرٍ مخترع (ق-م-٢)", () => {
    const store = seedNotificationStore()
    const r = startTelegramLink(store, notificationContext("u-square", { settings: [] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("LINK_TTL_UNSET")
    expect(store.tokens().length).toBe(0)
  })

  it("والرمزُ يُستهلك مرةً واحدة — والثانيةُ سببُها **مختلفٌ عن الانتهاء**", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    const issued = startTelegramLink(store, ctx)
    if (!issued.ok) throw new Error(issued.error.code)

    expect(
      linkChannel(store, ctx, { channel: "telegram", externalId: "tg-1", token: issued.value.token })
        .ok,
    ).toBe(true)
    const again = linkChannel(store, ctx, {
      channel: "telegram",
      externalId: "tg-2",
      token: issued.value.token,
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("LINK_TOKEN_CONSUMED")
  })

  it("ورمزٌ مجهولٌ ورمزُ غيرك: سببان **مُشخِّصان** لا رفضٌ واحدٌ مبهم", () => {
    const store = seedNotificationStore()
    const mine = notificationContext("u-square")
    const issued = startTelegramLink(store, mine)
    if (!issued.ok) throw new Error(issued.error.code)

    const unknown = linkChannel(store, mine, { channel: "telegram", externalId: "tg-1", token: "لا-رمز" })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("LINK_TOKEN_UNKNOWN")

    const other = linkChannel(store, notificationContext("u-amir"), {
      channel: "telegram",
      externalId: "tg-1",
      token: issued.value.token,
    })
    expect(other.ok).toBe(false)
    if (!other.ok) expect(other.error.code).toBe("LINK_TOKEN_NOT_OWNER")
  })

  it("وتيليغرام **لا يُربط بلا رمز**: معرّفُه يصل من خارج الجلسة فيلزم إثباتُ أنك أنت", () => {
    const store = seedNotificationStore()
    const r = linkChannel(store, notificationContext("u-square"), {
      channel: "telegram",
      externalId: "tg-9",
      token: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("LINK_PROOF_REQUIRED")
  })
})

describe("خ-٣ — لا يُستولى على قناةِ غيرك بمعرّفٍ منقول", () => {
  it("**ربطُ قناةٍ بمعرّفٍ يملكه غيرُك ⇒ مرفوض** — لا نقلَ ملكيةٍ ولا قطع", () => {
    const store = seedNotificationStore()
    const owner = notificationContext("u-square")
    const issued = startTelegramLink(store, owner)
    if (!issued.ok) throw new Error(issued.error.code)
    expect(
      linkChannel(store, owner, {
        channel: "telegram",
        externalId: "tg-777",
        token: issued.value.token,
      }).ok,
    ).toBe(true)

    // مهاجمٌ يعرف المعرّفَ ويحمل رمزَ نفسِه الصحيح — ومع ذلك يُردّ.
    const attacker = notificationContext("u-amir")
    const attackerToken = startTelegramLink(store, attacker)
    if (!attackerToken.ok) throw new Error(attackerToken.error.code)
    const stolen = linkChannel(store, attacker, {
      channel: "telegram",
      externalId: "tg-777",
      token: attackerToken.value.token,
    })
    expect(stolen.ok).toBe(false)
    if (!stolen.ok) expect(stolen.error.code).toBe("CHANNEL_OWNED_BY_ANOTHER")

    // والملكيةُ لم تتزحزح، ورمزُ المهاجم **لم يُستهلك** بفعلٍ مرفوض.
    expect(myChannels(store, owner).map((c) => c.externalId)).toEqual(["tg-777"])
    expect(myChannels(store, attacker)).toEqual([])
    expect(store.tokenById(attackerToken.value.token)!.consumedAt).toBeNull()
  })

  it("وإشعارُ المتصفح كذلك: اشتراكٌ يملكه غيرُك ⇒ مرفوض (وهو موضعُ خ-٣ الأصليّ)", () => {
    const store = seedNotificationStore()
    const owner = notificationContext("u-square")
    expect(
      linkChannel(store, owner, { channel: "push", externalId: "https://push/endpoint-a", token: null })
        .ok,
    ).toBe(true)

    const stolen = linkChannel(store, notificationContext("u-amir"), {
      channel: "push",
      externalId: "https://push/endpoint-a",
      token: null,
    })
    expect(stolen.ok).toBe(false)
    if (!stolen.ok) expect(stolen.error.code).toBe("CHANNEL_OWNED_BY_ANOTHER")
  })

  it("وربطُ ما تملكه أصلاً **عمليةٌ خاملة** — لا سطرَ ثانٍ ولا خطأ", () => {
    const store = seedNotificationStore()
    const owner = notificationContext("u-square")
    expect(linkChannel(store, owner, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(true)
    expect(linkChannel(store, owner, { channel: "push", externalId: "ep-a", token: null }).ok).toBe(true)
    expect(myChannels(store, owner).length).toBe(1)
  })
})

describe("القنواتُ تُشتقّ من سجل الإعدادات ولا تُسرد (CR-011/قب-٣٦)", () => {
  it("القناةُ المعطَّلةُ في الإعداد لا تُربط — ولا قائمةَ قنواتٍ ثانيةً في الوحدة", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square", {
      settings: [LINK_TTL, channelsOverride(["bell", "telegram"])],
    })
    expect(enabledChannels(ctx, "/")).toEqual(["bell", "telegram"])

    const r = linkChannel(store, ctx, { channel: "push", externalId: "ep-a", token: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("CHANNEL_NOT_ENABLED")
  })

  it("**والجرسُ لا يُربط**: قناةٌ داخل التطبيق لا معرّفَ خارجياً لها", () => {
    const store = seedNotificationStore()
    const r = linkChannel(store, notificationContext("u-square"), {
      channel: "bell",
      externalId: "أيّاً كان",
      token: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("CHANNEL_NOT_LINKABLE")
  })
})
