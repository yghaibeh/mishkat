/**
 * الرصيدُ **مشتقٌّ من الدفتر الواحد** — ق-٦٠، والأرصدةُ **منفصلةٌ بالعملات** — ق-٦٢
 * (`SPEC_finance_ledger` §٦.١ و§٤.٣).
 *
 * **لا حقلَ رصيدٍ مخزَّنٍ في أي كيان**: بُعدُ الوحدة على أسطر القيود هو المصدر، والتجميعُ
 * **بالاحتواء** فيرى المركزُ ما تحته من نفس المصدر — «شبكةٌ واحدة لا جزر».
 *
 * **وممنوعٌ جمعُ عملتين في رقمٍ واحد بلا سعرٍ معلن**: لا توجد هنا دالةٌ تفعل ذلك إلا
 * `totalInBase` — وهي **ترفض** بلا جدول أسعارٍ صريح، فلا يظهر رقمٌ مضلِّلٌ أبداً.
 */

import { contains } from "../../../authorization/scope.js"
import { convertWithRate } from "./money.js"
import { ACCOUNT_ROLES } from "./simpleFace.js"
import { err, ok, type Cents, type CurrencyCode, type FxRate, type Result } from "../types.js"
import type { LedgerStore } from "../data/store.js"

export type CurrencyBalance = { readonly debit: Cents; readonly credit: Cents; readonly net: Cents }
/** `null` = **لا سعرَ معلن** ⇒ يُرفض الجمعُ عبر العملات (§٤.٣). */
export type RateTable = ReadonlyMap<CurrencyCode, FxRate> | null

/** أرصدةُ نطاقٍ بالعملات المنفصلة؛ `accountId` يقصر القراءة على حسابٍ بعينه (النقد مثلاً). */
export function balancesByCurrency(
  store: LedgerStore,
  unitPath: string,
  accountId?: string,
): ReadonlyMap<CurrencyCode, CurrencyBalance> {
  const totals = new Map<CurrencyCode, { debit: number; credit: number }>()
  for (const line of store.lines()) {
    if (accountId !== undefined && line.accountId !== accountId) continue
    // الاحتواءُ لا التجاور: ثابتُ المسار (§١.٥ من مواصفة الصلاحيات) يمنع تسريب الشقيقة.
    if (!contains(unitPath, line.unitPath)) continue
    const t = totals.get(line.currency) ?? { debit: 0, credit: 0 }
    totals.set(line.currency, { debit: t.debit + line.debit, credit: t.credit + line.credit })
  }
  const out = new Map<CurrencyCode, CurrencyBalance>()
  for (const [currency, t] of totals) {
    out.set(currency, {
      debit: t.debit as Cents,
      credit: t.credit as Cents,
      net: (t.debit - t.credit) as Cents,
    })
  }
  return out
}

/**
 * **رصيدُ صندوق الوحدة** — ق-٦٠: بُعدُ النقد على أسطر الدفتر الواحد، لا حقلٌ مخزَّن.
 * لا يُجمَع على كل الحسابات: مجموعُ كل الحسابات صفرٌ بحكم التوازن (ق-٤٩) فلا يقول شيئاً —
 * والرصيدُ الذي يعنيه ق-٦٠ هو **النقد** الذي في يد الوحدة، بعملاته المنفصلة.
 */
export function cashBalances(
  store: LedgerStore,
  unitPath: string,
): ReadonlyMap<CurrencyCode, CurrencyBalance> {
  return balancesByCurrency(store, unitPath, ACCOUNT_ROLES.cash)
}

/**
 * التجميعُ عبر العملات — **الطريقُ الوحيد**، وهو مقفلٌ بلا سعرٍ معلن (ق-٦٢، §٤.٣).
 * التحويلُ بعددين صحيحين وقسمةٍ صحيحة؛ ولا يمسّ مبلغاً مخزَّناً — عرضٌ وتجميعٌ لا غير.
 */
export function totalInBase(
  balances: ReadonlyMap<CurrencyCode, CurrencyBalance>,
  rates: RateTable,
  base: CurrencyCode,
): Result<Cents> {
  let total = 0
  for (const [currency, balance] of balances) {
    if (currency === base) {
      total += balance.net
      continue
    }
    if (rates === null) return err("FX_RATE_UNDECLARED", currency)
    const rate = rates.get(currency)
    if (rate === undefined) return err("FX_RATE_MISSING", currency)
    total += convertWithRate(balance.net, rate.baseCents, rate.foreignCents)
  }
  return ok(total as Cents)
}
