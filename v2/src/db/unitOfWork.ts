/**
 * **وحدةُ العمل** — حاملةُ الذرّية في غياب المعاملات التفاعلية (`README.md` الحسم ١).
 *
 * ثلاثُ طبقاتٍ تحمل الثابت «لا قيدٌ بلا سجلِّ تسليمه، ولا سجلٌّ بلا قيده»:
 *  ١. **تحميلٌ ثم مقطعٌ متزامن**: المنطقُ يعمل على المستودع القائم كما هو حرفياً — فلا
 *     يتغيّر توقيعٌ تناديه خدمة، ولا يُعدَّل سطرٌ في وحدة ميزة.
 *  ٢. **الفارقُ يُحسب لا يُلتقط**: تُقارَن حالةُ المستودع بعد العملية بلقطةِ التحميل. فإن
 *     ارتدّت الذاكرةُ (رميةٌ داخل `transaction`) صار الفارقُ صفراً ⟵ **لا عبارةَ تُكتب**.
 *     وهذا وحدَه ما يصمد أمام كتابةٍ مباشرةٍ في حقلٍ عامّ بلا نداءِ دالّة.
 *  ٣. **دفعةٌ واحدة بمفاتيحَ طبيعية**: الفارقُ كلُّه `batch` واحدة (معاملةٌ ضمنية) وكلُّ
 *     عبارةٍ `ON CONFLICT … DO UPDATE` ⟵ إعادةُ الدفعة تتقارب ولا تزدوج (ع-٤).
 *
 * والمستودعانِ يُقذفان في **دفعةٍ واحدة** — فالثابتُ العابر للمستودعين لا يحتاج معاملةً
 * تفاعليةً غيرَ موجودة.
 */

import type { SqlDriver, SqlRow, SqlStatement } from "./sql/driver.js"
import {
  ROUTING_COLUMN,
  TENANT_COLUMN,
  TENANT_ROOT_PATH,
  hasTable,
  tableSpec,
  type TableSpec,
} from "./schema.js"

export type Scope = {
  readonly tenantId: string
  /** بادئةُ المسار المحمَّلة — `/` تعني الشبكةَ كلَّها. */
  readonly scopePath: string
}

/** جداولُ الجدول ⟵ (مفتاحٌ طبيعيّ ⟵ صفّ). */
export type RowSet = ReadonlyMap<string, ReadonlyMap<string, SqlRow>>

/**
 * ما يُلزم به المستودعُ المهاجَر: جداولٌ يملكها، وإسقاطٌ، وتحميل.
 * `owns` تفصل صفوفَ مصدرٍ عن آخر في جدولٍ مشترك (سجلُّ التدقيق والعدّادات) — فلا يمحو
 * إسقاطُ أحدهما صفوفَ الآخر.
 */
export type TableClaim = {
  readonly table: string
  readonly owns?: (row: SqlRow) => boolean
}

export type PersistentStore = {
  readonly name: string
  readonly tables: readonly (string | TableClaim)[]
  project: () => RowSet
  load: (rows: RowSet) => void
}

/**
 * فاصلُ المفتاح الطبيعيّ — محرفٌ **لا يظهر في أي معرّفٍ أو مسار**، فلا يلتبس مفتاحان
 * مركّبان. يُكتب هروباً لا حرفاً خاماً: محرفٌ غيرُ مرئيٍّ في المصدر يُنسَخ خطأً ولا يُرى.
 */
const KEY_SEPARATOR = "\u0000"

/** يُركِّب المفتاحَ الطبيعيّ كما يُركّبه `primaryKeyOf` — فلا يُبنى بيدٍ في موضعين. */
export function naturalKey(...values: readonly (string | number)[]): string {
  return values.map(String).join(KEY_SEPARATOR)
}

function claimOf(entry: string | TableClaim): TableClaim {
  return typeof entry === "string" ? { table: entry } : entry
}

export function primaryKeyOf(spec: TableSpec, row: SqlRow): string {
  return naturalKey(...spec.primaryKey.map((column) => String(row[column] ?? "")))
}

function sameRow(a: SqlRow, b: SqlRow): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => (a[key] ?? null) === (b[key] ?? null))
}

