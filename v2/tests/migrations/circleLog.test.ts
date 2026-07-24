/**
 * G10 — هجرةُ السجلّ اليوميّ `0011`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥). القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 *
 * **والوجهُ الخاصُّ بهذه الهجرة**: **المفتاحُ الطبيعيُّ يتجمّد هنا**. فيُقاس على المخطط نفسِه
 * أنّ مفتاحَ الجلسة **(شبكة × حلقة × يوم × فترة)** — وهو ما أوجب تنفيذَ CR-020 **قبلها**؛
 * ويُقاس أنّ **الجلسةَ كيانٌ واحدٌ** (`shape_kind` عمودٌ لا جدولان)، و**لا حقلَ يحفظ عدداً**.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { recordSession } from "../../src/features/circleLog/services/sessions.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  NOW,
  circleLogSession,
  logContext,
  seedCircleLogSession,
  seedCircleModel,
  seedCircleWithStudents,
} from "../db/_circleLog.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const CIRCLE_LOG_TABLES = [
  "circlelog_surahs",
  "circlelog_mushafs",
  "circlelog_periods",
  "circlelog_sessions",
  "circlelog_session_rows",
  "circlelog_session_photos",
  "circlelog_notes",
  "circlelog_links",
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

describe("هجرةُ السجلّ اليوميّ `0011` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة الثمانية بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of CIRCLE_LOG_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**ومفتاحُ الجلسة (شبكة × حلقة × يوم × فترة)** — CR-020 مُجمَّدٌ في المخطط", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    const info = await driver.all({ sql: "PRAGMA table_info(circlelog_sessions)", params: [] })
    const pk = info
      .filter((c) => Number(c["pk"]) > 0)
      .sort((a, b) => Number(a["pk"]) - Number(b["pk"]))
      .map((c) => String(c["name"]))
    expect(pk).toEqual(["tenant_id", "circle_id", "day_key", "period_id"])
    driver.close()
  })

  it("**والجلسةُ كيانٌ واحدٌ ومميِّزُه عمود** — لا جدولَ لجلسة تحفيظٍ وآخرُ لجلسة منهاج", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    expect(await columnsOf(driver, "circlelog_sessions")).toContain("shape_kind")
    const tables = await driver.all({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      params: [],
    })
    const names = tables.map((t) => String(t["name"]))
    expect(names.filter((n) => n.startsWith("circlelog_"))).toHaveLength(CIRCLE_LOG_TABLES.length)
    driver.close()
  })

  it("**ولا حقلَ يحفظ عدداً أو نسبةً في جداول العمل** — الحضورُ استعلامٌ (ق-٩١/٩٢)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    // **والقياسُ على جداول العمل لا على الكتالوج** — وهذا تمييزٌ بالمعنى لا استثناءٌ بالاسم:
    // `ayah_count`/`page_count` **حدودُ مرجعٍ ثابتة** يُتحقَّق بها النطاقُ (ق-٨٩)، لا عدّاداتُ
    // تقدّمٍ تتغيّر فتتباعد (نظيرُ استثنائهما في حارس المكتبة). والعدّادُ المحظورُ إنما يُخشى
    // في **ما ينمو بالأحداث** — وهو ما تقيسه هذه الحلقةُ حصراً.
    const operational = CIRCLE_LOG_TABLES.filter((t) => !/_(surahs|mushafs|periods)$/.test(t))
    for (const table of operational) {
      for (const column of await columnsOf(driver, table)) {
        expect(
          `${table}.${column}:${/(count|_total|_num|tally|_pct|average)$/.test(column)}`,
        ).toBe(`${table}.${column}:false`)
      }
    }
    driver.close()
  })
})

describe("هجرةُ السجلّ اليوميّ — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو جلسةً مكتوبة", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO circlelog_sessions (tenant_id, unit_path, circle_id, day_key, period_id," +
          " id, shape_kind, curriculum_session_id, duration_minutes, venue_ar, held_at," +
          " recorded_by_person_id, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/homs/sq2/khalid/", "cir-1", "2026-07-22", "day", "session-1", "recitation",
          null, null, null, 1_753_000_000_000, "u-amir", 1_753_000_000_000,
        ],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    expect(await driver.all({ sql: "SELECT id FROM circlelog_sessions", params: [] })).toHaveLength(1)
    const ledger = await driver.all({ sql: "SELECT name FROM _migrations", params: [] })
    expect(new Set(ledger.map((r) => String(r["name"]))).size).toBe(ledger.length)
    driver.close()
  })
})

describe("هجرةُ السجلّ اليوميّ — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0011")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    // **مشتقٌّ لا مسرود** (الوصفة §٣-٨ · قب-٥١ · فخّ ٢) — والثابتُ المقصود `after == before`.
    expect(applied).toEqual(shippedMigrations().filter((m) => m.name >= "0011").map((m) => m.name))
    expect(applied).toContain("0011_circleLog.sql")
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والسجلُّ يعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const prior = shippedMigrations().filter((m) => m.name < "0011")
    const target = openSqliteDriver()
    await applyMigrations(target, prior)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    const circles = seedCircleModel(MAIN)
    const w = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    await seedCircleLogSession(target, MAIN, circles)
    await circleLogSession(target, MAIN, circles, (store) => {
      const done = recordSession(
        store,
        logContext(
          { circles, log: null as never, circleId: w.circleId, otherCircleId: "", studentA: w.studentA, studentB: w.studentB },
          "u-amir",
        ),
        {
          circleId: w.circleId,
          at: NOW,
          rows: [{ enrollmentId: w.studentA, attendance: "present" }],
        },
      )
      if (!done.ok) throw new Error(done.error.code)
    })

    const rows = await target.all({
      sql: "SELECT unit_path, period_id FROM circlelog_sessions",
      params: [],
    })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe("/men/homs/sq2/khalid/")
    // **التركيبُ الأدنى يعبر القاعدة**: شبكةٌ لم تُعلن فتراتٍ ⇒ «اليومُ كلُّه» (CR-020).
    expect(String(rows[0]!["period_id"])).toBe("day")
    target.close()
  })
})
