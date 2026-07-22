/**
 * **ملفُّ الوصل الوحيد** بين هذه الوحدة ونموذج الحلقات الموحّد (عقدُ الوحدة §١).
 *
 * كلُّ ما تعرفه هذه الوحدةُ عن الحلقة يمرّ من هنا — وهذا مقصودٌ ويُقاس بالمحتوى
 * (`single-circle-entity.test.ts`): **ملفٌّ واحدٌ يستورد `circles`، وما عداه يسأل منفذاً**.
 * فيبقى **مصدرُ الحقيقة واحداً** (المادة ١/٢) و**الاعتمادُ بين الوحدات بواجهاتٍ معلنة**
 * (المادة ٣/٢) — ولا يُعاد بناءُ الحلقة ولا سجلِّ طلابها هنا بحال.
 */

import type { CirclesStore } from "../../circles/data/store.js"
import { enrollmentsOf } from "../../circles/services/derive.js"
import { allTypes } from "../../circles/services/catalog.js"
import type { CircleReader, CircleTypeReader, RosterReader } from "./ports.js"

/** حزمةُ منافذِ الحلقة — تُمرَّر معاً فلا تُوصَل واحدةٌ بمصدرٍ وأختُها بآخر. */
export type EducationPorts = {
  readonly circleOf: CircleReader
  readonly rosterOf: RosterReader
  readonly circleTypeIds: CircleTypeReader
}

export function makeCirclePorts(store: CirclesStore): EducationPorts {
  return {
    circleOf: (circleId) => {
      const circle = store.getCircle(circleId)
      if (circle === null) return null
      return {
        id: circle.id,
        unitPath: circle.unitPath,
        typeId: circle.typeId,
        teacherPersonId: circle.teacherPersonId,
        archivedAt: circle.archivedAt,
      }
    },
    // **الملتحقون الحاليّون من السجل الواحد** — لا نسخةَ ثانيةً تتباعد (ع-٢٩).
    rosterOf: (circleId) =>
      enrollmentsOf(store, circleId).map((e) => ({ id: e.id, nameAr: e.nameAr })),
    circleTypeIds: () => allTypes(store).map((t) => t.id),
  }
}
