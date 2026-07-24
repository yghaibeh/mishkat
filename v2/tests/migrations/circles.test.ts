/**
 * G10 — هجرةُ نموذج الحلقات `0010`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥). القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 *
 * **والوجهُ الخاصُّ بهذه الوحدة**: مرضُ v1 كان **جدولاً لكل نوع** (`tahfeez_circles`/`halaqat`)
 * وسجلَّي طلابٍ يخيطهما جسر (ق-٨٨). فيُقاس هنا **على المخطط نفسِه** أن الجدولَ واحدٌ والنوعُ
 * عمودٌ عليه، وأن كتالوجَ الأنواع **بلا عمود تفعيل** (ع-٨ ميتٌ بالبناء) — من زاد أياً منهما
 * يُحمّره هذا الاختبار.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { createCircle } from "../../src/features/circles/services/circles.js"
import { enroll } from "../../src/features/circles/services/enrollment.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import { circlesContext, circlesSession, seedCirclesSession } from "../db/_circles.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const CIRCLES_TABLES = [
  "circles_units",
  "circles_types",
  "circles_circles",
  "circles_enrollments",
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

describe("هجرةُ الحلقات `0010` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الأربعة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of CIRCLES_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**والنوعُ عمودٌ على جدولِ حلقةٍ واحد** — لا جدولَ لكل نوع (ب-٢٨ في القاعدة)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    expect(await columnsOf(driver, "circles_circles")).toContain("type_id")
    // **الغيابُ هو الدليل**: لا جدولَ ثانٍ للحلقة مهما اختلف النوع.
    const tables = await driver.all({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      params: [],
    })
    const names = tables.map((t) => String(t["name"]))
    expect(names.filter((n) => /(tahfeez|halaq|baseera)/i.test(n))).toEqual([])
    expect(names.filter((n) => n.startsWith("circles_"))).toHaveLength(CIRCLES_TABLES.length)
    driver.close()
  })

  it("**وكتالوجُ الأنواع بلا عمود تفعيل** — بابُ المنع الثاني (ع-٨) غيرُ موجودٍ ليُنسى", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    expect(await columnsOf(driver, "circles_types")).toEqual(["tenant_id", "unit_path", "id", "ar"])
    driver.close()
  })

  it("**ولا حقلَ يحفظ عدداً في المخطط نفسِه** — العددُ استعلامٌ لا رقمٌ مخزَّن (ع-١٩/ع-٢٩)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of CIRCLES_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        expect(`${table}.${column}:${/(count|_total|_num|tally)$/.test(column)}`).toBe(
          `${table}.${column}:false`,
        )
      }
    }
    driver.close()
  })
})

describe("هجرةُ الحلقات — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ حلقةٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO circles_circles (tenant_id, unit_path, id, type_id, name_ar, capacity," +
          " teacher_person_id, archived_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/homs/sq2/khalid/", "cir-1", "tahfeez", "حلقةُ الفجر", 20, null, null,
          1_753_000_000_000,
        ],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    const circles = await driver.all({ sql: "SELECT id FROM circles_circles", params: [] })
    expect(circles).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ الحلقات — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بالهجرات السابقة **وحدها**، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T31.
    const prior = shippedMigrations().filter((m) => m.name < "0010")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (الوصفة §٣-٨ · قب-٥١ · فخّ ٢): كلُّ الهجرات من `0010` فصاعداً تنزل
    // هنا — والحلقاتُ **إحداها** لا آخرُها. **والثابتُ المقصود هو التالي: `after == before`**.
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0010").map((m) => m.name))
    expect(applied).toContain("0010_circles.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والحلقاتُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0010")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedCirclesSession(target, MAIN)
    const circleId = await circlesSession(target, MAIN, (store) => {
      const made = createCircle(store, circlesContext("u-amir"), {
        unitId: "khalid",
        typeId: "tahfeez",
        nameAr: "حلقةُ الفجر",
        capacity: 20,
      })
      if (!made.ok) throw new Error(made.error.code)
      const done = enroll(store, circlesContext("u-amir"), { circleId: made.value.id, nameAr: "عبد الله" })
      if (!done.ok) throw new Error(done.error.code)
      return made.value.id
    })

    const enrollments = await target.all({
      sql: "SELECT circle_id, unit_path FROM circles_enrollments",
      params: [],
    })
    expect(enrollments).toHaveLength(1)
    expect(String(enrollments[0]!["circle_id"])).toBe(circleId)
    expect(String(enrollments[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    target.close()
  })
})
