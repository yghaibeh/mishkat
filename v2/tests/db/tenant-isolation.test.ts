/**
 * عزلُ الشبكة على **المستودع الحقيقيّ** — قب-١٨/CR-006 (الاختبار الإلزاميّ ٥).
 *
 * الشبكتان تحملان **نفسَ المسارات النسبيّة عمداً**: فلو كان العزلُ بالمسار وحده لتسرّبتا.
 * والقياسُ على القاعدة نفسِها: لا يُقرأ صفُّ شبكةٍ أخرى، ولا يُكتب عليه.
 */

import { describe, expect, it } from "vitest"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { MAIN, NOW, OTHER, freshDb, seedSession, session } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function donation(sourceId: string, amount = 10_000): Parameters<typeof postJournal>[2] {
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(amount) },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(amount),
      },
    ],
  }
}

describe("عزلُ الشبكة — على المستودع الحقيقيّ", () => {
  it("عزلُ الشبكة: صفٌّ من شبكةٍ أخرى **لا يُقرأ** ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)
    await session(driver, OTHER, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-حلب")).ok).toBe(true)
    })

    await session(driver, MAIN, ({ ledger }) => {
      expect(ledger.entries()).toHaveLength(0)
      expect(ledger.lines()).toHaveLength(0)
      expect(ledger.activePostingEntryId("donation:d-حلب")).toBeNull()
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)
    await session(driver, OTHER, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", 700)).ok).toBe(true)
    })
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", 900)).ok).toBe(true)
    })

    const rows = await driver.all({
      sql: "SELECT tenant_id, id FROM journal_entries ORDER BY tenant_id",
      params: [],
    })
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}`)).toEqual([
      `${OTHER}|je-1`,
      `${MAIN}|je-1`,
    ])
    await session(driver, OTHER, ({ ledger }) => {
      expect(ledger.entries()).toHaveLength(1)
      expect(ledger.fundBalance("general", "USD")).toBe(0)
    })
    driver.close()
  })

  it("عزلُ الشبكة: رصيدُ الشبكة يُحسب من أسطرها وحدها", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)
    for (const tenant of [MAIN, OTHER]) {
      await session(driver, tenant, ({ ledger }) => {
        const posted = postJournal(ledger, CTX, {
          ...donation(`d-${tenant}`, tenant === MAIN ? 500 : 900),
          lines: donation(`d-${tenant}`, tenant === MAIN ? 500 : 900).lines.map((l) =>
            l.side === "debit" ? { ...l, fundId: "general" } : l,
          ),
        })
        expect(posted.ok).toBe(true)
      })
    }
    await session(driver, MAIN, ({ ledger }) => {
      expect(ledger.fundBalance("general", "USD")).toBe(500)
    })
    await session(driver, OTHER, ({ ledger }) => {
      expect(ledger.fundBalance("general", "USD")).toBe(900)
    })
    driver.close()
  })

  it("عزلُ الشبكة: شجرةُ شبكةٍ لا تُرى من الأخرى ولو تطابقت المعرّفات", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      org.saveUnit({
        tenantId: MAIN,
        id: "m9",
        type: "mosque" as never,
        labelAr: "مسجدٌ خاصٌّ بمشكاة",
        parentId: "r1",
        path: "/men/r1/m9/",
        section: "men",
        archived: false,
      })
    })
    await seedSession(driver, OTHER)
    await session(driver, OTHER, ({ org }) => {
      expect(org.getUnit("m9")).toBeNull()
      // النسلُ يشمل العقدةَ نفسَها (بادئةُ المسار) — والمزروعُ في مشكاة `m9` ليس فيه.
      expect(org.subtreeOf("/men/r1/").map((u) => u.id).sort()).toEqual(["m1", "m2", "r1"])
    })
    driver.close()
  })

  it("عزلُ الشبكة: التحميلُ بنطاقٍ لا يجرّ ما فوق النطاق ولا ما بجانبه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-m1")).ok).toBe(true)
    })
    await session(
      driver,
      MAIN,
      ({ ledger }) => {
        // النطاقُ `/men/r1/m2/` لا يحوي قيدَ m1.
        expect(ledger.entries()).toHaveLength(0)
      },
      "/men/r1/m2/",
    )
    driver.close()
  })

  it("عزلُ الشبكة: نطاقٌ يقطع سطراً عن قيده **يُرمى** ولا يُحمَّل نصفَ دفتر", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      const spanning = {
        ...donation("d-عابر"),
        lines: [
          { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(10_000) },
          {
            accountId: "revenue.donations",
            unitId: "m2",
            currency: "USD",
            side: "credit" as const,
            amount: c(10_000),
          },
        ],
      }
      expect(postJournal(ledger, CTX, spanning).ok).toBe(true)
    })
    // سطرُ m2 داخل النطاق ورأسُه (على m1) خارجه ⟵ رميةٌ صريحة لا تحميلٌ ناقص.
    await expect(
      session(driver, MAIN, () => undefined, "/men/r1/m2/"),
    ).rejects.toThrow(/journal_lines|ENTRY_NOT_FOUND/)
    driver.close()
  })
})
