/**
 * G10 — هجرةُ الإشعارات `0005`: على قاعدةٍ نظيفة، **ومرتين**، **وعلى بيانات v1 منقولة**
 * (المادة ٧/١-٢، ADR-001 ع-٥).
 *
 * والوجهُ الثالثُ هو حالُ الإنتاج يوم T26-ب: الهجرةُ تنزل على قاعدةٍ **فيها منقولُ v1 وهجراتُ
 * الوحدات السابقة** — فإن لم يُقس ذلك صار «تنجح على النظيف» ادّعاءً عن حالةٍ لا تقع.
 *
 * القياسُ على **المخطط المطبَّق** (`PRAGMA`) لا على نصّ الملف.
 */

import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAIN, shippedMigrations } from "../db/_harness.js"
import {
  intake,
  notifyCtx,
  notificationsSession,
  personEvent,
  seedNotificationsSession,
} from "../db/_notifications.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

/** جداولُ هذه الهجرة — **مذكورةٌ هنا لأنها موضوعُ الاختبار**، لا قائمةَ حراسةٍ تتخلّف. */
const NOTIFICATION_TABLES = [
  "notification_units",
  "notification_kinds",
  "notification_queue",
  "notification_deliveries",
  "notification_link_tokens",
  "notification_channels",
  "notification_announcements",
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

async function uniqueIndexColumns(driver: SqliteDriver, table: string): Promise<readonly string[]> {
  const indexes = await driver.all({ sql: `PRAGMA index_list(${table})`, params: [] })
  const out: string[] = []
  for (const index of indexes.filter((i) => Number(i["unique"]) === 1)) {
    const info = await driver.all({ sql: `PRAGMA index_info(${String(index["name"])})`, params: [] })
    out.push(info.map((c) => String(c["name"])).join(","))
  }
  return out
}

describe("هجرةُ الإشعارات `0005` — على قاعدةٍ نظيفة", () => {
  it("تُنشئ جداولَ الوحدة السبعة بمفتاح التوجيه على كلٍّ منها (ع-٥)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    for (const table of NOTIFICATION_TABLES) {
      const columns = await columnsOf(driver, table)
      expect(`${table}:${columns.includes("tenant_id")}`).toBe(`${table}:true`)
      expect(`${table}:${columns.includes("unit_path")}`).toBe(`${table}:true`)
    }
    driver.close()
  })

  it("**وقيدا التفرّد البنيويّان** يعبران إلى القاعدة: المفتاحُ الطبيعيّ (ت-٨) والملكيةُ (خ-٣)", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    // ترجمةُ خرائط الذاكرة إلى قيود تفرّدٍ — فلا يُنشأ إشعارٌ ثانٍ لحدثٍ ولا تُزدوَج ملكيةُ قناة.
    expect(await uniqueIndexColumns(driver, "notification_queue")).toContain("tenant_id,natural_key")
    expect(await uniqueIndexColumns(driver, "notification_channels")).toContain(
      "tenant_id,channel,external_id",
    )
    driver.close()
  })
})

describe("هجرةُ الإشعارات — **مرتين** بلا ازدواجٍ ولا فقدٍ (المادة ٧/١)", () => {
  it("إعادةُ التشغيل لا تُطبّق شيئاً ولا تمحو صفَّ إشعارٍ مكتوباً", async () => {
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations())
    await driver.batch([
      {
        sql:
          "INSERT INTO notification_queue (tenant_id, unit_path, id, person_id, kind_id, ref_id," +
          " window_key, natural_key, summary_ar, amount_minor, amount_currency, outcome_ar," +
          " reason_ar, status, queued_at, read_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [MAIN, "/", "ntf-1", "u-square", "action.outcome", "act-1", "w29",
          "u-square|action.outcome|act-1|w29", "خلاصة", null, null, null, null, "queued", 1_753_000_000_000, null],
      },
    ])

    const second = await applyMigrations(driver, shippedMigrations())
    expect(second).toEqual([])
    expect(await driver.all({ sql: "SELECT id FROM notification_queue", params: [] })).toHaveLength(1)
    driver.close()
  })
})

describe("هجرةُ الإشعارات — **على بيانات v1 منقولة** (المادة ٧/٢)", () => {
  it("تنزل على قاعدةٍ فيها منقولُ v1 فتنجح ولا تمسّ صفّاً منه", async () => {
    // قاعدةٌ بالهجرات قبل `0005` **وحدها**، ثم يُنقل إليها v1 — وهي حالُ الإنتاج يوم T26-ب.
    const pilot = shippedMigrations().filter((m) => m.name < "0005")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    const report = await transferV1(v1, target, MAIN)
    v1.close()
    expect(report.entries).toBeGreaterThan(0)

    const before = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    expect(applied).toEqual(["0005_notifications.sql"])
    const after = await target.all({ sql: "SELECT id FROM journal_entries ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("**والإشعاراتُ تعمل على تلك القاعدة نفسِها** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const pilot = shippedMigrations().filter((m) => m.name < "0005")
    const target = openSqliteDriver()
    await applyMigrations(target, pilot)
    const v1 = openV1()
    await transferV1(v1, target, MAIN)
    v1.close()
    await applyMigrations(target, shippedMigrations())

    await seedNotificationsSession(target, MAIN)
    const notificationId = await notificationsSession(target, MAIN, (store) => {
      const done = intake(store, notifyCtx("u-amir"), personEvent("u-square"))
      if (!done.ok) throw new Error(done.error.code)
      return done.value.notificationIds[0]!
    })
    const rows = await target.all({
      sql: "SELECT id, unit_path FROM notification_queue",
      params: [],
    })
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["id"])).toBe(notificationId)
    // صندوقُ الشخص شبكيٌّ ⟵ مساره جذرُ الشبكة (README الحسم ٢).
    expect(String(rows[0]!["unit_path"])).toBe("/")
    target.close()
  })
})
