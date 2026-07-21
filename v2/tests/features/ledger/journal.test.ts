/**
 * ق-٤٩ — القيد متوازنٌ دائماً، يُرحَّل ذرياً، ويُصحَّح بعكسٍ لا بحذف
 * (`SPEC_finance_ledger` §٢). هنا الاختبارات الإلزامية ١ و٢ و٤.
 *
 * القاعدةُ الذهبية سارية: **حالاتُ السلب أكثرُ من الإيجاب** — النظامُ يُعرَّف بما يمنعه.
 */
import { describe, it, expect } from "vitest"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import {
  balanceProof,
  postJournal,
  reverseEntry,
  type JournalInput,
} from "../../../src/features/ledger/services/journal.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const AT = CTX.now

function donation(over: Partial<JournalInput> = {}): JournalInput {
  return {
    at: AT,
    unitId: "khalid",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation",
    sourceId: "d-1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(10_000) },
    ],
    ...over,
  }
}

describe("ق-٤٩/١ — برهانُ التوازن: Σمدين = Σدائن، والمختلُّ يُرفض (الاختبار الإلزاميّ ١)", () => {
  it("القيدُ المتوازن يُرحَّل، ومجموعُ المدين يساوي الدائن سنتاً بسنت", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, donation())
    expect(r.ok).toBe(true)
    const proof = balanceProof(store)
    expect(proof.balanced).toBe(true)
    expect(proof.byCurrency.get("USD")).toEqual({ debit: 10_000, credit: 10_000 })
  })

  it("**القيدُ المختلُّ يُرفض** ولا يُكتب منه شيء", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10_000) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(9_999) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNBALANCED")
    expect(store.entries()).toHaveLength(0)
    expect(store.lines()).toHaveLength(0)
  })

  it("ويُرفض القيدُ بسطرٍ واحد (لا قيدَ بطرفٍ واحد)", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [{ accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(0) }],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("TOO_FEW_LINES")
  })

  it("ويُرفض السطرُ الصفريّ — لا سطرَ بلا أثر", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(0) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(0) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ZERO_LINE")
  })

  it("ويُرفض المبلغُ السالب — الاتجاهُ بالطرف لا بالإشارة", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(-10_000) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(-10_000) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("NEGATIVE_AMOUNT")
  })

  it("ويُرفض الكسرُ العشريّ في مبلغ السطر — حدُّ ق-٤٨ يحرس الدفتر (الاختبار الإلزاميّ ٩)", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(100.5) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(100.5) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("FRACTIONAL_AMOUNT")
    expect(store.entries()).toHaveLength(0)
  })

  it("ويُرفض النوعُ خارج كتالوج المصادر المغلق", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, donation({ sourceType: "غير-معروف" as JournalInput["sourceType"] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_SOURCE_TYPE")
  })

  it("ويُرفض القيدُ على وحدةٍ غير مخزَّنة — النطاقُ من الكيان لا من المدخل", () => {
    const store = seedStore()
    const r = postJournal(store, CTX, donation({ unitId: "لا-وجود-لها" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_UNIT")
  })
})

describe("ق-٤٩/٢ — الذرّية: فشلٌ في منتصف الترحيل ⇒ لا أثرَ جزئيّ (الاختبار الإلزاميّ ٢)", () => {
  it("**سطرٌ ثانٍ بحسابٍ مجهولٍ يُرجع كلَّ شيء** — لا رأسَ بلا أسطر ولا نصفَ قيد", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10_000) },
          { accountId: "حسابٌ-لا-وجود-له", unitId: "khalid", currency: "USD", side: "credit", amount: c(10_000) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_ACCOUNT")
    expect(store.entries(), "بقي رأسُ قيدٍ بعد فشلٍ في منتصف الترحيل").toHaveLength(0)
    expect(store.lines(), "بقي سطرٌ يتيمٌ بعد فشلٍ في منتصف الترحيل").toHaveLength(0)
  })

  it("والفشلُ لا يحرق رقمَ سند — العدّادُ يرتدّ مع المعاملة (يغذّي ق-٥٦)", () => {
    const store = seedStore()
    postJournal(store, CTX, donation({ sourceId: "d-1" }))
    postJournal(
      store,
      CTX,
      donation({
        sourceId: "d-fail",
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(1) },
          { accountId: "مجهول", unitId: "khalid", currency: "USD", side: "credit", amount: c(1) },
        ],
      }),
    )
    const second = postJournal(store, CTX, donation({ sourceId: "d-2" }))
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.value.voucherSeq).toBe(2)
  })

  it("والصندوقُ المجهول يُرجع كلَّ شيء كذلك (تكاملٌ مرجعيٌّ في طبقة البيانات)", () => {
    const store = seedStore()
    const r = postJournal(
      store,
      CTX,
      donation({
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(500), fundId: "صندوقٌ-وهميّ" },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(500) },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_FUND")
    expect(store.entries()).toHaveLength(0)
    expect(store.lines()).toHaveLength(0)
  })
})

