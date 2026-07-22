/**
 * شاشتا الإشعارات والإعلانات — عقداهما في `SPEC.md` §٨، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، ولا تحسب شيئاً: كلُّ قيمةٍ فيها مُسقَطةٌ من
 * **نموذج الصفحة الواحد** (`notifications.mine` / `announcements.inbox`) — ق-١١١.
 *
 * **والقراءةُ حقٌّ مشتقٌّ لا قدرة** (ك-٣٥ · `SPEC_role_lenses` §٢.١٢/٣): جدولا الإشعارات
 * والإعلانات يعلنان `capability: "derived"` — **وسمٌ معلنٌ في العقد لا شذوذ**. والقدرةُ
 * تُعلَن حيث يوجد فعلٌ: **ربطُ القناة** (`account.self`) و**النشرُ** (`announcement.publish`).
 *
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه) و**صفر صورة**؛
 * وهو **يقول سببه** (ق-١١٢): دعوةُ فعلٍ لصاحبه، وتشخيصٌ للمطّلع.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, inlineFeedback, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatHijri, formatNumber } from "../../../ui/text/format.js"
import type { InboxView } from "../services/inbox.js"
import type { Announcement, LinkedChannel } from "../types.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type NotifyRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type NotifySnapshot = {
  readonly scopePath: string
  readonly unitLabelAr: string
  readonly unreadCountAr: string
  readonly notificationRows: readonly NotifyRow[]
  readonly channelRows: readonly NotifyRow[]
  readonly announcementRows: readonly NotifyRow[]
}

export const EMPTY_NOTIFY_SNAPSHOT: NotifySnapshot = Object.freeze({
  scopePath: "/",
  unitLabelAr: ABSENT,
  unreadCountAr: ABSENT,
  notificationRows: Object.freeze([]),
  channelRows: Object.freeze([]),
  announcementRows: Object.freeze([]),
})

/** إسقاطُ «إشعاراتي وقنواتي» — **تنسيقٌ لا حساب**. */
export function projectInboxSnapshot(
  view: InboxView,
  channels: readonly LinkedChannel[],
  display: { readonly unitLabelAr: string; readonly scopePath: string },
): NotifySnapshot {
  return {
    ...EMPTY_NOTIFY_SNAPSHOT,
    unitLabelAr: display.unitLabelAr,
    scopePath: display.scopePath,
    unreadCountAr: formatNumber(view.unreadCount),
    notificationRows: view.items.map((n) => ({
      kind: n.kindId,
      summary: n.payload.summaryAr,
      when: formatHijri(n.queuedAt),
    })),
    channelRows: channels.map((c) => ({
      channel: c.channel,
      externalId: c.externalId,
      linkedAt: formatHijri(c.linkedAt),
    })),
  }
}

/** إسقاطُ «الإعلانات» — نفسُ القاعدة: تنسيقٌ لا حساب. */
export function projectAnnouncementsSnapshot(
  announcements: readonly Announcement[],
  display: { readonly unitLabelAr: string; readonly scopePath: string },
): NotifySnapshot {
  return {
    ...EMPTY_NOTIFY_SNAPSHOT,
    unitLabelAr: display.unitLabelAr,
    scopePath: display.scopePath,
    announcementRows: announcements.map((a) => ({
      title: a.titleAr,
      unit: a.unitId,
      publishedAt: formatHijri(a.publishedAt),
    })),
  }
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(
  caps: Caps,
  snapshot: NotifySnapshot,
  surface: "personal" | "home",
  content: readonly UiNode[],
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: surface, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هاتين الشاشتين.
    showSearch: false,
    content,
  })
}

