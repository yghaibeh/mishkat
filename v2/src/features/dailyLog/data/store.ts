/**
 * مستودعُ سجل اليوم — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §٦).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): المستودعُ يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ إيقافُ نشاطٍ أو مخطّطٍ **حالةٌ في البيانات**
 *     (المادة ٧/٤)، ونسخةُ النشاط تُضاف ولا تُبدَّل بأثرٍ رجعيّ.
 *  ٣. **فهرسان فريدان على القيد** (ق-٤٥): `clientUuid` والمفتاحُ الطبيعيّ (وحدة/نشاط/يوم) —
 *     فمزامنتان متزامنتان **تحدِّثان قيداً واحداً** ولا تضاعفان نقاطاً.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  ActivityDefinition,
  ActivityScheme,
  DailyEntry,
  DailyLogUnit,
  FamilyRoster,
} from "../types.js"

type Snapshot = {
  readonly units: Map<string, DailyLogUnit>
  readonly schemes: Map<string, ActivityScheme>
  readonly activities: Map<string, ActivityDefinition>
  readonly entries: Map<string, DailyEntry>
  readonly rosters: Map<string, FamilyRoster>
  readonly seq: number
}

/** المفتاحُ الطبيعيّ للقيد (ق-٤٥) — وحدةٌ ونشاطٌ ويوم؛ والحرُّ لا مفتاحَ طبيعيَّ له. */
export function naturalKeyOf(
  unitPath: string,
  activityId: string | null,
  dayKey: string,
): string | null {
  return activityId === null ? null : `${unitPath}|${activityId}|${dayKey}`
}

export class DailyLogStore {
  private unitMap = new Map<string, DailyLogUnit>()
  private schemeMap = new Map<string, ActivityScheme>()
  private activityMap = new Map<string, ActivityDefinition>()
  private entryMap = new Map<string, DailyEntry>()
  private rosterMap = new Map<string, FamilyRoster>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── دليلُ الوحدات (ت-٢: المقاطعُ هي المعرّفات) ───────────────────────────
  saveUnit(unit: DailyLogUnit): void {
    this.unitMap.set(unit.id, Object.freeze({ ...unit, tenantId: this.tenantId }))
  }
  getUnit(id: string): DailyLogUnit | null {
    return this.unitMap.get(id) ?? null
  }
  units(): readonly DailyLogUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  // ── مخطّطاتُ الأنشطة (ق-٤٢) ───────────────────────────────────────────────
  saveScheme(scheme: ActivityScheme): void {
    this.schemeMap.set(scheme.id, Object.freeze({ ...scheme, tenantId: this.tenantId }))
  }
  getScheme(id: string): ActivityScheme | null {
    return this.schemeMap.get(id) ?? null
  }
  schemes(): readonly ActivityScheme[] {
    return Object.freeze([...this.schemeMap.values()])
  }

  // ── كتالوجُ الأنشطة بنسخه المؤرَّخة (ب-٣٩ج/ق-٣٦) ──────────────────────────
  saveActivity(definition: ActivityDefinition): void {
    this.activityMap.set(definition.id, Object.freeze({ ...definition, tenantId: this.tenantId }))
  }
  activities(): readonly ActivityDefinition[] {
    return Object.freeze([...this.activityMap.values()])
  }

  // ── قيودُ اليوم بفهرسَيها الفريدين (ق-٤٥) ─────────────────────────────────
  saveEntry(entry: DailyEntry): void {
    this.entryMap.set(entry.id, Object.freeze({ ...entry, tenantId: this.tenantId }))
  }
  getEntry(id: string): DailyEntry | null {
    return this.entryMap.get(id) ?? null
  }
  entries(): readonly DailyEntry[] {
    return Object.freeze([...this.entryMap.values()])
  }
  /** الفهرسُ الأول: بصمةُ العميل — تخدم الأوفلاين (ت-٨) فلا تُضاعف المزامنةُ نقاطاً. */
  findByClientUuid(clientUuid: string): DailyEntry | null {
    for (const e of this.entryMap.values()) if (e.clientUuid === clientUuid) return e
    return null
  }
  /** الفهرسُ الثاني: المفتاحُ الطبيعيّ — فلا قيدان لنفس النشاط في اليوم نفسِه. */
  findByNaturalKey(key: string): DailyEntry | null {
    for (const e of this.entryMap.values()) {
      if (naturalKeyOf(e.unitPath, e.activityId, e.dayKey) === key) return e
    }
    return null
  }

  // ── عددُ طلاب الأسرة (ب-٣٢) ───────────────────────────────────────────────
  saveRoster(roster: FamilyRoster): void {
    this.rosterMap.set(roster.unitPath, Object.freeze({ ...roster, tenantId: this.tenantId }))
  }
  getRoster(unitPath: string): FamilyRoster | null {
    return this.rosterMap.get(unitPath) ?? null
  }
  /** كلُّ الأعداد المضبوطة — تخدم الإسقاطَ إلى القاعدة (طبقةُ الاستمرار) لا منطقَ الوحدة. */
  rosters(): readonly FamilyRoster[] {
    return Object.freeze([...this.rosterMap.values()])
  }

  // ── المعاملة الذرّية ────────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      units: new Map(this.unitMap),
      schemes: new Map(this.schemeMap),
      activities: new Map(this.activityMap),
      entries: new Map(this.entryMap),
      rosters: new Map(this.rosterMap),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.unitMap = s.units
    this.schemeMap = s.schemes
    this.activityMap = s.activities
    this.entryMap = s.entries
    this.rosterMap = s.rosters
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