describe("ق-٤٩/٣ — التصحيح بعكسٍ لا بحذف (الاختبار الإلزاميّ ٤)", () => {
  it("**لا دالةَ حذفٍ أو تعديلٍ في عقد المستودع** — البناءُ نفسه يمنع المحو", () => {
    const names = [
      ...Object.getOwnPropertyNames(LedgerStore.prototype),
      ...Object.getOwnPropertyNames(seedStore()),
    ]
    const destructive = names.filter((n) => /delete|remove|drop|clear|purge|update/i.test(n))
    expect(destructive, `سطحُ مستودعٍ هدّام: ${destructive.join("، ")}`).toEqual([])
  })

  it("**والقيدُ المُرحَّل مجمَّدٌ**: محاولةُ تعديله في مكانه ترمي، ولا يُمحى سطرٌ من الدفتر", () => {
    const store = seedStore()
    const posted = postJournal(store, CTX, donation())
    expect(posted.ok).toBe(true)
    if (!posted.ok) return
    expect(Object.isFrozen(posted.value)).toBe(true)
    expect(() => {
      ;(posted.value as { memoAr: string }).memoAr = "تحريفٌ"
    }).toThrow(TypeError)
    expect(() => {
      ;(store.entries() as unknown as unknown[]).splice(0, 1)
    }).toThrow(TypeError)
  })

  it("والتصحيحُ يولّد **قيداً عاكساً** بسندٍ جديد، والأصلُ يبقى كما هو حرفياً", () => {
    const store = seedStore()
    const posted = postJournal(store, CTX, donation())
    if (!posted.ok) throw new Error("لم يُرحَّل القيدُ الأصل")
    const before = JSON.stringify(posted.value)

    const reversed = reverseEntry(store, CTX, posted.value.id, "خطأٌ في مبلغ التبرع")
    expect(reversed.ok).toBe(true)
    if (!reversed.ok) return

    expect(store.entries()).toHaveLength(2)
    expect(reversed.value.reversalOf).toBe(posted.value.id)
    expect(reversed.value.voucherSeq).toBe(2)
    expect(store.getEntry(posted.value.id)?.reversedBy).toBe(reversed.value.id)
    // الأصلُ نفسُه لم يتغير إلا بربط العكس — لا مبلغٌ ولا سطرٌ مُسّ.
    expect(JSON.stringify({ ...store.getEntry(posted.value.id), reversedBy: null })).toBe(before)

    // أثرُ العكس: المدينُ صار دائناً والعكس — والدفترُ عاد إلى الصفر متوازناً.
    const proof = balanceProof(store)
    expect(proof.balanced).toBe(true)
    expect(proof.byCurrency.get("USD")).toEqual({ debit: 20_000, credit: 20_000 })
  })

  it("ولا عكسَ مرتين، ولا عكسَ لقيدٍ عاكس، ولا عكسَ بلا سبب", () => {
    const store = seedStore()
    const posted = postJournal(store, CTX, donation())
    if (!posted.ok) throw new Error("لم يُرحَّل القيدُ الأصل")

    const noReason = reverseEntry(store, CTX, posted.value.id, "   ")
    expect(noReason.ok).toBe(false)
    if (!noReason.ok) expect(noReason.error.code).toBe("REASON_REQUIRED")

    const first = reverseEntry(store, CTX, posted.value.id, "سببٌ مكتوب")
    if (!first.ok) throw new Error("لم يُنتج العكسُ الأول")

    const twice = reverseEntry(store, CTX, posted.value.id, "سببٌ آخر")
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error.code).toBe("ALREADY_REVERSED")

    const ofReversal = reverseEntry(store, CTX, first.value.id, "سببٌ ثالث")
    expect(ofReversal.ok).toBe(false)
    if (!ofReversal.ok) expect(ofReversal.error.code).toBe("CANNOT_REVERSE_REVERSAL")

    const ghost = reverseEntry(store, CTX, "قيدٌ-لا-وجود-له", "سبب")
    expect(ghost.ok).toBe(false)
    if (!ghost.ok) expect(ghost.error.code).toBe("ENTRY_NOT_FOUND")
  })
})

describe("ب-٣٩د — القفلُ الزمنيّ والتأريخ المستقبليّ (§٢.٥)", () => {
  it("يرفض القيدَ الأقدم من نافذة القفل — والمدةُ **إعدادٌ حيّ** لا رقمٌ صلب", () => {
    const store = seedStore()
    const old = new Date(AT.getTime() - 15 * 24 * 60 * 60 * 1000)
    const r = postJournal(store, CTX, donation({ at: old }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("PERIOD_LOCKED")

    // نفسُ القيد يمرّ حين تُضبط النافذة أوسعَ من السجل — إثباتُ أن الرقم إعدادٌ لا ثابت.
    const wide = ledgerContext("u-finance", [
      {
        settingId: "records.backdate_lock_days",
        scopePath: "/",
        value: 60,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    expect(postJournal(seedStore(), wide, donation({ at: old })).ok).toBe(true)
  })

  it("ويرفض التأريخَ المستقبليّ ما دام مغلقاً في الإعدادات", () => {
    const store = seedStore()
    const future = new Date(AT.getTime() + 24 * 60 * 60 * 1000)
    const r = postJournal(store, CTX, donation({ at: future }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("FUTURE_DATING_REJECTED")
  })
})
