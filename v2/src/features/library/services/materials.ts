/**
 * إدارةُ الموادّ — الإنشاءُ والتعديلُ والأرشفة (عقدُ الوحدة §١ و§٣ و§٧).
 *
 * **ولا فحصَ صلاحيةٍ هنا**: القدرةُ والنطاق يُفرضان على **دالة الخادم** قبل جسم الدالة
 * (`server/endpoints.ts`)، ونطاقُ الفعل يُشتقّ من **المادة المخزَّنة** لا من المدخل — وهو
 * ما يقتل **ح-٦** بنيوياً. وما هنا **قواعدُ عملٍ** فحسب: قاموسٌ مغلقٌ (ق-٨٩) وتحقّقُ رفعٍ
 * في الخادم (المادة ٨/٤) وأرشفةٌ وسماً لا محواً (المادة ٧/٤).
 */

import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { validateUpload } from "./uploads.js"
import {
  libraryErr,
  libraryOk,
  type LibraryMaterial,
  type LibraryResult,
  type MaterialKind,
} from "../types.js"

export type CreateMaterialInput = {
  readonly titleAr: string
  readonly categoryId: string
  readonly audienceId: string
  readonly kind: MaterialKind
  /** موطنُ المادة التنظيميّ — منه يُشتقّ نطاقُها ومَن تبلغهم (§٣/§٦). */
  readonly unitId: string
  readonly mandatory: boolean
  readonly externalUrl?: string
  readonly contentType?: string
  readonly sizeBytes?: number
}

export type UpdateMaterialInput = {
  readonly materialId: string
  readonly titleAr?: string
  readonly categoryId?: string
  readonly audienceId?: string
  readonly mandatory?: boolean
}

/** فحصُ المعجمين — **قائمةٌ لا كتابةٌ حرّة** (ق-٨٩)، والمجهولُ يُسمّى في الرفض. */
function checkDictionaries(
  store: LibraryStore,
  categoryId: string,
  audienceId: string,
): LibraryResult<true> {
  if (store.getCategory(categoryId) === null) return libraryErr("UNKNOWN_CATEGORY", categoryId)
  if (store.getAudience(audienceId) === null) return libraryErr("UNKNOWN_AUDIENCE", audienceId)
  return libraryOk(true)
}

/**
 * محتوى المادة: رابطٌ **أو** ملفٌّ مرفوعٌ محقَّق — لا ثالثَ ولا اجتماعَ بينهما.
 * ومفتاحُ التخزين **من المستودع** فلا يأتي من المدخل ولا يُخمَّن (المادة ٨/٤).
 */
type MaterialContent = {
  readonly storageKey: string | null
  readonly contentType: string | null
  readonly sizeBytes: number | null
  readonly externalUrl: string | null
}

function resolveContent(
  store: LibraryStore,
  ctx: LibraryContext,
  unitPath: string,
  input: CreateMaterialInput,
): LibraryResult<MaterialContent> {
  if (input.kind === "link") {
    const url = (input.externalUrl ?? "").trim()
    if (url.length === 0) return libraryErr("LINK_REQUIRED")
    return libraryOk({ storageKey: null, contentType: null, sizeBytes: null, externalUrl: url })
  }

  if (input.contentType === undefined || input.sizeBytes === undefined) {
    return libraryErr("FILE_REQUIRED", input.kind)
  }
  const format = validateUpload(store, ctx, unitPath, {
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  })
  if (!format.ok) return format

  return libraryOk({
    storageKey: store.nextStorageKey(),
    contentType: format.value.contentType,
    sizeBytes: input.sizeBytes,
    externalUrl: null,
  })
}

export function createMaterial(
  store: LibraryStore,
  ctx: LibraryContext,
  input: CreateMaterialInput,
): LibraryResult<LibraryMaterial> {
  const title = input.titleAr.trim()
  if (title.length === 0) return libraryErr("EMPTY_TITLE")

  const unit = store.getUnit(input.unitId)
  if (unit === null) return libraryErr("UNKNOWN_LIBRARY_UNIT", input.unitId)

  const dictionaries = checkDictionaries(store, input.categoryId, input.audienceId)
  if (!dictionaries.ok) return dictionaries

  const content = resolveContent(store, ctx, unit.path, input)
  if (!content.ok) return content

  return store.transaction(() => {
    const material: LibraryMaterial = {
      tenantId: store.tenantId,
      id: store.nextId("mat"),
      titleAr: title,
      categoryId: input.categoryId,
      audienceId: input.audienceId,
      kind: input.kind,
      unitId: unit.id,
      unitPath: unit.path,
      mandatory: input.mandatory,
      ...content.value,
      createdBy: ctx.actorPersonId,
      createdAt: ctx.now,
      archivedAt: null,
      archivedBy: null,
    }
    store.saveMaterial(material)
    return libraryOk(material)
  })
}

/**
 * التعديلُ **لا يمسّ الموطنَ ولا المحتوى**: نقلُ مادةٍ إلى وحدةٍ أخرى يغيّر مَن تبلغهم ومَن
 * يملكها، فهو **إنشاءٌ جديدٌ في موطنه** لا تعديلٌ صامت (وإلا صارت الأرشفةُ والتنطيق حِيَلاً).
 */
export function updateMaterial(
  store: LibraryStore,
  input: UpdateMaterialInput,
): LibraryResult<LibraryMaterial> {
  const material = store.getMaterial(input.materialId)
  if (material === null) return libraryErr("UNKNOWN_MATERIAL", input.materialId)
  if (material.archivedAt !== null) return libraryErr("MATERIAL_ARCHIVED", input.materialId)

  const title = input.titleAr === undefined ? material.titleAr : input.titleAr.trim()
  if (title.length === 0) return libraryErr("EMPTY_TITLE")

  const categoryId = input.categoryId ?? material.categoryId
  const audienceId = input.audienceId ?? material.audienceId
  const dictionaries = checkDictionaries(store, categoryId, audienceId)
  if (!dictionaries.ok) return dictionaries

  return store.transaction(() => {
    const updated: LibraryMaterial = {
      ...material,
      titleAr: title,
      categoryId,
      audienceId,
      mandatory: input.mandatory ?? material.mandatory,
    }
    store.saveMaterial(updated)
    return libraryOk(updated)
  })
}

/** الأرشفةُ **وسمٌ لا محو** (المادة ٧/٤): مَن ومتى يبقيان، والتاريخُ يُقرأ ولا يُمحى. */
export function archiveMaterial(
  store: LibraryStore,
  ctx: LibraryContext,
  input: { readonly materialId: string },
): LibraryResult<LibraryMaterial> {
  const material = store.getMaterial(input.materialId)
  if (material === null) return libraryErr("UNKNOWN_MATERIAL", input.materialId)
  if (material.archivedAt !== null) return libraryErr("MATERIAL_ARCHIVED", input.materialId)

  return store.transaction(() => {
    const archived: LibraryMaterial = {
      ...material,
      archivedAt: ctx.now,
      archivedBy: ctx.actorPersonId,
    }
    store.saveMaterial(archived)
    return libraryOk(archived)
  })
}
