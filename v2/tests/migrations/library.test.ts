/**
 * G10 — هجرةُ المكتبة `0007`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥). القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 *
 * **والوجهُ الخاصُّ بالمكتبة**: الفخُّ المتوقَّع «عدّادٌ مخزَّنٌ للخَتمات الثلاث». فيُقاس هنا
 * **على المخطط نفسِه** أنه لا حقلَ يحفظ عدداً — لا في النيّة بل في القاعدة (نظيرُ «لا حائزَ
 * في مخطط العُهد»): من زاد عموداً كذلك يُحمّره هذا الاختبار.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { createMaterial } from "../../src/features/library/services/materials.js"
import { myLibrary } from "../../src/features/library/services/mine.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  libraryContext,
  librarySession,
  materialInput,
  seedLibrarySession,
} from "../db/_library.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const LIBRARY_TABLES = [
  "library_units",
  "library_categories",
  "library_audiences",
  "library_formats",
  "library_materials",
  "library_progress",
] as const

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ المكتبة `0007` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الستة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of LIBRARY_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**ولا حقلَ يحفظ عدداً في المخطط نفسِه** — «الخَتَماتُ الثلاث» اشتقاقٌ لا رولّ-أب مخزَّن", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of LIBRARY_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        // عمودٌ يحفظ عدّاً (delivered_count/completed_total/…) هو عينُ ما نهى عنه README §٤.
        expect(`${table}.${column}:${/(count|_total|_num|tally)$/.test(column)}`).toBe(
          `${table}.${column}:false`,
        )
      }
    }
    driver.close()
  })

  it("**وخطُّ الزمن مفتاحُه (شبكة، مادة، شخص)** — سجلٌّ واحدٌ لكلّ (مادة، شخص) كـ`UNIQUE` v1", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const info = await driver.all({ sql: "PRAGMA table_info(library_progress)", params: [] })
    const pk = info
      .filter((c) => Number(c["pk"]) > 0)
      .sort((a, b) => Number(a["pk"]) - Number(b["pk"]))
      .map((c) => String(c["name"]))
    expect(pk).toEqual(["tenant_id", "material_id", "person_id"])
    driver.close()
  })
})

describe("هجرةُ المكتبة — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ مادةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO library_materials (tenant_id, unit_path, id, title_ar, category_id," +
          " audience_id, kind, unit_id, mandatory, storage_key, content_type, size_bytes," +
          " external_url, created_by, created_at, archived_at, archived_by)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/homs/sq2/khalid/", "mat-1", "دليل", "admin_training", "all", "link",
          "khalid", 0, null, null, null, "https://x", "u-admin", 1_753_000_000_000, null, null,
        ],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const materials = await driver.all({ sql: "SELECT id FROM library_materials", params: [] })
    expect(materials).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ المكتبة — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بالهجرات السابقة **وحدها**، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const prior = shippedMigrations().filter((m) => m.name < "0007")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (الوصفة §٣-٨ · قب-٥١ · فخّ ٢): كلُّ الهجرات من `0007` فصاعداً تنزل
    // هنا — والمكتبةُ **إحداها** لا آخرُها. وسردُ «0007 وحدها» يفترض أنها الأخيرة، فتُحمّرها
    // أوّلُ هجرةِ وحدةٍ تليها. **والثابتُ المقصود هو التالي: `after == before`** (اللاإتلاف).
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0007").map((m) => m.name))
    expect(applied).toContain("0007_library.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والمكتبةُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0007")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedLibrarySession(target, MAIN)
    const id = await librarySession(target, MAIN, (store) => {
      const made = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
      if (!made.ok) throw new Error(made.error.code)
      return made.value.id
    })
    await librarySession(target, MAIN, (store) => {
      // ختمُ الاستلام يعبر القاعدةَ لأميرِ المسجد الذي تبلغه المادة.
      myLibrary(store, libraryContext("u-amir"))
    })
    const progress = await target.all({
      sql: "SELECT material_id, unit_path FROM library_progress",
      params: [],
    })
    expect(progress).toHaveLength(1)
    expect(String(progress[0]!["material_id"])).toBe(id)
    expect(String(progress[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    target.close()
  })
})
