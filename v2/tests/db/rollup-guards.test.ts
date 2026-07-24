/**
 * حرّاسُ الرولّ-أب وسجلِّ التدقيق — **بتوكيداتٍ سالبةٍ غالبة** (TESTING_POLICY §٢:
 * *«النظام الآمن يُعرَّف بما يمنعه»*).
 *
 * وأخصُّ ما هنا **ق-٥٥ بعد عبور القاعدة**: الحارسُ الشرعيُّ يقرأ الآن رولّ-أباً لا مجموعاً
 * حيّاً، فيجب أن يمنع ما كان يمنعه **ويُجيز ما كان يُجيزه** — وأثرُ خطئه لا يُقاس بسطرٍ
 * في تقرير بل بمالٍ لا يجوز صرفُه.
 */

import { describe, expect, it } from "vitest"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { reconcileFundRollup } from "../../src/features/ledger/data/rollup.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { diffStatements } from "../../src/db/unitOfWork.js"
import { tableSpec } from "../../src/db/schema.js"
import { AuditJournal } from "../../src/audit/journal.js"
import { LedgerStore } from "../../src/features/ledger/data/store.js"
import type { SqlRow } from "../../src/db/sql/driver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { MAIN, NOW, OTHER, freshDb, seedSession, session } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function move(sourceId: string, fundId: string, amount: number, direction: "in" | "out") {
  const cashSide = direction === "in" ? ("debit" as const) : ("credit" as const)
  const otherSide = direction === "in" ? ("credit" as const) : ("debit" as const)
  const otherAccount = direction === "in" ? "revenue.donations" : "expense.general"
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "حركةُ صندوق",
    sourceType: direction === "in" ? ("donation" as const) : ("expense" as const),
    sourceId,
    lines: [
      { accountId: "cash", unitId: "m1", currency: "USD", side: cashSide, amount: c(amount), fundId },
      {
        accountId: otherAccount,
        unitId: "m1",
        currency: "USD",
        side: otherSide,
        amount: c(amount),
        fundId,
      },
    ],
  }
}

describe("ق-٥٥ بعد عبور القاعدة — **المنعُ قاطعٌ والحرُّ لا يُقيَّد**", () => {
  it("لا يُصرف من الزكاة أكثرَ من رصيدها — والرصيدُ الآن رولّ-أبٌ لا مجموعٌ حيّ", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("z-in", "zakat", 1_000, "in")).ok).toBe(true)
    })

    // **جلسةٌ جديدة**: الرصيدُ جاء من القاعدة لا من ذاكرةِ الجلسة التي كتبته.
    await session(driver, MAIN, ({ ledger }) => {
      const over = postJournal(ledger, CTX, move("z-out", "zakat", 1_001, "out"))
      expect(over.ok).toBe(false)
      if (!over.ok) expect(over.error.code).toBe("RESTRICTED_FUND_OVERSPEND")
      // ولم يترك المرفوضُ أثراً في الرولّ-أب.
      expect(ledger.fundBalance("zakat", "USD")).toBe(1_000)
      reconcileFundRollup(ledger)
    })
    driver.close()
  })

  it("والصرفُ **حتى الرصيد تماماً** يمرّ — الحارسُ يمنع التجاوز لا الصرف", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("z-in", "zakat", 1_000, "in")).ok).toBe(true)
    })
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("z-out", "zakat", 1_000, "out")).ok).toBe(true)
      expect(ledger.fundBalance("zakat", "USD")).toBe(0)
      reconcileFundRollup(ledger)
    })
    driver.close()
  })

  it("والصندوقُ الحرُّ **لا يُقيَّد** ولو صار سالباً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("g-out", "general", 5_000, "out")).ok).toBe(true)
      expect(ledger.fundBalance("general", "USD")).toBe(-5_000)
      reconcileFundRollup(ledger)
    })
    driver.close()
  })
})

