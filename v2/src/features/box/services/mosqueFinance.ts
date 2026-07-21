/**
 * ب-٩ + ق-٦٣ — **مالية المسجد الداخلية: قبضٌ وصرفٌ مباشرٌ بلا طابور اعتماد**
 * (عقدُ الوحدة §٤).
 *
 * **الفرقُ عن مسار المسؤول الماليّ قدرةٌ لا دور** (G6): مَن يملك `mosqueFinance.manage` على
 * مسجده يُرحِّل مباشرةً؛ ومَن يملك `finance.entry` يقترح فيُبتّ اقتراحُه (ق-٥٣). ولذلك **لا
 * يُقرأ في هذا الملفّ إعدادُ «الأدوار المعفاة»**: قراءتُه فحصُ دورٍ مقنّع، والمصفوفةُ نفسُها
 * هي التي لا تمنح هذه القدرة إلا لمن يملك المسجد.
 *
 * **وضبطُه فوقه** سلسلةُ الإقفال الدوريّ (ق-٦٧) — **خارج نطاق هذه المهمة**، ومكانُها محجوزٌ
 * نصاً هنا وفي العقد فلا يُخترع لها مسارٌ ثانٍ داخل الصندوق.
 *
 * **ولا بابَ التفافٍ**: هذا المسارُ يمرّ على **نفس** حرّاس الصندوق — القاموسُ المغلق (ق-٦٤)
 * وضبطُ المقيَّد شرعاً (ق-٥٥) والتوازنُ والسندُ من النواة.
 */

import { receiveIntoBox, spendFromBox, type ReceiptLine } from "./operations.js"
import type { BoxContext } from "./context.js"
import type { BoxStores } from "../data/store.js"
import type { Cents } from "../../ledger/types.js"
import type { BoxPosting, BoxResult } from "../types.js"

/** الوجهُ المبسَّط لأمير المسجد (قب-٨): «قبضتُ» و«صرفتُ» — لا حسابَ ولا مدينَ ولا دائن. */
export type MosqueFinanceInput =
  | {
      readonly verb: "received"
      readonly unitId: string
      readonly operationId: string
      readonly memoAr: string
      readonly lines: readonly ReceiptLine[]
      readonly at?: Date
    }
  | {
      readonly verb: "paid"
      readonly unitId: string
      readonly operationId: string
      readonly memoAr: string
      readonly categoryId: string
      readonly currency: string
      readonly amount: Cents
      readonly fundId?: string
      readonly at?: Date
    }

export function recordMosqueFinance(
  stores: BoxStores,
  ctx: BoxContext,
  input: MosqueFinanceInput,
): BoxResult<BoxPosting> {
  if (input.verb === "received") {
    return receiveIntoBox(stores, ctx, {
      unitId: input.unitId,
      operationId: input.operationId,
      memoAr: input.memoAr,
      lines: input.lines,
      ...(input.at === undefined ? {} : { at: input.at }),
    })
  }
  return spendFromBox(stores, ctx, {
    unitId: input.unitId,
    operationId: input.operationId,
    memoAr: input.memoAr,
    categoryId: input.categoryId,
    currency: input.currency,
    amount: input.amount,
    ...(input.fundId === undefined ? {} : { fundId: input.fundId }),
    ...(input.at === undefined ? {} : { at: input.at }),
  })
}
