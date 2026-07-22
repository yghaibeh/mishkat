/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * **أربعُ قدراتٍ لا خامسةَ لها** — وهي عينُ ما يعلنه عقدُ الوحدة §٨.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاق**: `circle.teach` نوعُها «ش»، ومسارُ قرارها في المحرّك
 * **ملكيةُ الكيان مع حزمة الدور** (§٤.٢ + قب-٣٨) — فلو سُئل بنطاقٍ مصطنع لأجاب «نعم» لكلّ
 * أحد، **فظهر بابُ «دروسي» للجميع** (وهو عينُ العيب الذي اصطاده سياجُ الواجهة في T5).
 * ولذلك يُحقن **مِجسُّ ملكيةٍ حقيقيّ** (`teachesCircle`) يحسبه المُركِّبُ من الكيان المخزَّن.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { rootScope, selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "circle.view",
  "circle.manage",
  "circle.teach",
  "activityCatalog.manage",
])

const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["circle.teach"])
/** قدرةٌ **جذرية**: تُسأل على الجذر صراحةً فلا يكون الشمولُ سهواً (المادة ٤/٣). */
const ROOT_CAPS: readonly CapId[] = Object.freeze(["activityCatalog.manage"])

export function computeEducationCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  teachesCircle: boolean,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (PERSONAL_CAPS.includes(cap)) {
      if (!teachesCircle) continue
      if (can(actor, cap, selfScope(actor.personId, "lesson", actor.personId), ctx).allowed) {
        granted.add(cap)
      }
      continue
    }
    const scope = ROOT_CAPS.includes(cap) ? rootScope() : unitScope(scopePath)
    if (can(actor, cap, scope, ctx).allowed) granted.add(cap)
  }
  return granted
}
