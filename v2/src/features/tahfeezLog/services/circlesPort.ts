/**
 * **المحوّلُ الوحيد** بين هذه الوحدة ونموذج الحلقات الموحّد (عقدُ الوحدة §١).
 *
 * هو **الملفُّ الوحيد في الوحدة كلِّها** الذي يستورد من `features/circles/` — وحارسٌ محتوائيّ
 * يُفشل التسليمَ إن صاروا اثنين أو صفراً:
 *  - **اثنان** ⇒ معرفةُ نموذج T16 تسرّبت إلى الخدمات، فصار تبديلُه يمسّ الوحدةَ كلَّها.
 *  - **صفر** ⇒ **استُنسِخ النموذجُ بدل الاتصال به** — وهو بعينه ما وُلدت T16 لقتله (ب-٢٨).
 *
 * ولا يستورد إلا من **سطوح T16 المُعلَنة** (`services/derive.ts` · `services/catalog.ts`
 * · نوعِ مستودعها)، **ولا يكتب فيها حرفاً**: لا `save…` ولا `append…` في هذا الملفّ.
 */

import type { CirclesStore } from "../../circles/data/store.js"
import {
  circlesInScope as circlesInScopeOfT16,
  circlesOfTeacher as circlesOfTeacherOfT16,
  enrollmentsOf as enrollmentsOfT16,
} from "../../circles/services/derive.js"
import { typeById } from "../../circles/services/catalog.js"
import type { Circle } from "../../circles/types.js"
import type { CircleModelPort, CircleRef } from "./circleModel.js"

/** إسقاطُ كيان T16 على **ما يخصّ هذه الوحدةَ وحده** — لا نسخةٌ كاملة (ولا اسمَ ولا سعة). */
function refOf(circle: Circle): CircleRef {
  return {
    id: circle.id,
    unitPath: circle.unitPath,
    typeId: circle.typeId,
    teacherPersonId: circle.teacherPersonId,
    archived: circle.archivedAt !== null,
  }
}

export function circleModelFrom(store: CirclesStore): CircleModelPort {
  return {
    circleOf: (circleId) => {
      const circle = store.getCircle(circleId)
      return circle === null ? null : refOf(circle)
    },
    enrollmentsOf: (circleId) =>
      enrollmentsOfT16(store, circleId).map((e) => ({ id: e.id, nameAr: e.nameAr })),
    circlesInScope: (unitPath) => circlesInScopeOfT16(store, unitPath).map(refOf),
    circlesOfTeacher: (personId) => circlesOfTeacherOfT16(store, personId).map(refOf),
    hasType: (typeId) => typeById(store, typeId) !== null,
    unitPathOf: (unitId) => store.getUnit(unitId)?.path ?? null,
  }
}
