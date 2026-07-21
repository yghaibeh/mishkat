/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * **ومسارا الحساب مفصولان بحكم النموذج** (§١.١): المنطاقةُ تُسأل بـ`can()` على نطاق الشاشة،
 * و**الشخصيةُ لا تُسأل بنطاقٍ أبداً** — `can()` يردّ كلَّ قدرةٍ شخصيةٍ بنطاق وحدة
 * (`DENIED_PERSONAL_NOT_OWNER`) ولو كان السائلُ صاحبَها؛ فمصدرُ ظهورها **الملكيةُ** وحدها.
 * خلطُ المسارين هو بعينه العيبُ الذي اصطاده سياجُ T5 على «حلقاتي» (بابٌ شخصيٌّ ظهر للجميع).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { CommitteeStore } from "../data/store.js"
import { committeesLedBy } from "../services/committees.js"

/** القدراتُ **المنطاقة** التي تُسأل بنطاق الشاشة. */
export const SCOPED_SCREEN_CAPS: readonly CapId[] = Object.freeze([
  "committees.view",
  "committees.manage",
  "meetings.view",
  "meetings.manage",
])

/** القدرةُ **الشخصية** — مصدرُها الملكيةُ لا الشجرة (ك-٢٣: «لجنتي»). */
export const PERSONAL_SCREEN_CAPS: readonly CapId[] = Object.freeze(["committee.own"])

export function computeCommitteeCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCOPED_SCREEN_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}

/**
 * **قشرةُ الشاشة كاملةً**: المنطاقةُ من المحرّك، والشخصيةُ من **قيادةِ لجنةٍ فعلاً**.
 * وهي المصدرُ الوحيد لظهور باب «لجنتي» — فلا يظهر لأميرٍ ولا لمديرٍ مهما علت سلطتُه.
 */
export function computeCommitteeScreenCaps(
  store: CommitteeStore,
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>(computeCommitteeCaps(actor, scopePath, ctx))
  if (committeesLedBy(store, actor.personId).length > 0) {
    for (const cap of PERSONAL_SCREEN_CAPS) granted.add(cap)
  }
  return granted
}
