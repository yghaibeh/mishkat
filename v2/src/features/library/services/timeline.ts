/**
 * ق-٩٦ — **خطُّ الزمن الأحاديّ: «استلم ← فتح ← أنجز»** (عقدُ الوحدة §٤).
 *
 * **وهذا الملفُّ هو الموضعُ الوحيدُ الذي يكتب خَتمة** — يُقاس بحارسٍ محتوائيّ. فلا بابَ ثانٍ
 * ينجز مادةً، ولا مسارَ يختم «فتحاً» نيابةً عن صاحبه.
 *
 * **والفرقُ عن v1 مقصودٌ ومُعلَن**: كان `stamp()` يختم «فتح» صامتاً عند الإنجاز
 * (`if (field === "completedAt" && !p.openedAt) patch.openedAt = now`) — فيبدو خطُّ الزمن
 * متّسقاً وهو مُزوَّر، وتقول مصفوفةُ المتابعة «فُتحت» لمن لم يفتح. ونصُّ ق-٩٦ **«الإنجاز
 * بإقرارٍ صريح يستلزم الفتح»**: و«يستلزم» **شرطٌ يُفحص** لا خانةٌ تُملأ.
 *
 * وثلاثةُ ثوابتٍ أخرى:
 *  - **الحالةُ لا تُشتقّ من صمت**: السجلُّ لا يُنشأ إلا بالاستلام، فغيابُه «لم تُستلَم».
 *  - **الفاعلُ من الجلسة** (`ctx.actorPersonId`) — لا خَتمَ باسم غيرك.
 *  - **إعادةُ الخَتم لا تُحرّك التاريخ**: أولُ ختمٍ هو الحقيقة لا آخرُ نقرة.
 */

import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { materialsReaching, reachableMaterial } from "./reach.js"
import {
  libraryOk,
  libraryErr,
  type LibraryResult,
  type MaterialProgress,
  type ProgressState,
} from "../types.js"

/** حالةُ خط الزمن — **من الخَتمات وحدها**، والغيابُ حالةٌ معلنةٌ لا سكوت. */
export function stateOf(progress: MaterialProgress | null): ProgressState {
  if (progress === null) return "notDelivered"
  if (progress.completedAt !== null) return "completed"
  if (progress.openedAt !== null) return "opened"
  return "delivered"
}

/**
 * **ختمُ الاستلام آلياً عند أول عرضٍ لمكتبتي** (ق-٩٦) — للموادّ التي **تبلغ** صاحبَها وحدها.
 * ومتساوقة: مَن استُلمت له لا يُعاد ختمُها بتاريخٍ جديد.
 */
export function stampDelivery(store: LibraryStore, ctx: LibraryContext): void {
  const personId = ctx.actorPersonId
  store.transaction(() => {
    for (const material of materialsReaching(store, ctx, personId)) {
      if (store.getProgress(material.id, personId) !== null) continue
      store.saveProgress({
        tenantId: store.tenantId,
        materialId: material.id,
        personId,
        deliveredAt: ctx.now,
        openedAt: null,
        completedAt: null,
      })
    }
  })
}

/** الفتحُ: **يستلزم استلاماً سابقاً** — ولا يُخترع ختمٌ لسابقه. */
export function openMaterial(
  store: LibraryStore,
  ctx: LibraryContext,
  input: { readonly materialId: string },
): LibraryResult<MaterialProgress> {
  const personId = ctx.actorPersonId
  const material = reachableMaterial(store, ctx, input.materialId, personId)
  if (!material.ok) return material

  const progress = store.getProgress(material.value.id, personId)
  if (progress === null) return libraryErr("NOT_DELIVERED", material.value.id)
  if (progress.openedAt !== null) return libraryOk(progress)

  return store.transaction(() => {
    const opened: MaterialProgress = { ...progress, openedAt: ctx.now }
    store.saveProgress(opened)
    return libraryOk(opened)
  })
}

/** الإنجازُ: **إقرارٌ صريحٌ يستلزم الفتح** — والرفضُ يقول أيَّ خَتمةٍ تنقص. */
export function completeMaterial(
  store: LibraryStore,
  ctx: LibraryContext,
  input: { readonly materialId: string },
): LibraryResult<MaterialProgress> {
  const personId = ctx.actorPersonId
  const material = reachableMaterial(store, ctx, input.materialId, personId)
  if (!material.ok) return material

  const progress = store.getProgress(material.value.id, personId)
  if (progress === null) return libraryErr("NOT_DELIVERED", material.value.id)
  if (progress.openedAt === null) return libraryErr("NOT_OPENED_YET", material.value.id)
  if (progress.completedAt !== null) return libraryOk(progress)

  return store.transaction(() => {
    const done: MaterialProgress = { ...progress, completedAt: ctx.now }
    store.saveProgress(done)
    return libraryOk(done)
  })
}
