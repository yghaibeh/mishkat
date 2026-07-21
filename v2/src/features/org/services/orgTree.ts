/**
 * خدمة الشجرة التنظيمية — SPEC_org_and_accounts §١.
 *
 * تعمل بعد فرض القدرة في طبقة الخادم؛ مسؤوليتها **القواعد البنيوية والاتساق**:
 * وراثة القسم (ق-٢٠)، منع الخلط، الطبقة الموقوفة معطّلة (قب-٧)، وإعادة الاشتقاق الذرّية.
 * الأخطاء قيمٌ معلنة (المادة ٣/٤): لا استثناء لخطأ عمل.
 */

import { OrgStore, childPath } from "../data/store.js"
import { isDisabledUnitType, isLegalChildType, sectionOfSegment } from "../data/hierarchy.js"
import { bumpEpochsUnderPath } from "./session.js"
import { ok, err, type OrgUnit, type Result, type Section } from "../types.js"
import type { UnitTypeId } from "../../../authorization/generated/roles.generated.js"

type Clock = { readonly now: Date }

export type CreateUnitInput = {
  readonly parentId: string
  readonly id: string
  readonly type: UnitTypeId
  readonly labelAr: string
}

/** القسمُ يُورَّث من الأب حتماً؛ والقسمان يُثبِّتانه في مقطعهما (ق-٢٠). */
function sectionUnder(parent: OrgUnit, childId: string): Section | null {
  return parent.section !== null ? parent.section : sectionOfSegment(childId)
}

export function createUnit(store: OrgStore, _ctx: Clock, input: CreateUnitInput): Result<OrgUnit> {
  const parent = store.getUnit(input.parentId)
  if (parent === null) return err("PARENT_NOT_FOUND")
  if (store.getUnit(input.id) !== null) return err("DUPLICATE_ID")
  // الطبقة الموقوفة: غيابُ صفوفٍ لا if خاص — نوعٌ معطَّل لا تُنشأ منه عقدة (قب-٧).
  if (isDisabledUnitType(input.type)) return err("DISABLED_UNIT_TYPE")
  if (!isLegalChildType(parent.type, input.type)) return err("UNIT_TYPE_MISMATCH")

  const unit: OrgUnit = {
    // الشبكةُ تُشتقّ من سياق المستودع لا من مدخل العميل (§١.٠) — والمستودعُ يختمها أيضاً.
    tenantId: store.tenantId,
    id: input.id,
    type: input.type,
    labelAr: input.labelAr,
    parentId: parent.id,
    path: childPath(parent.path, input.id),
    section: sectionUnder(parent, input.id),
    archived: false,
  }
  store.saveUnit(unit)
  return ok(unit)
}

export type MoveUnitInput = {
  readonly unitId: string
  readonly newParentId: string
}

function hasLiveAssignmentUnder(store: OrgStore, path: string, now: Date): boolean {
  return store.assignments.some(
    (a) =>
      a.scopePath.startsWith(path) &&
      a.approvalStatus === "approved" &&
      (a.endDate === null || a.endDate.getTime() > now.getTime()),
  )
}

export function moveUnit(store: OrgStore, ctx: Clock, input: MoveUnitInput): Result<OrgUnit> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return err("ENTITY_NOT_FOUND")
  const newParent = store.getUnit(input.newParentId)
  if (newParent === null) return err("PARENT_NOT_FOUND")
  if (!isLegalChildType(newParent.type, unit.type)) return err("UNIT_TYPE_MISMATCH")

  const newSection = sectionUnder(newParent, unit.id)
  // منعُ الخلط بأثرٍ رجعيّ (ق-٢٠): نقلٌ يغيّر القسم فوق تكليفٍ حيّ مرفوض.
  if (newSection !== unit.section && hasLiveAssignmentUnder(store, unit.path, ctx.now)) {
    return err("SECTION_MIX_REJECTED")
  }

  const oldPrefix = unit.path
  const newUnitPath = childPath(newParent.path, unit.id)
  return store.transaction(() => {
    for (const u of store.subtreeOf(oldPrefix)) {
      const rebased = newUnitPath + u.path.slice(oldPrefix.length)
      const isRoot = u.id === unit.id
      store.saveUnit({
        ...u,
        parentId: isRoot ? newParent.id : u.parentId,
        path: rebased,
        section: newSection,
      })
    }
    return ok(store.getUnit(input.unitId)!)
  })
}

export function archiveUnit(store: OrgStore, _ctx: Clock, unitId: string): Result<OrgUnit> {
  const unit = store.getUnit(unitId)
  if (unit === null) return err("ENTITY_NOT_FOUND")
  const archived: OrgUnit = { ...unit, archived: true }
  store.saveUnit(archived)
  // إبطالٌ لحظيّ لكل مكلَّفٍ تحتها — يمنع «الأمير الشبح» لمسجدٍ مؤرشف (§٤.٥).
  bumpEpochsUnderPath(store, unit.path)
  return ok(archived)
}
