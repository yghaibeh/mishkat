/**
 * ق-١٠٤/ق-١٠٦/ق-١٧ — **المعرضُ ثلاثةُ روافدَ منسوبةٍ معزولةٍ بالنطاق، وفراغُه يقول سببه**
 * (عقدُ الوحدة §٣ و§٤).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا:
 *  ١. **النسبةُ سُلَّمٌ ملزمُ الترتيب** (ق-١٠٤): ناشرٌ ← رافعٌ له حساب ← مسؤولُ الوحدة ←
 *     «غير منسوبة». وبلوغُ الأخيرة يعني أن الرافعَ بلا حسابٍ **وأن الوحدةَ بلا مسؤول** معاً
 *     — فهي **آخرُ الحلول لا أوّلها**، وحالةٌ تُقاس لا افتراضٌ سهل.
 *  ٢. **العزلُ هابطٌ على كل رافد** (ق-١٧/ق-١٠٥): لا رافدَ يفلت من الترشيح بمسار الصفحة —
 *     فالأعلى يرى ما تحته **ولا يرى الجانبية**.
 *  ٣. **الفراغُ مُشخِّص** (ق-١٠٦/ق-١١٢): «شاغرٌ» أم «خامل» — والعددُ يُسأل عن **نطاق الصفحة
 *     بعينه** لا عن الشبكة (ق-١١٠).
 *
 * **والترتيبُ حتميّ**: تاريخُ الوقوع نزولاً، والتعادلُ يُكسر بالمعرّف — فلا عشوائيةَ عرض
 * (TESTING_POLICY §٥). وحجمُ الصفحة **إعدادٌ حيّ** لا رقمٌ صلب (قب-٦/G14).
 */

import { contains } from "../../../authorization/scope.js"
import type { MediaStore } from "../data/store.js"
import type { MediaContext } from "./context.js"
import type { FeedPhoto } from "./ports.js"
import { displayableCoveragesIn } from "./coverages.js"

/** إعدادُ حجم صفحة المعرض — القيمةُ من السجل لا من هنا. */
const PAGE_SIZE_SETTING = "platform.page_size.media"

/** الروافدُ الثلاثة (ق-١٠٤) — **رافدُ كلِّ صورةٍ ظاهرٌ في نموذج العرض**. */
export type GalleryStream = "coverage" | "dailyLog" | "lesson"

/** درجةُ السُّلَّم التي بلغتها النسبة — تُعرض فلا يُخفى «غير منسوبة» خلف صمت. */
export type AttributionVia = "publisher" | "uploader" | "unitResponsible" | "unattributed"

export type GalleryItem = {
  readonly id: string
  readonly stream: GalleryStream
  readonly unitPath: string
  readonly titleAr: string
  readonly occurredOn: Date
  readonly attributedTo: string | null
  readonly attributedVia: AttributionVia
}

/** حالُ الفراغ (ق-١٠٦): لا فراغَ · شاغرٌ بلا مسؤول · معيَّنٌ لم يُنتج. */
export type Emptiness = "none" | "vacant" | "idle"

export type MediaHubView = {
  readonly unitPath: string
  readonly items: readonly GalleryItem[]
  readonly streamCounts: Readonly<Record<GalleryStream, number>>
  /** عددُ مسؤولي الإعلام على النطاق — نصُّ ق-١٠٦ حرفياً. */
  readonly officerCount: number
  readonly emptiness: Emptiness
}

/**
 * سُلَّمُ ق-١٠٤ في موضعٍ واحد: **الرافدُ يعطي واقعةً، والحكمُ هنا**.
 * `hasAccount` هو ما يمنع نسبةَ صورةٍ إلى رافعٍ لا حساب له (فتكون نسبةً إلى لا أحد).
 */
function attribute(
  ctx: MediaContext,
  photo: FeedPhoto,
): { readonly attributedTo: string | null; readonly attributedVia: AttributionVia } {
  const uploader = photo.uploaderPersonId
  if (uploader !== null && ctx.ports.hasAccount(uploader)) {
    return { attributedTo: uploader, attributedVia: "uploader" }
  }
  const responsible = ctx.ports.responsibleFor(photo.unitPath)
  if (responsible !== null) {
    return { attributedTo: responsible, attributedVia: "unitResponsible" }
  }
  return { attributedTo: null, attributedVia: "unattributed" }
}

function feedItems(
  ctx: MediaContext,
  unitPath: string,
  stream: GalleryStream,
  photos: readonly FeedPhoto[],
): readonly GalleryItem[] {
  return photos
    .filter((p) => contains(unitPath, p.unitPath))
    .map((p) => ({
      id: p.id,
      stream,
      unitPath: p.unitPath,
      titleAr: p.titleAr,
      occurredOn: p.occurredOn,
      ...attribute(ctx, p),
    }))
}

function pageSize(ctx: MediaContext, unitPath: string): number {
  const value = ctx.settings(PAGE_SIZE_SETTING, unitPath, ctx.now)
  return typeof value === "number" ? value : 0
}

/** ق-١٠٤ + ق-١٧ + ق-١٠٦ — نموذجُ صفحة المعرض الواحد (ق-١١١: حقيقةٌ واحدةٌ في الصفحة). */
export function mediaHubView(
  store: MediaStore,
  ctx: MediaContext,
  unitPath: string,
): MediaHubView {
  const coverageItems: readonly GalleryItem[] = displayableCoveragesIn(store, unitPath).map((c) => ({
    id: c.id,
    stream: "coverage" as const,
    unitPath: c.unitPath,
    titleAr: c.titleAr,
    occurredOn: c.occurredOn,
    // **ناشرُها دائماً**: وجودُه مضمونٌ بحكم ق-١٠٣، فلا يهبط هذا الرافدُ السُّلَّمَ أبداً.
    attributedTo: c.publisherPersonId,
    attributedVia: "publisher" as const,
  }))

  const dailyLogItems = feedItems(ctx, unitPath, "dailyLog", ctx.ports.dailyLogPhotos(unitPath))
  const lessonItems = feedItems(ctx, unitPath, "lesson", ctx.ports.lessonPhotos(unitPath))

  const all = [...coverageItems, ...dailyLogItems, ...lessonItems].sort(
    (a, b) => b.occurredOn.getTime() - a.occurredOn.getTime() || a.id.localeCompare(b.id),
  )
  const items = all.slice(0, pageSize(ctx, unitPath))

  const officerCount = ctx.ports.officersIn(unitPath).length

  return {
    unitPath,
    items: Object.freeze(items),
    streamCounts: Object.freeze({
      coverage: items.filter((i) => i.stream === "coverage").length,
      dailyLog: items.filter((i) => i.stream === "dailyLog").length,
      lesson: items.filter((i) => i.stream === "lesson").length,
    }),
    officerCount,
    // ق-١٠٦: الفراغُ يقول سببه — **شغورُ الدور** أم **خمولُ المعيَّن**.
    emptiness: items.length > 0 ? "none" : officerCount === 0 ? "vacant" : "idle",
  }
}
