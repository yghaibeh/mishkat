/**
 * بلاغاتُ الميدان الثلاثة — لكلٍّ **اختبارٌ يثبت موتَ سببه** (`inventory/D_symptoms.md`).
 *
 * جذرُها المشترك **ج٥: انفصامُ الكتابة عن القراءة** — تُكتب في موضعٍ وتقرأ الشاشةُ من غيره.
 * والعلاجُ بنيويّ لا تجميليّ: **مصدرٌ واحد (الدفتر) تُشتق منه كل أرقام الصفحة** (ق-١١١).
 * ولذلك تُكتب هذه الاختباراتُ بصيغة **«أضِف ثم لاحِظ الظهور في كل موضعٍ يعرضه»**.
 */
import { describe, it, expect } from "vitest"
import { receiveIntoBox, spendFromBox } from "../../../src/features/box/services/operations.js"
import { handoverDown } from "../../../src/features/box/services/handover.js"
import { unitBoxView } from "../../../src/features/box/services/boxViews.js"
import { boxContext, c, seedBoxStores } from "./_seed.js"

const KHALID = "khalid"
const KHALID_PATH = "/men/homs/sq2/khalid/"
const SQ2_PATH = "/men/homs/sq2/"
const AMIR = () => boxContext("u-amir")
const SQUARE = () => boxContext("u-square")

describe("ع-١٣ — «أدخلتُ وارداً فظهر في الأعلى ولم يظهر في الأسفل»", () => {
  it("**أضِف وارداً** ⇒ يظهر في الرصيد وفي الصناديق الثلاثة وفي الحركات — من مصدرٍ واحد", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "rcv-13",
      memoAr: "واردٌ لم يُصرف بعد",
      lines: [{ currency: "USD", amount: c(6_500) }],
    })

    const view = unitBoxView(stores, KHALID_PATH)
    // الأعلى: الرصيد.
    expect(view.own.get("USD")?.net).toBe(6_500)
    // والوسط: الصناديق الثلاثة (الوارد بعينه).
    expect(view.flow.get("USD")).toEqual({ incoming: 6_500, outgoing: 0, net: 6_500 })
    // والأسفل: الحركات — **الظهورُ في الثلاثة أو لا ظهورَ أصلاً**.
    expect(view.movements).toHaveLength(1)
    expect(view.movements[0]).toMatchObject({ direction: "in", amount: 6_500, currency: "USD" })
  })

  it("**والوارد الذي لم يُصرف يبقى ظاهراً**: لا شيءَ يُخفيه بعد قراءةٍ أخرى", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "rcv-13b",
      memoAr: "واردٌ",
      lines: [{ currency: "USD", amount: c(1_000) }],
    })
    const first = unitBoxView(stores, KHALID_PATH)
    const second = unitBoxView(stores, KHALID_PATH)
    expect(second.own.get("USD")?.net).toBe(first.own.get("USD")?.net)
    expect(second.movements).toHaveLength(first.movements.length)
  })
})

describe("ع-١٤ — «يظهر المبلغ ثم تفصيله؛ والصادرُ والواردُ في الصناديق الثلاثة»", () => {
  it("**أضِف وارداً وصادراً** ⇒ الصناديقُ الثلاثة تطابق تفصيلَ الحركات قرشاً بقرش", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "rcv-14",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(9_000) }],
    })
    spendFromBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "spd-14",
      memoAr: "صرفتُ نقليات",
      categoryId: "transport",
      currency: "USD",
      amount: c(2_000),
    })

    const view = unitBoxView(stores, KHALID_PATH)
    const flow = view.flow.get("USD")
    expect(flow).toEqual({ incoming: 9_000, outgoing: 2_000, net: 7_000 })

    // «المبلغُ ثم تفصيلُه»: مجموعُ الحركات = الصناديق الثلاثة، لأن المصدرَ واحد.
    const movedIn = view.movements
      .filter((m) => m.direction === "in" && m.currency === "USD")
      .reduce((a, m) => a + m.amount, 0)
    const movedOut = view.movements
      .filter((m) => m.direction === "out" && m.currency === "USD")
      .reduce((a, m) => a + m.amount, 0)
    expect(movedIn).toBe(flow?.incoming)
    expect(movedOut).toBe(flow?.outgoing)
    expect(movedIn - movedOut).toBe(flow?.net)
  })

  it("ولكل عملةٍ صناديقُها الثلاثة — لا خلطَ ولا رقمَ مجموع (ق-٦٢)", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "rcv-14c",
      memoAr: "قبضتُ بعملتين",
      lines: [
        { currency: "USD", amount: c(3_000) },
        { currency: "SYP", amount: c(400_000) },
      ],
    })
    const view = unitBoxView(stores, KHALID_PATH)
    expect(view.flow.get("USD")?.net).toBe(3_000)
    expect(view.flow.get("SYP")?.net).toBe(400_000)
    expect(view.flow.size).toBe(2)
  })
})

describe("ع-٢٤ — «لا يظهر شيء في الصناديق السُّفلية»", () => {
  it("**سلّم نازلاً** ⇒ يظهر فوراً في صندوق الوحدة الابنة داخل عرض الأب", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, SQUARE(), {
      unitId: "sq2",
      operationId: "rcv-24",
      memoAr: "قبضتُ لصندوق المربع",
      lines: [{ currency: "USD", amount: c(40_000) }],
    })
    const done = handoverDown(stores, SQUARE(), {
      fromUnitId: "sq2",
      toUnitId: KHALID,
      toCustodianPersonId: "u-amir",
      operationId: "hnd-24",
      memoAr: "سلّمتُ نازلاً",
      currency: "USD",
      amount: c(15_000),
    })
    expect(done.ok).toBe(true)

    const parent = unitBoxView(stores, SQ2_PATH)
    const child = parent.children.find((ch) => ch.unitId === KHALID)
    expect(child?.balances.get("USD")?.net).toBe(15_000)
    // ورصيدُ المربع بذاته نقص بنفس القدر — الطرفان في قيدٍ واحد.
    expect(parent.own.get("USD")?.net).toBe(25_000)
    // والتجميعُ الهابط لم يتغيّر: المالُ ما زال داخل شجرته.
    expect(parent.subtree.get("USD")?.net).toBe(40_000)
  })

  it("**والوحدةُ التي لا حركةَ لها تظهر بصفرها** ولا تختفي (ق-١١٢: الفراغُ يُشخَّص)", () => {
    const stores = seedBoxStores()
    const parent = unitBoxView(stores, SQ2_PATH)
    expect(parent.children.map((ch) => ch.unitId).sort()).toEqual(["bilal", "khalid"])
    expect(parent.children.every((ch) => ch.balances.size === 0)).toBe(true)
  })

  it("وقبضُ المسجد يظهر في **صندوق مسجده وفي الصناديق السُّفلية عند مربعه** معاً", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, AMIR(), {
      unitId: KHALID,
      operationId: "rcv-24b",
      memoAr: "قبضتُ في المسجد",
      lines: [{ currency: "USD", amount: c(2_500) }],
    })
    expect(unitBoxView(stores, KHALID_PATH).own.get("USD")?.net).toBe(2_500)
    expect(
      unitBoxView(stores, SQ2_PATH).children.find((ch) => ch.unitId === KHALID)?.balances.get("USD")
        ?.net,
    ).toBe(2_500)
  })
})