// ── شاشةُ «إشعاراتي وقنواتي» ────────────────────────────────────────────────
export const NOTIFICATIONS_CONTRACT: ScreenContract = Object.freeze({
  route: "/account/notifications",
  surface: "personal",
  // «إشعاراتي» لكل مسجَّل (IA §٢.٢: `account.self` للكل) — فعدستُها كلُّ دورٍ حيّ.
  lenses: [
    "admin",
    "section_head",
    "rabita",
    "square",
    "amir",
    "teacher",
    "committee_head",
    "media",
    "finance_officer",
    "student",
  ] as const,
  // موطنُ «الإشعار» (IA §١ ك-٣٥) — لا موطنَ ثانٍ له.
  canonicalHome: ["notification"] as const,
  capabilities: ["account.self"] as const,
  dataSource: "notifications.mine",
  emptyStates: { owner: "notify.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function notificationsScreenNodes(caps: Caps, snapshot: NotifySnapshot): UiNode {
  if (!caps.has("account.self")) return viewerEmpty()

  return shell(caps, snapshot, "personal", [
    statCard({
      sentenceKey: "notify.unreadHeading",
      valueAr: snapshot.unreadCountAr,
      // النطاقُ منطوقٌ على الصفحة (ق-١١٠): إشعاراتُك أنت لا إشعاراتُ نطاقٍ.
      scopeNoteKey: "notify.scopeNote",
      action: button({ labelKey: "notify.markRead", variant: "ghost", capability: "derived" }),
      tone: "brand",
    }),
    // **قراءةُ الإشعارات حقٌّ مشتقّ** (ك-٣٥): الجدولُ يعلن `derived` لا قدرةً مخترعة.
    dataTable({
      columns: [
        { key: "kind", labelKey: "notify.kind" },
        { key: "summary", labelKey: "notify.summary" },
        { key: "when", labelKey: "notify.when" },
      ],
      rows: snapshot.notificationRows,
      state: snapshot.notificationRows.length === 0 ? "empty" : "data",
      capability: "derived",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "notify.emptyInbox",
        actionKey: "notify.emptyOwner",
        capability: "derived",
      }),
    }),
    // **وقنواتي فعلٌ شخصيّ**: هنا تُعلَن القدرة — والربطُ لصاحبه وحده (خ-٣).
    dataTable({
      columns: [
        { key: "channel", labelKey: "notify.channel" },
        { key: "externalId", labelKey: "notify.channelExternalId" },
        { key: "linkedAt", labelKey: "notify.channelState" },
      ],
      rows: snapshot.channelRows,
      state: snapshot.channelRows.length === 0 ? "empty" : "data",
      capability: "account.self",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "notify.emptyChannels",
        actionKey: "notify.linkTelegram",
        capability: "account.self",
      }),
    }),
    form({
      schema: "notificationChannelLink",
      fields: [
        field({ name: "channel", labelKey: "notify.channel", kind: "select", required: true }),
        field({
          name: "externalId",
          labelKey: "notify.channelExternalId",
          kind: "text",
          required: true,
        }),
      ],
      submit: button({
        labelKey: "notify.linkTelegram",
        variant: "primary",
        capability: "account.self",
      }),
    }),
    // **ع-١٦ في الواجهة**: العمرُ معلنٌ قبل الاستعمال لا بعد انتهائه — والمدةُ من الخادم.
    inlineFeedback({ messageKey: "notify.linkTtlNote", tone: "info", iconName: "info" }),
  ])
}

// ── شاشةُ «الإعلانات» ───────────────────────────────────────────────────────
export const ANNOUNCEMENTS_CONTRACT: ScreenContract = Object.freeze({
  route: "/announcements",
  surface: "home",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «الإعلان» (IA §١ ك-٣٢) — لا موطنَ ثانٍ له.
  canonicalHome: ["announcement"] as const,
  capabilities: ["announcement.publish"] as const,
  dataSource: "announcements.inbox",
  emptyStates: { owner: "announce.emptyOwner", viewer: "announce.emptyViewer" } as const,
})

export function announcementsScreenNodes(caps: Caps, snapshot: NotifySnapshot): UiNode {
  const canPublish = caps.has("announcement.publish")

  const content: UiNode[] = [
    // **القراءةُ حقٌّ مشتقّ من الإسناد** (ح-٥ · §٢.١٣): بلا قدرةٍ عمداً، والترشيحُ في الخادم.
    dataTable({
      columns: [
        { key: "title", labelKey: "announce.title" },
        { key: "unit", labelKey: "announce.unit" },
        { key: "publishedAt", labelKey: "announce.publishedAt" },
      ],
      rows: snapshot.announcementRows,
      state: snapshot.announcementRows.length === 0 ? "empty" : "data",
      capability: "derived",
      emptyState: canPublish
        ? emptyState({
            audience: "owner",
            titleKey: "announce.emptyViewer",
            actionKey: "announce.emptyOwner",
            capability: "announcement.publish",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "announce.emptyViewer",
            diagnosisKey: "state.emptyViewerIdle",
          }),
    }),
  ]

  // **مَن لا ينشر لا يجد نموذجاً معطَّلاً** يبحث عن سبب رفضه (ق-١٠٩).
  if (canPublish) {
    content.push(
      form({
        schema: "announcementInput",
        fields: [
          field({ name: "titleAr", labelKey: "announce.title", kind: "text", required: true }),
          field({ name: "bodyAr", labelKey: "announce.body", kind: "textarea", required: true }),
          field({ name: "unitId", labelKey: "announce.unit", kind: "select", required: true }),
          field({ name: "audience", labelKey: "announce.audience", kind: "select", required: true }),
        ],
        submit: button({
          labelKey: "announce.publish",
          variant: "primary",
          capability: "announcement.publish",
        }),
      }),
    )
  }

  return shell(caps, snapshot, "home", content)
}

registerScreen({
  contract: NOTIFICATIONS_CONTRACT,
  preview: (caps) => notificationsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
})
registerScreen({
  contract: ANNOUNCEMENTS_CONTRACT,
  preview: (caps) => announcementsScreenNodes(caps, EMPTY_NOTIFY_SNAPSHOT),
})
