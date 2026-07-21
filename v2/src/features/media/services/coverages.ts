/**
 * ق-١٠٣/ق-١٠٥ — **التغطيةُ كيانُ حدثٍ يُنشأ بأجوبته الأربعة**، وألبومُها لصاحبها وحده
 * (عقدُ الوحدة §١ و§٢).
 *
 * ثلاثةُ ثوابتٍ في كل فعلٍ هنا:
 *  ١. **الفاعلُ من السياق لا من المدخل**: الناشرُ والرافعُ والحاذفُ كلُّهم `ctx.actorPersonId`
 *     — فلا يُزوَّر فعلٌ باسم غيره ولو مرّ من الحدّ (والمحرّكُ يردّ النيابةَ قبل ذلك — §٢.١).
 *  ٢. **النقصُ سببٌ مُشخِّص**: كلُّ جوابٍ ناقصٍ رمزُ خطأٍ باسمه — لا «تعذّر الإنشاء» مبهمة.
 *  ٣. **لا محو**: الحذفُ حالةٌ تُكتب بمن حذف ومتى، **ويأخذ صورَ الألبوم معه** فلا تبقى
 *     صورةٌ معلَّقةٌ بلا سياق (وهو عينُ ز-٥ الذي تقتله هذه الوحدة).
 */

import { contains } from "../../../authorization/scope.js"
import type { MediaStore } from "../data/store.js"
import type { MediaContext } from "./context.js"
import { validateUpload } from "./uploads.js"
import {
  mediaErr,
  mediaOk,
  type MediaCoverage,
  type MediaPhoto,
  type MediaResult,
} from "../types.js"

/** إعدادُ قبول التأريخ المستقبليّ (ق-٤٥) — قاعدةٌ تُضبط لا تُصلَّب (قب-٦). */
const FUTURE_DATING_SETTING = "records.allow_future_dating"

export type CreateCoverageInput = {
  /**
   * **دعوى ملكيةٍ يقارنها المحرّكُ بهوية الجلسة** (لا كيانَ مخزَّناً بعد — §٢.١):
   * فالمدخلُ لا يُصدَّق بل يُقارَن، والجسمُ يكتب `ctx.actorPersonId` على أي حال.
   */
  readonly publisherPersonId: string
  readonly titleAr: string
  readonly kindId: string
  readonly unitId: string
  readonly occurredOn: Date
}

export type AddPhotoInput = {
  readonly coverageId: string
  readonly contentType: string
  readonly sizeBytes: number
}

export type CoverageSummary = {
  readonly id: string
  readonly titleAr: string
  readonly kindId: string
  readonly unitPath: string
  readonly occurredOn: Date
  readonly photoCount: number
  /** **تغطيةٌ بلا صورةٍ لا تُعرض** (ق-١٠٣) — فهي مسوّدةُ صاحبها حتى يصلَها ألبومُها. */
  readonly published: boolean
}

/** ألبومُ التغطية — فارغٌ إن حُذفت: **الحذفُ يأخذ صورَها معها** (ق-١٠٥). */
export function albumOf(store: MediaStore, coverageId: string): readonly MediaPhoto[] {
  const coverage = store.getCoverage(coverageId)
  if (coverage === null || coverage.deletedAt !== null) return Object.freeze([])
  return store.photosOf(coverageId)
}

/** ق-١٠٣ — أربعةُ أجوبةٍ أو لا كيان. */
export function createCoverage(
  store: MediaStore,
  ctx: MediaContext,
  input: CreateCoverageInput,
): MediaResult<MediaCoverage> {
  // «ماذا»
  if (input.titleAr.trim().length === 0) return mediaErr("EMPTY_TITLE")

  // «أين» — الوحدةُ من **مستودع هذه الشبكة** (قب-١٨)، والمدى من المحرّك (ق-١٠٥).
  const unit = store.getUnit(input.unitId)
  if (unit === null) return mediaErr("UNKNOWN_MEDIA_UNIT", input.unitId)
  if (!ctx.publishingScope(ctx.actorPersonId, unit.path)) {
    return mediaErr("OUT_OF_PUBLISHING_SCOPE", unit.path)
  }

  // النوعُ من المعجم المغلق — بياناتٌ مرجعية لا اتحادٌ في الكود.
  const kind = store.getKind(input.kindId)
  if (kind === null) return mediaErr("UNKNOWN_COVERAGE_KIND", input.kindId)
  if (!kind.active) return mediaErr("KIND_INACTIVE", kind.id)

  // «متى» — تاريخُ الوقوع، والمستقبلُ مرفوضٌ ما لم يُفتح الإعدادُ الحيّ.
  if (input.occurredOn.getTime() > ctx.now.getTime()) {
    const allowFuture = ctx.settings(FUTURE_DATING_SETTING, unit.path, ctx.now) === true
    if (!allowFuture) return mediaErr("FUTURE_OCCURRENCE_DATE", input.occurredOn.toISOString())
  }

  return store.transaction(() => {
    const coverage: MediaCoverage = {
      tenantId: store.tenantId,
      id: store.nextId("mc"),
      titleAr: input.titleAr.trim(),
      kindId: kind.id,
      unitId: unit.id,
      unitPath: unit.path,
      occurredOn: input.occurredOn,
      // «مَن» — **من الجلسة**.
      publisherPersonId: ctx.actorPersonId,
      createdAt: ctx.now,
      deletedAt: null,
      deletedBy: null,
    }
    store.saveCoverage(coverage)
    return mediaOk(coverage)
  })
}

