/**
 * ق-٥٦ — سنداتٌ مرقّمةٌ متسلسلةٌ **بلا فجوات**، ومقاومتُها للتزامن
 * (`SPEC_finance_ledger` §٦.٢). هنا الاختبار الإلزاميّ السابع.
 *
 * **آليةُ التسلسل المختبَرة**: التخصيصُ يقع **داخل معاملة الترحيل** لا قبلها — فالفشلُ
 * يُرجع العدّاد (مصدرُ الفجوات الكلاسيكيّ)، والمعاملةُ **مقطعٌ حرجٌ متزامنٌ بلا `await`**
 * فلا تتشابك عمليتان على العدّاد.
 */
import { describe, it, expect } from "vitest"
import { postJournal, type JournalInput } from "../../../src/features/ledger/services/journal.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")

function entry(sourceId: string, accountId = "revenue.donations"): JournalInput {
  return {
    at: CTX.now,
    unitId: "khalid",
    memoAr: "قيدٌ للاختبار",
    sourceType: "donation",
    sourceId,
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(100) },
      { accountId, unitId: "khalid", currency: "USD", side: "credit", amount: c(100) },
    ],
  }
}

describe("ق-٥٦ — التسلسل بلا فجوات (الاختبار الإلزاميّ ٧)", () => {
  it("بعد ن ترحيلاً ناجحاً: الأرقامُ ١…ن بلا فجوةٍ ولا تكرار", () => {
    const store = seedStore()
    const n = 25
    for (let i = 1; i <= n; i += 1) expect(postJournal(store, CTX, entry(`s-${i}`)).ok).toBe(true)
    const seqs = store.entries().map((e) => e.voucherSeq)
    expect(seqs).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    expect(new Set(seqs).size).toBe(n)
  })

  it("**والترحيلُ الفاشل لا يحرق رقماً** — العدّادُ يرتدّ مع المعاملة", () => {
    const store = seedStore()
    postJournal(store, CTX, entry("ok-1"))
    for (let i = 0; i < 5; i += 1) {
      expect(postJournal(store, CTX, entry(`bad-${i}`, "حسابٌ-مجهول")).ok).toBe(false)
    }
    postJournal(store, CTX, entry("ok-2"))
    expect(store.entries().map((e) => e.voucherSeq)).toEqual([1, 2])
  })

  it("**وتحت تزامنٍ** (خمسون عمليةً متشابكة) تبقى بلا فجوةٍ ولا تكرار", async () => {
    const store = seedStore()
    const n = 50
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        (async () => {
          // تشابكٌ حقيقيّ على حلقة الأحداث قبل لمس العدّاد.
          await Promise.resolve()
          return postJournal(store, CTX, entry(`p-${i}`))
        })(),
      ),
    )
    expect(results.every((r) => r.ok)).toBe(true)
    const seqs = store
      .entries()
      .map((e) => e.voucherSeq)
      .sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    expect(new Set(store.entries().map((e) => e.voucherNo)).size).toBe(n)
  })

  it("وتزامنٌ فيه ناجحٌ وفاشلٌ معاً: الناجحون وحدهم يستهلكون أرقاماً متتالية", async () => {
    const store = seedStore()
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (async () => {
          await Promise.resolve()
          return postJournal(store, CTX, i % 2 === 0 ? entry(`g-${i}`) : entry(`b-${i}`, "مجهول"))
        })(),
      ),
    )
    const seqs = store
      .entries()
      .map((e) => e.voucherSeq)
      .sort((a, b) => a - b)
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("وشكلُ رقم السند **من الإعدادات** لا من الكود (قب-٦)", () => {
    const store = seedStore()
    const posted = postJournal(store, CTX, entry("s-1"))
    expect(posted.ok).toBe(true)
    if (posted.ok) expect(posted.value.voucherNo).toBe("R-000001")

    const custom = ledgerContext("u-finance", [
      {
        settingId: "finance.receipt.prefix",
        scopePath: "/",
        value: "REC-",
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        settingId: "finance.receipt.number_padding",
        scopePath: "/",
        value: 4,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    const other = postJournal(seedStore(), custom, entry("s-1"))
    expect(other.ok).toBe(true)
    if (other.ok) expect(other.value.voucherNo).toBe("REC-0001")
  })
})
