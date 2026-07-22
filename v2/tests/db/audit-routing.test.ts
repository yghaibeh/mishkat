/**
 * موضعُ سجلّ التدقيق ومفتاحُ توجيهه — `db/README.md` الحسم ٣ (نقطةُ اللاعودة الثانية).
 *
 * السجلُّ **واحدٌ مركزيّ**، ويحمل مفتاحَ التوجيه كسائر الجداول. وما لا يُشتقّ نطاقُه
 * **مُعلنٌ ومحروسٌ بـ`toEqual`** — فلا ينمو صامتاً ولا ينكمش صامتاً (قب-٤٦ §٢ روحاً).
 */

import { describe, expect, it } from "vitest"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { postEventSafely } from "../../src/features/ledger/services/posting.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { AUDIT_ACTIONS_WITHOUT_SCOPE } from "../../src/db/repositories/ledgerRepository.js"
import { MAIN, NOW, freshDb, seedSession, session } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function donation(sourceId: string): Parameters<typeof postJournal>[2] {
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(500) },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(500),
      },
    ],
  }
}

type AuditRow = { source: string; action: string; unit_path: string; scope_exact: number; seq: number }

async function auditRows(driver: Awaited<ReturnType<typeof freshDb>>): Promise<readonly AuditRow[]> {
  return (await driver.all({
    sql: "SELECT source, action, unit_path, scope_exact, seq FROM audit_log ORDER BY source, seq",
    params: [],
  })) as unknown as readonly AuditRow[]
}

describe("سجلُّ التدقيق — جدولٌ واحدٌ مركزيّ", () => {
  it("سجلُّ الشجرة وسجلُّ الدفتر يسكنان **جدولاً واحداً** يُميَّزان بمصدرهما", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org, ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
      org.appendAudit({
        at: NOW,
        actorPersonId: "u-admin",
        action: "users.provision",
        capability: "user.manage",
        scopePath: "/men/r1/m1/",
        targetType: "account",
        targetId: "p-1",
        reason: null,
      })
    })
    const rows = await auditRows(driver)
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["org", "ledger"]))
    driver.close()
  })

  it("مفتاحُ التوجيه: قيدُ تدقيقِ الدفتر يُشتقّ نطاقُه من **الكيان المُدقَّق** لا من فراغ", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })
    const posted = (await auditRows(driver)).find((r) => r.action === "ledger.post")!
    expect(posted.unit_path).toBe("/men/r1/m1/")
    expect(posted.scope_exact).toBe(1)
    driver.close()
  })

  it("مفتاحُ التوجيه: قيدُ تدقيقِ الشجرة ينسخ نطاقَه المعلن ولا يخترعه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      org.appendAudit({
        at: NOW,
        actorPersonId: "u-admin",
        action: "registration.approve",
        capability: "user.manage",
        scopePath: "/men/r1/m2/",
        targetType: "account",
        targetId: "p-9",
        reason: null,
      })
    })
    const rows = await auditRows(driver)
    expect(rows.map((r) => `${r.unit_path}|${r.scope_exact}`)).toEqual(["/men/r1/m2/|1"])
    driver.close()
  })

  it("ما لا يُشتقّ نطاقُه يُوجَّه إلى جذر الشبكة **موسوماً** لا مُموَّهاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      const failed = postEventSafely(ledger, CTX, {
        sourceType: "donation",
        sourceId: "d-معطوب",
        at: NOW,
        unitId: "لا-وجود-لها",
        memoAr: "وحدةٌ مجهولة",
        lines: donation("d-معطوب").lines,
      })
      expect(failed.posted).toBe(false)
    })
    const rows = await auditRows(driver)
    expect(rows.map((r) => `${r.action}|${r.unit_path}|${r.scope_exact}`)).toEqual([
      "ledger.post.failed|/|0",
    ])
    driver.close()
  })
})

describe("حَجْرُ الأفعال التي لا يُشتقّ نطاقُها — لا ينمو ولا ينكمش صامتاً", () => {
  it("القائمةُ المعلنة تطابق ما يقع فعلاً — `toEqual` لا `toContain`", () => {
    expect([...AUDIT_ACTIONS_WITHOUT_SCOPE]).toEqual(["ledger.post.failed"])
  })

  it("كلُّ فعلٍ في القائمة **يعجز فعلاً** عن الاشتقاق — فلا يبقى فيها ميت", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(
        postEventSafely(ledger, CTX, {
          sourceType: "donation",
          sourceId: "d-معطوب",
          at: NOW,
          unitId: "لا-وجود-لها",
          memoAr: "وحدةٌ مجهولة",
          lines: donation("d-معطوب").lines,
        }).posted,
      ).toBe(false)
    })
    const inexact = (await auditRows(driver)).filter((r) => r.scope_exact === 0)
    expect(inexact.map((r) => r.action)).toEqual([...AUDIT_ACTIONS_WITHOUT_SCOPE])
    driver.close()
  })

  it("فعلُ تدقيقٍ خارج القائمة لا يُشتقّ نطاقُه ⟵ **يُرمى** ولا يُوجَّه إلى الجذر صامتاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await expect(
      session(driver, MAIN, ({ ledger }) => {
        ledger.appendAudit({
          at: NOW,
          actorPersonId: "u-finance",
          action: "ledger.فعلٌ-مستحدث",
          targetId: "هدفٌ-لا-يُعرف",
          reason: null,
        })
      }),
    ).rejects.toThrow(/ledger\.فعلٌ-مستحدث/)
    driver.close()
  })
})

describe("التدرّجُ بالعمر — مصمَّمٌ اليوم وغيرُ مبنيٍّ اليوم", () => {
  it("سجلُّ التدقيق مفهرسٌ على (شبكة، وقت) — فترحيلُ القديم مسحُ مدىً لا مسحٌ كامل", async () => {
    const driver = await freshDb()
    const indexes = await driver.all({ sql: "PRAGMA index_list(audit_log)", params: [] })
    const sets: string[] = []
    for (const index of indexes) {
      const info = await driver.all({
        sql: `PRAGMA index_info(${String(index["name"])})`,
        params: [],
      })
      sets.push(info.map((c2) => String(c2["name"])).join(","))
    }
    expect(sets).toContain("tenant_id,at")
    driver.close()
  })

  it("لا مفتاحَ أجنبيّاً يشير إلى سجلّ التدقيق — فحذفُ المؤرشَف لا يكسر شيئاً", async () => {
    const driver = await freshDb()
    const tables = await driver.all({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      params: [],
    })
    for (const table of tables) {
      const keys = await driver.all({
        sql: `PRAGMA foreign_key_list(${String(table["name"])})`,
        params: [],
      })
      expect(keys.map((k) => String(k["table"]))).not.toContain("audit_log")
    }
    driver.close()
  })

  it("حمولةُ `before/after` نصٌّ لا مزيةُ محرّك (ع-٣)", async () => {
    const driver = await freshDb()
    const columns = await driver.all({ sql: "PRAGMA table_info(audit_log)", params: [] })
    for (const name of ["before", "after"]) {
      const column = columns.find((c2) => String(c2["name"]) === name)!
      expect(`${name}:${String(column["type"])}`).toBe(`${name}:TEXT`)
    }
    driver.close()
  })
})
