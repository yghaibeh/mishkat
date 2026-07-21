/**
 * القبضُ والصرف — ق-٦٢ (تعدد العملات) · ق-٥٦ (السند) · ق-٦٤ (القاموس المغلق) · ق-٥٥ (المقيَّد).
 *
 * **السلبُ أكثرُ من الإيجاب**: كلُّ قاعدةٍ تُختبر بخرقها قبل امتثالها.
 */
import { describe, it, expect } from "vitest"
import { receiveIntoBox, spendFromBox } from "../../../src/features/box/services/operations.js"
import { ownBoxBalances } from "../../../src/features/box/services/boxBalances.js"
import { spendCategories } from "../../../src/features/box/services/categories.js"
import { boxContext, c, seedBoxStores } from "./_seed.js"

const KHALID = "khalid"
const CTX = () => boxContext("u-amir")

describe("ق-٦٢ — القبضُ متعدد العملات في عمليةٍ واحدة، والأرصدة **منفصلةٌ بالعملات**", () => {
  it("قبضٌ بثلاث عملاتٍ في عمليةٍ واحدة ⇒ ثلاثةُ أرصدةٍ منفصلة لا رقمٌ مجموع", () => {
    const stores = seedBoxStores()
    const posted = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-1",
      memoAr: "قبضتُ تبرعاً بثلاث عملات",
      lines: [
        { currency: "USD", amount: c(30_000) },
        { currency: "SYP", amount: c(500_000) },
        { currency: "TRY", amount: c(12_000) },
      ],
    })
    if (!posted.ok) throw new Error(`تعذّر القبض: ${posted.error.code}`)

    const balances = ownBoxBalances(stores.ledger, "/men/homs/sq2/khalid/")
    expect([...balances.keys()].sort()).toEqual(["SYP", "TRY", "USD"])
    expect(balances.get("USD")?.net).toBe(30_000)
    expect(balances.get("SYP")?.net).toBe(500_000)
    expect(balances.get("TRY")?.net).toBe(12_000)
    // **ولا رقمَ مجموع**: لا مفتاحَ يجمع العملات في هذه الخريطة أصلاً.
    expect(balances.size).toBe(3)
  })

  it("والقيدُ **واحدٌ** لا ثلاثة — عمليةٌ واحدةٌ بسندٍ واحدٍ مرقّم (ق-٥٦)", () => {
    const stores = seedBoxStores()
    const posted = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [
        { currency: "USD", amount: c(1_000) },
        { currency: "SYP", amount: c(2_000) },
      ],
    })
    if (!posted.ok) throw new Error(posted.error.code)
    expect(stores.ledger.entries()).toHaveLength(1)
    expect(posted.value.voucherNo).toMatch(/^R-0*1$/)
    expect(stores.ledger.linesOf(posted.value.entryId)).toHaveLength(4)
  })

  it("قبضٌ بلا أسطر ⇒ مرفوض `NO_OPERATION_LINES` — لا عمليةَ فارغة", () => {
    const stores = seedBoxStores()
    const posted = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-empty",
      memoAr: "قبضٌ فارغ",
      lines: [],
    })
    expect(posted.ok).toBe(false)
    if (posted.ok) return
    expect(posted.error.code).toBe("NO_OPERATION_LINES")
    expect(stores.ledger.entries()).toHaveLength(0)
  })

  it("قبضٌ بعملةٍ غير مسموحة ⇒ مرفوضٌ من حارس النواة (`CURRENCY_NOT_ENABLED`)", () => {
    const stores = seedBoxStores()
    const posted = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-eur",
      memoAr: "قبضٌ بعملةٍ غريبة",
      lines: [{ currency: "EUR", amount: c(100) }],
    })
    expect(posted.ok).toBe(false)
    if (posted.ok) return
    expect(posted.error.code).toBe("CURRENCY_NOT_ENABLED")
  })

  it("قبضٌ لوحدةٍ مجهولة ⇒ مرفوض ولا يُكتب شيء", () => {
    const stores = seedBoxStores()
    const posted = receiveIntoBox(stores, CTX(), {
      unitId: "لا-وحدة",
      operationId: "rcv-x",
      memoAr: "قبض",
      lines: [{ currency: "USD", amount: c(100) }],
    })
    expect(posted.ok).toBe(false)
    expect(stores.ledger.entries()).toHaveLength(0)
  })
})

