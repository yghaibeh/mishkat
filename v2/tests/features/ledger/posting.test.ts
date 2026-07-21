/**
 * ق-٥٠ — الترحيل الآلي للأحداث: **idempotent · واعٍ بالعكس · غير حرج**
 * (`SPEC_finance_ledger` §٣). هنا الاختبار الإلزاميّ الثالث.
 */
import { describe, it, expect } from "vitest"
import { postJournal, balanceProof } from "../../../src/features/ledger/services/journal.js"
import {
  postEvent,
  postEventSafely,
  postingKeyOf,
  repostEvent,
  type LedgerEvent,
} from "../../../src/features/ledger/services/posting.js"
import { balancesByCurrency } from "../../../src/features/ledger/services/balances.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")

function donationEvent(amount = 10_000, sourceId = "d-77"): LedgerEvent {
  return {
    sourceType: "donation",
    sourceId,
    at: CTX.now,
    unitId: "khalid",
    memoAr: "تبرعُ محسنٍ للمسجد",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(amount) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(amount) },
    ],
  }
}

describe("ق-٥٠/١ — مفتاحُ التكرار الطبيعيّ معلَنٌ صراحةً (§٣.٢)", () => {
  it("المفتاحُ هو «النوع:المعرّف» — لا رقمٌ عشوائيٌّ ولا طابعٌ زمنيّ", () => {
    expect(postingKeyOf(donationEvent())).toBe("donation:d-77")
  })

  it("ويُرفض نوعُ مصدرٍ خارج الكتالوج المغلق", () => {
    const bad = { ...donationEvent(), sourceType: "هديّة" } as unknown as LedgerEvent
    const r = postEvent(seedStore(), CTX, bad)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_SOURCE_TYPE")
  })
})

describe("ق-٥٠/٢ — idempotency: تكرارُ الحدث ⇒ قيدٌ واحدٌ لا اثنان (الاختبار الإلزاميّ ٣)", () => {
  it("**ترحيلُ الحدث نفسه مرتين لا يزدوج** — ويعيد القيدَ القائم موسوماً بالتكرار", () => {
    const store = seedStore()
    const first = postEvent(store, CTX, donationEvent())
    const second = postEvent(store, CTX, donationEvent())
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.duplicated).toBe(false)
    expect(second.value.duplicated).toBe(true)
    expect(second.value.entry.id).toBe(first.value.entry.id)
    expect(store.entries()).toHaveLength(1)
    expect(store.lines()).toHaveLength(2)
    expect(balancesByCurrency(store, "/men/homs/sq2/khalid/").get("USD")?.net).toBe(0)
  })

  it("**والسباقُ الذي يفلت من الفحص المسبق يرتدّ ذرّياً** — الفرضُ في طبقة البيانات", () => {
    const store = seedStore()
    const input = {
      at: CTX.now,
      unitId: "khalid",
      memoAr: "تبرع",
      sourceType: "donation" as const,
      sourceId: "d-race",
      lines: donationEvent().lines,
    }
    expect(postJournal(store, CTX, input).ok).toBe(true)
    const race = postJournal(store, CTX, input)
    expect(race.ok).toBe(false)
    if (!race.ok) expect(race.error.code).toBe("DUPLICATE_POSTING_KEY")
    expect(store.entries(), "ازدوج القيدُ رغم وحدة المفتاح").toHaveLength(1)
    expect(store.lines(), "بقي سطرٌ يتيمٌ من المحاولة المرتدّة").toHaveLength(2)
  })

  it("وحدثان مختلفا المعرّف يُرحَّلان قيدين — التكرارُ لا يبتلع الجديد", () => {
    const store = seedStore()
    postEvent(store, CTX, donationEvent(10_000, "d-1"))
    postEvent(store, CTX, donationEvent(20_000, "d-2"))
    expect(store.entries()).toHaveLength(2)
  })
})

