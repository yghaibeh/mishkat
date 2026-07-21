/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * وستُّ قدراتٍ لا سابعةَ لها — وهي عينُ ما يعلنه عقدُ الوحدة §٨.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { rootScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** قدراتُ شاشة سجل اليوم — تُقاس على **نطاق الوحدة** المعروضة. */
export const DAILY_LOG_SCREEN_CAPS: readonly CapId[] = Object.freeze([
  "dailyLog.view",
  "dailyLog.edit",
  "familyRoster.manage",
  "report.submit",
  "report.retract",
])

/** قدرةُ شاشة الكتالوج **جذريّة**: مرجعٌ مركزيٌّ على الشبكة كلِّها (IA ك-١٨). */
export const CATALOG_SCREEN_CAPS: readonly CapId[] = Object.freeze(["activityCatalog.manage"])

export function computeDailyLogCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of DAILY_LOG_SCREEN_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  // النطاقُ الجذريّ **يُمرَّر صراحةً** فلا يكون الشمولُ سهواً (المادة ٤/٣).
  for (const cap of CATALOG_SCREEN_CAPS) {
    if (can(actor, cap, rootScope(), ctx).allowed) granted.add(cap)
  }
  return granted
}
