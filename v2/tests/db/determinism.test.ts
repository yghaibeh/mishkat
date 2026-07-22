/**
 * الحتميّة تنجو عبور القاعدة (TESTING_POLICY §٥، بند التنفيذ ٤):
 * **معرّفاتٌ متتابعة لا عشوائية، ولا ساعةَ داخل المستودع.**
 *
 * القاعدةُ تكسر هذا بطبعها (عدّادُ الذاكرة يعود صفراً عند كل جلسة) — فالعدّادُ **يُخزَّن
 * ويُستعاد**، ورقمُ السند **بلا فجوة** عبر الجلسات (§٦.٢).
 */

import { describe, expect, it } from "vitest"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
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
      { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(1_000) },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(1_000),
      },
    ],
  }
}

describe("الحتميّة عبر الجلسات", () => {
  it("المعرّفُ متتابعٌ عبر جلستين — العدّادُ يُستعاد ولا يعود صفراً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    const first = await session(driver, MAIN, ({ ledger }) => {
      const r = postJournal(ledger, CTX, donation("d-1"))
      return r.ok ? r.value.id : "لا"
    })
    const second = await session(driver, MAIN, ({ ledger }) => {
      const r = postJournal(ledger, CTX, donation("d-2"))
      return r.ok ? r.value.id : "لا"
    })
    expect(first).toBe("je-1")
    // قيدٌ (١) وسطراه (٢،٣) ⟵ القيدُ التالي (٤): **لا إعادةَ استعمالٍ ولا قفزَ عشوائيّ**.
    expect(second).toBe("je-4")
    driver.close()
  })

  it("المعرّفُ **لا يتكرّر** عبر الجلسات — فلا يُدهس قيدٌ بقيد", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    for (const id of ["d-1", "d-2", "d-3"]) {
      await session(driver, MAIN, ({ ledger }) => {
        expect(postJournal(ledger, CTX, donation(id)).ok).toBe(true)
      })
    }
    const rows = await driver.all({ sql: "SELECT id FROM journal_entries", params: [] })
    expect(new Set(rows.map((r) => String(r["id"]))).size).toBe(3)
    driver.close()
  })

  it("رقمُ السند **بلا فجوة** عبر الجلسات (§٦.٢)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    for (const id of ["d-1", "d-2", "d-3"]) {
      await session(driver, MAIN, ({ ledger }) => {
        expect(postJournal(ledger, CTX, donation(id)).ok).toBe(true)
      })
    }
    const rows = await driver.all({
      sql: "SELECT voucher_seq FROM journal_entries ORDER BY voucher_seq",
      params: [],
    })
    expect(rows.map((r) => Number(r["voucher_seq"]))).toEqual([1, 2, 3])
    driver.close()
  })

  it("قيدٌ فاشلٌ **لا يحرق** رقمَ سندٍ ولا معرّفاً عبر القاعدة", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      const bad = postJournal(ledger, CTX, {
        ...donation("d-مختل"),
        lines: [
          { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(1) },
          {
            accountId: "revenue.donations",
            unitId: "m1",
            currency: "USD",
            side: "credit" as const,
            amount: c(2),
          },
        ],
      })
      expect(bad.ok).toBe(false)
    })
    const after = await session(driver, MAIN, ({ ledger }) => {
      const r = postJournal(ledger, CTX, donation("d-1"))
      return r.ok ? `${r.value.id}|${r.value.voucherSeq}` : "لا"
    })
    expect(after).toBe("je-1|1")
    driver.close()
  })

  it("لا ساعةَ في المستودع: جلستان على قاعدتين مستقلتين تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedSession(driver, MAIN)
      await session(driver, MAIN, ({ ledger }) => {
        expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
      })
      const rows = await driver.all({
        sql: "SELECT tenant_id, unit_path, id, voucher_no, voucher_seq, at, source_type, source_id, posting_key FROM journal_entries ORDER BY id",
        params: [],
      })
      runs.push(JSON.stringify(rows))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })

  it("التاريخُ يعبر القاعدة بلا انحراف — يخرج كما دخل", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })
    await session(driver, MAIN, ({ ledger }) => {
      expect(ledger.entries()[0]!.at.toISOString()).toBe(NOW.toISOString())
    })
    driver.close()
  })
})