/** بادئةٌ آمنة لـ`LIKE`: المسارُ قد يحمل `_` وهو محرفُ بدلٍ في اللهجة القياسية. */
function likePrefix(path: string): string {
  return `${path.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}

function upsert(spec: TableSpec, row: SqlRow): SqlStatement {
  const columns = spec.columns.map((column) => column.name)
  const assignable = columns.filter((column) => !spec.primaryKey.includes(column))
  const setClause =
    assignable.length === 0
      ? "DO NOTHING"
      : `DO UPDATE SET ${assignable.map((column) => `${column} = excluded.${column}`).join(", ")}`
  return {
    sql:
      `INSERT INTO ${spec.name} (${columns.join(", ")}) ` +
      `VALUES (${columns.map(() => "?").join(", ")}) ` +
      `ON CONFLICT (${spec.primaryKey.join(", ")}) ${setClause}`,
    params: columns.map((column) => row[column] ?? null),
  }
}

function remove(spec: TableSpec, row: SqlRow): SqlStatement {
  return {
    sql: `DELETE FROM ${spec.name} WHERE ${spec.primaryKey.map((c) => `${c} = ?`).join(" AND ")}`,
    params: spec.primaryKey.map((column) => row[column] ?? null),
  }
}

/**
 * الفارقُ بين لقطتين ⟵ عبارات. **واختفاءُ صفٍّ من جدولٍ ملحقٍ فقط رميةٌ لا `DELETE`**
 * (المادة ٧/٤: لا حذفَ فيزيائيّ لبيانات العمل الحساسة) — والإخفاقُ الصامت أسوأ من الرمية.
 */
export function diffStatements(
  spec: TableSpec,
  before: ReadonlyMap<string, SqlRow>,
  after: ReadonlyMap<string, SqlRow>,
): readonly SqlStatement[] {
  const statements: SqlStatement[] = []
  for (const [key, row] of after) {
    const previous = before.get(key)
    if (previous === undefined || !sameRow(previous, row)) statements.push(upsert(spec, row))
  }
  for (const [key, row] of before) {
    if (after.has(key)) continue
    if (spec.appendOnly) {
      throw new Error(
        `محوٌ ممنوع: صفٌّ اختفى من ${spec.name} (${key.split(KEY_SEPARATOR).join("/")}) — الجدولُ ملحقٌ فقط (المادة ٧/٤)`,
      )
    }
    statements.push(remove(spec, row))
  }
  return statements
}

export class UnitOfWork {
  private readonly sources: PersistentStore[] = []
  private readonly baselines = new Map<string, RowSet>()

  constructor(
    private readonly driver: SqlDriver,
    readonly scope: Scope,
  ) {}

  enlist(source: PersistentStore): void {
    this.sources.push(source)
  }

  /**
   * يقرأ نطاقَ كلِّ مصدرٍ ويُحمِّله. **ويرفض مصدراً بلا مخطط** — فلا تُقذف وحدةُ عملٍ
   * خليطة تترك قيداً دائماً وسجلَّ تسليمه في ذاكرةٍ تزول (README الحسم ١).
   */
  async hydrate(): Promise<void> {
    const cache = new Map<string, readonly SqlRow[]>()
    for (const source of this.sources) {
      const claims = source.tables.map(claimOf)
      for (const claim of claims) {
        if (!hasTable(claim.table)) {
          throw new Error(
            `وحدةُ عملٍ خليطة: المستودع «${source.name}» يطلب الجدول ${claim.table} ولا مخططَ له — يُرفض ولا يُقذف نصفَ أثر`,
          )
        }
      }
      const rows = new Map<string, Map<string, SqlRow>>()
      for (const claim of claims) {
        const spec = tableSpec(claim.table)
        let all = cache.get(claim.table)
        if (all === undefined) {
          all = await this.read(spec)
          cache.set(claim.table, all)
        }
        const owned = new Map<string, SqlRow>()
        for (const row of all) {
          if (claim.owns !== undefined && !claim.owns(row)) continue
          owned.set(primaryKeyOf(spec, row), row)
        }
        rows.set(claim.table, owned)
      }
      source.load(rows)
      this.baselines.set(source.name, rows)
    }
  }

  private async read(spec: TableSpec): Promise<readonly SqlRow[]> {
    const columns = spec.columns.map((column) => column.name).join(", ")
    return this.driver.all({
      sql:
        `SELECT ${columns} FROM ${spec.name} ` +
        `WHERE ${TENANT_COLUMN} = ? AND (${ROUTING_COLUMN} LIKE ? ESCAPE '\\' OR ${ROUTING_COLUMN} = ?)`,
      params: [this.scope.tenantId, likePrefix(this.scope.scopePath), TENANT_ROOT_PATH],
    })
  }

  /** عباراتُ مصدرٍ بعينه مقابل أساسه — مكشوفةٌ للتشخيص وللاختبار المباشر. */
  statementsFor(sourceName: string, projected: RowSet): readonly SqlStatement[] {
    const baseline = this.baselines.get(sourceName)
    if (baseline === undefined) throw new Error(`مستودعٌ لم يُحمَّل: ${sourceName}`)
    const statements: SqlStatement[] = []
    for (const [table, after] of projected) {
      const spec = tableSpec(table)
      const before = baseline.get(table) ?? new Map<string, SqlRow>()
      statements.push(...diffStatements(spec, before, after))
    }
    return statements
  }

  /** يقذف فارقَ المصادر كلِّها في **دفعةٍ واحدة** — كلٌّ أو لا شيء. */
  async flush(): Promise<void> {
    const projections = this.sources.map((source) => ({ source, rows: source.project() }))
    const statements: SqlStatement[] = []
    for (const { source, rows } of projections) {
      statements.push(...this.statementsFor(source.name, rows))
    }
    if (statements.length > 0) await this.driver.batch(statements)
    for (const { source, rows } of projections) this.baselines.set(source.name, rows)
  }
}
