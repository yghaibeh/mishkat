/**
 * دوالُّ خادم الرواتب — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٩.
 *
 * خمسةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من المستودع، وكشفُ الراتب من **الشخص
 *     نفسِه** — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **الفاعلُ من الجلسة لا من المدخل**: مَن يصرف ومَن يقرأ كشفَه يُؤخذان من `actor` حصراً.
 *  ٤. **ولا مبلغَ استحقاقٍ في أيّ مدخل**: مدخلاتُ الصرف **مَن ومتى وأين** — والمبالغُ من
 *     السطر المختوم (ق-٥٢). والمبلغُ الوحيدُ الذي يمرّ من الخارج هو **الحافزُ** (ق-٧٧:
 *     منحةٌ تقديرية لا استحقاق) و**أصلُ السلفة** (عقدٌ لا أجر).
 *  ٥. **ولا قدرةَ بتٍّ هنا** (G22): الإقرارُ سطحُه في `approval/server/payroll.ts` وحده.
 *
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨)، فعزلُ الشبكة يقع قبل المحرّك.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { PayrollStores } from "../data/store.js"
import type { PayrollContext } from "../services/context.js"
import { monthlyPlan, ownPayslip } from "../services/plan.js"
import { disburse, type DisburseInput } from "../services/payout.js"
import { grantAdvance, type GrantAdvanceInput } from "../services/advances.js"
import { grantIncentive, type GrantIncentiveInput } from "../services/incentives.js"
import { distributionMap, type DistributionInput } from "../services/distribution.js"
import type { DeriveInput } from "../services/derive.js"
import type { Advance, DistributionMap, Incentive, MonthlyPlanView, Payout, PayrollResult } from "../types.js"

/** نافذةُ الشهر ومَن فيه — يمرّرها المُركِّب (§٤.٥: لا استعلامَ داخل الخدمة). */
export type PayrollWindow = {
  readonly from: Date
  readonly to: Date
  readonly personIds: readonly string[]
}

export function makePayrollEndpoints(
  stores: PayrollStores,
  contextOf: (actor: Actor, request: DecisionContext) => PayrollContext,
  windowOf: (unitPath: string) => PayrollWindow,
) {
  /** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
  const unitById = (unitId: string | undefined): Scope => {
    const unit = unitId === undefined ? null : stores.ledger.getUnit(unitId)
    return unit === null ? NO_SCOPE : unitScope(unit.path)
  }

  const deriveInputOf = (unitPath: string, periodId: string): DeriveInput => {
    const window = windowOf(unitPath)
    return { unitPath, periodId, from: window.from, to: window.to, personIds: window.personIds }
  }

  const planViewFn = defineServerFn({
    name: "payroll.plan.view",
    capability: "payroll.view",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "read",
    audit: "payroll.plan.view",
    handler: async (
      input: { unitId: string; periodId: string },
      { actor, request },
    ): Promise<MonthlyPlanView> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return monthlyPlan(
        stores,
        contextOf(actor, request),
        deriveInputOf(unit.path, input.periodId),
      )
    },
  })

  const payoutFn = defineServerFn({
    name: "payroll.payout.record",
    capability: "finance.payout",
    // نطاقُ الفعل **وحدةُ الصرف**: من صندوقها يخرج المال (ق-٦٥).
    scope: (input: { payingUnitId: string }) => unitById(input.payingUnitId),
    intent: "write",
    audit: "payroll.payout.record",
    handler: async (input: DisburseInput, { actor, request }): Promise<PayrollResult<Payout>> =>
      disburse(stores, contextOf(actor, request), input),
  })

  const distributionFn = defineServerFn({
    name: "payroll.distribution.view",
    capability: "payroll.view",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "read",
    audit: "payroll.distribution.view",
    handler: async (
      input: { unitId: string; periodId: string; unitPaths: readonly string[] },
      { actor, request },
    ): Promise<DistributionMap> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      const mapInput: DistributionInput = {
        periodId: input.periodId,
        rootPath: unit.path,
        unitPaths: input.unitPaths,
      }
      return distributionMap(stores, contextOf(actor, request), mapInput)
    },
  })

  const advanceFn = defineServerFn({
    name: "payroll.advance.grant",
    capability: "finance.payout",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "write",
    audit: "payroll.advance.grant",
    handler: async (input: GrantAdvanceInput, { actor, request }): Promise<PayrollResult<Advance>> =>
      grantAdvance(stores, contextOf(actor, request), input),
  })

  const incentiveFn = defineServerFn({
    name: "payroll.incentive.grant",
    capability: "incentive.manage",
    scope: (input: { unitId: string }) => unitById(input.unitId),
    intent: "write",
    audit: "payroll.incentive.grant",
    handler: async (
      input: GrantIncentiveInput,
      { actor, request },
    ): Promise<PayrollResult<Incentive>> => grantIncentive(stores, contextOf(actor, request), input),
  })

  /**
   * **كشفُ راتبي** — قدرةٌ **شخصية** (ق-٢٩): نطاقُها **الشخصُ نفسُه** لا شجرةُ الوحدات،
   * فلا يفتحها الشمولُ «\*» ولا يراها المديرُ عن غيره. **والفاعلُ من الجلسة**: لا يُمرَّر
   * `personId` من المدخل أصلاً — فلا سبيلَ لطلب كشفِ غيرك (ق-٣٠ من الجهة المقابلة).
   */
  const payslipFn = defineServerFn({
    name: "payroll.payslip.own",
    capability: "payroll.own",
    scope: (input: { personId: string; periodId: string }) =>
      selfScope(input.personId, "payslip", input.periodId),
    intent: "read",
    audit: "payroll.payslip.own",
    handler: async (
      input: { personId: string; periodId: string; unitPath: string },
      { actor, request },
    ): Promise<MonthlyPlanView> =>
      ownPayslip(
        stores,
        contextOf(actor, request),
        deriveInputOf(input.unitPath, input.periodId),
        actor.personId,
      ),
  })

  return {
    planView: planViewFn,
    payout: payoutFn,
    distribution: distributionFn,
    advance: advanceFn,
    incentive: incentiveFn,
    payslip: payslipFn,
  }
}
