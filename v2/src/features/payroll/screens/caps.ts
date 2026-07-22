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
 * **والقدرةُ الشخصية `payroll.own` ليست في القائمة أعلاه عمداً**: نوعُها «ش»، ومسارُ قرارها
 * **ملكيةُ الكيان لا الشجرة** (§١.١). حضورُها في «كشفُ راتبي» من ملكية الشخص لكشفه،
 * وفرضُها في الخادم **بنطاقٍ شخصيٍّ مشتقٍّ من الفاعل نفسِه** لا من مدخله.
 *
 * > **وحارسُها في المحرّك لا هنا** — وهذا فرقٌ اكتُشف بالكسر المُوجَّه (قب-٤٦ §١): كان في هذا
 * > المِلفّ سطرُ تخطٍّ (`PERSONAL_CAPS`) يبدو حارساً وهو **ميّتٌ مرّتين**: القدرةُ الشخصية
 * > **ليست في القائمة أصلاً** فلا يجري عليه الدور، **و`can()` يردّها بنفسه** بنطاقٍ منطاقٍ
 * > (`DENIED_PERSONAL_NOT_OWNER`) فلا أثرَ له لو جرى. **كسرُه لم يُسقط اختباراً واحداً** —
 * > وهو تعريفُ الحارس الديكور (المادة ٠). **فحُذف**، وحلّ محلَّه توكيدٌ يُثبت الضمانةَ
 * > **الحقيقية**: أن المحرّك نفسَه يمنع تسرّبَ الشخصية إلى أيّ قشرةٍ منطاقة —
 * > `tests/features/payroll/edges.test.ts`. **حارسٌ واحدٌ صادق خيرٌ من اثنين أحدُهما زينة.**
 */
export function computePayrollCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