describe("ق-٥٠/٣ — الوعيُ بالعكس: التصحيحُ لا يُحجب بالمفتاح (§٣.٣)", () => {
  it("**العكسُ يُلغي الأثر صحيحاً**: الرصيدُ يعود صفراً والدفترُ متوازن", () => {
    const store = seedStore()
    const posted = postEvent(store, CTX, donationEvent())
    if (!posted.ok) throw new Error("لم يُرحَّل الحدث")
    const cash = () =>
      store
        .lines()
        .filter((l) => l.accountId === "cash")
        .reduce((n, l) => n + l.debit - l.credit, 0)
    expect(cash()).toBe(10_000)

    const reposted = repostEvent(store, CTX, donationEvent(7_500))
    expect(reposted.ok).toBe(true)
    // العكسُ ألغى العشرةَ آلاف، والجديدُ أثبت السبعةَ آلافٍ ونصفاً — لا تراكم.
    expect(cash()).toBe(7_500)
    expect(store.entries()).toHaveLength(3)
    expect(balanceProof(store).balanced).toBe(true)
  })

  it("وعكسُ الترحيل **يحرّر المفتاح** فيُقبل ترحيلٌ جديدٌ به لا تكراراً", () => {
    const store = seedStore()
    const posted = postEvent(store, CTX, donationEvent())
    if (!posted.ok) throw new Error("لم يُرحَّل الحدث")
    expect(store.activePostingEntryId("donation:d-77")).toBe(posted.value.entry.id)

    const again = repostEvent(store, CTX, donationEvent(5_000))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(store.activePostingEntryId("donation:d-77")).toBe(again.value.id)

    const third = postEvent(store, CTX, donationEvent(5_000))
    expect(third.ok).toBe(true)
    if (third.ok) expect(third.value.duplicated).toBe(true)
  })

  it("وإعادةُ ترحيلِ حدثٍ لم يُرحَّل أصلاً ترحّله ببساطة (لا عكسَ لِما لا وجود له)", () => {
    const store = seedStore()
    const r = repostEvent(store, CTX, donationEvent())
    expect(r.ok).toBe(true)
    expect(store.entries()).toHaveLength(1)
  })

  it("وإعادةُ الترحيل **ذرّية**: فشلُ الجديد لا يترك القديمَ معكوساً", () => {
    const store = seedStore()
    const posted = postEvent(store, CTX, donationEvent())
    if (!posted.ok) throw new Error("لم يُرحَّل الحدث")
    const broken: LedgerEvent = {
      ...donationEvent(9_000),
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(9_000) },
        { accountId: "حسابٌ-مجهول", unitId: "khalid", currency: "USD", side: "credit", amount: c(9_000) },
      ],
    }
    const r = repostEvent(store, CTX, broken)
    expect(r.ok).toBe(false)
    expect(store.entries(), "بقي أثرٌ من إعادة ترحيلٍ فاشلة").toHaveLength(1)
    expect(store.getEntry(posted.value.entry.id)?.reversedBy, "عُكس القديمُ ولم يُرحَّل الجديد").toBe(null)
  })
})

describe("ق-٥٠/٤ — غيرُ حرج: فشلُ الترحيل لا يُسقط العملية الأصلية (§٣.٤)", () => {
  it("**لا يرمي أبداً** — يعيد فشلاً مصنَّفاً فيمضي الحدثُ الأصليّ في وحدته", () => {
    const store = seedStore()
    const broken: LedgerEvent = { ...donationEvent(), unitId: "وحدةٌ-لا-وجود-لها" }
    let threw = false
    let result: ReturnType<typeof postEventSafely> | null = null
    try {
      result = postEventSafely(store, CTX, broken)
    } catch {
      threw = true
    }
    expect(threw, "رمى الترحيلُ التابع فأسقط العملية الأصلية").toBe(false)
    expect(result?.posted).toBe(false)
    if (result !== null && !result.posted) expect(result.code).toBe("UNKNOWN_UNIT")
    expect(store.entries()).toHaveLength(0)
  })

  it("ويُدوَّن الفشلُ في سجل التدقيق — يُصلَّح الدفترُ لاحقاً ولا يُبتلع الخبر", () => {
    const store = seedStore()
    postEventSafely(store, CTX, { ...donationEvent(), unitId: "وحدةٌ-لا-وجود-لها" })
    const failures = store.audit().filter((a) => a.action === "ledger.post.failed")
    expect(failures).toHaveLength(1)
    expect(failures[0]?.reason).toBe("UNKNOWN_UNIT")
  })

  it("وردمُ الفشل لاحقاً **بنفس المفتاح** لا يزدوج (ق-٥٠ حرفياً)", () => {
    const store = seedStore()
    postEventSafely(store, CTX, { ...donationEvent(), unitId: "وحدةٌ-لا-وجود-لها" })
    const backfill = postEventSafely(store, CTX, donationEvent())
    expect(backfill.posted).toBe(true)
    expect(postEventSafely(store, CTX, donationEvent()).posted).toBe(true)
    expect(store.entries(), "ازدوج الردمُ بنفس المفتاح").toHaveLength(1)
  })
})
