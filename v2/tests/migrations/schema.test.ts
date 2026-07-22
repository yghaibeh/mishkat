/**
 * G10 — الهجرةُ الأولى: على قاعدةٍ نظيفة، **ومرتين**، وبمفتاح التوجيه على كل جدول
 * (المادة ٧/١-٢، ADR-001 ع-٥، `db/README.md` الحسم ٢).
 *
 * القياسُ على **المخطط المطبَّق فعلاً** (`PRAGMA`) لا على نصّ الملف — فلا يمرّ عمودٌ
 * كُتب في الملفّ ولم يصل القاعدة.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import {
  ROUTING_COLUMN,
  TABLES,
  TENANT_COLUMN,
  type ColumnSpec,
} from "../../src/db/schema.js"
import { freshDb, shippedMigrations } from "../db/_harness.js"

type PragmaColumn = { name: string; type: string; notnull: number; pk: number }

async function appliedColumns(
  driver: Awaited<ReturnType<typeof freshDb>>,
  table: string,
): Promise<readonly PragmaColumn[]> {
  return (await driver.all({
    sql: `PRAGMA table_info(${table})`,
    params: [],
  })) as unknown as readonly PragmaColumn[]
}

async function appliedTables(
  driver: Awaited<ReturnType<typeof freshDb>>,
): Promise<readonly string[]> {
  const rows = await driver.all({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    params: [],
  })
  return rows.map((r) => String(r["name"]))
}

async function indexedColumnSets(
  driver: Awaited<ReturnType<typeof freshDb>>,
  table: string,
): Promise<readonly string[]> {
  const indexes = await driver.all({ sql: `PRAGMA index_list(${table})`, params: [] })
  const out: string[] = []
  for (const index of indexes) {
    const info = await driver.all({
      sql: `PRAGMA index_info(${String(index["name"])})`,
      params: [],
    })
    out.push(info.map((c) => String(c["name"])).join(","))
  }
  return out
}

describe("الهجرةُ الأولى — القاعدةُ النظيفة", () => {
  it("تُطبَّق على قاعدةٍ نظيفة فتُنشئ كلَّ جدولٍ يعلنه المخطط", async () => {
    const driver = await freshDb()
    const applied = await appliedTables(driver)
    for (const spec of TABLES) expect(applied).toContain(spec.name)
    driver.close()
  })

  it("لا جدولَ في القاعدة خارج المخطط المعلن — فلا مصدرَ حقيقةٍ ثانٍ", async () => {
    const driver = await freshDb()
    const declared = new Set(TABLES.map((t) => t.name))
    for (const name of await appliedTables(driver)) expect(declared).toContain(name)
    driver.close()
  })

  it("أعمدةُ كلِّ جدولٍ في القاعدة تطابق المخطط المعلن حرفياً — اسماً وإلزاماً ومفتاحاً", async () => {
    const driver = await freshDb()
    for (const spec of TABLES) {
      const applied = await appliedColumns(driver, spec.name)
      expect(applied.map((c) => c.name)).toEqual(spec.columns.map((c: ColumnSpec) => c.name))
      for (const column of spec.columns) {
        const found = applied.find((c) => c.name === column.name)!
        expect(`${column.name}:${found.notnull === 1}`).toBe(`${column.name}:${!column.nullable}`)
      }
      const pk = applied
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name)
      expect(pk).toEqual([...spec.primaryKey])
    }
    driver.close()
  })
})

describe("مفتاحُ التوجيه — ع-٥ (نقطةُ اللاعودة)", () => {
  it("مفتاحُ التوجيه: كلُّ جدولٍ يحمل بيانات شبكةٍ يحمل `tenant_id` و`unit_path`", async () => {
    const driver = await freshDb()
    for (const spec of TABLES) {
      if (spec.infrastructure) continue
      const names = (await appliedColumns(driver, spec.name)).map((c) => c.name)
      expect(`${spec.name}:${names.includes(TENANT_COLUMN)}`).toBe(`${spec.name}:true`)
      expect(`${spec.name}:${names.includes(ROUTING_COLUMN)}`).toBe(`${spec.name}:true`)
    }
    driver.close()
  })

  it("مفتاحُ التوجيه: كلُّ جدولٍ مفهرسٌ على (شبكة، مسار) — فاستعلامُ «ما تحت العقدة» لا يمسح", async () => {
    const driver = await freshDb()
    for (const spec of TABLES) {
      if (spec.infrastructure) continue
      const sets = await indexedColumnSets(driver, spec.name)
      expect(`${spec.name}:${sets.includes(`${TENANT_COLUMN},${ROUTING_COLUMN}`)}`).toBe(
        `${spec.name}:true`,
      )
    }
    driver.close()
  })

  it("مفتاحُ التوجيه: لا جدولَ بنيةٍ تحتية إلا الذي لا يحمل شبكةً أصلاً", async () => {
    const driver = await freshDb()
    for (const spec of TABLES.filter((t) => t.infrastructure)) {
      const names = (await appliedColumns(driver, spec.name)).map((c) => c.name)
      expect(names).not.toContain(TENANT_COLUMN)
    }
    driver.close()
  })
})

describe("الهجرةُ مرتين — idempotent (المادة ٧/١)", () => {
  it("إعادةُ تشغيل الهجرات لا ترمي ولا تُطبّق شيئاً جديداً", async () => {
    const driver = openSqliteDriver()
    const first = await applyMigrations(driver, shippedMigrations())
    expect(first.length).toBeGreaterThan(0)
    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    driver.close()
  })

  it("إعادةُ التشغيل لا تُزدوج صفَّ دفترِ الهجرات ولا تُفقد بياناتٍ مكتوبة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql: "INSERT INTO org_units (tenant_id, unit_path, id, type, label_ar, parent_id, section, archived) VALUES (?,?,?,?,?,?,?,?)",
        params: ["t-main", "/men/", "men", "section", "قسم الرجال", null, "men", 0],
      },
    ])
    await applyMigrations(driver, shippedMigrations())
    const units = await driver.all({ sql: "SELECT id FROM org_units", params: [] })
    expect(units).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })

  it("الهجرةُ المرقّمةُ تُسجَّل باسمها — فلا تُطبَّق مرتين ولو تغيّر ترتيبُ القراءة", async () => {
    const driver = openSqliteDriver()
    const migrations = shippedMigrations()
    await applyMigrations(driver, migrations)
    const recorded = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(recorded.map((r) => String(r["name"])).sort()).toEqual(
      migrations.map((m) => m.name).sort(),
    )
    driver.close()
  })
})

describe("لهجةُ القاسم المشترك — ع-٣", () => {
  it("لا مزيةَ محرّكٍ خاصة في الهجرات: لا JSONB ولا فهرسٌ جزئيّ ولا AUTOINCREMENT", () => {
    for (const migration of shippedMigrations()) {
      const sql = migration.sql.replace(/--[^\n]*/g, "")
      expect(`${migration.name}:${/\bJSONB\b/i.test(sql)}`).toBe(`${migration.name}:false`)
      expect(`${migration.name}:${/\bAUTOINCREMENT\b/i.test(sql)}`).toBe(`${migration.name}:false`)
      expect(`${migration.name}:${/CREATE\s+INDEX[^;]*\bWHERE\b/i.test(sql)}`).toBe(
        `${migration.name}:false`,
      )
    }
  })

  it("لا مخططَ لوحدةٍ خارج وحدتَي الريادة — الثلاث عشرة الباقية لـT26", () => {
    const pilot =
      /^(_migrations|org_|ledger_|journal_|finance_actions|funds|fund_balances|audit_log|active_posting_keys|sequences)/
    for (const spec of TABLES) expect(`${spec.name}:${pilot.test(spec.name)}`).toBe(`${spec.name}:true`)
  })
})
