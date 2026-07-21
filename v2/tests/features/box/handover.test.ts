/**
 * ق-٦١ — التسليمُ النازل: **عمليةٌ واحدةٌ بقيدٍ واحد** + **إقرارُ المستلِم وحده** (خ-٧).
 *
 * السلبُ أكثرُ من الإيجاب: الصعودُ العكسيّ · الوحدةُ الغريبة · التسليمُ للنفس · المستلِمُ
 * الذي ليس أميناً · المقرُّ الذي ليس المستلِم · الإقرارُ مرتين.
 */
import { describe, it, expect } from "vitest"
import {
  acknowledgeHandover,
  handoverDown,
  handoverAmount,
  pendingHandoversFor,
} from "../../../src/features/box/services/handover.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"
import { ownBoxBalances } from "../../../src/features/box/services/boxBalances.js"
import { boxContext, c, seedBoxStores } from "./_seed.js"

const SQ2 = "sq2"
const SQ2_PATH = "/men/homs/sq2/"
const KHALID_PATH = "/men/homs/sq2/khalid/"
const CTX = () => boxContext("u-square")

function seedWithCash() {
  const stores = seedBoxStores()
  const received = receiveIntoBox(stores, CTX(), {
    unitId: SQ2,
    operationId: "rcv-sq2",
    memoAr: "قبضتُ لصندوق المربع",
    lines: [{ currency: "USD", amount: c(50_000) }],
  })
  if (!received.ok) throw new Error(received.error.code)
  return stores
}

describe("ق-٦١ — التسليمُ عمليةٌ واحدةٌ بقيدٍ واحد: **لا مالَ معلّقٌ بين طرفين**", () => {
  it("تسليمٌ نازل ⇒ **قيدٌ واحدٌ** ينقص المصدرَ ويزيد الوجهةَ في اللحظة نفسِها", () => {
    const stores = seedWithCash()
    const before = stores.ledger.entries().length
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "khalid",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-1",
      memoAr: "سلّمتُ لمسجد خالد",
      currency: "USD",
      amount: c(20_000),
    })
    if (!done.ok) throw new Error(done.error.code)

    expect(stores.ledger.entries().length - before).toBe(1)
    expect(stores.ledger.linesOf(done.value.posting.entryId)).toHaveLength(2)
    expect(ownBoxBalances(stores.ledger, SQ2_PATH).get("USD")?.net).toBe(30_000)
    expect(ownBoxBalances(stores.ledger, KHALID_PATH).get("USD")?.net).toBe(20_000)
  })

  it("والمبلغُ **يُقرأ من القيد** لا من سجلّ التسليم — لا نسخةَ مالٍ خارج الدفتر (ق-٦٠)", () => {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "khalid",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-2",
      memoAr: "سلّمتُ",
      currency: "USD",
      amount: c(7_000),
    })
    if (!done.ok) throw new Error(done.error.code)
    const amounts = handoverAmount(stores.ledger, done.value.handover)
    expect(amounts.get("USD")).toBe(7_000)
    expect(Object.keys(done.value.handover)).not.toContain("amount")
  })

  it("**الصعودُ العكسيّ مرفوض**: المسجدُ لا يسلّم مربعَه ⇒ `NOT_DESCENDANT_UNIT` ولا قيد", () => {
    const stores = seedWithCash()
    const before = stores.ledger.entries().length
    const done = handoverDown(stores, boxContext("u-amir"), {
      fromUnitId: "khalid",
      toUnitId: SQ2,
      toCustodianPersonId: "u-square",
      operationId: "hnd-up",
      memoAr: "تسليمٌ صاعد",
      currency: "USD",
      amount: c(100),
    })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("NOT_DESCENDANT_UNIT")
    expect(stores.ledger.entries()).toHaveLength(before)
  })

  it("**والغريبةُ مرفوضة**: مربعٌ يسلّم مسجداً في مربعٍ آخر ⇒ `NOT_DESCENDANT_UNIT`", () => {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "omar",
      toCustodianPersonId: "u-amir-omar",
      operationId: "hnd-alien",
      memoAr: "تسليمٌ لوحدةٍ غريبة",
      currency: "USD",
      amount: c(100),
    })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("NOT_DESCENDANT_UNIT")
  })

  it("**والتسليمُ للوحدة نفسِها مرفوض** ⇒ `SAME_UNIT_HANDOVER` (لا دورةٌ في محلّها)", () => {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: SQ2,
      toCustodianPersonId: "u-square",
      operationId: "hnd-self",
      memoAr: "تسليمٌ لنفس الوحدة",
      currency: "USD",
      amount: c(100),
    })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("SAME_UNIT_HANDOVER")
  })

  it("**ومستلِمٌ ليس أميناً للوجهة مرفوض** ⇒ `NOT_RECEIVING_CUSTODIAN` (ق-٥٩ بالقدرة لا بالدور)", () => {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "khalid",
      // معلّمُ حلقةٍ في المسجد: صاحبُ تكليفٍ **وليس أميناً** — هذا عينُ ثغرة v1.
      toCustodianPersonId: "u-teacher",
      operationId: "hnd-teacher",
      memoAr: "تسليمٌ لغير أمين",
      currency: "USD",
      amount: c(100),
    })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("NOT_RECEIVING_CUSTODIAN")
    expect(stores.box.handovers()).toHaveLength(0)
  })

  it("**والذرّيةُ عابرةٌ للمستودعين**: تسليمٌ يفشل في الدفتر ⇒ لا سجلَّ تسليمٍ يبقى", () => {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "khalid",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-bad-currency",
      memoAr: "تسليمٌ بعملةٍ غير مسموحة",
      currency: "EUR",
      amount: c(100),
    })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("CURRENCY_NOT_ENABLED")
    expect(stores.box.handovers()).toHaveLength(0)
  })
})

