/**
 * دوالُّ خادم الإعلام — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنةٌ من الكتالوج** — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة؛ واثنتان
 *     لا ثالثةَ لهما: `media.hub` للاطّلاع و`media.post` للعمل.
 *  ٢. **النطاقُ مشتقّ**: الوحدةُ من **مستودع هذه الشبكة** (قب-١٨)، والملكيةُ من **التغطية
 *     المخزَّنة** — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **الأفعالُ الشخصيةُ نطاقُها ملكيّة** (ق-٢٧/ق-١٠٥): `selfScope` يجعل النيابةَ مستحيلةً
 *     **قبل جسم الدالة** — والمدير كغيره، بلا فرعٍ يقول «إن كان مديراً».
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن ينشر ومَن يرفع ومَن يحذف كلُّهم `actor`.
 *
 * > **الإنشاءُ لا كيانَ مخزَّناً له بعد** (عقدُ الوحدة §٢.١): نطاقُه **دعوى ملكيةٍ من المدخل
 * > يقارنها المحرّكُ بهوية الجلسة**، فالمدخلُ لا يُصدَّق بل يُقارَن — ومطابقتُه شرطُ القبول.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { MediaStore } from "../data/store.js"
import { makePublishingScopeCheck, type ActorDirectory } from "../services/scope.js"
import type { MediaContext } from "../services/context.js"
import type { MediaPorts } from "../services/ports.js"
import {
  addPhoto,
  createCoverage,
  deleteCoverage,
  myCoverages,
  type AddPhotoInput,
  type CoverageSummary,
  type CreateCoverageInput,
} from "../services/coverages.js"
import { mediaHubView, type MediaHubView } from "../services/gallery.js"
import type { MediaCoverage, MediaPhoto, MediaResult } from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: MediaStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ فعلٍ على تغطيةٍ قائمة: **ملكيةٌ من الكيان المخزَّن** — والمجهولةُ ⇒ `NO_SCOPE`. */
function coverageOwnerScope(store: MediaStore, coverageId: string | undefined): Scope {
  const coverage = coverageId === undefined ? null : store.getCoverage(coverageId)
  return coverage === null
    ? NO_SCOPE
    : selfScope(coverage.publisherPersonId, "mediaCoverage", coverage.id)
}

export function makeMediaEndpoints(
  store: MediaStore,
  settings: SettingsResolver,
  directory: ActorDirectory,
  ports: MediaPorts,
) {
  /** سياقُ الخدمات: الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ محقونة (قب-٦). */
  const contextOf = (actor: Actor, request: DecisionContext): MediaContext => ({
    now: request.now,
    settings,
    actorPersonId: actor.personId,
    publishingScope: makePublishingScopeCheck(directory, request),
    ports,
  })

  const hubViewFn = defineServerFn({
    name: "media.hub.view",
    capability: "media.hub",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "media.hub.view",
    handler: async (input: { unitId: string }, { actor, request }): Promise<MediaHubView> => {
      const unit = store.getUnit(input.unitId)!
      return mediaHubView(store, contextOf(actor, request), unit.path)
    },
  })

  const createCoverageFn = defineServerFn({
    name: "media.coverage.create",
    capability: "media.post",
    scope: (input: { publisherPersonId: string }) =>
      selfScope(input.publisherPersonId, "mediaCoverage", "new"),
    intent: "write",
    audit: "media.coverage.create",
    handler: async (
      input: CreateCoverageInput,
      { actor, request },
    ): Promise<MediaResult<MediaCoverage>> =>
      createCoverage(store, contextOf(actor, request), input),
  })

  const addPhotoFn = defineServerFn({
    name: "media.coverage.photo.add",
    capability: "media.post",
    scope: (input: { coverageId: string }) => coverageOwnerScope(store, input.coverageId),
    intent: "write",
    audit: "media.coverage.photo.add",
    handler: async (input: AddPhotoInput, { actor, request }): Promise<MediaResult<MediaPhoto>> =>
      addPhoto(store, contextOf(actor, request), input),
  })

  const deleteCoverageFn = defineServerFn({
    name: "media.coverage.delete",
    capability: "media.post",
    scope: (input: { coverageId: string }) => coverageOwnerScope(store, input.coverageId),
    intent: "write",
    audit: "media.coverage.delete",
    handler: async (
      input: { coverageId: string },
      { actor, request },
    ): Promise<MediaResult<MediaCoverage>> =>
      deleteCoverage(store, contextOf(actor, request), input),
  })

  const myCoveragesFn = defineServerFn({
    name: "media.coverages.mine",
    capability: "media.post",
    scope: (input: { publisherPersonId: string }) =>
      selfScope(input.publisherPersonId, "mediaCoverage", "mine"),
    intent: "read",
    audit: "media.coverages.mine",
    handler: async (
      _input: { publisherPersonId: string },
      { actor, request },
    ): Promise<readonly CoverageSummary[]> => myCoverages(store, contextOf(actor, request)),
  })

  return {
    hubView: hubViewFn,
    createCoverage: createCoverageFn,
    addPhoto: addPhotoFn,
    deleteCoverage: deleteCoverageFn,
    myCoverages: myCoveragesFn,
  }
}