/**
 * تغطيةٌ **قائمةٌ لصاحبها** — الحارسُ المشترك لكل فعلٍ على ألبومٍ قائم.
 * دفاعٌ في العمق خلف نطاق الخادم الشخصيّ: لو سقط أحدُهما بقي الآخر.
 */
function ownedCoverage(
  store: MediaStore,
  ctx: MediaContext,
  coverageId: string,
): MediaResult<MediaCoverage> {
  const coverage = store.getCoverage(coverageId)
  if (coverage === null) return mediaErr("COVERAGE_NOT_FOUND", coverageId)
  if (coverage.publisherPersonId !== ctx.actorPersonId) {
    return mediaErr("NOT_COVERAGE_PUBLISHER", coverageId)
  }
  if (coverage.deletedAt !== null) return mediaErr("COVERAGE_DELETED", coverageId)
  return mediaOk(coverage)
}

/** ق-١٠٣ — لا صورةَ إلا إلى تغطيةٍ قائمةٍ لناشرها، وبنوعٍ وحجمٍ يقبلهما الخادم (§٧). */
export function addPhoto(
  store: MediaStore,
  ctx: MediaContext,
  input: AddPhotoInput,
): MediaResult<MediaPhoto> {
  const owned = ownedCoverage(store, ctx, input.coverageId)
  if (!owned.ok) return owned

  const format = validateUpload(store, ctx, owned.value.unitPath, {
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  })
  if (!format.ok) return format

  return store.transaction(() => {
    const photo: MediaPhoto = {
      tenantId: store.tenantId,
      id: store.nextId("mp"),
      coverageId: owned.value.id,
      // **المفتاحُ من المستودع لا من المدخل** (المادة ٨/٤).
      storageKey: store.nextId(`media/${owned.value.id}`),
      contentType: format.value.contentType,
      sizeBytes: input.sizeBytes,
      uploadedBy: ctx.actorPersonId,
      uploadedAt: ctx.now,
    }
    store.savePhoto(photo)
    return mediaOk(photo)
  })
}

/** ق-١٠٥ — الحذفُ لناشرها وحده، ويأخذ صورَها؛ وهو **بيانٌ لا محو** (المادة ٧/٤). */
export function deleteCoverage(
  store: MediaStore,
  ctx: MediaContext,
  input: { readonly coverageId: string },
): MediaResult<MediaCoverage> {
  const owned = ownedCoverage(store, ctx, input.coverageId)
  if (!owned.ok) return owned

  return store.transaction(() => {
    const deleted: MediaCoverage = {
      ...owned.value,
      deletedAt: ctx.now,
      deletedBy: ctx.actorPersonId,
    }
    store.saveCoverage(deleted)
    return mediaOk(deleted)
  })
}

/** «تغطياتي» — تغطياتُ صاحب الجلسة وحدَه، أحدثُها وقوعاً أوّلاً. */
export function myCoverages(store: MediaStore, ctx: MediaContext): readonly CoverageSummary[] {
  return store
    .coverages()
    .filter((c) => c.publisherPersonId === ctx.actorPersonId && c.deletedAt === null)
    .map((c) => {
      const photoCount = store.photosOf(c.id).length
      return {
        id: c.id,
        titleAr: c.titleAr,
        kindId: c.kindId,
        unitPath: c.unitPath,
        occurredOn: c.occurredOn,
        photoCount,
        published: photoCount > 0,
      }
    })
    .sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime() || a.id.localeCompare(b.id))
}

/** التغطياتُ المعروضةُ في نطاقٍ — قائمةٌ **بألبومٍ** وغيرُ محذوفة، مرشَّحةٌ هبوطاً (ق-١٧). */
export function displayableCoveragesIn(
  store: MediaStore,
  unitPath: string,
): readonly MediaCoverage[] {
  return store
    .coverages()
    .filter(
      (c) =>
        c.deletedAt === null &&
        contains(unitPath, c.unitPath) &&
        store.photosOf(c.id).length > 0,
    )
}
