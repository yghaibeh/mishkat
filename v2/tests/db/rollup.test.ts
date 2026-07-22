/**
 * **الرولّ-أب** — `ADR-001` ع-٦ («تجميعٌ مسبق حتماً، لا مجموعٌ حيّ») وقرارُ CR-026 (أ).
 *
 * الثابتُ الذي لا يُمسّ: **الرولّ-أب يساوي مجموعَ الأسطر — دائماً وبلا استثناء**.
 * وهو **مدخلُ الحارس الشرعيّ ق-٥٥** لا رقمٌ في تقرير: أكبرُ من الحقيقة ⟵ يُجيز صرفاً لا
 * يجوز؛ أصغرُ ⟵ يمنع مشروعاً فيلتفّ الناس على النظام.
 *
 * ثلاثةُ قيودٍ تُبرهَن هنا (README «الرولّ-أب»):
 *  ١. **مسارُ كتابةٍ واحد** — يُبرهَن بمسحٍ بنيويّ في `rollup-write-path.test.ts`.
 *  ٢. **مطابقةٌ مستمرة** — بعد **كل خطوة** من سيناريو طويلٍ مركّب، لا في النهاية فقط.
 *  ٣. **الاختلافُ يُرمى ولا يُصلَح صامتاً** — إفسادٌ يدويٌّ في القاعدة ⟵ رميةٌ عند التحميل.
 */

import { describe, expect, it } from "vitest"
import { postJournal, reverseEntry } from "../../src/features/ledger/services/journal.js"
import { postEventSafely } from "../../src/features/ledger/services/posting.js"
import { reconcileFundRollup } from "../../src/features/ledger/data/rollup.js"
import { reconcileFundBalances } from "../../src/db/reconcile.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import type { LedgerStore } from "../../src/features/ledger/data/store.js"
import { MAIN, NOW, OTHER, freshDb, seedSession, session } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

/** تبرّعٌ نقديّ لصندوقٍ بعينه في وحدةٍ بعينها — نقدٌ (أصل) مقابل إيراد. */
function donation(sourceId: string, unitId: string, fundId: string, amount: number) {
  return {
    at: NOW,
    unitId,
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      {
        accountId: "cash",
        unitId,
        currency: "USD",
        side: "debit" as const,
        amount: c(amount),
        fundId,
      },
      {
        accountId: "revenue.donations",
        unitId,
        currency: "USD",
        side: "credit" as const,
        amount: c(amount),
        fundId,
      },
    ],
  }
}

/** صرفٌ من صندوق — يُنقص النقدَ الموسوم بالصندوق (وهو ما يقيسه ق-٥٥). */
function spend(sourceId: string, unitId: string, fundId: string, amount: number) {
  return {
    at: NOW,
    unitId,
    memoAr: "صرفٌ نقديّ",
    sourceType: "expense" as const,
    sourceId,
    lines: [
      {
        accountId: "expense.general",
        unitId,
        currency: "USD",
        side: "debit" as const,
        amount: c(amount),
        fundId,
      },
      {
        accountId: "cash",
        unitId,
        currency: "USD",
        side: "credit" as const,
        amount: c(amount),
        fundId,
      },
    ],
  }
}

/** المجموعُ الحيُّ من الأسطر — **مرجعُ الحقيقة في الاختبار وحده**، لا في الإنتاج (ع-٦). */
function liveSum(store: LedgerStore, fundId: string, currency: string): number {
  let net = 0
  for (const line of store.lines()) {
    if (line.fundId !== fundId || line.currency !== currency) continue
    if (store.getAccount(line.accountId)?.kind !== "asset") continue
    net += line.debit - line.credit
  }
  return net
}

