/**
 * دوالُّ خادم المكتبة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٩.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنةٌ من الكتالوج** — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة؛ واثنتان
 *     لا ثالثةَ لهما: `library.own` للعمل الشخصيّ و`library.manage` للإدارة المنطاقة.
 *  ٢. **النطاقُ مشتقّ**: الوحدةُ من **مستودع هذه الشبكة** (قب-١٨)، ونطاقُ الفعل على مادةٍ
 *     قائمة **من المادة المخزَّنة** — وهو ما يقتل **ح-٦**؛ والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ
 *     يُقفل ولا يُفتح**.
 *  ٣. **الأفعالُ الشخصيةُ نطاقُها ملكيّة** (ق-٢٧/قب-٣٨): `selfScope` يجعل النيابةَ مستحيلةً
 *     **قبل جسم الدالة** — والمدير كغيره، بلا فرعٍ يقول «إن كان مديراً».
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: كلُّ خَتمةٍ تُكتب بـ`actor.personId`.
 *
 * > **و«مكتبتي» تُعلن نيّتَها كتابةً**: الاستلامُ يُختم عند أول عرض (ق-٩٦)، فالعرضُ فعلٌ
 * > كاتب — **والإعلانُ يصف الفعلَ لا الشاشة**. وثمرتُه أنّ الانتحالَ القرائيّ (ب-٤٠أ)
 * > لا يختم باسم أحد.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { LibraryStore } from "../data/store.js"
import { makeAudienceMembership, type ActorDirectory } from "../services/audience.js"
import { makeScopeReach } from "../services/directory.js"
import type { LibraryContext } from "../services/context.js"
import type { LibraryPorts } from "../services/ports.js"
import {
  archiveMaterial,
  createMaterial,
  updateMaterial,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from "../services/materials.js"
import { myLibrary, type MyLibraryFilter, type MyLibraryView } from "../services/mine.js"
import { completeMaterial, openMaterial } from "../services/timeline.js"
import { manageView, type LibraryManageView } from "../services/tracking.js"
import { overdueMandatory, type OverdueMandatory } from "../services/reminders.js"
import type { LibraryMaterial, LibraryResult, MaterialProgress } from "../types.js"

/** كيانُ الملكية في الأفعال الشخصية — اسمٌ واحدٌ معلن، فالنطاقُ لا يُرتجل. */
const PERSONAL_ENTITY = "libraryProgress"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: LibraryStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ فعلٍ على مادةٍ قائمة: **من الكيان المخزَّن** — والمجهولةُ ⇒ `NO_SCOPE` (ح-٦). */
function materialScope(store: LibraryStore, materialId: string | undefined): Scope {
  const material = materialId === undefined ? null : store.getMaterial(materialId)
  return material === null ? NO_SCOPE : unitScope(material.unitPath)
}

/** نطاقُ فعلٍ شخصيّ: **دعوى ملكيةٍ من المدخل يقارنها المحرّكُ بهوية الجلسة**. */
function personalScope(personId: string | undefined, entityId: string): Scope {
  return personId === undefined ? NO_SCOPE : selfScope(personId, PERSONAL_ENTITY, entityId)
}

export function makeLibraryEndpoints(
  store: LibraryStore,
  settings: SettingsResolver,
  directory: ActorDirectory,
  ports: LibraryPorts,
) {
  /** سياقُ الخدمات: الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ محقونة (قب-٦). */
  const contextOf = (actor: Actor, request: DecisionContext): LibraryContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    inAudience: makeAudienceMembership(directory, request),
    reaches: makeScopeReach(directory, request.now),
    ports,
  })

  const mineFn = defineServerFn({
    name: "library.mine.view",
    capability: "library.own",
    scope: (input: { personId: string }) => personalScope(input.personId, "mine"),
    // **كاتبةٌ لأنها تختم الاستلام** (ق-٩٦) — الإعلانُ يصف الفعل لا الشاشة.
    intent: "write",
    audit: "library.mine.view",
    handler: async (
      input: { personId: string; filter?: MyLibraryFilter },
      { actor, request },
    ): Promise<MyLibraryView> => myLibrary(store, contextOf(actor, request), input.filter ?? {}),
  })

  const openFn = defineServerFn({
    name: "library.material.open",
    capability: "library.own",
    scope: (input: { personId: string; materialId: string }) =>
      personalScope(input.personId, input.materialId),
    intent: "write",
    audit: "library.material.open",
    handler: async (
      input: { personId: string; materialId: string },
      { actor, request },
    ): Promise<LibraryResult<MaterialProgress>> =>
      openMaterial(store, contextOf(actor, request), input),
  })

  const completeFn = defineServerFn({
    name: "library.material.complete",
    capability: "library.own",
    scope: (input: { personId: string; materialId: string }) =>
      personalScope(input.personId, input.materialId),
    intent: "write",
    audit: "library.material.complete",
    handler: async (
      input: { personId: string; materialId: string },
      { actor, request },
    ): Promise<LibraryResult<MaterialProgress>> =>
      completeMaterial(store, contextOf(actor, request), input),
  })

  const manageViewFn = defineServerFn({
    name: "library.manage.view",
    capability: "library.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "library.manage.view",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<LibraryManageView> => {
      const unit = store.getUnit(input.unitId)!
      return manageView(store, contextOf(actor, request), unit.path)
    },
  })

  const createMaterialFn = defineServerFn({
    name: "library.material.create",
    capability: "library.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "library.material.create",
    handler: async (
      input: CreateMaterialInput,
      { actor, request },
    ): Promise<LibraryResult<LibraryMaterial>> =>
      createMaterial(store, contextOf(actor, request), input),
  })

  const updateMaterialFn = defineServerFn({
    name: "library.material.update",
    capability: "library.manage",
    scope: (input: { materialId: string }) => materialScope(store, input.materialId),
    intent: "write",
    audit: "library.material.update",
    // **لا سياقَ للتعديل**: لا ساعةَ ولا فاعلَ يُكتبان فيه — العنوانُ والجمهورُ بياناتٌ
    // يحكمها المعجم، والنطاقُ فُرض قبل جسم الدالة.
    handler: async (input: UpdateMaterialInput): Promise<LibraryResult<LibraryMaterial>> =>
      updateMaterial(store, input),
  })

  const archiveMaterialFn = defineServerFn({
    name: "library.material.archive",
    capability: "library.manage",
    scope: (input: { materialId: string }) => materialScope(store, input.materialId),
    intent: "write",
    audit: "library.material.archive",
    handler: async (
      input: { materialId: string },
      { actor, request },
    ): Promise<LibraryResult<LibraryMaterial>> =>
      archiveMaterial(store, contextOf(actor, request), input),
  })

  const overdueFn = defineServerFn({
    name: "library.overdue.view",
    capability: "library.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "library.overdue.view",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly OverdueMandatory[]> => {
      const unit = store.getUnit(input.unitId)!
      return overdueMandatory(store, contextOf(actor, request), unit.path)
    },
  })

  return {
    mine: mineFn,
    open: openFn,
    complete: completeFn,
    manageView: manageViewFn,
    createMaterial: createMaterialFn,
    updateMaterial: updateMaterialFn,
    archiveMaterial: archiveMaterialFn,
    overdue: overdueFn,
  }
}
