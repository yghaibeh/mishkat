/**
 * §٦ — **«ما وُجِّه إليّ أنا»: شرطان مجتمعان لا ثالثَ لهما** (ق-٩٦ + ق-١٧).
 *
 * **موضعُ القاعدة واحد**: كلُّ سطحٍ يسأل «أتبلغ هذه المادةُ فلاناً؟» يمرّ من هنا — «مكتبتي»
 * والفتحُ والإنجازُ ومصفوفةُ المتابعة والتذكير. فلو تعدّدت المواضعُ لتباعدت الأجوبة، وهو
 * عينُ مرض v1 (شرطُ الجمهور في `myLibraryData` وشرطٌ آخر في `materialTrackingData`).
 *
 * والرفضُ **يُسمّي أيَّ الشرطين سقط** (المادة ٣/٤): `NOT_IN_AUDIENCE` غيرُ
 * `OUT_OF_MATERIAL_SCOPE` — فالتشخيصُ جزءٌ من العقد لا زينة.
 */

import { contains } from "../../../authorization/scope.js"
import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { libraryErr, libraryOk, type LibraryMaterial, type LibraryResult } from "../types.js"

/** أفي جمهور المادة؟ — سؤالٌ للمحرّك بقدرة الجمهور (§٢)، والجمهورُ المجهولُ لا يبلغ أحداً. */
export function inMaterialAudience(
  store: LibraryStore,
  ctx: LibraryContext,
  material: LibraryMaterial,
  personId: string,
): boolean {
  const audience = store.getAudience(material.audienceId)
  if (audience === null) return false
  return ctx.inAudience(personId, audience.capabilityId)
}

/** أتبلغ المادةُ هذا الشخص؟ — الشرطان معاً، والمؤرشفةُ لا تبلغ أحداً. */
export function materialReaches(
  store: LibraryStore,
  ctx: LibraryContext,
  material: LibraryMaterial,
  personId: string,
): boolean {
  if (material.archivedAt !== null) return false
  if (!inMaterialAudience(store, ctx, material, personId)) return false
  return ctx.reaches(personId, material.unitPath)
}

/**
 * الحارسُ المُشخِّص لفعلٍ على مادةٍ بعينها: يعيد المادةَ أو **السببَ المميِّز**.
 * وترتيبُه مقصود: الوجودُ ثم الأرشفةُ ثم الجمهورُ ثم النطاق — فالرسالةُ تصف أقربَ عائق.
 */
export function reachableMaterial(
  store: LibraryStore,
  ctx: LibraryContext,
  materialId: string,
  personId: string,
): LibraryResult<LibraryMaterial> {
  const material = store.getMaterial(materialId)
  if (material === null) return libraryErr("UNKNOWN_MATERIAL", materialId)
  if (material.archivedAt !== null) return libraryErr("MATERIAL_ARCHIVED", materialId)
  if (!inMaterialAudience(store, ctx, material, personId)) {
    return libraryErr("NOT_IN_AUDIENCE", material.audienceId)
  }
  if (!ctx.reaches(personId, material.unitPath)) {
    return libraryErr("OUT_OF_MATERIAL_SCOPE", material.unitPath)
  }
  return libraryOk(material)
}

/**
 * موادُّ الشخص كلُّها — **مرتَّبةٌ حتميّاً**: الإلزاميُّ أولاً (ق-٩٦)، ثم الأقدمُ فالأقدم،
 * ثم المعرّفُ فاصلاً. فترتيبُ الشاشة قرارٌ واحدٌ في موضعٍ واحد.
 */
export function materialsReaching(
  store: LibraryStore,
  ctx: LibraryContext,
  personId: string,
): readonly LibraryMaterial[] {
  return Object.freeze(
    store
      .materials()
      .filter((m) => materialReaches(store, ctx, m, personId))
      .sort(byNeedThenAge),
  )
}

/** موادُّ نطاقٍ (هابطاً — ق-١٧) بالترتيب نفسِه: كتالوجُ صفحة الإدارة. */
export function materialsInScope(
  store: LibraryStore,
  scopePath: string,
  includeArchived: boolean,
): readonly LibraryMaterial[] {
  return Object.freeze(
    store
      .materials()
      .filter((m) => contains(scopePath, m.unitPath))
      .filter((m) => includeArchived || m.archivedAt === null)
      .sort(byNeedThenAge),
  )
}

function byNeedThenAge(a: LibraryMaterial, b: LibraryMaterial): number {
  if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1
  const byAge = a.createdAt.getTime() - b.createdAt.getTime()
  return byAge !== 0 ? byAge : a.id.localeCompare(b.id)
}
