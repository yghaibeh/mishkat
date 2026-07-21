/**
 * عملياتُ الصندوق — القبضُ والصرف (عقدُ الوحدة §٢.١/§٢.٢).
 *
 * **الوحدةُ لا تكتب في الدفتر**: تُترجم فعلَ الأمين إلى **حدثٍ** (`LedgerEvent`) وتُسلّمه
 * النواةَ فتُنتج القيدَ المتوازن والسندَ المتسلسل (§٣ من العقد الحاكم). ومنه:
 *  - **التوازنُ لكل عملةٍ على حدة** والسندُ بلا فجوات والذرّيةُ — كلُّها من النواة لا تُعاد هنا.
 *  - **حارسُ المقيَّد شرعاً** (ق-٥٥) يُستهلَك ولا يُنسَخ: الوسمُ يمرّ على **طرفَي** القيد
 *    فيرى الحارسُ أثرَه على سطر الأصل.
 *  - **المفتاحُ طبيعيّ** (ق-٥٠): معرّفُ العملية في وحدتها — فتكرارُها لا يزدوج.
 *
 * **صفر رقمٍ تشغيليّ** (قب-٦/G14) و**صفر فحصِ دور** (G6): القدرةُ تُفرض في طبقة الخادم،
 * وهذه الطبقة تحرس ثوابتَ العمل وحدها.
 */

import { postEvent, type LedgerEvent } from "../../ledger/services/posting.js"
import { ACCOUNT_ROLES } from "../../ledger/services/simpleFace.js"
import type { LineInput } from "../../ledger/services/journal.js"
import type { LedgerStore } from "../../ledger/data/store.js"
import type { Cents } from "../../ledger/types.js"
import { resolveSpendCategory } from "./categories.js"
import type { BoxContext } from "./context.js"
import type { BoxStores } from "../data/store.js"
import { boxErr, boxOk, type BoxPosting, type BoxResult } from "../types.js"

/**
 * سطرُ قبضٍ بعملته — أسطرُ عملاتٍ في **العملية الواحدة** (ق-٦٢).
 * **مدخلٌ عابرٌ لا كيانٌ مخزَّن**: موطنُه طبقةُ الخدمات لأن كياناتِ الوحدة لا تحمل مالاً (ق-٦٠).
 */
export type ReceiptLine = {
  readonly currency: string
  readonly amount: Cents
  readonly fundId?: string
}

export type ReceiveInput = {
  readonly unitId: string
  /** معرّفُ العملية في وحدتها — **مفتاحُ التكرار الطبيعيّ** لا رقمٌ عشوائيّ (§٣.٢). */
  readonly operationId: string
  readonly memoAr: string
  readonly lines: readonly ReceiptLine[]
  /** تاريخُ الأثر؛ افتراضُه لحظةُ الطلب — ويحرسه القفلُ الزمنيّ في النواة (§٢.٥). */
  readonly at?: Date
}

export type SpendInput = {
  readonly unitId: string
  readonly operationId: string
  readonly memoAr: string
  /** فئةٌ من القاموس المغلق المركزيّ (ق-٦٤) — لا حسابَ يختاره المستخدم (قب-٨). */
  readonly categoryId: string
  readonly currency: string
  readonly amount: Cents
  readonly fundId?: string
  readonly at?: Date
}

/** يترجم نتيجةَ النواة إلى نتيجة الوحدة — **بسببها كما هو** لا برمزٍ مبهم. */
export function postBoxEvent(
  store: LedgerStore,
  ctx: BoxContext,
  event: LedgerEvent,
): BoxResult<BoxPosting> {
  const posted = postEvent(store, ctx, event)
  if (!posted.ok) return { ok: false, error: posted.error }
  return boxOk({
    entryId: posted.value.entry.id,
    voucherNo: posted.value.entry.voucherNo,
    duplicated: posted.value.duplicated,
  })
}

/**
 * **القبض** (ق-٦٢ + ق-٥٦): أسطرُ عملاتٍ في **العملية الواحدة** — لكل سطرٍ مدينُ النقد
 * ودائنُ الإيراد بعملة ذلك السطر، فيتوازن القيدُ داخل كل عملة وتبقى الأرصدة منفصلة.
 */
export function receiveIntoBox(
  stores: BoxStores,
  ctx: BoxContext,
  input: ReceiveInput,
): BoxResult<BoxPosting> {
  if (input.lines.length === 0) return boxErr("NO_OPERATION_LINES", input.operationId)

  const lines: LineInput[] = []
  for (const line of input.lines) {
    const common = {
      unitId: input.unitId,
      currency: line.currency,
      amount: line.amount,
      ...(line.fundId === undefined ? {} : { fundId: line.fundId }),
    }
    lines.push({ accountId: ACCOUNT_ROLES.cash, side: "debit", ...common })
    lines.push({ accountId: ACCOUNT_ROLES.donationRevenue, side: "credit", ...common })
  }

  return postBoxEvent(stores.ledger, ctx, {
    sourceType: "donation",
    sourceId: input.operationId,
    at: input.at ?? ctx.now,
    unitId: input.unitId,
    memoAr: input.memoAr,
    lines,
  })
}

/**
 * **الصرف** (ق-٦٤ + ق-٥٥): الفئةُ تُحلّ من القاموس المرجعيّ فتُعطي حسابَ المصروف؛
 * والوسمُ الشرعيُّ يمرّ على الطرفين فيحرس النواةُ المقيَّد.
 */
export function spendFromBox(
  stores: BoxStores,
  ctx: BoxContext,
  input: SpendInput,
): BoxResult<BoxPosting> {
  const category = resolveSpendCategory(stores.box, input.categoryId)
  if (!category.ok) return category

  const common = {
    unitId: input.unitId,
    currency: input.currency,
    amount: input.amount,
    ...(input.fundId === undefined ? {} : { fundId: input.fundId }),
  }

  return postBoxEvent(stores.ledger, ctx, {
    sourceType: "expense",
    sourceId: input.operationId,
    at: input.at ?? ctx.now,
    unitId: input.unitId,
    memoAr: input.memoAr,
    lines: [
      { accountId: category.value.accountId, side: "debit", ...common },
      { accountId: ACCOUNT_ROLES.cash, side: "credit", ...common },
    ],
  })
}
