/**
 * ق-٧٧ — **الحوافزُ التشغيلية استثناءٌ لا التزام** (عقدُ الوحدة §٧).
 *
 * نصُّ القاعدة: «كفالةُ الرواتب هي التزامُ المؤسسة (العقدةُ الأهمّ)؛ والحوافزُ التشغيلية
 * تُمنح **استثناءً عند الحاجة لا التزاماً**، **ولا «حوافزُ أداءٍ» مدمجةٌ في أجر المعلم** —
 * **الساعةُ هي الأساس**».
 *
 * **وحرسُ الشطر الأخير بنيويٌّ لا نصّيّ**: ليس في `derive.ts` مسارٌ رابع، وليس في
 * `EntitlementLine` حقلُ حافز، وليس في هذا الملفّ استيرادٌ من `derive.ts` ولا العكس.
 * فمنحُ حافزٍ لمعلّمٍ **لا يستطيع** أن يُغيّر إجماليَّ مستحقّه — لا لأن أحداً انتبه، بل
 * **لأن الطريق غير موجود**. (وهو نفسُ منطق «صفر سطح هجوم» في قب-٤٥: أقوى من أيّ حارس.)
 *
 * **والمبلغُ هنا يأتي من المستخدم — وهذا صوابٌ لا نقضٌ لق-٥٢**: ق-٥٢ تحكم **المستحق**
 * («لا استحقاقٌ يُكتب باليد») لأنه **دالّةُ عملٍ منجَز**. والحافزُ **ليس مستحقاً** بنصّ
 * ق-٧٧ بل **منحةٌ تقديرية استثنائية** — فمقدارُها قرارُ صاحب القدرة، ولذلك حُرست بقدرةٍ
 * مستقلّة (`incentive.manage`) وبتدقيقٍ ظاهر، **وأُخرجت من الاشتقاق كلِّه**.
 */

import { postEvent } from "../../ledger/services/posting.js"
import { cents } from "../../ledger/services/money.js"
import type { Cents } from "../../ledger/types.js"
import { atomically, type PayrollStores } from "../data/store.js"
import type { PayrollContext } from "./context.js"
import { baseCurrency } from "./rates.js"
import { payrollErr, payrollOk, type Incentive, type PayrollResult } from "../types.js"

export type GrantIncentiveInput = {
  readonly personId: string
  readonly unitId: string
  /** معرّفُ العملية في وحدتها — **مفتاحُ التكرار الطبيعيّ** (ق-٥٠): منحةٌ لا تزدوج. */
  readonly operationId: string
  readonly amountCents: Cents
  readonly memoAr: string
}

export function grantIncentive(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: GrantIncentiveInput,
): PayrollResult<Incentive> {
  const unit = stores.ledger.getUnit(input.unitId)
  if (unit === null) return payrollErr("UNKNOWN_PAYROLL_UNIT", input.unitId)

  const amount = cents(input.amountCents)
  if (!amount.ok) return { ok: false, error: amount.error }
  if (amount.value <= 0) return payrollErr("NOTHING_TO_PAY", String(amount.value))

  const currency = baseCurrency(ctx, unit.path)
  const common = { unitId: input.unitId, currency, amount: amount.value }

  return atomically(stores, () => {
    const posted = postEvent(stores.ledger, ctx, {
      // **مصروفٌ لا راتب**: قيدٌ مستقلٌّ بمصدرٍ مستقل — فلا يختلط بأجرٍ في تقريرٍ ولا في دفتر.
      sourceType: "expense",
      sourceId: input.operationId,
      at: ctx.now,
      unitId: input.unitId,
      memoAr: input.memoAr,
      lines: [
        { accountId: ctx.accounts.salaryExpense, side: "debit", ...common },
        { accountId: ctx.accounts.cash, side: "credit", ...common },
      ],
    })
    if (!posted.ok) return { ok: false as const, error: posted.error }

    const incentive: Incentive = {
      tenantId: stores.payroll.tenantId,
      id: stores.payroll.nextId("inc"),
      personId: input.personId,
      unitPath: unit.path,
      entryId: posted.value.entry.id,
      grantedBy: ctx.actorPersonId,
      at: ctx.now,
    }
    stores.payroll.appendIncentive(incentive)
    stores.ledger.appendAudit({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "payroll.incentive.grant",
      targetId: incentive.id,
      reason: null,
    })
    return payrollOk(incentive)
  })
}
