/**
 * **الصرفُ مربوطٌ بمعرّف الاستحقاق** — ق-٦٥ · ق-٧١ · ق-٦٩ (عقدُ الوحدة §٤).
 *
 * **الحارسُ خماسيٌّ قبل أيّ قيد**، وكلُّ بندٍ منه قاعدةٌ مكتوبةٌ لا احتياطٌ عام:
 *  ١. **لا صرفَ على غير مختوم**: «المالُ المدفوع واقعةٌ لا اشتقاق» (§٢-٣) — فالمرحلةُ
 *     ليست `sealed` ⇒ رفض. **وهذا هو ما يمنع أن يُدفع رقمٌ يتغيّر بعد دفعه.**
 *  ٢. **ولا صرفَ بلا استحقاقٍ محسوب** (ق-٦٥): مَن لا سطرَ له في المختوم لا يُدفع له.
 *  ٣. **ولا استحقاقٌ يُدفع مرتين** (ق-٦٥) — **بحارسين**: سجلُّ الصرف هنا، **ومفتاحُ التكرار
 *     الطبيعيّ في النواة** (ق-٥٠). دفاعٌ في العمق: تعثُّرُ شبكةٍ وإعادةُ طلبٍ لا يزدوجان
 *     حتى لو سبق أحدُهما الآخر.
 *  ٤. **ولا دفعةَ فارغة** (ق-٧١) ولا صرفَ صافٍ صفريّ — دفعةٌ بلا مالٍ قيدٌ بلا معنى.
 *  ٥. **ومَن لا مسجدَ له يصرف له أمينُ أقرب وحدةٍ مالكة** (ق-٦٥) — من **محرّك التوجيه القائم**.
 *
 * **والقيدُ واحدٌ متوازنٌ بالإجمالي** (ق-٧١): مدينٌ لكلِّ مستحقٍّ بإجماليه (فيبقى الكشفُ
 * مفصَّلاً بصاحبه، وهو «كشفُ التوقيعات»)، ودائنُ الذمم بمجموع الأقساط، ودائنُ النقد
 * **بمجموع الصوافي سطراً واحداً**. والتوازنُ والسندُ والذرّيةُ **كلُّها من النواة** لا تُعاد هنا.
 *
 * **وصفر مبلغٍ من المدخل**: `DisburseInput` ليس فيه حقلُ مبلغٍ واحد — المبالغُ **تُقرأ من
 * السطر المختوم** حصراً. فلا سبيلَ بنيوياً لأن يُصرف رقمٌ كتبه إنسان (ق-٥٢).
 */

import { postEvent, type LedgerEvent } from "../../ledger/services/posting.js"
import type { Cents } from "../../ledger/types.js"
import type { LineInput } from "../../ledger/services/journal.js"
import { atomically, type PayrollStores } from "../data/store.js"
import { dueInstalmentFor, recordInstalment } from "./advances.js"
import type { PayrollContext } from "./context.js"
import { baseCurrency } from "./rates.js"
import {
  payrollErr,
  payrollOk,
  type EntitlementLine,
  type Payout,
  type PayrollResult,
} from "../types.js"

export type DisburseInput = {
  readonly unitPath: string
  readonly periodId: string
  /** وحدةُ الصرف المُعلَنة — **تُطابَق بجواب محرّك التوجيه ولا تُصدَّق كما جاءت** (ق-٦٥). */
  readonly payingUnitId: string
  /** **مَن يُصرف لهم — لا كم يُصرف لهم**: المبلغُ من المختوم (ق-٥٢). */
  readonly personIds: readonly string[]
  readonly memoAr: string
}

