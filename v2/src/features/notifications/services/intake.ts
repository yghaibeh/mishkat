/**
 * **الواجهةُ المعلنة لاستقبال ما تصدّره الوحدات** (بند المهمة ٧، عقدُ الوحدة §٦).
 *
 * **تصريحٌ ملزم**: هذه الوحدةُ **مستقبِلةٌ لا مولِّدة**. لا مُجدوِلَ يُبنى هنا ولا مؤقّتَ ولا
 * دورةَ زمنية (المجدولاتُ ت-٩ **مؤجَّلةٌ نصاً**): الوحداتُ — المكتبةُ والإشرافُ والحلقاتُ
 * ومحرّكُ الاعتماد — **تُصدِّر أحداثَها إلى هذا الباب**، ويُحقن إليها **دالةً** فلا تستورد
 * إحداهما الأخرى (قب-٣١: كلٌّ في مجلده). ومتى بُني المُجدوِل فمكانُه **خارجَها** وهو يستدعيه.
 *
 * **وق-١١ بنيويّةٌ في هذا الباب**: الكتالوجُ مغلق، و`NotificationTrigger` **ليس فيه محفّزٌ
 * اسمُه «إدخال»** — فمن أراد إشعاراً لكل إدخالٍ يوميّ **لم يجد له نوعاً** ⇒
 * `UNKNOWN_NOTIFICATION_KIND`. الإشعارُ **عند التقديم** لا عند كل إدخال.
 *
 * **وترتيبُ الحرّاس مقصود**: النوعُ ثم الحمولةُ ثم الجمهور — فلا يُسأل المحرّكُ عن مستهدَفي
 * حدثٍ مرفوضٍ أصلاً، ولا يُدرَج في الطابور نصفُ حدث.
 */

import type { NotificationStore } from "../data/store.js"
import type { NotificationContext } from "./context.js"
import { enqueue } from "./queue.js"
import { resolveTargets } from "./targeting.js"
import {
  notifyErr,
  notifyOk,
  type NotificationAudience,
  type NotificationPayloadInput,
  type NotificationResult,
} from "../types.js"

/** حدثُ وحدةٍ أخرى — **أركانُ المفتاح الطبيعيّ فيه إلزامية** (ت-٨/ت-٩). */
export type NotificationEvent = {
  readonly kindId: string
  /** الكيانُ المُشعَر عنه. */
  readonly refId: string
  /** نافذةُ التكرار — تذكيرٌ مرةً في كل نافذة لا في كل تشغيل (ت-٩). */
  readonly windowKey: string
  readonly audience: NotificationAudience
  readonly payload: NotificationPayloadInput
}

export type IntakeReceipt = {
  /** مَن وصلَه — **جوابُ المحرّك**، يعود للمُصدِّر ليُدوّنه في تدقيقه إن شاء. */
  readonly targets: readonly string[]
  readonly notificationIds: readonly string[]
  /** أكانت إعادةً لحدثٍ مُدرَجٍ سلفاً؟ (ت-٨ — يُعلَن ولا يُبتلع). */
  readonly deduplicated: boolean
}

export type NotificationIntake = (event: NotificationEvent) => NotificationResult<IntakeReceipt>

export function makeIntake(
  store: NotificationStore,
  ctx: NotificationContext,
): NotificationIntake {
  return (event) => {
    const kind = store.getKind(event.kindId)
    if (kind === null) return notifyErr("UNKNOWN_NOTIFICATION_KIND", event.kindId)
    if (!kind.active) return notifyErr("KIND_INACTIVE", kind.id)

    const summaryAr = event.payload.summaryAr.trim()
    if (summaryAr.length === 0) return notifyErr("EMPTY_SUMMARY", event.kindId)

    const targets = resolveTargets(ctx, event.audience)
    if (targets.length === 0) return notifyErr("NO_TARGETS", event.kindId)

    const payload = {
      summaryAr,
      amount: event.payload.amount ?? null,
      outcomeAr: event.payload.outcomeAr ?? null,
      reasonAr: event.payload.reasonAr ?? null,
    }

    const outcomes = targets.map((personId) =>
      enqueue(store, ctx, {
        personId,
        kindId: kind.id,
        refId: event.refId,
        windowKey: event.windowKey,
        payload,
      }),
    )

    return notifyOk({
      targets,
      notificationIds: outcomes.map((o) => o.notification.id),
      deduplicated: outcomes.every((o) => o.deduplicated),
    })
  }
}
