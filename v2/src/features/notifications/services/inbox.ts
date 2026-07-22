/**
 * ك-٣٥ — **«إشعاراتي» حقٌّ مشتقّ**: لا قدرةَ عرضٍ تُخترع (`SPEC_authorization` §٢.١٣).
 *
 * الحراسةُ هنا **ملكيةٌ لا قدرةُ عرض**: كلٌّ يرى طابورَه هو، وسطحُه `account.self` بنطاقٍ
 * شخصيّ — فالنيابةُ مستحيلةٌ **قبل جسم الدالة** (§٧ من عقد الوحدة). ومقاومةُ التضخّم قاعدةٌ
 * معلنة: *قدرةٌ لا يحرسها سيناريو منعٍ حقيقيّ لا تُخترع.*
 *
 * **وعددُ غير المقروء مشتقٌّ عند القراءة** لا عدّادٌ مخزَّن (درسُ ق-٦٠ في الصندوق: كلُّ عدّادٍ
 * مخزَّنٍ يتباعد عن مصدره حتماً) — **وعلى الطابور كلِّه لا على الصفحة**، وإلا كذب الجرس.
 */

import { ROOT_PATH } from "../../../authorization/scope.js"
import type { NotificationStore } from "../data/store.js"
import { settingNumberOrNull, type NotificationContext } from "./context.js"
import { notifyErr, notifyOk, type Notification, type NotificationResult } from "../types.js"

/** حجمُ الصفحة **إعدادٌ حيّ** لا رقمٌ صلب (قب-٦/G14). */
const PAGE_SIZE_SETTING = "platform.page_size.default"

export type InboxView = {
  readonly items: readonly Notification[]
  readonly unreadCount: number
}

/** ترتيبٌ حتميّ: الأحدثُ أولاً، والتعادلُ يُكسر بالمعرّف (TESTING_POLICY §٥). */
function newestFirst(a: Notification, b: Notification): number {
  return b.queuedAt.getTime() - a.queuedAt.getTime() || b.id.localeCompare(a.id)
}

export function myNotifications(store: NotificationStore, ctx: NotificationContext): InboxView {
  const mine = [...store.notificationsFor(ctx.actorPersonId)].sort(newestFirst)
  const pageSize = settingNumberOrNull(ctx, PAGE_SIZE_SETTING, ROOT_PATH) ?? 0
  return {
    items: Object.freeze(mine.slice(0, pageSize)),
    unreadCount: mine.filter((n) => n.status === "queued").length,
  }
}

export type MarkReadInput = { readonly notificationId: string }

/**
 * وسمُ إشعارٍ مقروءاً — **لصاحبه وحده** (دفاعٌ في العمق خلف النطاق الشخصيّ)، و**خاملٌ**
 * على المقروء أصلاً: الفعلُ نفسُه مرتين نتيجتُه واحدة (ت-٨ في وجهها القرائيّ).
 */
export function markRead(
  store: NotificationStore,
  ctx: NotificationContext,
  input: MarkReadInput,
): NotificationResult<Notification> {
  const notification = store.getNotification(input.notificationId)
  if (notification === null) return notifyErr("NOTIFICATION_NOT_FOUND", input.notificationId)
  if (notification.personId !== ctx.actorPersonId) {
    return notifyErr("NOT_NOTIFICATION_OWNER", input.notificationId)
  }
  if (notification.status === "read") return notifyOk(notification)

  const read: Notification = { ...notification, status: "read", readAt: ctx.now }
  store.saveNotification(read)
  return notifyOk(read)
}
