/**
 * ق-٩٦ — **مصفوفةُ المتابعة ونموذجُ صفحة الإدارة** (عقدُ الوحدة §٩/§١٠).
 *
 * «يتابع البرنامجُ استلامَ كل مسؤولٍ لها والتأكد من إنجاز قراءتها» (المالك نصاً).
 * وثلاثةُ ثوابتٍ تحكم الصفحة:
 *  ١. **مصدرٌ واحدٌ للصفحة** (ق-١١١): الكتالوجُ والمصفوفةُ وحدودُ الرفع من نموذجٍ واحد —
 *     فلا كتابةٌ هنا وقراءةٌ هناك، ولا مادةٌ في المصفوفة لا تراها الصفحةُ في كتالوجها.
 *  ٢. **العزلُ بالنطاق** (ق-١٧/ق-١١٠): أفرادُ النطاق × موادُّ النطاق الإلزامية التي **تبلغهم**
 *     — لا الشبكةُ كلُّها. وهو الوجهُ القرائيُّ من قفل **ح-٦**.
 *  ٣. **الحالةُ حالةُ خط الزمن نفسُها** (`stateOf`) — لا حسابٌ ثانٍ يتباعد عنه.
 */

import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { materialReaches, materialsInScope } from "./reach.js"
import { stateOf } from "./timeline.js"
import { uploadLimits, type UploadLimits } from "./uploads.js"
import type { LibraryMaterial, MaterialKind, ProgressState } from "../types.js"

export type TrackingCell = {
  readonly materialId: string
  readonly state: ProgressState
}

export type TrackingRow = {
  readonly personId: string
  readonly cells: readonly TrackingCell[]
  readonly completed: number
  readonly total: number
}

export type CatalogRow = {
  readonly materialId: string
  readonly titleAr: string
  readonly categoryId: string
  readonly audienceId: string
  readonly kind: MaterialKind
  readonly mandatory: boolean
  readonly unitPath: string
  readonly archived: boolean
}

/** سببُ الفراغ يصل الشاشةَ **قيمةً** لا استنتاجاً فيها (ق-١٠٦). */
export type Emptiness = "vacant" | "idle"

export type LibraryManageView = {
  readonly unitPath: string
  readonly catalog: readonly CatalogRow[]
  readonly tracking: readonly TrackingRow[]
  readonly limits: UploadLimits
  readonly emptiness: Emptiness
}

/** الإلزاميُّ الحيُّ في النطاق — موضوعُ المتابعة وحدَه (والاختياريُّ عرضٌ لا متابعة). */
function mandatoryInScope(store: LibraryStore, scopePath: string): readonly LibraryMaterial[] {
  return materialsInScope(store, scopePath, false).filter((m) => m.mandatory)
}

export function trackingMatrix(
  store: LibraryStore,
  ctx: LibraryContext,
  scopePath: string,
): readonly TrackingRow[] {
  const materials = mandatoryInScope(store, scopePath)
  const rows: TrackingRow[] = []

  for (const personId of ctx.ports.peopleIn(scopePath)) {
    const cells: TrackingCell[] = []
    let completed = 0
    for (const material of materials) {
      // **مَن لا تبلغه المادةُ لا يُطالَب بها** — الجمهورُ والنطاقُ يحكمان الخلايا.
      if (!materialReaches(store, ctx, material, personId)) continue
      const state = stateOf(store.getProgress(material.id, personId))
      if (state === "completed") completed += 1
      cells.push({ materialId: material.id, state })
    }
    if (cells.length === 0) continue
    rows.push({ personId, cells: Object.freeze(cells), completed, total: cells.length })
  }

  // الترتيبُ **بالحاجة** (ق-١٠٨): الأقلُّ إنجازاً أولاً، ثم المعرّفُ حتميّةً.
  return Object.freeze(
    rows.sort((a, b) => {
      const byNeed = a.completed / a.total - b.completed / b.total
      return byNeed !== 0 ? byNeed : a.personId.localeCompare(b.personId)
    }),
  )
}

export function manageView(
  store: LibraryStore,
  ctx: LibraryContext,
  scopePath: string,
): LibraryManageView {
  const catalog = materialsInScope(store, scopePath, true).map(
    (m): CatalogRow => ({
      materialId: m.id,
      titleAr: m.titleAr,
      categoryId: m.categoryId,
      audienceId: m.audienceId,
      kind: m.kind,
      mandatory: m.mandatory,
      unitPath: m.unitPath,
      archived: m.archivedAt !== null,
    }),
  )

  return Object.freeze({
    unitPath: scopePath,
    catalog: Object.freeze(catalog),
    tracking: trackingMatrix(store, ctx, scopePath),
    limits: uploadLimits(store, ctx, scopePath),
    // ق-١٠٦: **شاغرٌ** (لا أحدَ في النطاق) غيرُ **خاملٍ** (أهلُه فيه ولم تُنشَر مادة).
    emptiness: ctx.ports.peopleIn(scopePath).length === 0 ? "vacant" : "idle",
  })
}
