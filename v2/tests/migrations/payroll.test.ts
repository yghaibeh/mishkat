/**
 * G10 — هجرةُ الرواتب `0014`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ حالُ الإنتاج يوم T31: الهجرةُ تنزل على قاعدةٍ **فيها منقولُ v1 وإحدى عشرة
 * وحدةً سبقتها** (منها `box` في هذه السلسلة نفسِها)، لا على قاعدةٍ بكر.
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { grantAdvance } from "../../src/features/payroll/services/advances.js"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  KHALID,
  KHALID_PATH,
  PERIOD,
  payrollContext,
  payrollSession,
  seedPayrollSession,
  seedWorld,
} from "../db/_payroll.js"
import type { Cents } from "../../src/features/ledger/types.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const PAYROLL_TABLES = [
  "payroll_advances",
  "payroll_instalments",
  "payroll_payouts",
  "payroll_payout_persons",
  "payroll_distributions",
  "payroll_incentives",
] as const

/**
 * **ألفاظُ المستحق** — الحارسُ يقيس **غيابَها من المخطط المطبَّق** (§٢-١): المستحقُّ
 * اشتقاقٌ لحظةَ السؤال، والمختومُ في حمولة المحرّك — **لا صفٌّ هنا**.
 */
const ENTITLEMENT_COLUMNS = ["gross_cents", "net_cents", "deduction_cents", "paid", "total_net_cents"]

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ الرواتب `0014` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الستة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of PAYROLL_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.slice(0, 2).join(",")}`).toBe(`${table}:tenant_id,unit_path`)
    }
    driver.close()
  })

  it("**وصفرُ سطرِ مستحقٍّ في الستة** (§٢-١) — الحارسُ على المخطط لا على النيّة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const offenders: string[] = []
    for (const table of PAYROLL_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        if (ENTITLEMENT_COLUMNS.includes(column)) offenders.push(`${table}.${column}`)
      }
    }
    expect(offenders).toEqual([])
    // **والحارسُ يقدر أن يحمرّ**: أعمدةُ المبالغ الملتزَمة موجودةٌ فعلاً — فهو يقرأ حقّاً،
    // والفرقُ بينها وبين المستحقّ هو **بيتُ القصيد**: ملتزَمٌ يُخزَّن، ومشتقٌّ لا يُخزَّن.
    const advance = await columnsOf(driver, "payroll_advances")
    expect(advance).toContain("principal_cents")
    expect(advance).toContain("instalment_cents")
    driver.close()
  })

  it("**والفهرسُ الفريدُ يحرس ق-٦٥ وق-٦٦ في القاعدة** — لا في الذاكرة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const indexes = (await driver.all({
      sql: "PRAGMA index_list(payroll_payout_persons)",
      params: [],
    })) as Record<string, unknown>[]
    expect(indexes.some((i) => String(i["name"]) === "idx_payroll_paid_once" && Number(i["unique"]) === 1)).toBe(true)

    const regionIndexes = (await driver.all({
      sql: "PRAGMA index_list(payroll_distributions)",
      params: [],
    })) as Record<string, unknown>[]
    expect(regionIndexes.some((i) => String(i["name"]) === "idx_payroll_region_once" && Number(i["unique"]) === 1)).toBe(true)

    // **ويرمي فعلاً** — الإعلانُ لا يكفي، والأثرُ يُقاس (قب-٥٢ ١: البنيويُّ يُثبت الإعلان).
    const insert = {
      sql:
        "INSERT INTO payroll_payout_persons (tenant_id, unit_path, payout_id, person_id, period_id)" +
        " VALUES (?,?,?,?,?)",
      params: [MAIN, KHALID_PATH, "pay-1", "u-teacher", PERIOD.id],
    }
    await driver.batch([insert])
    await expect(
      driver.batch([{ ...insert, params: [MAIN, KHALID_PATH, "pay-2", "u-teacher", PERIOD.id] }]),
    ).rejects.toThrow(/UNIQUE|constraint/i)
    driver.close()
  })
})

describe("هجرةُ الرواتب — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ سلفةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO payroll_advances (tenant_id, unit_path, id, person_id, entry_id," +
          " principal_cents, instalment_cents, granted_at, closed_at) VALUES (?,?,?,?,?,?,?,?,?)",
        params: [MAIN, KHALID_PATH, "adv-1", "u-teacher", "je-1", 30_000, 10_000, 1_753_000_000_000, null],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    expect(await driver.all({ sql: "SELECT id FROM payroll_advances", params: [] })).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ الرواتب — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0014")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (وصفة §٣-٨) — والثابتُ المقصود هو السطرُ بعده (اللاإتلاف).
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0014").map((m) => m.name))
    expect(applied).toContain("0014_payroll.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والرواتبُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0014")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedPayrollSession(target, MAIN)
    const id = await payrollSession(target, MAIN, (stores) => {
      const world = seedWorld(MAIN)
      const done = grantAdvance(
        stores,
        payrollContext({ world, actorPersonId: "u-finance", payingUnit: () => KHALID_PATH }),
        {
          personId: "u-teacher",
          unitId: KHALID,
          operationId: "adv-after-transfer",
          principalCents: 30_000 as Cents,
          instalmentCents: 10_000 as Cents,
          memoAr: "سلفةٌ بعد النقل",
        },
      )
      if (!done.ok) throw new Error(done.error.code)
      return done.value.id
    })

    const rows = await target.all({ sql: "SELECT id, unit_path FROM payroll_advances", params: [] })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["id"])).toBe(id)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    target.close()
  })
})
