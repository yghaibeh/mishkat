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
  /**
   * **ميزانيةُ التحميل** (G23 · CR-026 ب · قب-٤٨) — سقفُ الصفوف التي تُحمَّل لهذا المصدر
   * في وحدة عملٍ واحدة.
   *
   * **ولماذا حقلٌ إلزاميّ لا قائمةٌ في البوابة؟** لأن *«كلَّ بوابةٍ تحرس بقائمةٍ يجب أن
   * تشتقّ قائمتها من مصدر الحقيقة؛ وبوابةٌ تُسرد لها الحقيقةُ ستتخلّف عن الواقع حتماً»*
   * (CR-011/قب-٣٦). فالسقفُ يُعلن **حيث يُعلَن المستودع**، والبوابةُ تشتقّه ولا تحفظه —
   * ومستودعٌ جديدٌ بلا سقفٍ **لا يُترجم أصلاً**.
   *
   * **وما يحرسه**: العقودُ متزامنة، فكلُّ ما يقرؤه المنطق يجب أن يكون محمَّلاً سلفاً
   * (CR-026 §٣أ). وثمنُ ذلك أن **كلَّ قراءةٍ جديدةٍ قد توسّع النطاق صامتاً حتى يُبلَغ سقفُ
   * الذاكرة في الميدان لا في CI**. فالسقفُ هنا **يُنزع الصمت لا يقلب المعمار**: تجاوزُه
   * بناءٌ أحمرُ في الدقيقة التي تتوسّع فيها القراءة، لا مفاجأةٌ بعد سنة.
   */
  readonly rowBudget: number
  readonly tables: readonly (string | TableClaim)[]
  project: () => RowSet
  load: (rows: RowSet) => void
}

/**
 * **رميةُ الميزانية** — رسالتُها تُعلّم: أيُّ وحدة عملٍ، وكم حمّلت، وما سقفُها، وأيُّ
 * جدولٍ التهم النصيبَ الأكبر. حارسٌ يقول «تجاوزٌ» ولا يقول **أين** يُكلّف مطاردةً في غير
 * موضعها (CR-023/قب-٤٦ §٣).
 *
 * **والزنادُ مكتوبٌ لا شفويّ** (قب-٤٨ · `db/README.md`): أولُ إخفاقٍ **يتعذّر إصلاحُه
 * بتضييق النطاق** ⟵ CR-026 يُعاد فتحه والتحويلُ إلى `async` يُنفَّذ.
 */
export class LoadBudgetExceededError extends Error {
  constructor(
    readonly source: string,
    readonly loaded: number,
    readonly budget: number,
    readonly byTable: ReadonlyMap<string, number>,
  ) {
    super(
      `ميزانيةُ التحميل (G23): وحدةُ عمل «${source}» حمّلت ${loaded} صفّاً وسقفُها ${budget}. ` +
        `التفصيل: ${[...byTable]
          .sort((a, b) => b[1] - a[1])
          .map(([table, count]) => `${table}=${count}`)
          .join(" · ")}. ` +
        `ضيّق النطاق أو ارفع السقف بدليل؛ وإن تعذّر تضييقُه فهذا **زنادُ CR-026**: ` +
        `يُعاد فتحه ويُنفَّذ التحويلُ إلى عقودٍ غيرِ متزامنة (قب-٤٨).`,
    )
    this.name = "LoadBudgetExceededError"
  }
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

/**
 * **مُرشِّحُ النطاق — مصدرُ حقيقةٍ واحد** (المادة ١/٢): كلُّ قارئٍ للنطاق يستعمله، فلا
 * يقرأ التحميلُ مدىً وتقرأ المطابقةُ مدىً آخر ⟵ **تفاوتٌ يُتَّهم به الرولّ-أب وهو بريء**.
 * وما ليس نطاقُه وحدةً (المراجعُ والعدّادات) يسكن جذرَ الشبكة فيُضمّ صراحةً.
 */
export function scopePredicate(prefix = ""): string {
  const at = prefix === "" ? "" : `${prefix}.`
  return (
    `${at}${TENANT_COLUMN} = ? AND ` +
    `(${at}${ROUTING_COLUMN} LIKE ? ESCAPE '\\' OR ${at}${ROUTING_COLUMN} = ?)`
  )
}

export function scopeParams(scope: Scope): readonly string[] {
  return [scope.tenantId, likePrefix(scope.scopePath), TENANT_ROOT_PATH]
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
      const byTable = new Map<string, number>()
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
        byTable.set(claim.table, owned.size)
      }
      // **ميزانيةُ التحميل تُقاس قبل أن تُبنى الحالة** (G23): الرميةُ قبل `load` لا بعدها،
      // فلا يُبنى في الذاكرة ما نقول إنه لا يُبنى — والقياسُ على **ما يملكه المصدر فعلاً**.
      const loaded = [...byTable.values()].reduce((sum, count) => sum + count, 0)
      if (loaded > source.rowBudget) {
        throw new LoadBudgetExceededError(source.name, loaded, source.rowBudget, byTable)
      }
      source.load(rows)
      this.baselines.set(source.name, rows)
    }
  }

  private async read(spec: TableSpec): Promise<readonly SqlRow[]> {
    const columns = spec.columns.map((column) => column.name).join(", ")
    return this.driver.all({
      sql: `SELECT ${columns} FROM ${spec.name} WHERE ${scopePredicate()}`,
      params: scopeParams(this.scope),
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
