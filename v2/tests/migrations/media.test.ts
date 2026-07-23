/**
 * G10 — هجرةُ الإعلام `0006`: على قاعدةٍ نظيفة، **ومرتين**, **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ حالُ الإنتاج يوم T26-ب: هجرةُ الوحدة تنزل على قاعدةٍ **فيها بياناتُ v1
 * المنقولة أصلاً** (وحدتا الريادة)، لا على قاعدةٍ بكر. فإن لم يُقس ذلك صار «تنجح على النظيف»
 * ادّعاءً عن حالةٍ لا تقع.
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { createCoverage } from "../../src/features/media/services/coverages.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { KHALID_PATH, coverageInput, mediaContext, mediaSession, seedMediaSession } from "../db/_media.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const MEDIA_TABLES = ["media_units", "media_kinds", "media_formats", "media_coverages", "media_photos"] as const

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ الإعلام `0006` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الخمسة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of MEDIA_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**والتغطيةُ تحمل عمودَي «سحبِ المنشور»** — الحذفُ بيانٌ في المخطط لا محوٌ", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const columns = await columnsOf(driver, "media_coverages")
    expect(columns).toContain("deleted_at")
    expect(columns).toContain("deleted_by")
    driver.close()
  })
})

describe("هجرةُ الإعلام — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ تغطيةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO media_coverages (tenant_id, unit_path, id, title_ar, kind_id, unit_id," +
          " occurred_on, publisher_person_id, created_at, deleted_at, deleted_by)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [MAIN, KHALID_PATH, "mc-1", "افتتاح", "event", "khalid", 1_752_000_000_000, "u-media", 1_753_000_000_000, null, null],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const coverages = await driver.all({ sql: "SELECT id FROM media_coverages", params: [] })
    expect(coverages).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ الإعلام — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بهجرات ما قبل الإعلام، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const pilot = shippedMigrations().filter((m) => m.name < "0006")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    expect(applied).toEqual(["0006_media.sql"])
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والإعلامُ يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0006")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedMediaSession(target, MAIN)
    const coverageId = await mediaSession(target, MAIN, (store) => {
      const made = createCoverage(store, mediaContext("u-media"), coverageInput())
      if (!made.ok) throw new Error(made.error.code)
      return made.value.id
    })
    const rows = await target.all({ sql: "SELECT id, unit_path FROM media_coverages", params: [] })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["id"])).toBe(coverageId)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    target.close()
  })
})
