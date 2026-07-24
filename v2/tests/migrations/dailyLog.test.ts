/**
 * G10 — هجرةُ سجل اليوم `0004`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * الوجهُ الثالث (الجديد في T26-ب): هجراتُ الوحدات تنزل على قاعدةٍ **فيها بياناتُ v1 المنقولة
 * أصلاً** — حالُ الإنتاج يوم النقل، لا قاعدةٌ بكر. القياسُ على **المخطط المطبَّق** (`PRAGMA`).
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { recordDailyEntry } from "../../src/features/dailyLog/services/entries.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { KHALID, NOW, dailyLogContext, dailyLogSession, seedDailyLogSession } from "../db/_dailyLog.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const DAILY_TABLES = [
  "daily_units",
  "daily_schemes",
  "daily_activities",
  "daily_rosters",
  "daily_entries",
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

describe("هجرةُ سجل اليوم `0004` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الخمسة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of DAILY_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**الكتالوجُ يحمل `scope_path` بياناً — لا يحلّ محلَّ مفتاح التوجيه**", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of ["daily_schemes", "daily_activities"] as const) {
      const columns = await columnsOf(driver, table)
      // نطاقُ السريان عمودُ بيانات (`scope_path`/`scheme_id`)، ومفتاحُ التوجيه `unit_path` باقٍ.
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    expect(await columnsOf(driver, "daily_schemes")).toContain("scope_path")
    driver.close()
  })
})

describe("هجرةُ سجل اليوم — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو قيداً مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO daily_entries (tenant_id, unit_path, id, client_uuid, activity_id, free_text_ar," +
          " day_key, period_key, count, credited_count, points, student_ids, credited_student_ids," +
          " block, by_person_id, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/homs/sq2/khalid/", "dle-1", "c-1", "lesson", null,
          "2026-07-20", "2026-07-18", 1, 1, 5, "[]", "[]", "none", "u-amir", 1_753_000_000_000,
        ],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const entries = await driver.all({ sql: "SELECT id FROM daily_entries", params: [] })
    expect(entries).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ سجل اليوم — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بالهجرات السابقة **وحدها**، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const pilot = shippedMigrations().filter((m) => m.name < "0004")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    expect(applied).toEqual(["0004_dailyLog.sql"])
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**وسجلُّ اليوم يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0004")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedDailyLogSession(target, MAIN)
    await dailyLogSession(target, MAIN, (store) => {
      const done = recordDailyEntry(store, dailyLogContext("u-amir"), {
        clientUuid: "c-after-transfer",
        unitId: KHALID,
        activityId: "lesson",
        count: 1,
        date: NOW,
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    const entries = await target.all({ sql: "SELECT id, unit_path FROM daily_entries", params: [] })
    expect(entries).toHaveLength(1)
    expect(String(entries[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    target.close()
  })
})
