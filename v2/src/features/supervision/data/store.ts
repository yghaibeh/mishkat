/**
 * مستودعُ الزيارات الإشرافية — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §٧).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): المستودعُ يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ إيقافُ هدفٍ **حالةٌ في البيانات** (المادة ٧/٤)،
 *     والزيارةُ سجلٌّ ميدانيٌّ لا يُمحى.
 *  ٣. **لا حالةَ اعتمادٍ هنا** (G22): ليس في الكيانات حقلُ «معتمَد» ولا «معتمِد» — الحُكمُ
 *     يُسأل عنه منفذاً، فلا نسختان للحقيقة تتباعدان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { SupervisionUnit, SupervisionVisit, VisitTarget } from "../types.js"

type Snapshot = {
  readonly units: Map<string, SupervisionUnit>
  readonly targets: Map<string, VisitTarget>
  readonly visits: Map<string, SupervisionVisit>
  readonly seq: number
}

export class SupervisionStore {
  private unitMap = new Map<string, SupervisionUnit>()
  private targetMap = new Map<string, VisitTarget>()
  private visitMap = new Map<string, SupervisionVisit>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── دليلُ الوحدات (ت-٢: المقاطعُ هي المعرّفات) ───────────────────────────
  saveUnit(unit: SupervisionUnit): void {
    this.unitMap.set(unit.id, Object.freeze({ ...unit, tenantId: this.tenantId }))
  }
  getUnit(id: string): SupervisionUnit | null {
    return this.unitMap.get(id) ?? null
  }
  units(): readonly SupervisionUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  // ── أهدافُ الزيارة (إسقاطٌ قرائيّ — ب-٢٨) ─────────────────────────────────
  saveTarget(target: VisitTarget): void {
    this.targetMap.set(target.id, Object.freeze({ ...target, tenantId: this.tenantId }))
  }
  getTarget(id: string): VisitTarget | null {
    return this.targetMap.get(id) ?? null
  }
  targets(): readonly VisitTarget[] {
    return Object.freeze([...this.targetMap.values()])
  }

  // ── الزيارات ──────────────────────────────────────────────────────────────
  saveVisit(visit: SupervisionVisit): void {
    this.visitMap.set(visit.id, Object.freeze({ ...visit, tenantId: this.tenantId }))
  }
  getVisit(id: string): SupervisionVisit | null {
    return this.visitMap.get(id) ?? null
  }
  visits(): readonly SupervisionVisit[] {
    return Object.freeze([...this.visitMap.values()])
  }
  /** زياراتُ هدفٍ بعينه — مرتَّبةً بالأحدث أولاً (حتميّاً بمفتاح اليوم ثم المعرّف). */
  visitsOfTarget(targetId: string): readonly SupervisionVisit[] {
    return Object.freeze(
      [...this.visitMap.values()]
        .filter((v) => v.targetId === targetId)
        .sort((a, b) => (a.dayKey === b.dayKey ? b.id.localeCompare(a.id) : b.dayKey.localeCompare(a.dayKey))),
    )
  }

  // ── المعاملة الذرّية ────────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      units: new Map(this.unitMap),
      targets: new Map(this.targetMap),
      visits: new Map(this.visitMap),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.unitMap = s.units
    this.targetMap = s.targets
    this.visitMap = s.visits
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
