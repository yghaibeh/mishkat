/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * وثلاثُ قدراتٍ لا رابعةَ لها — وهي عينُ ما تعلنه عقودُ الشاشات §٦: قدرتان تعملان
 * (`visit.conduct` للتنفيذ، و`visit.approve` لصندوق اعتماد الأقرب) وواحدةٌ تطّلع (`visit.view`).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** قدراتُ شاشات الإشراف — كلُّها تُقاس على **نطاق الشاشة** المعروضة (لا على الجذر). */
export const SUPERVISION_SCREEN_CAPS: readonly CapId[] = Object.freeze([
  "visit.conduct",
  "visit.approve",
  "visit.view",
])

export function computeSupervisionCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SUPERVISION_SCREEN_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
