/**
 * مستودعُ الرواتب — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §٤/§٥/§٦/§١٢).
 *
 * **ما لا يعيش هنا أهمُّ ممّا يعيش**: **لا سطرَ مستحقٍّ ولا إجماليَّ شهرٍ ولا حقلَ «مدفوع»**
 * (§٢-١) — المستحقُّ **اشتقاقٌ لحظةَ السؤال**، والمختومُ يعيش في **حمولة المحرّك المُجمَّدة**،
 * و«مدفوعٌ» **يُشتقّ من سجل الصرف** لا يُحدَّث حقلاً. وما يعيش هنا **وقائعُ مالية التُزمت**
 * ومراجعُ توثيق: سلفةٌ خرج نقدُها، وقسطٌ استُرد، وصرفٌ وقع، وتسليمُ منطقةٍ، وحافزٌ مُنح.
 *
 * وثلاثةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ إقفالُ السلفة **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٣. **ذرّيةٌ عابرةٌ للمستودعين**: `atomically` تلفّ معاملةَ هذا المستودع حول معاملة الدفتر،
 *     فيرتدّان معاً — فلا قيدُ صرفٍ بلا سجلِّه ولا سجلٌّ بلا قيده.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { LedgerStore } from "../../ledger/data/store.js"
import type {
  Advance,
  AdvanceInstalment,
  Incentive,
  Payout,
  RegionDistribution,
} from "../types.js"

/** حزمةُ مستودعَي الشبكة الواحدة — الدفترُ مصدرُ المال، والرواتبُ توثيقُه ومراجعُه. */
export type PayrollStores = {
  readonly ledger: LedgerStore
  readonly payroll: PayrollStore
}

type Snapshot = {
  readonly advanceMap: Map<string, Advance>
  readonly instalmentList: AdvanceInstalment[]
  readonly payoutList: Payout[]
  readonly distributionList: RegionDistribution[]
  readonly incentiveList: Incentive[]
  readonly seq: number
}

export class PayrollStore {
  private advanceMap = new Map<string, Advance>()
  private instalmentList: AdvanceInstalment[] = []
  private payoutList: Payout[] = []
  private distributionList: RegionDistribution[] = []
  private incentiveList: Incentive[] = []
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── السلفة وأقساطها (ق-٦٩) ─────────────────────────────────────────────────
  saveAdvance(advance: Advance): void {
    this.advanceMap.set(advance.id, Object.freeze({ ...advance, tenantId: this.tenantId }))
  }
  getAdvance(id: string): Advance | null {
    return this.advanceMap.get(id) ?? null
  }
  advances(): readonly Advance[] {
    return Object.freeze([...this.advanceMap.values()])
  }
  /** سلفُ شخصٍ **المفتوحةُ وحدها** — المقفلةُ باقيةٌ في السجل ولا تُسترد ثانية. */
  openAdvancesOf(personId: string): readonly Advance[] {
    return Object.freeze(
      [...this.advanceMap.values()]
        .filter((a) => a.personId === personId && a.closedAt === null)
        .sort((a, b) => a.id.localeCompare(b.id)),
    )
  }

  appendInstalment(instalment: AdvanceInstalment): void {
    this.instalmentList.push(Object.freeze({ ...instalment, tenantId: this.tenantId }))
  }
  instalmentsOf(advanceId: string): readonly AdvanceInstalment[] {
    return Object.freeze(this.instalmentList.filter((i) => i.advanceId === advanceId))
  }

  // ── الصرف (ق-٦٥/ق-٧١) — توثيقٌ بلا مبلغ ────────────────────────────────────
  appendPayout(payout: Payout): void {
    this.payoutList.push(Object.freeze({ ...payout, tenantId: this.tenantId }))
  }
  payouts(): readonly Payout[] {
    return Object.freeze([...this.payoutList])
  }
  /** **مَن صُرف له في هذه الفترة** — مصدرُ «مدفوع» المشتقّ (ق-٦٥). */
  paidPersonIdsIn(periodId: string): ReadonlySet<string> {
    const out = new Set<string>()
    for (const p of this.payoutList) {
      if (p.periodId !== periodId) continue
      for (const personId of p.personIds) out.add(personId)
    }
    return out
  }

  // ── توزيعُ المناطق (ق-٦٦) — (فترة × منطقة) لا يتكرر ────────────────────────
  appendDistribution(distribution: RegionDistribution): void {
    this.distributionList.push(Object.freeze({ ...distribution, tenantId: this.tenantId }))
  }
  distributionsIn(periodId: string): readonly RegionDistribution[] {
    return Object.freeze(this.distributionList.filter((d) => d.periodId === periodId))
  }
  hasDistribution(periodId: string, toUnitPath: string): boolean {
    return this.distributionList.some((d) => d.periodId === periodId && d.toUnitPath === toUnitPath)
  }

  // ── الحوافز (ق-٧٧) — كيانٌ **خارج** أجر المعلّم بالبناء ────────────────────
  appendIncentive(incentive: Incentive): void {
    this.incentiveList.push(Object.freeze({ ...incentive, tenantId: this.tenantId }))
  }
  incentives(): readonly Incentive[] {
    return Object.freeze([...this.incentiveList])
  }

  // ── المعاملة الذرّية ────────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      advanceMap: new Map(this.advanceMap),
      instalmentList: [...this.instalmentList],
      payoutList: [...this.payoutList],
      distributionList: [...this.distributionList],
      incentiveList: [...this.incentiveList],
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.advanceMap = s.advanceMap
    this.instalmentList = s.instalmentList
    this.payoutList = s.payoutList
    this.distributionList = s.distributionList
    this.incentiveList = s.incentiveList
    this.seq = s.seq
  }

  /** **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع) — نظيرُ معاملة الدفتر. */
  transaction<T>(fn: () => T): T {
    const before = this.snapshot()
    try {
      return fn()
    } catch (e) {
      this.restore(before)
      throw e
    }
  }
}

/**
 * ذرّيةٌ **عابرةٌ للمستودعين**: أيُّ رميةٍ في الداخل تُرجع الدفترَ ومستودعَ الرواتب معاً
 * إلى ما قبل العملية — فلا يبقى قيدُ صرفٍ بلا توثيقه ولا توثيقٌ بلا قيده (عقدُ الوحدة §٤).
 */
export function atomically<T>(stores: PayrollStores, fn: () => T): T {
  return stores.payroll.transaction(() => stores.ledger.transaction(fn))
}
