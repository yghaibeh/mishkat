/**
 * قب-٨ — **المحرك محاسبيٌّ كامل والوجه يتبسّط** (`SPEC_finance_ledger` §٦.٤).
 *
 * المسؤولُ الماليّ شخصٌ بسيطٌ غير محاسب: يقول «قبضتُ» و«دفعتُ» و«سلّمتُ»، وهذه الوحدة
 * تترجم فعلَه إلى **قيدٍ مزدوجٍ متوازنٍ كامل** — فلا يختار حساباً ولا يعرف وجودَه.
 * والطريقُ ذو اتجاهين: `describeEntry` تعيد له القيدَ **بفعله** لا بسطور اليومية.
 */

import type {
  CurrencyCode,
  JournalEntry,
  JournalLine,
  LineInput,
  SimpleOperation,
  SourceType,
} from "../types.js"

/** خريطةُ الأدوار الحسابية **مغلقة** — الوجهُ لا يعرض حساباً، والمحرّكُ لا يخترع واحداً. */
export const ACCOUNT_ROLES = Object.freeze({
  cash: "cash",
  donationRevenue: "revenue.donations",
  generalExpense: "expense.general",
  handoverClearing: "clearing.handover",
})

/** نوعُ المصدر المقابل لكل فعلٍ بسيط — من الكتالوج المغلق (§٣.٢). */
export function sourceTypeOfVerb(verb: SimpleOperation["verb"]): SourceType {
  if (verb === "received") return "donation"
  if (verb === "paid") return "expense"
  return "handover"
}

/** ترجمةُ الفعل البسيط إلى أسطر القيد المزدوج — دالةٌ واحدةٌ لا تتكرر. */
export function simpleOperationLines(op: SimpleOperation): readonly LineInput[] {
  const fund = op.verb === "handedOver" ? undefined : op.fundId
  const common = { currency: op.currency, amount: op.amount, ...(fund === undefined ? {} : { fundId: fund }) }

  if (op.verb === "received") {
    return [
      { accountId: ACCOUNT_ROLES.cash, unitId: op.unitId, side: "debit", ...common },
      { accountId: ACCOUNT_ROLES.donationRevenue, unitId: op.unitId, side: "credit", ...common },
    ]
  }
  if (op.verb === "paid") {
    return [
      { accountId: ACCOUNT_ROLES.generalExpense, unitId: op.unitId, side: "debit", ...common },
      { accountId: ACCOUNT_ROLES.cash, unitId: op.unitId, side: "credit", ...common },
    ]
  }
  // «سلّمتُ»: قيدٌ واحدٌ بطرفين — ينقص المصدرَ ويثبت المقاصّة على الوجهة (ق-٦١ روحاً).
  return [
    { accountId: ACCOUNT_ROLES.handoverClearing, unitId: op.toUnitId, side: "debit", ...common },
    { accountId: ACCOUNT_ROLES.cash, unitId: op.unitId, side: "credit", ...common },
  ]
}

export type DescribedEntry = {
  readonly verb: SimpleOperation["verb"] | "journal"
  readonly voucherNo: string
  readonly amountsByCurrency: ReadonlyMap<CurrencyCode, number>
}

/** الاتجاهُ الآخر: القيدُ يُوصَف بفعل المستخدم البسيط — والمحاسبةُ خلف مدخلٍ هادئ. */
export function describeEntry(entry: JournalEntry, lines: readonly JournalLine[]): DescribedEntry {
  const amounts = new Map<CurrencyCode, number>()
  for (const line of lines) {
    amounts.set(line.currency, (amounts.get(line.currency) ?? 0) + line.debit)
  }
  const verb: DescribedEntry["verb"] =
    entry.sourceType === "donation"
      ? "received"
      : entry.sourceType === "expense"
        ? "paid"
        : entry.sourceType === "handover"
          ? "handedOver"
          : "journal"
  return { verb, voucherNo: entry.voucherNo, amountsByCurrency: amounts }
}
