/**
 * ح-٥ — **الإعلانُ يُقرأ بالنطاق والجمهور** (عقدُ الوحدة §٥، ك-٣٢).
 *
 * ثغرةُ v1 كانت **انفصامَ الكتابة عن القراءة**: الإنشاءُ منطاقٌ (`announcement.publish`)
 * والقراءةُ مفتوحة — كلُّ مسجَّلٍ يرى آخرَ الإعلانات أياً كان نطاقُها. والعلاجُ **ليس إخفاءَ
 * صفٍّ في القائمة** بل ترشيحٌ **عند المصدر** يسري على القائمة وعلى الفتح المباشر معاً
 * (المادة ٤/٦: «إخفاءُ الزر ليس حماية»).
 *
 * **والقارئُ يُعرَف بمواضع إسناده** — وهو نصُّ `SPEC_authorization` §٢.١٣ حرفياً: «قراءةُ
 * إعلانات نطاقك **حقٌّ مشتقٌّ من الإسناد** لا قدرةٌ تُمنح». فلا `announcement.view` تُخترع.
 *
 * **والجمهورُ شكلُ نطاقٍ لا قائمةُ أدوار**: `subtree` (النطاقُ وما تحته) و`unit` (الوحدةُ
 * بعينها). وأيُّ محورٍ ثالثٍ («أرسِل لأدوارٍ كذا») قائمةُ أدوارٍ تُفشلها G6 — فلا وجودَ له.
 */

import { contains } from "../../../authorization/scope.js"
import type { NotificationStore } from "../data/store.js"
import type { NotificationContext } from "./context.js"
import {
  notifyErr,
  notifyOk,
  type Announcement,
  type AnnouncementAudience,
  type NotificationResult,
} from "../types.js"

export type PublishAnnouncementInput = {
  readonly unitId: string
  readonly titleAr: string
  readonly bodyAr: string
  readonly audience: AnnouncementAudience
}

/**
 * النشرُ: **النطاقُ من الوحدة المخزَّنة** لا من مدخل العميل (يقتل صنف خ)، و**الناشرُ من
 * الجلسة** لا من المدخل (يقتل النيابة). ودعوى نطاقٍ أو ناشرٍ في المدخل **لا تُقرأ أصلاً**.
 */
export function publishAnnouncement(
  store: NotificationStore,
  ctx: NotificationContext,
  input: PublishAnnouncementInput,
): NotificationResult<Announcement> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return notifyErr("UNKNOWN_ANNOUNCEMENT_UNIT", input.unitId)

  const titleAr = input.titleAr.trim()
  const bodyAr = input.bodyAr.trim()
  if (titleAr.length === 0 || bodyAr.length === 0) {
    return notifyErr("EMPTY_ANNOUNCEMENT", input.unitId)
  }

  const announcement: Announcement = {
    tenantId: store.tenantId,
    id: store.nextId("ann"),
    titleAr,
    bodyAr,
    unitId: unit.id,
    scopePath: unit.path,
    audience: input.audience,
    publisherPersonId: ctx.actorPersonId,
    publishedAt: ctx.now,
  }
  store.saveAnnouncement(announcement)
  return notifyOk(announcement)
}

/**
 * ح-٥ — **أفي جمهوره؟** يُقاس بمواضع إسناد القارئ:
 *  - `subtree`: موضعٌ من مواضعه **محتوىً** في نطاق الإعلان (نزولاً لا صعوداً — ق-١٧).
 *  - `unit`: موضعٌ من مواضعه **يساوي** نطاقَه بعينه.
 */
function inAudience(
  ctx: NotificationContext,
  announcement: Announcement,
  readerId: string,
): boolean {
  const places = ctx.ports.assignmentScopesOf(readerId)
  return announcement.audience === "unit"
    ? places.some((place) => place === announcement.scopePath)
    : places.some((place) => contains(announcement.scopePath, place))
}

/** ترتيبٌ حتميّ: الأحدثُ أولاً، والتعادلُ يُكسر بالمعرّف (TESTING_POLICY §٥). */
function newestFirst(a: Announcement, b: Announcement): number {
  return b.publishedAt.getTime() - a.publishedAt.getTime() || b.id.localeCompare(a.id)
}

/** إعلاناتُ نطاقي — **مفلترةٌ عند المصدر** لا معروضةٌ ثم مخفيّة. */
export function myAnnouncements(
  store: NotificationStore,
  ctx: NotificationContext,
): readonly Announcement[] {
  return Object.freeze(
    [...store.announcements()]
      .filter((a) => inAudience(ctx, a, ctx.actorPersonId))
      .sort(newestFirst),
  )
}

export type OpenAnnouncementInput = { readonly announcementId: string }

/**
 * **الطبقةُ الثانية من ح-٥**: الفتحُ المباشرُ لإعلانِ نطاقٍ آخر **يُردّ في الخادم**.
 * والسببان متمايزان — مجهولٌ غيرُ «خارج الجمهور» — فيُشخَّص الرفضُ ولا يُبهم.
 */
export function openAnnouncement(
  store: NotificationStore,
  ctx: NotificationContext,
  input: OpenAnnouncementInput,
): NotificationResult<Announcement> {
  const announcement = store.getAnnouncement(input.announcementId)
  if (announcement === null) return notifyErr("ANNOUNCEMENT_NOT_FOUND", input.announcementId)
  if (!inAudience(ctx, announcement, ctx.actorPersonId)) {
    return notifyErr("OUT_OF_ANNOUNCEMENT_AUDIENCE", input.announcementId)
  }
  return notifyOk(announcement)
}