export function disburse(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DisburseInput,
): PayrollResult<Payout> {
  // ٤أ — لا دفعةَ فارغة (ق-٧١): تُردّ قبل قراءة أيّ شيء.
  if (input.personIds.length === 0) return payrollErr("EMPTY_BATCH", input.periodId)

  const payingUnit = stores.ledger.getUnit(input.payingUnitId)
  if (payingUnit === null) return payrollErr("UNKNOWN_PAYROLL_UNIT", input.payingUnitId)

  // ٥ — وحدةُ الصرف **جوابُ محرّك التوجيه** (ق-٥٩/ق-٦٥)، والمُعلَنُ يُطابَق به.
  const resolved = ctx.payingUnit(input.unitPath)
  if (resolved === null) return payrollErr("NO_PAYING_UNIT", input.unitPath)
  if (resolved !== payingUnit.path) return payrollErr("NOT_PAYING_UNIT", payingUnit.path)

  // ١ — لا صرفَ على غير مختوم (§٢-٣).
  const seal = ctx.seal(input.unitPath, input.periodId)
  if (seal.stage !== "sealed" || seal.plan === null) {
    return payrollErr("PLAN_NOT_SEALED", input.periodId)
  }

  const sealedByPerson = new Map(seal.plan.lines.map((l) => [l.personId, l]))
  const alreadyPaid = stores.payroll.paidPersonIdsIn(input.periodId)
  const ordered = [...new Set(input.personIds)].sort()
  const due: EntitlementLine[] = []

  for (const personId of ordered) {
    // ٢ — لا صرفَ بلا استحقاقٍ محسوب (ق-٦٥).
    const line = sealedByPerson.get(personId)
    if (line === undefined) return payrollErr("NO_SEALED_ENTITLEMENT", personId)
    // ٣ — ولا استحقاقٌ يُدفع مرتين (ق-٦٥).
    if (alreadyPaid.has(personId)) return payrollErr("ALREADY_PAID", personId)
    // ٤ب — ولا يُصرف صافٍ صفريّ: قيدٌ بلا مالٍ قيدٌ بلا معنى (ق-٧١ روحاً).
    if (line.netCents <= 0) return payrollErr("NOTHING_TO_PAY", personId)
    due.push(line)
  }

  const currency = baseCurrency(ctx, payingUnit.path)
  const payoutId = stores.payroll.nextId("pay")

  const lines: LineInput[] = []
  let totalNet = 0
  let totalInstalment = 0
  const recovered: { advanceId: string; amountCents: Cents }[] = []

  for (const line of due) {
    // **مدينٌ لكلِّ مستحقٍّ بإجماليه** — فالكشفُ مفصَّلٌ بصاحبه في القيد نفسِه (ق-٧١).
    lines.push({
      accountId: ctx.accounts.salaryExpense,
      unitId: input.payingUnitId,
      currency,
      side: "debit",
      amount: line.grossCents,
    })
    totalNet += line.netCents
    // ق-٦٩: القسطُ يُعاد احتسابُه **على الإجمالي المختوم** فيبقى `net ≥ ٠` ولا يتجاوز المتبقي.
    const instalment = dueInstalmentFor(stores, line.personId, line.grossCents)
    if (instalment !== null) {
      totalInstalment += instalment.amountCents
      recovered.push(instalment)
    }
  }

  if (totalInstalment > 0) {
    // **الخصمُ الوحيدُ المبنيّ** (ب-٣١): تسويةٌ محاسبية — والعقابيُّ يمنعه حارسُ النواة (ق-٣٤).
    lines.push({
      accountId: ctx.accounts.staffReceivable,
      unitId: input.payingUnitId,
      currency,
      side: "credit",
      amount: totalInstalment as Cents,
      kind: "deduction",
      deductionKind: "settlement",
    })
  }

  // **دائنُ النقد بمجموع الصوافي سطراً واحداً** — «قيدٌ واحدٌ بالإجمالي» (ق-٧١).
  // وهو **موجبٌ حتماً**: حارسُ `NOTHING_TO_PAY` أعلاه ردّ كلَّ صافٍ غيرِ موجب قبل الوصول هنا.
  lines.push({
    accountId: ctx.accounts.cash,
    unitId: input.payingUnitId,
    currency,
    side: "credit",
    amount: totalNet as Cents,
  })

  const event: LedgerEvent = {
    sourceType: "payroll",
    sourceId: payoutId,
    at: ctx.now,
    unitId: input.payingUnitId,
    memoAr: input.memoAr,
    lines,
  }

  return atomically(stores, () => {
    const posted = postEvent(stores.ledger, ctx, event)
    if (!posted.ok) return { ok: false as const, error: posted.error }

    const payout: Payout = {
      tenantId: stores.payroll.tenantId,
      id: payoutId,
      entryId: posted.value.entry.id,
      periodId: input.periodId,
      payingUnitPath: payingUnit.path,
      personIds: ordered,
      paidBy: ctx.actorPersonId,
      at: ctx.now,
    }
    stores.payroll.appendPayout(payout)

    for (const instalment of recovered) {
      recordInstalment(stores, ctx, {
        advanceId: instalment.advanceId,
        periodId: input.periodId,
        entryId: posted.value.entry.id,
        amountCents: instalment.amountCents,
      })
    }

    // المادة ٤/٨ — كلُّ عمليةٍ مالية تُدوَّن: مَن ولمن ومتى.
    stores.ledger.audit.append({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "payroll.payout.record",
      unitPath: payout.payingUnitPath,
      capability: null,
      targetType: "payrollPayout",
      targetId: payout.id,
      reason: null,
      // **لا حالَ قبله**: سجلُّ الصرف واقعةٌ تُلحَق ولا تنتقل حالُها بعدُ. و«مدفوعٌ» يُشتقّ
      // من هذا السجلّ (ق-٦٥) — فاللقطةُ تقول **مَن صُرف لهم وفي أيِّ فترة** لا مبلغاً.
      before: null,
      after: `${input.periodId} \u00b7 ${payout.personIds.length}`,
    })
    return payrollOk(payout)
  })
}
