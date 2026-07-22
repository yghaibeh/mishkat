/**
 * **نموذجُ صفحة الرواتب** — علاجُ ع-٢١ وع-٢٥ **في النموذج لا في الشاشة** (عقدُ الوحدة §٣).
 *
 * ع-٢١ («أين أعطي الرواتب؟ يدوي أم آلي؟») **عرَضُ شاشةٍ لا تشرح تدفّقاً** (ج٧). فالجوابُ
 * ليس نصَّ مساعدةٍ بل **حقلاً في النموذج**: `stage` — مشتقّةٌ ⟵ معلَّقةٌ ⟵ مختومة. والشاشةُ
 * **تعرضها ولا تخترعها**، فيستحيل أن تُظهر زرَّ صرفٍ في مرحلةٍ لا يجوز فيها الصرف.
 *
 * **وهنا يظهر حدُّ المبدأ الحاكم عملياً** (§٢-٣):
 *  - **قبل الختم**: المعروضُ هو **الاشتقاقُ الحيّ** — فتصحيحُ درسٍ ينعكس فوراً.
 *  - **بعد الختم**: المعروضُ هو **المختومُ وحده** — فتعديلُ درسٍ قديم **لا يمسّ راتباً أُقرّ**.
 *  - **والفارقُ يُعلَن ولا يُطبَّق**: `drift` تُظهر الفرقَ بين المختوم والحيّ **للتحقيق**،
 *    ولا تغيّر قرشاً. فالصمتُ عيبٌ، **والتغييرُ الصامتُ تزويرٌ بالإهمال** — وكلاهما مقتول.
 */

import type { Cents } from "../../ledger/types.js"
import type { PayrollStores } from "../data/store.js"
import type { PayrollContext } from "./context.js"
import { derivePlan, type DeriveInput } from "./derive.js"
import type { EntitlementPlan, MonthlyPlanView, PlanDrift } from "../types.js"

/** الفارقُ بين المختوم والحيّ — **يُحسب ولا يُطبَّق**، ولا يظهر إلا حين يوجد فعلاً. */
function driftBetween(sealed: EntitlementPlan, live: EntitlementPlan): readonly PlanDrift[] {
  const liveByPerson = new Map(live.lines.map((l) => [l.personId, l]))
  const out: PlanDrift[] = []
  for (const line of sealed.lines) {
    const current = liveByPerson.get(line.personId)
    if (current === undefined) continue
    if (current.netCents === line.netCents) continue
    out.push({
      personId: line.personId,
      sealedNetCents: line.netCents,
      liveNetCents: current.netCents,
      deltaCents: (current.netCents - line.netCents) as Cents,
    })
  }
  return out
}

/**
 * **مصدرُ البيانات الواحد للشاشة** (ق-١١١): كلُّ رقمٍ في صفحة الرواتب يخرج من هنا —
 * فلا تُكتب حقيقةٌ في موضعٍ وتُقرأ من آخر (ج٥: انفصامُ الكتابة عن القراءة).
 */
export function monthlyPlan(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DeriveInput,
): MonthlyPlanView {
  const seal = ctx.seal(input.unitPath, input.periodId)
  const live = derivePlan(stores, ctx, input)
  const sealed = seal.stage === "sealed" ? seal.plan : null

  const shown = sealed ?? live

  return {
    unitPath: input.unitPath,
    periodId: input.periodId,
    stage: seal.stage,
    lines: shown.lines,
    totalNetCents: shown.totalNetCents,
    drift: sealed === null ? [] : driftBetween(sealed, live),
    // **«مدفوعٌ» اشتقاقٌ من سجل الصرف** لا حقلٌ يُحدَّث على سطرٍ لا وجودَ له (ق-٦٥).
    paidPersonIds: [...stores.payroll.paidPersonIdsIn(input.periodId)].sort(),
  }
}

/**
 * **كشفُ راتبي** (ق-٢٩: القدرةُ الشخصية) — نفسُ المصدر الواحد **مقصوراً على صاحبه**.
 * والقصرُ هنا **اتساقُ عرضٍ**؛ أمّا الحمايةُ ففي نطاق الدالة الشخصيّ على الخادم (§٨).
 */
export function ownPayslip(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DeriveInput,
  personId: string,
): MonthlyPlanView {
  const view = monthlyPlan(stores, ctx, { ...input, personIds: [personId] })
  return {
    ...view,
    lines: view.lines.filter((l) => l.personId === personId),
    drift: view.drift.filter((d) => d.personId === personId),
    paidPersonIds: view.paidPersonIds.filter((p) => p === personId),
  }
}