describe("ق-٦٤ — فئاتُ الصرف قاموسٌ مغلقٌ مركزيّ **من البيانات لا من الكود**", () => {
  it("فئةٌ خارج القاموس ⇒ **مرفوضة** `UNKNOWN_CATEGORY` ولا قيد", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(10_000) }],
    })
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-1",
      memoAr: "صرفٌ بفئةٍ مخترعة",
      categoryId: "فئةٌ-مخترعة",
      currency: "USD",
      amount: c(1_000),
    })
    expect(spent.ok).toBe(false)
    if (spent.ok) return
    expect(spent.error.code).toBe("UNKNOWN_CATEGORY")
    expect(stores.ledger.entries()).toHaveLength(1)
  })

  it("وفئةٌ أُوقفت في المرجع ⇒ **مرفوضة** `CATEGORY_INACTIVE` (الإيقافُ بيانٌ لا حذف)", () => {
    const stores = seedBoxStores()
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-2",
      memoAr: "صرفٌ بفئةٍ موقوفة",
      categoryId: "retired",
      currency: "USD",
      amount: c(100),
    })
    expect(spent.ok).toBe(false)
    if (spent.ok) return
    expect(spent.error.code).toBe("CATEGORY_INACTIVE")
  })

  it("**القاموسُ بياناتٌ**: فئةٌ تُضاف إلى المرجع تصير مقبولةً بلا تغيير سطرِ كود (قب-٦/G14)", () => {
    const stores = seedBoxStores()
    const before = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-3",
      memoAr: "صرفٌ بفئةٍ لم تُسجَّل بعد",
      categoryId: "maintenance",
      currency: "USD",
      amount: c(500),
    })
    expect(before.ok).toBe(false)

    stores.ledger.saveAccount({
      tenantId: stores.ledger.tenantId,
      id: "expense.maintenance",
      ar: "مصروفُ صيانة",
      kind: "expense",
    })
    stores.box.saveCategory({
      tenantId: stores.box.tenantId,
      id: "maintenance",
      ar: "صيانة",
      accountId: "expense.maintenance",
      active: true,
    })

    const after = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-4",
      memoAr: "صرفٌ بالفئة بعد تسجيلها",
      categoryId: "maintenance",
      currency: "USD",
      amount: c(500),
    })
    expect(after.ok).toBe(true)
    expect(spendCategories(stores.box).map((x) => x.id)).toContain("maintenance")
  })

  it("والقاموسُ المعروضُ **الفعّالُ وحده** — الموقوفةُ لا تُعرض ولا تُحذف", () => {
    const stores = seedBoxStores()
    const ids = spendCategories(stores.box).map((x) => x.id)
    expect(ids).toContain("fuel")
    expect(ids).not.toContain("retired")
    expect(stores.box.getCategory("retired")).not.toBeNull()
  })

  it("الصرفُ بفئةٍ صحيحة ⇒ قيدٌ متوازنٌ على حساب الفئة، والرصيدُ ينقص", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(10_000) }],
    })
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-5",
      memoAr: "صرفتُ محروقات",
      categoryId: "fuel",
      currency: "USD",
      amount: c(2_500),
    })
    if (!spent.ok) throw new Error(spent.error.code)
    const lines = stores.ledger.linesOf(spent.value.entryId)
    expect(lines.map((l) => l.accountId).sort()).toEqual(["cash", "expense.fuel"])
    expect(ownBoxBalances(stores.ledger, "/men/homs/sq2/khalid/").get("USD")?.net).toBe(7_500)
  })
})

describe("ق-٥٥ — المقيَّدُ شرعاً لا يُصرف فوق رصيده، والحرُّ لا يُقيَّد", () => {
  it("صرفٌ من الزكاة فوق رصيدها ⇒ **منعٌ قاطع** `RESTRICTED_FUND_OVERSPEND`", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-zakat",
      memoAr: "قبضتُ زكاةً",
      lines: [{ currency: "USD", amount: c(10_000), fundId: "zakat" }],
    })
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-zakat",
      memoAr: "صرفٌ من الزكاة فوق رصيدها",
      categoryId: "fuel",
      currency: "USD",
      amount: c(30_000),
      fundId: "zakat",
    })
    expect(spent.ok).toBe(false)
    if (spent.ok) return
    expect(spent.error.code).toBe("RESTRICTED_FUND_OVERSPEND")
    // ولا أثرَ في الدفتر: القيدُ الوحيد هو القبض.
    expect(stores.ledger.entries()).toHaveLength(1)
  })

  it("والصرفُ من الصندوق الحرّ فوق رصيده **يمرّ** — الحرُّ لا يُقيَّد بالرصيد", () => {
    const stores = seedBoxStores()
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-free",
      memoAr: "صرفٌ من الحرّ",
      categoryId: "transport",
      currency: "USD",
      amount: c(9_000),
      fundId: "general",
    })
    expect(spent.ok).toBe(true)
  })

  it("والزكاةُ تُصرف **في حدود رصيدها** بلا اعتراض", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-zakat",
      memoAr: "قبضتُ زكاةً",
      lines: [{ currency: "USD", amount: c(10_000), fundId: "zakat" }],
    })
    const spent = spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-zakat-ok",
      memoAr: "صرفٌ من الزكاة في حدودها",
      categoryId: "fuel",
      currency: "USD",
      amount: c(4_000),
      fundId: "zakat",
    })
    expect(spent.ok).toBe(true)
  })
})

describe("ق-٥٠ — تكرارُ العملية نفسها لا يزدوج (المفتاحُ طبيعيٌّ من معرّف العملية)", () => {
  it("قبضٌ بنفس معرّف العملية مرتين ⇒ قيدٌ واحدٌ موسومٌ بالتكرار لا قيدان", () => {
    const stores = seedBoxStores()
    const first = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-dup",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(700) }],
    })
    const second = receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-dup",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(700) }],
    })
    if (!first.ok || !second.ok) throw new Error("تعذّر القبض")
    expect(second.value.duplicated).toBe(true)
    expect(second.value.entryId).toBe(first.value.entryId)
    expect(stores.ledger.entries()).toHaveLength(1)
    expect(ownBoxBalances(stores.ledger, "/men/homs/sq2/khalid/").get("USD")?.net).toBe(700)
  })
})
