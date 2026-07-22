/**
 * ق-٧٥ + ت-٨ + ت-٩ — **الطابورُ الموحّد**: بابٌ واحدٌ للإدراج، ومفتاحٌ طبيعيٌّ يمنع المضاعفة،
 * وتصريفٌ معزولُ الخطوات (عقدُ الوحدة §١ و§٣).
 *
 * **الاعترافُ الذي وُلدت منه ق-٧٥** في سجل v1 صريح: «كان ناقصاً — صراحةً». كان بعضُ
 * الإشعارات يُدرَج `sent` **بنصٍّ خام** يتجاوز الطابور، فيرى المستخدمُ «لديك إشعارٌ جديد»
 * بلا معنى. فهنا:
 *  - **الحالةُ تولد `queued`**: لا معاملَ حالةٍ في التوقيع أصلاً، فلا مسارَ يُنشئ مُسلَّماً.
 *  - **الحمولةُ مهيكلة**: خلاصةٌ ومبلغٌ ونتيجةٌ وسبب — والقناةُ تصوغ، والوحدةُ لا تُنشئ نصّاً.
 *  - **القناةُ خلف واجهة**: `ChannelDeliverer` يُحقن، والمنطقُ فوقه **واحد**.
 */

import type { NotificationStore } from "../data/store.js"
import { deliveryChannelsFor } from "./channels.js"
import type { NotificationContext } from "./context.js"
import type {
  ChannelDelivery,
  ChannelId,
  Notification,
  NotificationPayload,
} from "../types.js"

/** ت-٨/ت-٩ — أربعةُ أركان: بدونها يتكرّر التذكيرُ في كل تشغيل. */
export function naturalKeyOf(input: {
  readonly personId: string
  readonly kindId: string
  readonly refId: string
  readonly windowKey: string
}): string {
  return `${input.personId}|${input.kindId}|${input.refId}|${input.windowKey}`
}

export type EnqueueInput = {
  readonly personId: string
  readonly kindId: string
  readonly refId: string
  readonly windowKey: string
  readonly payload: NotificationPayload
}

export type EnqueueOutcome = {
  readonly notification: Notification
  /** **يُعلَن ولا يُبتلع** (ت-٨): الفرقُ بين «أُنشئ» و«كان موجوداً» معلومةٌ للمستدعي. */
  readonly deduplicated: boolean
}

/**
 * البابُ الوحيدُ لإنشاء إشعار. **المفتاحُ الطبيعيُّ فهرسٌ في المستودع**، فإعادةُ الحدث نفسِه
 * تعيد الموجودَ ولا تُنشئ ثانياً — **ولو نسي المستدعي أن يسأل**.
 */
export function enqueue(
  store: NotificationStore,
  ctx: NotificationContext,
  input: EnqueueInput,
): EnqueueOutcome {
  const naturalKey = naturalKeyOf(input)
  const existing = store.findByNaturalKey(naturalKey)
  if (existing !== null) return { notification: existing, deduplicated: true }

  const notification: Notification = {
    tenantId: store.tenantId,
    id: store.nextId("ntf"),
    personId: input.personId,
    kindId: input.kindId,
    refId: input.refId,
    windowKey: input.windowKey,
    naturalKey,
    payload: input.payload,
    // **تولد في الطابور دائماً** — لا معاملَ حالةٍ يسمح بغير هذا (ق-٧٥).
    status: "queued",
    queuedAt: ctx.now,
    readAt: null,
  }
  store.saveNotification(notification)

  for (const channel of deliveryChannelsFor(store, ctx, input.personId)) {
    store.saveDelivery({
      tenantId: store.tenantId,
      // مفتاحُ التسليم (إشعارٌ × قناة) — فإعادةُ الإدراج لا تُنشئ سطراً ثانياً (ت-٨).
      id: `${notification.id}|${channel}`,
      notificationId: notification.id,
      channel,
      status: "queued",
      attempts: 0,
      lastErrorAr: null,
    })
  }

  return { notification, deduplicated: false }
}

/** منفذُ القناة — **الوحدةُ تعرف أنّ التسليم تمّ ولا تعرف كيف** (ت-١٦ خلف الواجهة). */
export type ChannelDeliverer = (delivery: ChannelDelivery, notification: Notification) => boolean

export type DrainReport = {
  readonly delivered: number
  readonly failed: number
  /** قناةٌ بلا منفذٍ محقون: **تبقى في الطابور** ولا تُوسَم مُسلَّمة ولا تُبتلع. */
  readonly skipped: number
}

/**
 * ت-٩ — **كلُّ خطوةٍ في `try/catch` مستقل**: تعثُّرُ قناةٍ لا يمنع إيصالَ البواقي، والفاشلُ
 * يبقى `failed` بسببه فيُرى. **ولا إعادةَ تسليمٍ للمُسلَّم** (ت-٨): الإعادةُ لا تُضاعف.
 *
 * وليست هذه مُجدوِلاً: لا مؤقّتَ فيها ولا دورة — تُستدعى من خارج الوحدة (عقدُ الوحدة §٦).
 */
export function drainQueue(
  store: NotificationStore,
  deliverers: Partial<Record<ChannelId, ChannelDeliverer>>,
): DrainReport {
  let delivered = 0
  let failed = 0
  let skipped = 0

  for (const delivery of store.deliveries()) {
    if (delivery.status !== "queued") continue
    const deliver = deliverers[delivery.channel]
    if (deliver === undefined) {
      skipped += 1
      continue
    }
    const notification = store.getNotification(delivery.notificationId)
    if (notification === null) {
      skipped += 1
      continue
    }
    try {
      const ok = deliver(delivery, notification)
      if (ok) {
        delivered += 1
        store.saveDelivery({ ...delivery, status: "delivered", attempts: delivery.attempts + 1 })
      } else {
        failed += 1
        store.saveDelivery({
          ...delivery,
          status: "failed",
          attempts: delivery.attempts + 1,
          lastErrorAr: "ردّت القناةُ بالرفض",
        })
      }
    } catch (e) {
      failed += 1
      store.saveDelivery({
        ...delivery,
        status: "failed",
        attempts: delivery.attempts + 1,
        lastErrorAr: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { delivered, failed, skipped }
}