describe("الرولّ-أب لا يتحرّك إلا بما يُحرّك المال", () => {
  it("سطرٌ **بلا صندوق** لا يُنشئ صفَّ رولّ-أبٍ أصلاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(
        postJournal(ledger, CTX, {
          at: NOW,
          unitId: "m1",
          memoAr: "قيدٌ بلا صندوق",
          sourceType: "manualJournal",
          sourceId: "mj-1",
          lines: [
            { accountId: "cash", unitId: "m1", currency: "USD", side: "debit", amount: c(700) },
            {
              accountId: "revenue.donations",
              unitId: "m1",
              currency: "USD",
              side: "credit",
              amount: c(700),
            },
          ],
        }).ok,
      ).toBe(true)
      expect(ledger.fundRollupRows()).toEqual([])
      reconcileFundRollup(ledger)
    })
    expect(await driver.all({ sql: "SELECT * FROM fund_balances", params: [] })).toEqual([])
    driver.close()
  })

  it("وسطرٌ على حسابٍ **ليس أصلاً** لا يحرّك الرصيد — وسمُ الطرفين لا يُلغي أثرَه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("g-in", "general", 400, "in")).ok).toBe(true)
      // الطرفان موسومان بالصندوق، لكنّ الرصيدَ ٤٠٠ لا صفر: **أسطرُ الأصول وحدَها**.
      expect(ledger.fundBalance("general", "USD")).toBe(400)
      expect(ledger.fundRollupRows()).toHaveLength(1)
      reconcileFundRollup(ledger)
    })
    driver.close()
  })

  it("وعملةٌ أخرى **صندوقٌ آخر في الحساب**: لا مكافئَ يخفي النقدَ الفعليّ (ق-٦٢)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("g-in", "general", 400, "in")).ok).toBe(true)
      expect(ledger.fundBalance("general", "SYP")).toBe(0)
      expect(ledger.fundBalance("لا-صندوق", "USD")).toBe(0)
    })
    driver.close()
  })
})

