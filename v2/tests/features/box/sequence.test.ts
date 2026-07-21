/**
 * ق-٥٦ — **السندُ بلا فجوات على مسار الصندوق** (الاختبارُ الإلزاميّ التاسع).
 *
 * النواةُ تضمن التسلسل؛ وهذا الاختبار يثبت أن **مسارَ الصندوق لا يثقبه**: عملياتٌ متزامنةٌ
 * ناجحةٌ وفاشلةٌ متشابكة (قبضٌ وصرفٌ وتسليم) ⇒ الأرقامُ ١…ن بلا فجوةٍ ولا تكرار.
 */
import { describe, it, expect } from "vitest"
import { receiveIntoBox, spendFromBox } from "../../../src/features/box/services/operations.js"
import { handoverDown } from "../../../src/features/box/services/handover.js"
import { boxContext, c, seedBoxStores } from "./_seed.js"

const SQ2 = "sq2"
const CTX = () => boxContext("u-square")

describe("ق-٥٦ — التسلسلُ بلا فجوات عبر عملياتٍ متزامنة", () => {
  it("بعد ن عمليةِ قبضٍ ناجحة: الأرقامُ ١…ن بلا فجوةٍ ولا تكرار", () => {
    const stores = seedBoxStores()
    const n = 20
    for (let i = 1; i <= n; i += 1) {
      const r = receiveIntoBox(stores, CTX(), {
        unitId: SQ2,
        operationId: `rcv-${i}`,
        memoAr: "قبضتُ",
        lines: [{ currency: "USD", amount: c(100) }],
      })
      expect(r.ok).toBe(true)
    }
    const seqs = stores.ledger.entries().map((e) => e.voucherSeq)
    expect(seqs).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    expect(new Set(seqs).size).toBe(n)
  })

  it("**والعملياتُ الفاشلةُ لا تحرق رقماً**: فئةٌ مجهولةٌ وعملةٌ ممنوعةٌ وتسليمٌ صاعد", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: SQ2,
      operationId: "ok-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(1_000) }],
    })
    for (let i = 0; i < 5; i += 1) {
      expect(
        spendFromBox(stores, CTX(), {
          unitId: SQ2,
          operationId: `bad-cat-${i}`,
          memoAr: "صرفٌ بفئةٍ مجهولة",
          categoryId: "لا-فئة",
          currency: "USD",
          amount: c(10),
        }).ok,
      ).toBe(false)
      expect(
        receiveIntoBox(stores, CTX(), {
          unitId: SQ2,
          operationId: `bad-cur-${i}`,
          memoAr: "قبضٌ بعملةٍ ممنوعة",
          lines: [{ currency: "EUR", amount: c(10) }],
        }).ok,
      ).toBe(false)
      expect(
        handoverDown(stores, boxContext("u-amir"), {
          fromUnitId: "khalid",
          toUnitId: SQ2,
          toCustodianPersonId: "u-square",
          operationId: `bad-up-${i}`,
          memoAr: "تسليمٌ صاعد",
          currency: "USD",
          amount: c(10),
        }).ok,
      ).toBe(false)
    }
    receiveIntoBox(stores, CTX(), {
      unitId: SQ2,
      operationId: "ok-2",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(1_000) }],
    })
    expect(stores.ledger.entries().map((e) => e.voucherSeq)).toEqual([1, 2])
  })

  it("**وتحت تشابكٍ**: أربعون عمليةً مختلطةً متزامنة ⇒ تسلسلٌ متّصلٌ بلا تكرار", async () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: SQ2,
      operationId: "seed-cash",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(100_000) }],
    })
    const jobs: Promise<boolean>[] = []
    for (let i = 0; i < 20; i += 1) {
      jobs.push(
        Promise.resolve().then(
          () =>
            receiveIntoBox(stores, CTX(), {
              unitId: SQ2,
              operationId: `p-rcv-${i}`,
              memoAr: "قبضتُ",
              lines: [{ currency: "USD", amount: c(100) }],
            }).ok,
        ),
      )
      jobs.push(
        Promise.resolve().then(
          () =>
            handoverDown(stores, CTX(), {
              fromUnitId: SQ2,
              toUnitId: "khalid",
              toCustodianPersonId: "u-amir",
              operationId: `p-hnd-${i}`,
              memoAr: "سلّمتُ",
              currency: "USD",
              amount: c(100),
            }).ok,
        ),
      )
    }
    const results = await Promise.all(jobs)
    expect(results.every(Boolean)).toBe(true)

    const seqs = stores.ledger.entries().map((e) => e.voucherSeq).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: seqs.length }, (_, i) => i + 1))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})
