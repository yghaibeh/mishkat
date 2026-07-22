/**
 * «مكتبتي» — **نموذجُ صفحةٍ واحد** (ق-١١١) لِما وُجِّه إليّ أنا (عقدُ الوحدة §٥ و§٦).
 *
 * ثلاثةُ ثوابتٍ فيه:
 *  ١. **العرضُ يختم الاستلام** (ق-٩٦): فالقراءةُ فعلٌ كاتبٌ **مُعلَنٌ كاتباً** على دالة
 *     الخادم — لا ختمٌ خفيٌّ خلف إعلانٍ يقول «قراءة».
 *  ٢. **الإلزاميُّ لا يُخفى**: مرشّحُ الفئة يعمل على غير الإلزاميّ، والإلزاميُّ يبقى ظاهراً
 *     متصدّراً — فلا يختفي واجبٌ خلف مرشّح.
 *  ٣. **العدّادان مشتقّان** لا مخزَّنان: يُحسبان عند القراءة من الخَتمات نفسِها، فلا رقمَ
 *     يتباعد عن واقعه (نظيرُ «صفر رصيدٍ مخزَّن» ق-٦٠).
 */

import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { materialsReaching } from "./reach.js"
import { stampDelivery, stateOf } from "./timeline.js"
import type { MaterialKind, ProgressState } from "../types.js"

export type MyLibraryItem = {
  readonly materialId: string
  readonly titleAr: string
  readonly categoryId: string
  readonly audienceId: string
  readonly kind: MaterialKind
  readonly mandatory: boolean
  /** وجهةُ المادة: رابطُها الخارجيّ أو مفتاحُ تخزينها — **لا مسارَ مزوّدٍ ولا نطاق**. */
  readonly href: string | null
  /** **حالةٌ صريحة** من الخَتمات (§٤) — لا «غيرُ معروفة» ولا استنتاجٌ من صمت. */
  readonly state: ProgressState
}

export type MyLibraryView = {
  readonly personId: string
  readonly items: readonly MyLibraryItem[]
  /** إجماليُّ الإلزاميّ الموجَّه إليّ والمُنجَزُ منه — **اشتقاقان** لا حقلان. */
  readonly mandatoryTotal: number
  readonly mandatoryCompleted: number
}

export type MyLibraryFilter = {
  readonly categoryId?: string
}

export function myLibrary(
  store: LibraryStore,
  ctx: LibraryContext,
  filter: MyLibraryFilter = {},
): MyLibraryView {
  const personId = ctx.actorPersonId
  stampDelivery(store, ctx)

  const reaching = materialsReaching(store, ctx, personId)
  const items: MyLibraryItem[] = []
  let mandatoryTotal = 0
  let mandatoryCompleted = 0

  for (const material of reaching) {
    const state = stateOf(store.getProgress(material.id, personId))
    if (material.mandatory) {
      mandatoryTotal += 1
      if (state === "completed") mandatoryCompleted += 1
    }
    // **الإلزاميُّ لا يُخفى** ولو ضاق المرشّح — والاختياريُّ يُرشَّح.
    const filtered =
      filter.categoryId !== undefined && filter.categoryId !== material.categoryId
    if (filtered && !material.mandatory) continue

    items.push({
      materialId: material.id,
      titleAr: material.titleAr,
      categoryId: material.categoryId,
      audienceId: material.audienceId,
      kind: material.kind,
      mandatory: material.mandatory,
      href: material.externalUrl ?? material.storageKey,
      state,
    })
  }

  return Object.freeze({
    personId,
    items: Object.freeze(items),
    mandatoryTotal,
    mandatoryCompleted,
  })
}
