/**
 * ق-٦٦ — **الرواتبُ تسليماتٌ هرمية بخريطة توزيعٍ تمتد للفرد الأخير** (عقدُ الوحدة §٥).
 *
 * نصُّ القاعدة: «وخريطةُ التوزيع تُري المدير **كلَّ توقّفٍ بصاحبه**: صُرف ٣٨٠ من ٤١٢ —
 * المتبقي عند مسجد كذا». فالخريطةُ ليست تقريراً تجميعياً بل **قائمةَ توقّفاتٍ مُسمّاة**:
 * أين وقف المالُ، وعند مَن، وكم.
 *
 * **وكلُّ رقمٍ فيها اشتقاقٌ** (ق-٦٠ روحاً): الإجماليُّ من **الختم**، والمصروفُ من **سجل
 * الصرف** — **صفر عدّادٍ موازٍ**. ولو انحرف عدّادٌ يوماً لَما وُجد ما ينحرف.
 *
 * **ودفعةُ المنطقة لا تتكرر**: (فترة × منطقة) مفتاحٌ فريدٌ في المستودع، والتسليمُ نفسُه
 * **يقع في وحدة الصندوق** بمنفذٍ محقون — فلا يُعاد بناءُ ق-٦١ هنا (قيدٌ واحدٌ ذرّيّ ونازلٌ حصراً).
 */

import { contains } from "../../../authorization/scope.js"
import type { Cents } from "../../ledger/types.js"
import type { PayrollStores } from "../data/store.js"
import type { PayrollContext } from "./context.js"
import { baseCurrency } from "./rates.js"
import {
  payrollErr,
  payrollOk,
  type DistributionMap,
  type DistributionStop,
  type PayrollResult,
  type RegionDistribution,
} from "../types.js"

export type DistributionInput = {
  readonly periodId: string
  readonly rootPath: string
  /** الوحداتُ التي تُقرأ ختومُها — يمرّرها المُركِّب، **لا استعلامَ داخل الخدمة** (§٤.٥). */
  readonly unitPaths: readonly string[]
}

/**
 * **الخريطةُ مشتقّةٌ بالكامل**: من الختم (كم يُستحق) ومن سجل الصرف (كم صُرف).
 * والوحدةُ التي لا ختمَ لها **لا تُخفى** — لا تُنتج توقّفاً، فلا يظهر رقمٌ وهميّ (ق-١١٢).
 */
export function distributionMap(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DistributionInput,
): DistributionMap {
  const paid = stores.payroll.paidPersonIdsIn(input.periodId)
  const stops: DistributionStop[] = []
  let total = 0
  let paidTotal = 0

  for (const unitPath of [...input.unitPaths].sort()) {
    // **الاحتواءُ لا التجاور**: ثابتُ المسار يمنع تسريب الشقيقة (نظيرُ `balancesByCurrency`).
    if (!contains(input.rootPath, unitPath)) continue
    const seal = ctx.seal(unitPath, input.periodId)
    if (seal.stage !== "sealed" || seal.plan === null) continue

    for (const line of seal.plan.lines) {
      if (line.netCents <= 0) continue
      const isPaid = paid.has(line.personId)
      total += line.netCents
      if (isPaid) paidTotal += line.netCents
      stops.push({
        unitPath: line.unitPath,
        personId: line.personId,
        netCents: line.netCents,
        paid: isPaid,
      })
    }
  }

  return {
    periodId: input.periodId,
    rootPath: input.rootPath,
    totalNetCents: total as Cents,
    paidNetCents: paidTotal as Cents,
    // **المتبقي اشتقاقٌ من الاثنين** لا حقلٌ ثالثٌ ينحرف عنهما.
    remainingNetCents: (total - paidTotal) as Cents,
    stops,
    distributedRegions: stores.payroll
      .distributionsIn(input.periodId)
      .map((d) => d.toUnitPath)
      .sort(),
  }
}

export type RegionDistributionInput = {
  readonly periodId: string
  readonly fromUnitPath: string
  readonly toUnitPath: string
  readonly amountCents: Cents
  readonly memoAr: string
}

/**
 * **تسليمُ دفعة المنطقة** (ق-٦٦): تسليمٌ نازلٌ واحدٌ لكل منطقة بوسم `salaries:<الفترة>`.
 *
 * والتسليمُ نفسُه **فعلُ وحدة الصندوق** (ق-٦١) — يُسأل بمنفذٍ ولا يُنسَخ هنا؛ فحارسُ «نازلٌ
 * حصراً» والقيدُ الواحدُ الذرّيّ يعيشان في موطنهما. **ونحن نحرس ما يخصّنا**: أن لا تتكرر.
 */
export function distributeToRegion(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: RegionDistributionInput,
): PayrollResult<RegionDistribution> {
  // **نازلٌ حصراً** — احتواءٌ صارم: الوجهةُ تحت المصدر ولا تساويه (نظيرُ ق-٦١).
  if (input.toUnitPath === input.fromUnitPath || !contains(input.fromUnitPath, input.toUnitPath)) {
    return payrollErr("NOT_DESCENDANT_REGION", input.toUnitPath)
  }
  // **لا تتكرر** (ق-٦٦ نصاً): (فترة × منطقة) مفتاحٌ فريد.
  if (stores.payroll.hasDistribution(input.periodId, input.toUnitPath)) {
    return payrollErr("REGION_ALREADY_DISTRIBUTED", input.toUnitPath)
  }
  if (input.amountCents <= 0) return payrollErr("NOTHING_TO_PAY", input.toUnitPath)

  const handover = ctx.handover
  // **غيابُ المنفذ يعني لا مسارَ توزيعٍ — لا تجاوزَه** (فشلٌ يُقفل ولا يُفتح).
  if (handover === undefined) return payrollErr("NO_PAYING_UNIT", input.toUnitPath)

  const outcome = handover({
    fromUnitPath: input.fromUnitPath,
    toUnitPath: input.toUnitPath,
    amountCents: input.amountCents,
    currency: baseCurrency(ctx, input.fromUnitPath),
    memoAr: input.memoAr,
    // **وسمُ الدفعة مفتاحُ تكرارٍ طبيعيّ** (ق-٥٠/ق-٦٦) — لا رقمٌ عشوائيّ.
    operationId: `salaries:${input.periodId}:${input.toUnitPath}`,
  })
  if (!outcome.ok) return payrollErr("NOT_DESCENDANT_REGION", outcome.code)

  const distribution: RegionDistribution = {
    tenantId: stores.payroll.tenantId,
    id: stores.payroll.nextId("dist"),
    periodId: input.periodId,
    toUnitPath: input.toUnitPath,
    at: ctx.now,
  }
  stores.payroll.appendDistribution(distribution)
  return payrollOk(distribution)
}
