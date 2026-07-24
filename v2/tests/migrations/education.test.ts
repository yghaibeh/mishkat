/**
 * G10 — هجرةُ المنهاج `0012`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**.
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 *
 * **والوجهُ الخاصُّ بها**: **الغيابُ هو الدليل** — لا جدولَ درسٍ هنا (CR-016)، ولا مفتاحَ
 * تفعيلٍ في صفوف المنهاج (ع-٨)، ولا عمودَ تقدّمٍ مخزَّن (ق-٩٢).
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { markProgress } from "../../src/features/education/services/progress.js"
import { circleDaysFrom } from "../../src/features/education/services/dayLogPort.js"
import { circleModelFrom } from "../../src/features/circleLog/services/circlesPort.js"
import { makeCirclePorts } from "../../src/features/education/services/bindings.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  NOW,
  SESSION_A,
  circlePathOf,
  educationSession,
  seedCircleModel,
  seedCircleWithStudents,
  seedEducationSession,
} from "../db/_education.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

const EDUCATION_TABLES = [
  "education_curricula",
  "education_levels",
  "education_books",
  "education_sessions",
  "education_progress_corrections",
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

describe("هجرةُ المنهاج `0012` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الخمسة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of EDUCATION_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**ولا مفتاحَ تفعيلٍ في صفوف المنهاج** (ع-٨ ميتٌ بالبناء) **ولا عمودَ تقدّمٍ مخزَّن**", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of EDUCATION_TABLES) {
      for (const column of await columnsOf(driver, table)) {
        expect(`${table}.${column}:${/^(active|enabled|is_active)$/.test(column)}`).toBe(
          `${table}.${column}:false`,
        )
        expect(`${table}.${column}:${/(count|_total|_pct|progress)$/.test(column)}`).toBe(
          `${table}.${column}:false`,
        )
      }
    }
    driver.close()
  })

  it("**والغيابُ هو الدليل**: لا جدولَ درسٍ ولا حضورٍ في هذه الوحدة (CR-016)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const tables = await driver.all({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      params: [],
    })
    const mine = tables.map((t) => String(t["name"])).filter((n) => n.startsWith("education_"))
    expect(mine.sort()).toEqual([...EDUCATION_TABLES].sort())
    expect(mine.filter((n) => /(lesson|attendance)/.test(n))).toEqual([])
    driver.close()
  })
})

describe("هجرةُ المنهاج — **مرتين** بلا ازدواجٍ ولا فقد (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو بصمةً مكتوبة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO education_progress_corrections (tenant_id, unit_path, id, circle_id," +
          " enrollment_id, session_id, completed, at, by_person_id, reason_ar)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/homs/sq2/khalid/", "fix-1", "cir-1", "enr-1", "ses-1", 1,
          1_753_000_000_000, "u-amir", "سبب",
        ],
      },
    ])
    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    expect(
      await driver.all({ sql: "SELECT id FROM education_progress_corrections", params: [] }),
    ).toHaveLength(1)
    driver.close()
  })
})

describe("هجرةُ المنهاج — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0012")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (الوصفة §٣-٨) — والثابتُ المقصود `after == before`.
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0012").map((m) => m.name))
    expect(applied).toContain("0012_education.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والمنهاجُ يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0012")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    const circles = seedCircleModel(MAIN)
    const w = seedCircleWithStudents(circles, { unitId: "khalid", typeId: "baseera" })
    const pathOf = circlePathOf(circles)
    await seedEducationSession(target, MAIN, pathOf)
    await educationSession(target, MAIN, pathOf, ({ education, log }) => {
      const settings = createSettingsResolver([])
      const isLessonApproved = (): boolean => false
      const done = markProgress(
        education,
        {
          now: NOW,
          actorPersonId: "u-amir",
          settings,
          ...makeCirclePorts(circles),
          isLessonApproved,
          days: circleDaysFrom({
            logStore: log,
            education,
            circles: circleModelFrom(circles),
            settings,
            isLessonApproved,
          })("u-amir", NOW),
        },
        {
          circleId: w.circleId,
          enrollmentId: w.studentA,
          sessionId: SESSION_A,
          completed: true,
          reasonAr: "حضر مجلساً تعويضياً",
        },
      )
      if (!done.ok) throw new Error(done.error.code)
    })

    const rows = await target.all({
      sql: "SELECT unit_path FROM education_progress_corrections",
      params: [],
    })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    target.close()
  })
})