describe("الرولّ-أب = مجموعُ الأسطر — بعد كل خطوة لا في النهاية", () => {
  it("سيناريو طويلٌ مركّب: قيدٌ · عكسٌ · دفعةٌ مجمّعة · فشلٌ مرتدّ · شبكتان", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)

    /** المطابقةُ **بعد كل خطوة**: في الذاكرة، ثم على القاعدة بعد أن تُقذف الخطوة. */
    const checkpoints: string[] = []
    const step = async (label: string, tenantId: string, fn: (s: LedgerStore) => void) => {
      await session(driver, tenantId, ({ ledger }) => {
        fn(ledger)
        reconcileFundRollup(ledger)
      })
      await reconcileFundBalances(driver, { tenantId, scopePath: "/" })
      checkpoints.push(label)
    }

    // ١) قيدٌ واحد
    await step("قيد", MAIN, (s) => {
      expect(postJournal(s, CTX, donation("d-1", "m1", "zakat", 900)).ok).toBe(true)
    })

    // ٢) دفعةٌ مجمّعة: أربعة قيودٍ في وحدتين وصندوقين داخل جلسةٍ واحدة
    await step("دفعة", MAIN, (s) => {
      expect(postJournal(s, CTX, donation("d-2", "m1", "general", 400)).ok).toBe(true)
      expect(postJournal(s, CTX, donation("d-3", "m2", "zakat", 700)).ok).toBe(true)
      expect(postJournal(s, CTX, donation("d-4", "m2", "general", 250)).ok).toBe(true)
      expect(postJournal(s, CTX, spend("e-1", "m1", "general", 150)).ok).toBe(true)
    })

    // ٣) عكسٌ — أثرُ الأصل يُلغى بالضبط، والرولّ-أب يتبعه بلا تدخّل
    await step("عكس", MAIN, (s) => {
      const target = s.entries().find((e) => e.sourceId === "d-3")!
      expect(reverseEntry(s, CTX, target.id, "خطأُ إدخال").ok).toBe(true)
    })

    // ٤) فشلٌ مرتدّ: قيدٌ مختلٌّ داخل المعاملة ⟵ لا سطرَ ولا رولّ-أب
    await step("فشلٌ مرتدّ", MAIN, (s) => {
      const before = s.fundBalance("general", "USD")
      const failed = postEventSafely(s, CTX, {
        sourceType: "donation",
        sourceId: "d-معطوب",
        at: NOW,
        unitId: "لا-وجود-لها",
        memoAr: "وحدةٌ مجهولة",
        lines: donation("d-معطوب", "m1", "general", 999).lines,
      })
      expect(failed.posted).toBe(false)
      expect(s.fundBalance("general", "USD")).toBe(before)
    })

    // ٥) الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً (قب-١٨)
    await step("شبكةٌ ثانية", OTHER, (s) => {
      expect(postJournal(s, CTX, donation("d-1", "m1", "zakat", 5_000)).ok).toBe(true)
    })

    expect(checkpoints).toEqual(["قيد", "دفعة", "عكس", "فشلٌ مرتدّ", "شبكةٌ ثانية"])

    // والحصيلةُ نفسُها تُقرأ من الرولّ-أب ومن الأسطر سواءً — في الشبكتين.
    await session(driver, MAIN, ({ ledger }) => {
      expect(ledger.fundBalance("zakat", "USD")).toBe(liveSum(ledger, "zakat", "USD"))
      expect(ledger.fundBalance("zakat", "USD")).toBe(900)
      expect(ledger.fundBalance("general", "USD")).toBe(liveSum(ledger, "general", "USD"))
      expect(ledger.fundBalance("general", "USD")).toBe(500)
    })
    await session(driver, OTHER, ({ ledger }) => {
      expect(ledger.fundBalance("zakat", "USD")).toBe(5_000)
    })
    driver.close()
  })

  it("المطابقةُ تصمد على **نطاقٍ جزئيّ**: صفوفُ الرولّ-أب وأسطرُه يتقاسمان الفلترة نفسَها", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", "m1", "general", 300)).ok).toBe(true)
      expect(postJournal(ledger, CTX, donation("d-2", "m2", "general", 800)).ok).toBe(true)
    })

    await session(
      driver,
      MAIN,
      ({ ledger }) => {
        reconcileFundRollup(ledger)
        // نطاقُ مسجدٍ واحد ⟵ رصيدُه هو، لا رصيدُ الشبكة (وهو سلوكُ اليوم حرفياً).
        expect(ledger.fundBalance("general", "USD")).toBe(300)
      },
      "/men/r1/m1/",
    )
    await reconcileFundBalances(driver, { tenantId: MAIN, scopePath: "/men/r1/m1/" })
    driver.close()
  })
})

