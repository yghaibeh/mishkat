/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * وسبعُ قدراتٍ لا ثامنةَ لها — وهي عينُ ما يعلنه عقدُ الوحدة §٦.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "box.view",
  "box.receive",
  "box.spend",
  "box.handover",
  "box.handover.acknowledge",
  "mosqueFinance.view",
  "mosqueFinance.manage",
])

/**
 * **القدرةُ الشخصية لا تُحسب بنطاق**: `box.handover.acknowledge` نوعُها «ش»، ومسارُ قرارها
 * ملكيةُ الكيان لا الشجرة (§١.١). فلا تُسأل هنا بنطاقٍ مصطنع — وإلا ظهر بابٌ شخصيٌّ للجميع
 * (وهو عينُ العيب الذي اصطاده سياجُ الواجهة في T5). حضورُها في الشاشة يُحسب من **وجود
 * تسليمٍ ينتظر إقرارَ هذا الشخص بعينه** (`myPendingHandovers`)، وفرضُها في الخادم بنطاقٍ
 * شخصيٍّ مشتقٍّ من التسليم المخزَّن.
 */
const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["box.handover.acknowledge"])

export function computeBoxCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (PERSONAL_CAPS.includes(cap)) continue
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
