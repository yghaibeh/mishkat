/**
 * ق-٦٢ — تعدد العملات: أسطرٌ بعملاتٍ مختلفة في العملية الواحدة، **والأرصدة منفصلة**،
 * و**ممنوعٌ جمعُ عملتين في رقمٍ واحد بلا سعر صرفٍ معلن** (`SPEC_finance_ledger` §٤).
 * هنا الاختبار الإلزاميّ السادس.
 */
import { describe, it, expect } from "vitest"
import { postJournal, type JournalInput } from "../../../src/features/ledger/services/journal.js"
import { balancesByCurrency, totalInBase } from "../../../src/features/ledger/services/balances.js"
import type { FxRate } from "../../../src/features/ledger/types.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const KHALID = "/men/homs/sq2/khalid/"

/** «كذا دولاراً + كذا ليرة سورية + كذا تركية» في العملية الواحدة (ق-٦٢ حرفياً). */
function threeCurrencyDonation(): JournalInput {
  return {
    at: CTX.now,
    unitId: "khalid",
    memoAr: "تبرعٌ بثلاث عملات",
    sourceType: "donation",
    sourceId: "d-multi",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(10_000) },
      { accountId: "cash", unitId: "khalid", currency: "SYP", side: "debit", amount: c(5_000_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "SYP", side: "credit", amount: c(5_000_000) },
      { accountId: "cash", unitId: "khalid", currency: "TRY", side: "debit", amount: c(120_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "TRY", side: "credit", amount: c(120_000) },
    ],
  }
}

describe("ق-٦٢/١ — أسطرُ عملاتٍ في العملية الواحدة", () => {
  it("التبرعُ بثلاث عملاتٍ يُرحَّل **بقيدٍ واحد** متوازنٍ في كل عملة", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, threeCurrencyDonation())
    expect(r.ok).toBe(true)
    expect(store.entries()).toHaveLength(1)
    expect(store.lines()).toHaveLength(6)
  })

  it("**وقيدٌ مدينُه بعملةٍ ودائنُه بأخرى يُرفض** — جمعٌ ضمنيٌّ بلا سعرٍ معلن", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, {
      ...threeCurrencyDonation(),
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10_000) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "SYP", side: "credit", amount: c(10_000) },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe("UNBALANCED")
      expect(r.error.detail).toBe("USD")
    }
    expect(store.entries()).toHaveLength(0)
  })

  it("وعملةٌ خارج المسموح في الإعدادات تُرفض (قب-٦ — القائمةُ إعدادٌ لا ثابت)", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, {
      ...threeCurrencyDonation(),
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "EUR", side: "debit", amount: c(100) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "EUR", side: "credit", amount: c(100) },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("CURRENCY_NOT_ENABLED")
  })
})

describe("ق-٦٢/٢ — الأرصدةُ بالعملات **منفصلة** (لا مكافئٌ يخفيها)", () => {
  it("رصيدُ النقد يُعرَض بثلاثة أسطرٍ لثلاث عملات — كلٌّ برقمه", () => {
    const store = seedStore()
    postJournal(store, CTX, threeCurrencyDonation())
    const balances = balancesByCurrency(store, KHALID, "cash")
    expect([...balances.keys()].sort()).toEqual(["SYP", "TRY", "USD"])
    expect(balances.get("USD")?.net).toBe(10_000)
    expect(balances.get("SYP")?.net).toBe(5_000_000)
    expect(balances.get("TRY")?.net).toBe(120_000)
  })

  it("والرصيدُ **مشتقٌّ بالاحتواء**: المركزُ يرى تجمّعَ ما تحته من نفس المصدر (ق-٦٠)", () => {
    const store = seedStore()
    postJournal(store, CTX, threeCurrencyDonation())
    expect(balancesByCurrency(store, "/", "cash").get("USD")?.net).toBe(10_000)
    // وحدةٌ شقيقةٌ لا ترى شيئاً — النطاقُ بالاحتواء لا بالتجاور.
    expect(balancesByCurrency(store, "/men/homs/sq2/bilal/", "cash").size).toBe(0)
  })
})

describe("ق-٦٢/٣ — **ممنوعٌ جمعُ عملتين في رقمٍ واحد بلا سعرٍ معلن** (الاختبار الإلزاميّ ٦)", () => {
  it("**التجميعُ بلا جدول أسعارٍ يُرفض** ولا يُعيد رقماً مضلِّلاً", () => {
    const store = seedStore()
    postJournal(store, CTX, threeCurrencyDonation())
    const balances = balancesByCurrency(store, KHALID, "cash")
    const r = totalInBase(balances, null, "USD")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("FX_RATE_UNDECLARED")
  })

  it("وسعرٌ ناقصٌ لعملةٍ حاضرةٍ يُرفض كذلك — لا إسقاطَ صامتٍ لعملة", () => {
    const store = seedStore()
    postJournal(store, CTX, threeCurrencyDonation())
    const rates = new Map<string, FxRate>([["SYP", { baseCents: c(100), foreignCents: c(1_000_000) }]])
    const r = totalInBase(balancesByCurrency(store, KHALID, "cash"), rates, "USD")
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe("FX_RATE_MISSING")
      expect(r.error.detail).toBe("TRY")
    }
  })

  it("**وبسعرٍ معلنٍ بعددين صحيحين** يُجمع — بقسمةٍ صحيحةٍ لا عائمة", () => {
    const store = seedStore()
    postJournal(store, CTX, threeCurrencyDonation())
    const rates = new Map<string, FxRate>([
      ["SYP", { baseCents: c(100), foreignCents: c(1_000_000) }],
      ["TRY", { baseCents: c(100), foreignCents: c(4_000) }],
    ])
    const r = totalInBase(balancesByCurrency(store, KHALID, "cash"), rates, "USD")
    expect(r.ok).toBe(true)
    // ١٠٠٠٠ (أساس) + ٥٬٠٠٠٬٠٠٠×١٠٠/١٬٠٠٠٬٠٠٠ = ٥٠٠ + ١٢٠٬٠٠٠×١٠٠/٤٬٠٠٠ = ٣٬٠٠٠
    if (r.ok) expect(r.value).toBe(13_500)
  })

  it("وعملةُ الأساس وحدها لا تحتاج سعراً (لا جمعَ عملتين أصلاً)", () => {
    const store = seedStore()
    postJournal(store, CTX, {
      ...threeCurrencyDonation(),
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(700) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(700) },
      ],
    })
    const r = totalInBase(balancesByCurrency(store, KHALID, "cash"), null, "USD")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(700)
  })
})
