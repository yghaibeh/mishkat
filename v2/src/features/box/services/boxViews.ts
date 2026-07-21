/**
 * نماذجُ العرض — **الحقيقةُ الواحدة في الصفحة** (ق-١١١) وعلاجُ ع-١٣/ع-١٤/ع-٢٤ البنيويّ.
 *
 * جذرُ البلاغات الثلاثة **ج٥: انفصامُ الكتابة عن القراءة** — تُكتب في موضعٍ وتقرأ الشاشةُ من
 * غيره. فالعلاجُ ليس ترتيبَ بطاقاتٍ في الشاشة، بل **دالةً واحدةً تُنتج كلَّ أرقام الصفحة من
 * الدفتر**: الرصيدُ والصناديقُ الثلاثة والحركاتُ والصناديقُ السُّفلية كلُّها من هنا، فيستحيل
 * أن يظهر رقمٌ في موضعٍ ويغيب عن آخر — **لأنها ليست حساباتٍ متعددة بل عروضٌ لمصدرٍ واحد**.
 *
 * والشاشةُ تستهلك هذا النموذج ولا تحسب شيئاً بنفسها (المادة ٤/٦: الواجهةُ تعرض ولا تقرر).
 */

import type { CurrencyBalance } from "../../ledger/services/balances.js"
import type { CurrencyCode } from "../../ledger/types.js"
import {
  boxFlow,
  boxMovements,
  childBoxSummaries,
  ownBoxBalances,
  subtreeBoxBalances,
  type BoxFlow,
  type BoxMovement,
  type ChildBoxSummary,
} from "./boxBalances.js"
import { handoversIn, pendingHandoversFor } from "./handover.js"
import type { BoxStores } from "../data/store.js"
import type { BoxHandover } from "../types.js"

export type UnitBoxView = {
  readonly unitPath: string
  /** رصيدُ الوحدة بذاتها بالعملات المنفصلة (ق-٦٠/ق-٦٢). */
  readonly own: ReadonlyMap<CurrencyCode, CurrencyBalance>
  /** التجميعُ الهابط — اطّلاعُ المشرف على شجرته (ق-١٧). */
  readonly subtree: ReadonlyMap<CurrencyCode, CurrencyBalance>
  /** الصناديقُ الثلاثة: واردٌ · صادرٌ · رصيد (ع-١٤). */
  readonly flow: ReadonlyMap<CurrencyCode, BoxFlow>
  /** آخرُ حركات الصندوق: المبلغُ ثم تفصيلُه (ع-١٣/ع-١٤). */
  readonly movements: readonly BoxMovement[]
  /** **الصناديقُ السُّفلية** — كلُّ وحدةٍ ابنةٍ برصيدها ولو كان صفراً (ع-٢٤/ق-١١٢). */
  readonly children: readonly ChildBoxSummary[]
  readonly handovers: readonly BoxHandover[]
}

export type MosqueFinanceView = {
  readonly unitPath: string
  /** إجمالياتُ المسجد ورصيدُه (ب-٩) — **ولا شيءَ من مال المركز** (ق-٣٠). */
  readonly balances: ReadonlyMap<CurrencyCode, CurrencyBalance>
  readonly flow: ReadonlyMap<CurrencyCode, BoxFlow>
  readonly movements: readonly BoxMovement[]
}

/** نموذجُ صفحة الصندوق — **مصدرُ الصفحة الواحد** (ق-١١١). */
export function unitBoxView(stores: BoxStores, unitPath: string): UnitBoxView {
  return {
    unitPath,
    own: ownBoxBalances(stores.ledger, unitPath),
    subtree: subtreeBoxBalances(stores.ledger, unitPath),
    flow: boxFlow(stores.ledger, unitPath, "own"),
    movements: boxMovements(stores.ledger, unitPath),
    children: childBoxSummaries(stores.ledger, unitPath),
    handovers: handoversIn(stores.box, unitPath),
  }
}

/** «ما ينتظر إقراري» — بالملكية لا بالنطاق (§١.١): تسليماتُ الشخص وحده. */
export function myPendingHandovers(stores: BoxStores, personId: string): readonly BoxHandover[] {
  return pendingHandoversFor(stores.box, personId)
}

/**
 * نموذجُ صفحة مالية المسجد (ب-٩) — **نفسُ الدفتر بنطاق المسجد**، لا دفترٌ داخليٌّ للمسجد.
 * وما لا يظهر هنا مقصودٌ: لا مالَ مركز ولا رواتبَ ولا مانحين (ق-٣٠).
 */
export function mosqueFinanceView(stores: BoxStores, unitPath: string): MosqueFinanceView {
  return {
    unitPath,
    balances: ownBoxBalances(stores.ledger, unitPath),
    flow: boxFlow(stores.ledger, unitPath, "own"),
    movements: boxMovements(stores.ledger, unitPath),
  }
}
