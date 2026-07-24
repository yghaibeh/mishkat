/**
 * G10 — هجرةُ الصندوق `0013`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ حالُ الإنتاج يوم T31: الهجرةُ تنزل على قاعدةٍ **فيها منقولُ v1 وعشرُ وحداتٍ
 * سبقتها**، لا على قاعدةٍ بكر. فإن لم يُقس ذلك صار «تنجح على النظيف» ادّعاءً عن حالةٍ لا تقع.
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
import { handoverDown } from "../../src/features/box/services/handover.js"
import { receiveIntoBox } from "../../src/features/box/services/operations.js"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { KHALID_PATH, SQ2, SQ2_PATH, boxContext, boxSession, c, seedBoxSession } from "../db/_box.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const BOX_TABLES = ["box_categories", "box_handovers"] as const

/**
 * **ألفاظُ المال** — الحارسُ يقيس **غيابَها من المخطط المطبَّق** (ق-٦٠): لا مبلغَ ولا عملةَ
 * ولا رصيدَ في كياناتِ هذه الوحدة، فالمالُ حقيقةٌ واحدةٌ في الدفتر لا نسخةٌ هنا.
 */
const MONEY_COLUMNS = ["amount", "amount_cents", "cents", "currency", "balance", "net", "total"]

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function columnsOf(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const rows = await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })
  return rows.map((r) => String(r["name"]))
}

describe("هجرةُ الصندوق `0013` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جدولَي الوحدة بمفتاح التوجيه على كلٍّ منهما (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of BOX_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
      // والعمودان **أوّلان** بالترتيب — المفتاحُ يُقرأ أوّلاً (وصفة §٣-٢).
      expect(`${table}:${columns.slice(0, 2).join(",")}`).toBe(`${table}:tenant_id,unit_path`)
    }
    driver.close()
  })

  it("**وصفرُ عمودِ مالٍ في الجدولين** (ق-٦٠) — الحارسُ على المخطط لا على النيّة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const offenders: string[] = []
    for (const table of BOX_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        if (MONEY_COLUMNS.includes(column)) offenders.push(`${table}.${column}`)
      }
    }
    expect(offenders).toEqual([])
    // **والحارسُ يقدر أن يحمرّ**: ألفاظُ المال موجودةٌ فعلاً في مخطط الدفتر — فهو يقرأ حقّاً.
    const ledgerLines = await columnsOf(driver, "journal_lines")
    expect(ledgerLines.filter((column) => MONEY_COLUMNS.includes(column)).length).toBeGreaterThan(0)
    driver.close()
  })

  it("**والتسليمُ يحمل بصمتَي الإقرار قابلتَين للفراغ** — الانتظارُ حالٌ لا نقصُ بيانات", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const rows = await driver.all({ sql: "PRAGMA table_info(box_handovers)", params: [] })
    const nullable = new Map(rows.map((r) => [String(r["name"]), Number(r["notnull"]) === 0]))
    expect(`ack_by=${nullable.get("acknowledged_by")}`).toBe("ack_by=true")
    expect(`ack_at=${nullable.get("acknowledged_at")}`).toBe("ack_at=true")
    // ومَن سلّم **إلزاميّ**: لا تسليمَ بلا بصمةِ مسلِّمه (ق-٦١).
    expect(`by=${nullable.get("handed_over_by")}`).toBe("by=false")
    driver.close()
  })
})

describe("هجرةُ الصندوق — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ تسليمٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO box_handovers (tenant_id, unit_path, id, entry_id, from_unit_path," +
          " to_custodian_person_id, handed_over_by, at, acknowledged_by, acknowledged_at)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?)",
        params: [MAIN, KHALID_PATH, "hnd-1", "je-1", SQ2_PATH, "u-amir", "u-square", 1_753_000_000_000, null, null],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const handovers = await driver.all({ sql: "SELECT id FROM box_handovers", params: [] })
    expect(handovers).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ الصندوق — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0013")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (وصفة §٣-٨): سردُ «0013 وحدها» يفترض أنها **الأخيرة**، فتُحمّرها
    // هجرةُ الرواتب `0014` التي تليها في سلسلتي نفسِها. **والثابتُ المقصود هو السطرُ التالي**
    // (`after == before`: اللاإتلاف) لا عددُ الهجرات.
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0013").map((m) => m.name))
    expect(applied).toContain("0013_box.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والصندوقُ يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0013")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedBoxSession(target, MAIN)
    const id = await boxSession(target, MAIN, (stores) => {
      const received = receiveIntoBox(stores, boxContext("u-square"), {
        unitId: SQ2,
        operationId: "rcv-after-transfer",
        memoAr: "قبضٌ بعد النقل",
        lines: [{ currency: "USD", amount: c(30_000) }],
      })
      if (!received.ok) throw new Error(received.error.code)
      const done = handoverDown(stores, boxContext("u-square"), {
        fromUnitId: SQ2,
        toUnitId: "khalid",
        toCustodianPersonId: "u-amir",
        operationId: "hnd-after-transfer",
        memoAr: "تسليمٌ بعد النقل",
        currency: "USD",
        amount: c(10_000),
      })
      if (!done.ok) throw new Error(done.error.code)
      return done.value.handover.id
    })

    const rows = await target.all({ sql: "SELECT id, unit_path FROM box_handovers", params: [] })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["id"])).toBe(id)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    target.close()
  })
})
