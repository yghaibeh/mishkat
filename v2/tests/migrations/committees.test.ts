/**
 * G10 — هجرةُ اللجان `0008`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { formCommittee } from "../../src/features/committees/services/committees.js"
import { recordMeeting } from "../../src/features/committees/services/meetings.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { committeeContext, committeeSession, KHALID, KHALID_PATH, seedCommitteeSession } from "../db/_committees.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const COMMITTEE_TABLES = [
  "committee_units",
  "committees",
  "committee_members",
  "committee_activities",
  "committee_meetings",
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

describe("هجرةُ اللجان `0008` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الخمسة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of COMMITTEE_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**ولا عمودَ نصابٍ ولا صوتٍ ولا حضورٍ في المخطط نفسِه** (ب-٢ مدفون — يُقاس لا يُوعَد)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of COMMITTEE_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        expect(`${table}.${column}:${/(quorum|vote|attend|نصاب|صوت|حضور)/.test(column)}`).toBe(`${table}.${column}:false`)
      }
    }
    // ولا عمودَ معرّفِ شخصٍ في جدول الأعضاء (ق-٣١) — الاستحالةُ في القاعدة كما في النوع.
    expect((await columnsOf(driver, "committee_members")).some((c) => /person/.test(c))).toBe(false)
    driver.close()
  })
})

describe("هجرةُ اللجان — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ لجنةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO committees (tenant_id, unit_path, id, mosque_unit_id, mosque_path," +
          " label_ar, head_person_id, head_name_ar, active) VALUES (?,?,?,?,?,?,?,?,?)",
        params: [MAIN, `${KHALID_PATH}cm-relief/`, "cm-relief", KHALID, KHALID_PATH, "لجنة", null, "فلان", 1],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const committees = await driver.all({ sql: "SELECT id FROM committees", params: [] })
    expect(committees).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ اللجان — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بهجرات ما قبل اللجان، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const priors = shippedMigrations().filter((m) => m.name < "0008")
    const target = openSqliteDriver()
    await applyMigrations(target, priors)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **احتواءٌ لا تساوٍ**: قد تسبقني هجراتُ موجةٍ أخرى في القاعدة المدموجة — والمُثبَتُ أن
    // هجرتي **نزلت** على قاعدةٍ منقولةٍ من v1 (نظيرُ ما صار إليه اختبارُ العُهد).
    expect(applied).toContain("0008_committees.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**واللجانُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const priors = shippedMigrations().filter((m) => m.name < "0008")
    const target = openSqliteDriver()
    await applyMigrations(target, priors)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedCommitteeSession(target, MAIN)
    await committeeSession(target, MAIN, (store) => {
      const done = formCommittee(store, committeeContext("u-amir"), {
        id: "cm-relief",
        mosqueUnitId: KHALID,
        labelAr: "لجنةٌ بعد النقل",
        headPersonId: null,
        headNameAr: "فلان",
      })
      if (!done.ok) throw new Error(done.error.code)
      const mtg = recordMeeting(store, committeeContext("u-amir"), {
        mosqueUnitId: KHALID,
        heldAt: new Date("2026-07-19T00:00:00.000Z"),
        minutesAr: "محضرٌ بعد النقل",
        decisionsAr: ["قرار"],
      })
      if (!mtg.ok) throw new Error(mtg.error.code)
    })
    const committees = await target.all({ sql: "SELECT id, unit_path FROM committees", params: [] })
    expect(committees).toHaveLength(1)
    expect(String(committees[0]!["unit_path"])).toBe(`${KHALID_PATH}cm-relief/`)
    const meetings = await target.all({ sql: "SELECT unit_path FROM committee_meetings", params: [] })
    expect(String(meetings[0]!["unit_path"])).toBe(KHALID_PATH)
    target.close()
  })
})