describe("خ-٧ — الإقرارُ للأمين المستلِم وحده (قدرةٌ شخصية §١.١)", () => {
  function seedHandover() {
    const stores = seedWithCash()
    const done = handoverDown(stores, CTX(), {
      fromUnitId: SQ2,
      toUnitId: "khalid",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-ack",
      memoAr: "سلّمتُ لمسجد خالد",
      currency: "USD",
      amount: c(9_000),
    })
    if (!done.ok) throw new Error(done.error.code)
    return { stores, handoverId: done.value.handover.id }
  }

  it("الأمينُ المستلِم يقرّ ⇒ يُوثَّق باسمه ووقته (توثيقُ البصمتين)", () => {
    const { stores, handoverId } = seedHandover()
    const acked = acknowledgeHandover(stores, boxContext("u-amir"), {
      handoverId,
      personId: "u-amir",
    })
    if (!acked.ok) throw new Error(acked.error.code)
    expect(acked.value.acknowledgedBy).toBe("u-amir")
    expect(acked.value.acknowledgedAt).not.toBeNull()
  })

  it("**والمديرُ لا يقرّ عن الأمين** ⇒ `NOT_RECEIVING_CUSTODIAN` (ولو ملك كلَّ شيءٍ آخر)", () => {
    const { stores, handoverId } = seedHandover()
    const acked = acknowledgeHandover(stores, boxContext("u-admin"), {
      handoverId,
      personId: "u-admin",
    })
    expect(acked.ok).toBe(false)
    if (acked.ok) return
    expect(acked.error.code).toBe("NOT_RECEIVING_CUSTODIAN")
    expect(stores.box.getHandover(handoverId)?.acknowledgedBy).toBeNull()
  })

  it("**وأميرٌ آخرُ لا يقرّ** عن أمير المسجد المستلِم", () => {
    const { stores, handoverId } = seedHandover()
    const acked = acknowledgeHandover(stores, boxContext("u-amir-bilal"), {
      handoverId,
      personId: "u-amir-bilal",
    })
    expect(acked.ok).toBe(false)
  })

  it("**ومانحُ التسليم لا يقرّ استلامَ نفسِه** — البصمتان لشخصين لا لشخص", () => {
    const { stores, handoverId } = seedHandover()
    const acked = acknowledgeHandover(stores, CTX(), { handoverId, personId: "u-square" })
    expect(acked.ok).toBe(false)
    if (acked.ok) return
    expect(acked.error.code).toBe("NOT_RECEIVING_CUSTODIAN")
  })

  it("**ولا إقرارَ مرتين** ⇒ `ALREADY_ACKNOWLEDGED` (والأولُ يبقى كما هو)", () => {
    const { stores, handoverId } = seedHandover()
    acknowledgeHandover(stores, boxContext("u-amir"), { handoverId, personId: "u-amir" })
    const again = acknowledgeHandover(stores, boxContext("u-amir"), {
      handoverId,
      personId: "u-amir",
    })
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.error.code).toBe("ALREADY_ACKNOWLEDGED")
  })

  it("وتسليمٌ مجهول ⇒ `HANDOVER_NOT_FOUND` — الغائبُ يُقفل ولا يُفتح", () => {
    const { stores } = seedHandover()
    const acked = acknowledgeHandover(stores, boxContext("u-amir"), {
      handoverId: "لا-تسليم",
      personId: "u-amir",
    })
    expect(acked.ok).toBe(false)
    if (acked.ok) return
    expect(acked.error.code).toBe("HANDOVER_NOT_FOUND")
  })

  it("«ما ينتظر إقراري» يخصّ صاحبَه: الأمينُ يرى تسليمَه، وغيرُه لا يرى شيئاً", () => {
    const { stores } = seedHandover()
    expect(pendingHandoversFor(stores.box, "u-amir")).toHaveLength(1)
    expect(pendingHandoversFor(stores.box, "u-admin")).toHaveLength(0)
    expect(pendingHandoversFor(stores.box, "u-square")).toHaveLength(0)
  })

  it("**والمالُ لا ينتظر الإقرار**: رصيدُ الوجهة كامِلٌ قبل الإقرار وبعده سواء (ق-٦١)", () => {
    const { stores, handoverId } = seedHandover()
    const beforeAck = ownBoxBalances(stores.ledger, KHALID_PATH).get("USD")?.net
    acknowledgeHandover(stores, boxContext("u-amir"), { handoverId, personId: "u-amir" })
    const afterAck = ownBoxBalances(stores.ledger, KHALID_PATH).get("USD")?.net
    expect(beforeAck).toBe(9_000)
    expect(afterAck).toBe(9_000)
  })
})
