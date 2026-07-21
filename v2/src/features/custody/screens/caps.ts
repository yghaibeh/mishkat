/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * أربعُ قدراتٍ لا خامسةَ لها — وهي عينُ ما يعلنه عقدُ الوحدة §٧.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاق**: `custody.own` نوعُها «ش»، ومسارُ قرارها في المحرّك
 * **ملكيةُ الكيان لا الشجرة** (§٤.٢) — فلو سُئل بنطاقٍ مصطنع لأجاب «نعم» لكلّ أحد، فظهر
 * بابُ «عُهدتي» للجميع (عينُ العيب الذي اصطاده سياجُ الواجهة في T5). ولذلك يُحقن **مِجسُّ
 * ملكيةٍ حقيقيّ**: `hasOwnCustody` — استعلامٌ على الكيان المخزَّن، لا إسقاطٌ عن حزمة الدور.
 * وهذا هو المِجسُّ الحقيقيُّ الذي انتظرته `home/screens/caps.ts` («يُستبدَل باستعلام ملكيةٍ
 * حقيقيّ مع أول كيانٍ مملوك») — وربطُه هناك يخصّ وحدةَ الرئيسية لا هذه.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { CustodyStore } from "../data/store.js"
import { openCustodyOf, pendingReceiptsFor } from "../services/derive.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "custody.view",
  "custody.grant",
  "asset.manage",
  "custody.own",
])

const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["custody.own"])

/**
 * **مِجسُّ الملكية**: أبهذا الشخص عهدةٌ فعلاً؟ (بيده أو تنتظر إقرارَه) — فبابُ «عُهدتي»
 * لا يُفتح لمن لا عهدةَ له ولو منحه دورُه القدرة.
 */
export function hasOwnCustody(store: CustodyStore, personId: string): boolean {
  return openCustodyOf(store, personId).length > 0 || pendingReceiptsFor(store, personId).length > 0
}

export function computeCustodyCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  ownsCustody: boolean,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (PERSONAL_CAPS.includes(cap)) {
      if (!ownsCustody) continue
      if (can(actor, cap, selfScope(actor.personId, "custody", actor.personId), ctx).allowed) {
        granted.add(cap)
      }
      continue
    }
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
