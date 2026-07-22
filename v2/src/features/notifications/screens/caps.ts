/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي بها فقط — لا فحصَ دورٍ
 * في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ إعلانُ القدرة على دالة
 * الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * **والقدرةُ الشخصية تُسأل بملكيّتها لا بنطاقٍ مصطنع** (§١.١): `account.self` مسارُ قرارها في
 * المحرّك **حزمةُ الدور وملكيةُ الكيان معاً** (قب-٣٨) — وصاحبُ الصفحة هو الفاعلُ نفسُه،
 * فتُسأل بنطاقه الشخصيّ ويُجيب المحرّكُ عنها كما يُجيب في الخادم تماماً (لا مسارَ ثانٍ).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** القدراتُ التي تحكم عناصرَ شاشتَي هذه الوحدة — اثنتان لا ثالثةَ لهما (عقدُ الوحدة §٧). */
export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "account.self",
  "announcement.publish",
])

/** الشخصيةُ تُسأل بالملكيّة، والمنطاقةُ تُسأل بنطاق الصفحة — لا خلطَ بين المسارين. */
const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["account.self"])

export function computeNotificationCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    const scope = PERSONAL_CAPS.includes(cap)
      ? selfScope(actor.personId, "notification", "self")
      : unitScope(scopePath)
    if (can(actor, cap, scope, ctx).allowed) granted.add(cap)
  }
  return granted
}
