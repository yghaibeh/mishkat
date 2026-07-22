/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * **خمسُ قدراتٍ لا سادسةَ لها** — وهي عينُ ما يعلنه عقدُ الوحدة §١٠.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاق**: `circle.teach` نوعُها «ش»، ومسارُ قرارها في المحرّك
 * **ملكيةُ الكيان مع حزمة الدور** (§٤.٢ + قب-٣٨) — فلو سُئل بنطاقٍ مصطنع لأجاب «نعم» لكلّ
 * أحد، فظهر بابُ «سجلُّ حلقاتي» للجميع (وهو عينُ العيب الذي اصطاده سياجُ الواجهة في T5).
 * ولذلك يُحقن **مِجسُّ ملكيةٍ حقيقيّ**: أللفاعل حلقةٌ مُسنَدة فعلاً؟
 *
 * **وإخفاءُ الزر ليس حماية**: الحمايةُ إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ**
 * مع الفرض لا بديلٌ عنه — ولذلك مصفوفةُ الشاشات تقرن كلَّ غيابٍ برفضٍ من الخادم.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { CircleModelPort } from "../services/circleModel.js"

/** القدراتُ المنطاقة — تُقاس على **نطاق الحلقة/الوحدة** المعروضة. */
export const SCOPED_SCREEN_CAPS: readonly CapId[] = Object.freeze([
  "circle.view",
  "circle.manage",
  "circle.notes.supervise",
  "guardianLink.manage",
])

/** القدرةُ الشخصيةُ الوحيدة في الوحدة — تُسأل بالملكية لا بالنطاق. */
export const PERSONAL_SCREEN_CAPS: readonly CapId[] = Object.freeze(["circle.teach"])

/** **مِجسُّ الملكية**: أبهذا الشخص حلقةٌ مُسنَدةٌ فعلاً؟ — من السجل الواحد لا من عدّاد (ع-٢٩). */
export function teachesAnyCircle(circles: CircleModelPort, personId: string): boolean {
  return circles.circlesOfTeacher(personId).length > 0
}

export function computeCircleLogCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  teachesCircle: boolean,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCOPED_SCREEN_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  for (const cap of PERSONAL_SCREEN_CAPS) {
    if (!teachesCircle) continue
    if (can(actor, cap, selfScope(actor.personId, "circleLog", actor.personId), ctx).allowed) {
      granted.add(cap)
    }
  }
  return granted
}
