/**
 * ب-٣١ — الخصومات: **بنيةٌ تحتيةٌ كاملةٌ في المحرك، وعرضٌ خلف مفتاح إدارةٍ افتراضُه الإخفاء**
 * (`SPEC_finance_ledger` §٧.١، قرارُ المالك في جلسة ٢٠٢٦-٠٧-٢٠).
 *
 * **لا حذفَ للبنية ولا إظهارَ افتراضيّ** (قب-٧): سطرُ الخصم يعيش في القيد كأيّ سطر ويدخل
 * الأرصدة؛ والمفتاحُ يحكم **العرض** وحده. والخصمُ العقابيُّ يحرسه `postJournal` نفسُه.
 */

import { contains } from "../../../authorization/scope.js"
import type { LedgerStore } from "../data/store.js"
import type { LedgerContext } from "./journal.js"
import type { JournalLine } from "../types.js"

/** مفتاحُ العرض — إعدادٌ حيّ افتراضُه الإخفاء («لا خصومات» هو الافتراضي). */
export function deductionsVisible(ctx: LedgerContext, scopePath: string): boolean {
  const value = ctx.settings("finance.deductions.display_enabled", scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError("إعدادُ عرض الخصومات ليس مفتاحاً")
  return value
}

/** أسطرُ الخصم في نطاقٍ — البنيةُ قائمةٌ دائماً وإن حجبها مفتاحُ العرض. */
export function deductionLines(store: LedgerStore, unitPath: string): readonly JournalLine[] {
  return store.lines().filter((l) => l.kind === "deduction" && contains(unitPath, l.unitPath))
}