describe("الارتدادُ يشمل الرولّ-أب والتدقيق — لا أثرَ يبقى لِما لم يقع", () => {
  it("رميةٌ داخل المعاملة **تُرجع الرصيد** — والخريطةُ الداخلية تُنسخ بمستويين", () => {
    const store = new LedgerStore(MAIN)
    store.saveAccount({ tenantId: MAIN, id: "cash", ar: "النقد", kind: "asset" })
    store.saveFund({ tenantId: MAIN, id: "zakat", ar: "الزكاة", restricted: true })
    const entryId = store.openEntry({
      voucherNo: "R-1",
      voucherSeq: 1,
      at: NOW,
      unitPath: "/men/r1/m1/",
      memoAr: "أساس",
      sourceType: "donation",
      sourceId: "d-0",
      postingKey: null,
      reversalOf: null,
      reasonAr: null,
      postedBy: "u-finance",
    })
    store.appendLine(entryId, {
      accountId: "cash",
      unitPath: "/men/r1/m1/",
      fundId: "zakat",
      currency: "USD",
      debit: c(300),
      credit: c(0),
      kind: "normal",
      deductionKind: null,
    })
    expect(store.fundBalance("zakat", "USD")).toBe(300)

    expect(() =>
      store.transaction(() => {
        store.appendLine(entryId, {
          accountId: "cash",
          unitPath: "/men/r1/m1/",
          fundId: "zakat",
          currency: "USD",
          debit: c(900),
          credit: c(0),
          kind: "normal",
          deductionKind: null,
        })
        throw new Error("عطبٌ مُحقَن بعد تحريك الرصيد")
      }),
    ).toThrow()
    // ولو كان النسخُ سطحياً لبقي ١٢٠٠ — وهذا **أخطرُ من فقدِ سطر**: رصيدٌ أكبرُ من الحقيقة.
    expect(store.fundBalance("zakat", "USD")).toBe(300)
    reconcileFundRollup(store)
  })

  it("وقيدُ تدقيقٍ عن أثرٍ ارتدّ **لا يبقى** — شهادةُ زورٍ على النظام", () => {
    const store = new LedgerStore(MAIN)
    expect(() =>
      store.transaction(() => {
        store.audit.append({
          at: NOW,
          actorPersonId: "u-finance",
          action: "ledger.post",
          unitPath: "/men/r1/m1/",
          capability: null,
          targetType: "journalEntry",
          targetId: "je-1",
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
        throw new Error("عطبٌ مُحقَن بعد التدوين")
      }),
    ).toThrow()
    expect(store.audit.all()).toEqual([])
  })

  it("والتسلسلُ يرتدّ معه — فلا تُحرق أرقامٌ في فشلٍ مرتدّ (نظيرُ عدّاد السندات)", () => {
    const store = new LedgerStore(MAIN)
    expect(() =>
      store.transaction(() => {
        store.audit.append({
          at: NOW,
          actorPersonId: "u",
          action: "a",
          unitPath: "/men/",
          capability: null,
          targetType: "t",
          targetId: "x",
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
        throw new Error("ارتداد")
      }),
    ).toThrow()
    const after = store.audit.append({
      at: NOW,
      actorPersonId: "u",
      action: "a",
      unitPath: "/men/",
      capability: null,
      targetType: "t",
      targetId: "y",
      reason: null,
      // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
      // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
      before: null,
      after: null,
    })
    expect(after.seq).toBe(1)
  })

  it("وعلامةٌ من المستقبل تُرمى — لا ارتدادَ إلى حالةٍ لم تقع", () => {
    const journal = new AuditJournal(MAIN)
    expect(() => journal.rollbackTo(3 as never)).toThrow(/من المستقبل/)
  })
})

describe("عزلُ الشبكة باقٍ — على الرولّ-أب وعلى السجلّ (قب-١٨)", () => {
  it("رولّ-أبُ شبكةٍ لا يبلغه أحدٌ من أخرى ولو تطابقت المسارات", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("z-in", "zakat", 9_000, "in")).ok).toBe(true)
    })
    await session(driver, OTHER, ({ ledger }) => {
      expect(ledger.fundBalance("zakat", "USD")).toBe(0)
      expect(ledger.fundRollupRows()).toEqual([])
      // ولا يُجيز رصيدُ الجارة صرفاً هنا.
      const over = postJournal(ledger, CTX, move("z-out", "zakat", 1, "out"))
      expect(over.ok).toBe(false)
    })
    driver.close()
  })

  it("وسجلُّ شبكةٍ لا يظهر في تدقيق أخرى ولو تطابق المسار", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await seedSession(driver, OTHER)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, move("z-in", "zakat", 100, "in")).ok).toBe(true)
    })
    await session(driver, OTHER, ({ audit }) => {
      expect(audit.listInScope("/men/r1/m1/", 50)).toEqual([])
      expect(audit.all()).toEqual([])
    })
    driver.close()
  })
})

describe("صفُّ الرولّ-أب لا يُمحى — الاختفاءُ عطبٌ يُرمى لا `DELETE` يُكتب", () => {
  it("اختفاءُ صفٍّ من الإسقاط **يُرمى** (المادة ٧/٤ على جدولٍ ملحقٍ فقط)", () => {
    const spec = tableSpec("fund_balances")
    const row: SqlRow = {
      tenant_id: MAIN,
      unit_path: "/men/r1/m1/",
      fund_id: "zakat",
      currency: "USD",
      balance: 500,
    }
    expect(() => diffStatements(spec, new Map([["k", row]]), new Map())).toThrow(/محوٌ ممنوع/)
  })

  it("وتغيُّرُ الرصيد يُنتج **إدراجاً بمفتاحٍ طبيعيّ** لا تحديثاً أعمى (ع-٤)", () => {
    const spec = tableSpec("fund_balances")
    const base: SqlRow = {
      tenant_id: MAIN,
      unit_path: "/men/r1/m1/",
      fund_id: "zakat",
      currency: "USD",
      balance: 500,
    }
    const [statement] = diffStatements(
      spec,
      new Map([["k", base]]),
      new Map([["k", { ...base, balance: 700 }]]),
    )
    expect(statement!.sql).toContain("ON CONFLICT (tenant_id, unit_path, fund_id, currency)")
  })
})