describe("الاختلافُ يُرمى ولا يُصلَح صامتاً", () => {
  it("رولّ-أبٌ مفسَدٌ في القاعدة ⟵ التحميلُ **يرمي** ولا يكتب تصحيحاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", "m1", "zakat", 900)).ok).toBe(true)
    })

    // تزويرٌ يدويّ: رصيدٌ **أكبر** من الحقيقة — أخطرُ الاتجاهين (يُجيز صرفاً لا يجوز).
    await driver.batch([{
      sql: "UPDATE fund_balances SET balance = ? WHERE tenant_id = ? AND fund_id = ?",
      params: [999_999, MAIN, "zakat"],
    }])

    await expect(session(driver, MAIN, () => undefined)).rejects.toThrow(/zakat/)

    // ولم يُصلَح صامتاً: الصفُّ المزوَّر **كما هو** بعد الرمية.
    const rows = await driver.all({
      sql: "SELECT balance FROM fund_balances WHERE tenant_id = ? AND fund_id = ?",
      params: [MAIN, "zakat"],
    })
    expect(rows.map((r) => r["balance"])).toEqual([999_999])
    driver.close()
  })

  it("المطابقةُ الدورية (الليلية) ترمي على التفاوت وتُسمّي مفتاحَه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", "m1", "general", 400)).ok).toBe(true)
    })
    await driver.batch([{
      sql: "UPDATE fund_balances SET balance = balance - ? WHERE tenant_id = ?",
      params: [1, MAIN],
    }])
    await expect(reconcileFundBalances(driver, { tenantId: MAIN, scopePath: "/" })).rejects.toThrow(
      /general/,
    )
    driver.close()
  })

  it("صفُّ رولّ-أبٍ **محذوف** والأسطرُ باقية ⟵ يُرمى (رصيدٌ أصغرُ يمنع صرفاً مشروعاً)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", "m1", "zakat", 900)).ok).toBe(true)
    })
    await driver.batch([
      { sql: "DELETE FROM fund_balances WHERE tenant_id = ?", params: [MAIN] },
    ])
    await expect(session(driver, MAIN, () => undefined)).rejects.toThrow(/zakat/)
    await expect(reconcileFundBalances(driver, { tenantId: MAIN, scopePath: "/" })).rejects.toThrow(
      /zakat/,
    )
    driver.close()
  })

  it("صفُّ رولّ-أبٍ **مخترَع** لا يقابله سطر ⟵ يُرمى كذلك (التفاوتُ في الاتجاهين)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await driver.batch([{
      sql:
        "INSERT INTO fund_balances (tenant_id, unit_path, fund_id, currency, balance) " +
        "VALUES (?, ?, ?, ?, ?)",
      params: [MAIN, "/men/r1/m1/", "zakat", "USD", 50_000],
    }])
    await expect(reconcileFundBalances(driver, { tenantId: MAIN, scopePath: "/" })).rejects.toThrow(
      /zakat/,
    )
    driver.close()
  })

  it("والمطابقةُ **صامتةٌ حين تتطابق** — فلا رميةَ على قاعدةٍ سليمة", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", "m1", "zakat", 900)).ok).toBe(true)
    })
    await expect(
      reconcileFundBalances(driver, { tenantId: MAIN, scopePath: "/" }),
    ).resolves.toBeUndefined()
    driver.close()
  })
})
