/**
 * G10 — الهجرةُ **على بيانات v1 منقولة** (المادة ٧/٢، ADR-001 §٧-١).
 *
 * والنقلُ يمرّ **بنفس البوابة التي يمرّ بها الإنتاج**: يُبنى العالمُ في مستودعَي v2 بدوالّهما
 * المعلنة (فتُفرض ثوابتُ الختم والتوازن والتكامل المرجعيّ)، ثم يُقذف بـ`flush` واحدة.
 * فلا مسارَ كتابةٍ ثانٍ يتباعد عن الأول — ولا يعبر إلى v2 ما لا يعبر بوابتَه.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { applyMigrations } from "../../src/db/migrations/runner.js"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { transferV1 } from "../../src/db/transfer/v1.js"
import { balanceProof } from "../../src/features/ledger/services/journal.js"
import { MAIN, freshDb, freshStores, shippedMigrations, unitOfWorkFor } from "../db/_harness.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const V1_SQL = readFileSync(join(HERE, "fixtures/v1-sample.sql"), "utf8")

function openV1(): SqliteDriver {
  const driver = openSqliteDriver()
  driver.execSync(V1_SQL)
  return driver
}

async function transferred(): Promise<{
  target: SqliteDriver
  report: Awaited<ReturnType<typeof transferV1>>
}> {
  const target = await freshDb()
  const v1 = openV1()
  const report = await transferV1(v1, target, MAIN)
  v1.close()
  return { target, report }
}

describe("نقلُ بيانات v1 — ما يعبر وما يُردّ", () => {
  it("الشجرةُ تعبر كاملةً بمساراتها ومعرّفاتها (ت-٢: المقاطعُ معرّفات)", async () => {
    const { target, report } = await transferred()
    expect(report.units).toBe(4)
    const rows = await target.all({
      sql: "SELECT id, unit_path, archived FROM org_units ORDER BY unit_path",
      params: [],
    })
    expect(rows.map((r) => `${String(r["id"])}@${String(r["unit_path"])}`)).toEqual([
      "men@/men/",
      "r1@/men/r1/",
      "m1@/men/r1/m1/",
      "m2@/men/r1/m2/",
    ])
    // `status <> 'active'` في v1 ⟵ **أرشفةٌ منطقية** لا حذف (المادة ٧/٤).
    expect(rows.find((r) => r["id"] === "m2")!["archived"]).toBe(1)
    target.close()
  })

  it("القيدُ السليم يعبر بسطوره وبمفتاح توجيهٍ على كلِّ صفّ", async () => {
    const { target, report } = await transferred()
    expect(report.entries).toBe(5)
    expect(report.lines).toBe(10)
    const lines = await target.all({
      sql: "SELECT unit_path FROM journal_lines ORDER BY id",
      params: [],
    })
    expect(lines).toHaveLength(10)
    for (const line of lines) expect(String(line["unit_path"])).toMatch(/^\/men\//)
    target.close()
  })

  it("سطرٌ بلا وحدةٍ في v1 **يُردّ ويُبلَّغ** — ولا يُوجَّه إلى الجذر صامتاً", async () => {
    const { target, report } = await transferred()
    const rejected = report.rejected.find((r) => r.id === "je_c")!
    expect(rejected.reason).toBe("UNRESOLVED_ROUTING_KEY")
    const rows = await target.all({
      sql: "SELECT id FROM journal_entries WHERE source_id = ?",
      params: ["d-300"],
    })
    expect(rows).toHaveLength(0)
    target.close()
  })

  it("قيدٌ مختلٌّ في v1 **يُردّ ويُبلَّغ** — ولا يعبر فيفسد الدفتر", async () => {
    const { target, report } = await transferred()
    const rejected = report.rejected.find((r) => r.id === "je_d")!
    expect(rejected.reason).toBe("UNBALANCED")
    expect(
      await target.all({ sql: "SELECT id FROM journal_entries WHERE source_id = ?", params: ["d-400"] }),
    ).toHaveLength(0)
    target.close()
  })

  it("المردودُ يُعدّ ولا يُبتلع: التقريرُ يُحصي كلَّ ما لم يعبر", async () => {
    const { target, report } = await transferred()
    expect(report.rejected.map((r) => r.id).sort()).toEqual(["je_c", "je_d", "je_h"])
    // وكلُّ مردودٍ يحمل **سببَه** لا مجرّدَ عدّاد.
    expect(report.rejected.find((r) => r.id === "je_h")!.reason).toBe("REJECTED_BY_LEDGER")
    target.close()
  })
})

describe("الثوابتُ تصمد بعد النقل", () => {
  it("نزاهةُ الدفتر: Σمدين = Σدائن لكل عملةٍ على البيانات المنقولة", async () => {
    const { target } = await transferred()
    const { org, ledger, audit } = freshStores(MAIN)
    const uow = unitOfWorkFor(target, { org, ledger, audit }, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()
    const proof = balanceProof(ledger)
    expect(proof.balanced).toBe(true)
    expect([...proof.byCurrency.keys()].sort()).toEqual(["SYP", "USD"])
    target.close()
  })

  it("مفتاحُ التوجيه: لا صفَّ بيانات شبكةٍ بلا مسارٍ بعد النقل", async () => {
    const { target } = await transferred()
    const tables = await target.all({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations'",
      params: [],
    })
    for (const table of tables) {
      const bad = await target.all({
        sql: `SELECT COUNT(*) AS n FROM ${String(table["name"])} WHERE unit_path IS NULL OR unit_path = ''`,
        params: [],
      })
      expect(`${String(table["name"])}:${Number(bad[0]!["n"])}`).toBe(`${String(table["name"])}:0`)
    }
    target.close()
  })

  it("عملةُ v1 الفارغة (`NULL` = الأساس) تُترجم صراحةً ولا تعبر فارغة", async () => {
    const { target } = await transferred()
    const rows = await target.all({
      sql: "SELECT DISTINCT currency FROM journal_lines ORDER BY currency",
      params: [],
    })
    expect(rows.map((r) => String(r["currency"]))).toEqual(["SYP", "USD"])
    target.close()
  })

  it("العدّادُ يُستأنف من حيث انتهى النقل — فالقيدُ التالي لا يدهس منقولاً", async () => {
    const { target } = await transferred()
    const sequences = await target.all({ sql: "SELECT name, value FROM sequences", params: [] })
    const seq = sequences.find((r) => String(r["name"]) === "ledger.seq")!
    const ids = await target.all({ sql: "SELECT id FROM journal_lines", params: [] })
    const maxSuffix = Math.max(...ids.map((r) => Number(String(r["id"]).split("-")[1])))
    expect(Number(seq["value"])).toBeGreaterThanOrEqual(maxSuffix)
    target.close()
  })
})

describe("الهجرةُ على قاعدةٍ فيها بيانات v1 (المادة ٧/٢)", () => {
  it("إعادةُ تشغيل الهجرات فوق البيانات المنقولة لا ترمي ولا تُتلف صفّاً", async () => {
    const { target } = await transferred()
    const before = await target.all({ sql: "SELECT * FROM journal_lines ORDER BY id", params: [] })
    const applied = await applyMigrations(target, shippedMigrations())
    expect(applied).toEqual([])
    const after = await target.all({ sql: "SELECT * FROM journal_lines ORDER BY id", params: [] })
    expect(after).toEqual(before)
    target.close()
  })

  it("إعادةُ النقل نفسِه **لا تُزدوج** — النقلُ idempotent بالمفتاح الطبيعيّ", async () => {
    const target = await freshDb()
    const first = openV1()
    await transferV1(first, target, MAIN)
    first.close()
    const second = openV1()
    await transferV1(second, target, MAIN)
    second.close()
    const entries = await target.all({ sql: "SELECT id FROM journal_entries", params: [] })
    expect(entries).toHaveLength(5)
    const units = await target.all({ sql: "SELECT id FROM org_units", params: [] })
    expect(units).toHaveLength(4)
    target.close()
  })
})

describe("كتالوجُ المصادر — المفتوحُ في v1 ⟵ المغلقُ في v2 (§٣.٢)", () => {
  it("مصدرُ v1 يُترجم إلى نوعٍ **داخل الكتالوج** ولا يعبر نوعٌ خارجه", async () => {
    const { target } = await transferred()
    const rows = await target.all({
      sql: "SELECT source_id, source_type FROM journal_entries ORDER BY source_id",
      params: [],
    })
    const byId = new Map(rows.map((r) => [String(r["source_id"]), String(r["source_type"])]))
    // `fuel` ليس نوعاً في v2 ⟵ مصروف؛ وبلا مصدرٍ ⟵ قيدٌ يدويّ.
    expect(byId.get("f-500")).toBe("expense")
    expect(byId.get("je_f")).toBe("manualJournal")
    expect(byId.get("d-100")).toBe("donation")
    expect(byId.get("p-600")).toBe("payroll")
    const closed = new Set(["donation", "expense", "payroll", "manualJournal"])
    for (const type of byId.values()) expect(closed.has(type)).toBe(true)
    target.close()
  })
})
