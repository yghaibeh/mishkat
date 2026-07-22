/**
 * دوالُّ خادم الإشعارات — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٧.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنةٌ من الكتالوج** — لا نقطةَ بلا إعلان (G7)، **ولا قدرةَ مخترعة**: اثنتان
 *     لا ثالثةَ لهما، و**لا `notification.view` ولا `announcement.view`** (ك-٣٥ · §٢.١٣).
 *  ٢. **النطاقُ مشتقّ**: الوحدةُ من **مستودع هذه الشبكة** (قب-١٨)، والملكيةُ من **الكيان
 *     المخزَّن** — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **الأفعالُ الشخصيةُ نطاقُها ملكيّة** (ق-٢٧/قب-٣٨): `selfScope` يجعل النيابةَ مستحيلةً
 *     **قبل جسم الدالة** — والمدير كغيره، بلا فرعٍ يقول «إن كان مديراً». وهي **الطبقةُ الأولى
 *     من حارس خ-٣**: لا يُربط أحدٌ قناةً باسم غيره أصلاً.
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن يقرأ ومَن يربط ومَن ينشر كلُّهم `actor`.
 *
 * > **والقدرةُ التي يحملها الحدثُ ليست من هنا**: الجمهورُ يصل الوحدةَ **بياناً** عبر واجهة
 * > الاستقبال (§٦)، فلا تسمّي هذه الوحدةُ قدرةَ بتٍّ واحدة — وتبقى بصفر مخالفةٍ لـG22.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { NotificationStore } from "../data/store.js"
import type { NotificationContext } from "../services/context.js"
import type { NotificationPorts } from "../services/ports.js"
import { makeCapabilityAnswer } from "../services/targeting.js"
import {
  enabledChannels,
  linkChannel,
  myChannels,
  startTelegramLink,
  type IssuedLink,
  type LinkChannelInput,
} from "../services/channels.js"
import { markRead, myNotifications, type InboxView } from "../services/inbox.js"
import {
  myAnnouncements,
  openAnnouncement,
  publishAnnouncement,
  type PublishAnnouncementInput,
} from "../services/announcements.js"
import type {
  Announcement,
  ChannelId,
  LinkedChannel,
  Notification,
  NotificationResult,
} from "../types.js"

/** دعوى ملكيةٍ من المدخل **يقارنها المحرّكُ بهوية الجلسة** — المدخلُ لا يُصدَّق بل يُقارَن. */
function ownerClaim(personId: string | undefined, entityType: string, entityId: string): Scope {
  return personId === undefined ? NO_SCOPE : selfScope(personId, entityType, entityId)
}

/** نطاقُ فعلٍ على إشعارٍ قائم: **ملكيةٌ من الكيان المخزَّن** — والمجهولُ ⇒ `NO_SCOPE`. */
function notificationOwnerScope(store: NotificationStore, notificationId: string | undefined): Scope {
  const notification = notificationId === undefined ? null : store.getNotification(notificationId)
  return notification === null
    ? NO_SCOPE
    : selfScope(notification.personId, "notification", notification.id)
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: NotificationStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

export type MyChannelsView = {
  readonly enabled: readonly ChannelId[]
  readonly linked: readonly LinkedChannel[]
}

export function makeNotificationEndpoints(
  store: NotificationStore,
  settings: SettingsResolver,
  ports: NotificationPorts,
) {
  /** سياقُ الخدمات: الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ والمنافذُ محقونة. */
  const contextOf = (actor: Actor, request: DecisionContext): NotificationContext => ({
    now: request.now,
    settings,
    actorPersonId: actor.personId,
    holdsCapability: makeCapabilityAnswer(request),
    ports,
  })

  const mineFn = defineServerFn({
    name: "notifications.mine",
    capability: "account.self",
    scope: (input: { personId: string }) => ownerClaim(input.personId, "notification", "mine"),
    intent: "read",
    audit: "notifications.mine",
    handler: async (_input: { personId: string }, { actor, request }): Promise<InboxView> =>
      myNotifications(store, contextOf(actor, request)),
  })

  const readFn = defineServerFn({
    name: "notifications.read",
    capability: "account.self",
    scope: (input: { notificationId: string }) => notificationOwnerScope(store, input.notificationId),
    intent: "write",
    audit: "notifications.read",
    handler: async (
      input: { notificationId: string },
      { actor, request },
    ): Promise<NotificationResult<Notification>> =>
      markRead(store, contextOf(actor, request), input),
  })

  const linkStartFn = defineServerFn({
    name: "notifications.telegram.linkStart",
    capability: "account.self",
    scope: (input: { personId: string }) => ownerClaim(input.personId, "notificationChannel", "new"),
    intent: "write",
    audit: "notifications.telegram.linkStart",
    handler: async (
      _input: { personId: string },
      { actor, request },
    ): Promise<NotificationResult<IssuedLink>> => startTelegramLink(store, contextOf(actor, request)),
  })

  const linkFn = defineServerFn({
    name: "notifications.channel.link",
    capability: "account.self",
    scope: (input: { personId: string; channel: ChannelId }) =>
      ownerClaim(input.personId, "notificationChannel", input.channel),
    intent: "write",
    audit: "notifications.channel.link",
    handler: async (
      input: { personId: string } & LinkChannelInput,
      { actor, request },
    ): Promise<NotificationResult<LinkedChannel>> =>
      linkChannel(store, contextOf(actor, request), input),
  })

  const myChannelsFn = defineServerFn({
    name: "notifications.channels.mine",
    capability: "account.self",
    scope: (input: { personId: string }) => ownerClaim(input.personId, "notificationChannel", "mine"),
    intent: "read",
    audit: "notifications.channels.mine",
    handler: async (_input: { personId: string }, { actor, request }): Promise<MyChannelsView> => {
      const ctx = contextOf(actor, request)
      return { enabled: enabledChannels(ctx), linked: myChannels(store, ctx) }
    },
  })

  const publishFn = defineServerFn({
    name: "announcements.publish",
    capability: "announcement.publish",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "announcements.publish",
    handler: async (
      input: PublishAnnouncementInput,
      { actor, request },
    ): Promise<NotificationResult<Announcement>> =>
      publishAnnouncement(store, contextOf(actor, request), input),
  })

  const inboxFn = defineServerFn({
    name: "announcements.inbox",
    capability: "account.self",
    scope: (input: { personId: string }) => ownerClaim(input.personId, "announcement", "inbox"),
    intent: "read",
    audit: "announcements.inbox",
    handler: async (
      _input: { personId: string },
      { actor, request },
    ): Promise<readonly Announcement[]> => myAnnouncements(store, contextOf(actor, request)),
  })

  const openFn = defineServerFn({
    name: "announcements.open",
    capability: "account.self",
    scope: (input: { personId: string; announcementId: string }) =>
      ownerClaim(input.personId, "announcement", input.announcementId),
    intent: "read",
    audit: "announcements.open",
    handler: async (
      input: { personId: string; announcementId: string },
      { actor, request },
    ): Promise<NotificationResult<Announcement>> =>
      openAnnouncement(store, contextOf(actor, request), input),
  })

  return {
    mine: mineFn,
    read: readFn,
    linkStart: linkStartFn,
    link: linkFn,
    myChannels: myChannelsFn,
    publish: publishFn,
    inbox: inboxFn,
    open: openFn,
  }
}
