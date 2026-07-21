/**
 * ق-٥٥ — ضبطُ صرف الأموال المقيَّدة شرعياً (`SPEC_finance_ledger` §٦.٣)
 * وب-٣١ — الخصومات: **بنيةٌ تحتيةٌ كاملةٌ في المحرك وعرضٌ خلف مفتاحٍ افتراضُه الإخفاء** (§٧.١).
 */
import { describe, it, expect } from "vitest"
import { postJournal, type JournalInput } from "../../../src/features/ledger/services/journal.js"
import { deductionsVisible, deductionLines } from "../../../src/features/ledger/services/deductions.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const FROM = new Date("2026-01-01T00:00:00.000Z")

function receiveIntoFund(fundId: string, amount: number, sourceId: string): JournalInput {
  return {
    at: CTX.now,
    unitId: "khalid",
    memoAr: "قبضٌ لصندوقٍ",
    sourceType: "donation",
    sourceId,
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(amount), fundId },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(amount), fundId },
    ],
  }
}

function spendFromFund(fundId: string, amount: number, sourceId: string): JournalInput {
  return {
    at: CTX.now,
    unitId: "khalid",
    memoAr: "صرفٌ من صندوق",
    sourceType: "expense",
    sourceId,
    lines: [
      { accountId: "expense.general", unitId: "khalid", currency: "USD", side: "debit", amount: c(amount), fundId },
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "credit", amount: c(amount), fundId },
    ],
  }
}

describe("ق-٥٥ — المقيَّدُ شرعاً لا يُصرف فوق رصيده، والحرُّ لا يُقيَّد", () => {
  it("الصرفُ ضمن رصيد الصندوق المقيَّد يمرّ", () => {
    const store = seedStore()
    expect(postJournal(store, CTX, receiveIntoFund("zakat", 10_000, "z-in")).ok).toBe(true)
    expect(postJournal(store, CTX, spendFromFund("zakat", 4_000, "z-out")).ok).toBe(true)
    expect(store.fundBalance("zakat", "USD")).toBe(6_000)
  })

  it("**والصرفُ فوق رصيده يُرفض منعاً قاطعاً** ولا يترك أثراً", () => {
    const store = seedStore()
    postJournal(store, CTX, receiveIntoFund("zakat", 10_000, "z-in"))
    const r = postJournal(store, CTX, spendFromFund("zakat", 10_001, "z-over"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("RESTRICTED_FUND_OVERSPEND")
    expect(store.fundBalance("zakat", "USD")).toBe(10_000)
    expect(store.entries()).toHaveLength(1)
  })

  it("**والصندوقُ الحرُّ لا يُقيَّد بالرصيد** — التمييزُ مقصود", () => {
    const store = seedStore()
    expect(postJournal(store, CTX, spendFromFund("general", 50_000, "g-out")).ok).toBe(true)
    expect(store.fundBalance("general", "USD")).toBe(-50_000)
  })

  it("والقيدُ بلا وسمِ صندوقٍ لا يخضع للضبط أصلاً", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, {
      ...spendFromFund("general", 1_000, "n-out"),
      lines: [
        { accountId: "expense.general", unitId: "khalid", currency: "USD", side: "debit", amount: c(1_000) },
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "credit", amount: c(1_000) },
      ],
    })
    expect(r.ok).toBe(true)
  })

  it("**والضبطُ مفتاحٌ حيّ** لا شرطٌ صلب: بإطفائه يمرّ ما كان يُمنع (قب-٦)", () => {
    const store = seedStore()
    const relaxed = ledgerContext("u-finance", [
      {
        settingId: "finance.restricted_funds.block_overspend",
        scopePath: "/",
        value: false,
        validFrom: FROM,
      },
    ])
    expect(postJournal(store, relaxed, spendFromFund("zakat", 10_000, "z-over")).ok).toBe(true)
  })

  it("والضبطُ **لكل عملةٍ على حدة** — رصيدُ الدولار لا يغطّي صرفَ الليرة", () => {
    const store = seedStore()
    postJournal(store, CTX, receiveIntoFund("zakat", 10_000, "z-in"))
    const r = postJournal(store, CTX, {
      ...spendFromFund("zakat", 1, "z-syp"),
      lines: [
        { accountId: "expense.general", unitId: "khalid", currency: "SYP", side: "debit", amount: c(1_000), fundId: "zakat" },
        { accountId: "cash", unitId: "khalid", currency: "SYP", side: "credit", amount: c(1_000), fundId: "zakat" },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("RESTRICTED_FUND_OVERSPEND")
  })
})

describe("ب-٣١ — الخصومات: البنيةُ كاملةٌ والعرضُ خلف مفتاحٍ افتراضُه الإخفاء", () => {
  function salaryWithDeduction(deductionKind: "settlement" | "penal"): JournalInput {
    return {
      at: CTX.now,
      unitId: "khalid",
      memoAr: "راتبٌ بخصمِ تسوية",
      sourceType: "payroll",
      sourceId: `p-${deductionKind}`,
      lines: [
        { accountId: "expense.general", unitId: "khalid", currency: "USD", side: "debit", amount: c(50_000) },
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "credit", amount: c(45_000) },
        {
          accountId: "clearing.handover",
          unitId: "khalid",
          currency: "USD",
          side: "credit",
          amount: c(5_000),
          kind: "deduction",
          deductionKind,
        },
      ],
    }
  }

  it("**البنيةُ كاملةٌ في المحرك**: سطرُ خصمِ تسويةٍ يُرحَّل ويدخل القيد كأيّ سطر", () => {
    const store = seedStore()
    expect(postJournal(store, CTX, salaryWithDeduction("settlement")).ok).toBe(true)
    const deductions = deductionLines(store, "/men/homs/sq2/khalid/")
    expect(deductions).toHaveLength(1)
    expect(deductions[0]?.deductionKind).toBe("settlement")
    expect(deductions[0]?.credit).toBe(5_000)
  })

  it("**والخصمُ العقابيّ ممنوعٌ افتراضاً** (ق-٣٤/ق4-ب: الاستحقاقُ دالةُ المنجَز)", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, salaryWithDeduction("penal"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("PENAL_DEDUCTION_NOT_ALLOWED")
    expect(store.entries()).toHaveLength(0)
  })

  it("ويمرّ العقابيّ إن فتحه المالكُ بإعدادٍ — بنيةٌ قائمةٌ لا محذوفة (قب-٧)", () => {
    const opened = ledgerContext("u-finance", [
      { settingId: "finance.penal_deductions_allowed", scopePath: "/", value: true, validFrom: FROM },
    ])
    expect(postJournal(seedStore(), opened, salaryWithDeduction("penal")).ok).toBe(true)
  })

  it("**والعرضُ مخفيٌّ افتراضاً** — «لا خصومات» هو الافتراضي (قرارُ المالك في ب-٣١)", () => {
    expect(deductionsVisible(CTX, "/")).toBe(false)
  })

  it("ويظهر بمفتاح الإدارة وحده — لا حذفَ للبنية ولا إظهارَ افتراضيّ", () => {
    const shown = ledgerContext("u-finance", [
      { settingId: "finance.deductions.display_enabled", scopePath: "/", value: true, validFrom: FROM },
    ])
    expect(deductionsVisible(shown, "/")).toBe(true)
  })
})
