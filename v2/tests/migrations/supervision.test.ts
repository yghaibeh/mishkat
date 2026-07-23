/**
 * G10 — هجرةُ الإشراف `0009`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ هو ما يخصّ T26-ب: هجراتُ الوحدات تنزل على قاعدةٍ **فيها بياناتُ v1
 * المنقولة أصلاً** — فإن لم يُقس ذلك صار «تنجح على النظيف» ادّعاءً عن حالةٍ لا تقع إنتاجاً.
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { recordVisit } from "../../src/features/supervision/services/visits.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  C1,
  C1_PATH,
  CORE,
  NOW,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  seedSupervisionSession,
  supervisionContext,
  supervisionSession,
} from "../db/_supervision.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const SUPERVISION_TABLES = ["supervision_units", "supervision_targets", "supervision_visits"] as const

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ الإشراف `0009` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الثلاثة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of SUPERVISION_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**والزيارةُ تحمل مسارَين: هدفاً (`unit_path`) ومرساةً (`supervisor_path`)** في المخطط نفسِه", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const columns = await columnsOf(driver, "supervision_visits")
    expect(columns.includes("unit_path")).toBe(true)
    expect(columns.includes("supervisor_path")).toBe(true)
    // ولا حقلَ «معتمَد» ولا «معتمِد» في المخطط (G22): الحُكمُ منفذٌ يُسأل لا عمودٌ يُخزَّن.
    for (const column of columns) {
      expect(`${column}:${/^(approved|verdict|approver)/.test(column)}`).toBe(`${column}:false`)
    }
    driver.close()
  })
})

describe("هجرةُ الإشراف — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ زيارةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO supervision_visits (tenant_id, unit_path, id, target_id, supervisor_path," +
          " curriculum, day_key, visited_at, attendees, rating_pct, note_ar, details, by_person_id)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, C1_PATH, "vst-1", C1, SQ2_PATH, "tahfeez", "2026-07-20", 1_753_000_000_000,
          12, 80, "حلقةٌ منتظمة", "{}", "u-square",
        ],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const visits = await driver.all({ sql: "SELECT id FROM supervision_visits", params: [] })
    expect(visits).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ الإشراف — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بالهجرات السابقة **دون** الإشراف، ثم يُنقل إليها v1 — وهي حالُ الإنتاج.
    const prior = shippedMigrations().filter((m) => m.name < "0009")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    expect(applied).toEqual(["0009_supervision.sql"])
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والإشرافُ يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0009")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedSupervisionSession(target, MAIN)
    await supervisionSession(target, MAIN, (store) => {
      const done = recordVisit(store, supervisionContext("u-square"), {
        targetId: C1,
        visitedAt: NOW,
        core: CORE,
        details: TAHFEEZ_DETAILS,
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    const visits = await target.all({ sql: "SELECT id, unit_path, supervisor_path FROM supervision_visits", params: [] })
    expect(visits).toHaveLength(1)
    expect(String(visits[0]!["unit_path"])).toBe(C1_PATH)
    expect(String(visits[0]!["supervisor_path"])).toBe(SQ2_PATH)
    target.close()
  })
})
