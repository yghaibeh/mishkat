/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * **ثلاثُ قدراتٍ لا رابعةَ لها** — وهي عينُ ما يعلنه عقدُ الوحدة §٧.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاق**: `circle.teach` نوعُها «ش»، ومسارُ قرارها في المحرّك
 * **ملكيةُ الكيان مع حزمة الدور** (§٤.٢ + قب-٣٨) — فلو سُئل بنطاقٍ مصطنع لأجاب «نعم» لكلّ
 * أحد، **فظهر بابُ «حلقاتي» للجميع** (وهو بعينه العيبُ الذي اصطاده سياجُ الواجهة في T5 على
 * هذا الباب نفسِه). ولذلك يُحقن **مِجسُّ ملكيةٍ حقيقيّ**: `teachesAnyCircle` — استعلامٌ على
 * الكيان المخزَّن، لا إسقاطٌ عن حزمة الدور.
 *
 * > وهذا هو **الاستعلامُ الحقيقيّ** الذي انتظرته `home/screens/caps.ts` لبابِ «حلقاتي»
 * > («يُستبدَل باستعلام ملكيةٍ حقيقيّ مع أول كيانٍ مملوك») — وربطُه هناك يخصّ وحدةَ الرئيسية.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { CirclesStore } from "../data/store.js"
import { circlesOfTeacher } from "../services/derive.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "circle.view",
  "circle.manage",
  "circle.teach",
])

const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["circle.teach"])

/**
 * **مِجسُّ الملكية**: أبهذا الشخص حلقةٌ مُسنَدةٌ فعلاً؟ — فبابُ «حلقاتي» لا يُفتح لمن لا
 * حلقةَ له ولو منحه دورُه القدرة. وهو أيضاً **الجوابُ البنيويّ لـع-٢٩**: العددُ من السجل
 * الواحد لا من عدّادٍ يُحدَّث.
 */
export function teachesAnyCircle(store: CirclesStore, personId: string): boolean {
  return circlesOfTeacher(store, personId).length > 0
}

export function computeCirclesCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  teachesCircle: boolean,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (PERSONAL_CAPS.includes(cap)) {
      if (!teachesCircle) continue
      if (can(actor, cap, selfScope(actor.personId, "circle", actor.personId), ctx).allowed) {
        granted.add(cap)
      }
      continue
    }
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
