/**
 * ق-٦٠ — **الرصيدُ مشتقٌّ من الدفتر الواحد: صفر حقلِ رصيدٍ مخزَّن** (عقدُ الوحدة §٣).
 *
 * كلُّ دالةٍ هنا **استعلامٌ على أسطر النواة**، وليس في الوحدة كلِّها حقلٌ يحفظ رصيداً أو
 * مجموعاً. ولهذا وحدَه تموت أعراضُ الميدان الثلاثة (ع-١٣/ع-١٤/ع-٢٤) بنيوياً: الأعلى والأسفل
 * و«الصناديق السُّفلية» **ثلاثةُ عروضٍ لمصدرٍ واحد**، فلا يمكن أن يظهر رقمٌ في أحدها ويغيب
 * عن الآخر — وذاك جذرُهم (ج٥: انفصامُ الكتابة عن القراءة).
 *
 * **والأرصدةُ منفصلةٌ بالعملات دائماً** (ق-٦٢): ليس في هذا الملفّ دالةٌ تجمع عملتين في رقم؛
 * الجمعُ بسعرٍ معلن موطنُه `totalInBase` في النواة وهو **مقفلٌ بلا سعرٍ معلن**.
 */

import { contains } from "../../../authorization/scope.js"
import { cashBalances, type CurrencyBalance } from "../../ledger/services/balances.js"
import { ACCOUNT_ROLES } from "../../ledger/services/simpleFace.js"
import type { LedgerStore } from "../../ledger/data/store.js"
import type { Cents, CurrencyCode, JournalLine } from "../../ledger/types.js"

/** «الصناديق الثلاثة» بلغة المستخدم (ع-١٤): واردٌ · صادرٌ · رصيد — لكل عملةٍ على حدة. */
export type BoxFlow = {
  readonly incoming: Cents
  readonly outgoing: Cents
  readonly net: Cents
}

/** حركةُ صندوقٍ كما يقرؤها المالي البسيط: مبلغٌ ثم تفصيلُه (ع-١٤) — لا مدينَ ولا دائن. */
export type BoxMovement = {
  readonly entryId: string
  readonly voucherNo: string
  readonly at: Date
  readonly memoAr: string
  readonly unitPath: string
  readonly currency: CurrencyCode
  readonly direction: "in" | "out"
  readonly amount: Cents
}

/** رصيدُ صندوقٍ ابنٍ في العرض الهابط (ع-٢٤ · ق-١٧). */
export type ChildBoxSummary = {
  readonly unitId: string
  readonly unitPath: string
  readonly balances: ReadonlyMap<CurrencyCode, CurrencyBalance>
}

/** أسطرُ النقد وحدها هي حركةُ الصندوق — نظيرُ قاعدة النواة في قياس رصيد الصندوق الشرعيّ. */
function cashLines(store: LedgerStore): readonly JournalLine[] {
  return store.lines().filter((l) => l.accountId === ACCOUNT_ROLES.cash)
}

function aggregate(lines: readonly JournalLine[]): ReadonlyMap<CurrencyCode, CurrencyBalance> {
  const totals = new Map<CurrencyCode, { debit: number; credit: number }>()
  for (const line of lines) {
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
 * رصيدُ **الوحدة بذاتها** — مطابقةٌ تامّةٌ للمسار لا احتواء: صندوقُ المربع غيرُ مجموع
 * صناديق مساجده، والخلطُ بينهما هو ما جعل «الأعلى» و«الأسفل» يتناقضان في v1 (ع-١٣).
 */
export function ownBoxBalances(
  store: LedgerStore,
  unitPath: string,
): ReadonlyMap<CurrencyCode, CurrencyBalance> {
  return aggregate(cashLines(store).filter((l) => l.unitPath === unitPath))
}

/** التجميعُ الهابط: الوحدةُ **وما تحتها** — اطّلاعُ المشرف (ق-١٧) من **نفس** المصدر. */
export function subtreeBoxBalances(
  store: LedgerStore,
  unitPath: string,
): ReadonlyMap<CurrencyCode, CurrencyBalance> {
  return cashBalances(store, unitPath)
}

/**
 * الصناديقُ الثلاثة — **مشتقّةٌ من نفس دالة الرصيد** لا محسوبةٌ ثانيةً (ق-١١١):
 * فيستحيل أن يقول «الوارد» شيئاً ويقول «الرصيد» غيرَه (ع-١٤).
 */
export function boxFlow(
  store: LedgerStore,
  unitPath: string,
  reach: "own" | "subtree",
): ReadonlyMap<CurrencyCode, BoxFlow> {
  const balances = reach === "own" ? ownBoxBalances(store, unitPath) : subtreeBoxBalances(store, unitPath)
  const out = new Map<CurrencyCode, BoxFlow>()
  for (const [currency, b] of balances) {
    out.set(currency, { incoming: b.debit, outgoing: b.credit, net: b.net })
  }
  return out
}

/**
 * حركاتُ الصندوق (الوحدةُ وما تحتها) — كلُّ سطرِ نقدٍ حركةٌ بسندها ووحدتها واتجاهها.
 * القراءةُ **من القيود إلى أسطرها** لا العكس: فلا يوجد فرعُ «سطرٌ بلا قيد» أصلاً — الحالةُ
 * المستحيلةُ التي لا تُختبر لا تُكتب (نظيرُ ثابت الختم في النواة).
 */
export function boxMovements(store: LedgerStore, unitPath: string): readonly BoxMovement[] {
  const out: BoxMovement[] = []
  for (const entry of store.entries()) {
    for (const line of store.linesOf(entry.id)) {
      if (line.accountId !== ACCOUNT_ROLES.cash) continue
      if (!contains(unitPath, line.unitPath)) continue
      const incoming = line.debit > 0
      out.push({
        entryId: entry.id,
        voucherNo: entry.voucherNo,
        at: entry.at,
        memoAr: entry.memoAr,
        unitPath: line.unitPath,
        currency: line.currency,
        direction: incoming ? "in" : "out",
        amount: (incoming ? line.debit : line.credit) as Cents,
      })
    }
  }
  return out
}

/**
 * **الصناديقُ السُّفلية** (ع-٢٤): كلُّ وحدةٍ ابنةٍ مباشرةٍ برصيدها الهابط.
 * تُقرأ من **إسقاط الوحدات في الدفتر نفسِه**، فالوحدةُ التي لا حركةَ لها تظهر بصفرٍ صريح
 * ولا تختفي — «الفراغُ يُشخَّص ولا يُخفى» (ق-١١٢).
 */
export function childBoxSummaries(
  store: LedgerStore,
  unitPath: string,
): readonly ChildBoxSummary[] {
  const out: ChildBoxSummary[] = []
  for (const unit of store.units()) {
    if (unit.path === unitPath) continue
    if (!contains(unitPath, unit.path)) continue
    const rest = unit.path.slice(unitPath.length)
    // الأبناءُ المباشرون وحدهم: مقطعٌ واحدٌ بعد مسار الأب (وإلا لتكرّر الحفيدُ تحت جدّه).
    if (rest.split("/").filter((s) => s.length > 0).length !== 1) continue
    out.push({
      unitId: unit.id,
      unitPath: unit.path,
      balances: subtreeBoxBalances(store, unit.path),
    })
  }
  return out
}
