/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * وأربعُ قدراتٍ لا خامسةَ لها في سطح الرواتب المركزية — وهي عينُ ما يعلنه عقدُ الوحدة §٩.
 * **وقدرةُ الإقرار `payroll.approve` ليست منها**: إعلانُها وسطحُها في **مجلد المحرّك** حصراً
 * (G22)، وبابُها في شاشة «بانتظار اعتمادك» هناك لا هنا — فالوحدةُ **تقترح ولا تقرّ**.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "payroll.view",
  "payroll.run",
  "finance.payout",
  "incentive.manage",
])

/**
 * **القدرةُ الشخصية لا تُحسب بنطاق**: `payroll.own` نوعُها «ش»، ومسارُ قرارها ملكيةُ الكيان
 * لا الشجرة (§١.١) — فلو سُئلت هنا بنطاقٍ مصطنع لَظهر بابٌ شخصيٌّ للجميع (وهو عينُ العيب
 * الذي اصطاده سياجُ الواجهة في T5). حضورُها في شاشة «كشفُ راتبي» من **ملكية الشخص لكشفه**،
 * وفرضُها في الخادم بنطاقٍ شخصيٍّ مشتقٍّ من الفاعل نفسِه.
 */
const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["payroll.own"])

export function computePayrollCaps(
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
