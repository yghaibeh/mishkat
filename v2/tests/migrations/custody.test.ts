/**
 * G10 — هجرةُ العُهد `0003`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ هو الجديد في T26-ب: الهجرةُ الأولى نزلت على قاعدةٍ **بكر**، أمّا هجراتُ
 * الوحدات الثلاث عشرة فتنزل على قاعدةٍ **فيها بياناتُ v1 المنقولة أصلاً**. فإن لم يُقس ذلك
 * صار «تنجح على النظيف» ادّعاءً عن حالةٍ لا تقع في الإنتاج أبداً.
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { registerAsset } from "../../src/features/custody/services/assets.js"
import { recordCustodyMove } from "../../src/features/custody/services/chain.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { custodyContext, custodySession, seedCustodySession } from "../db/_custody.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const CUSTODY_TABLES = ["custody_units", "custody_assets", "custody_moves"] as const

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ العُهد `0003` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الثلاثة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of CUSTODY_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**ولا حقلَ حائزٍ ولا حالةٍ في المخطط نفسِه** — الثابتُ يُفرض في القاعدة كما في النوع", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of CUSTODY_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        expect(`${table}.${column}:${/^(holder|status|current_holder)/.test(column)}`).toBe(
          `${table}.${column}:false`,
        )
      }
    }
    driver.close()
  })
})

describe("هجرةُ العُهد — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ عهدةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO custody_assets (tenant_id, unit_path, id, label_ar, serial_ar, note_ar," +
          " registered_by, registered_at) VALUES (?,?,?,?,?,?,?,?)",
        params: [MAIN, "/men/homs/sq2/khalid/", "as-1", "حاسوب", null, null, "u-finance", 1_753_000_000_000],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const assets = await driver.all({ sql: "SELECT id FROM custody_assets", params: [] })
    expect(assets).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ العُهد — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بهجرتَي الريادة **وحدهما**، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const pilot = shippedMigrations().filter((m) => m.name < "0003")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **احتواءٌ لا تساوٍ**: «٠٠٠٣ آخرُ هجرةٍ» فرضيةٌ انقضت بموجة T26-ب-٢ (تُضاف هجراتٌ بعده)؛
    // والمُثبَتُ الدائمُ أن هجرةَ العُهد **نزلت** على قاعدةٍ منقولةٍ من v1 — لا أنها الوحيدة.
    expect(applied).toContain("0003_custody.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والعُهدُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0003")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedCustodySession(target, MAIN)
    const assetId = await custodySession(target, MAIN, ({ custody }) => {
      const done = registerAsset(custody, custodyContext("u-finance"), {
        unitId: "khalid",
        labelAr: "حاسوبٌ بعد النقل",
      })
      if (!done.ok) throw new Error(done.error.code)
      return done.value.id
    })
    await custodySession(target, MAIN, ({ custody }) => {
      expect(
        recordCustodyMove(custody, custodyContext("u-amir"), {
          assetId,
          action: "hand",
          toPersonId: "u-teacher",
          conditionAr: "سليم",
        }).ok,
      ).toBe(true)
    })
    const moves = await target.all({ sql: "SELECT id, unit_path FROM custody_moves", params: [] })
    expect(moves).toHaveLength(1)
    expect(String(moves[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    target.close()
  })
})
