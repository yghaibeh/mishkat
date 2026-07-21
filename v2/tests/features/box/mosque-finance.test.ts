/**
 * ب-٩ — مالية المسجد الداخلية: **ق-٦٣ بلا طابور** و**ق-٣٠ خصوصيةُ مال المركز**.
 *
 * هنا الاختبارُ الإلزاميّ السابع (خصوصيةُ المركز عن الأمير)، ومعه إثباتُ الفرق الجوهريّ:
 * الأميرُ يقبض لمسجده **فيصير قيداً فوراً**، والمسؤولُ الماليُّ يقترح **فيصير فعلاً معلَّقاً**
 * — والفرقُ **قدرةٌ لا دور** (G6).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeBoxEndpoints } from "../../../src/features/box/server/endpoints.js"
import { makeLedgerEndpoints } from "../../../src/features/ledger/server/endpoints.js"
import { recordMosqueFinance } from "../../../src/features/box/services/mosqueFinance.js"
import { mosqueFinanceView } from "../../../src/features/box/services/boxViews.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { boxContext, c, canonicalActor, canonicalDirectory, DECISION, seedBoxStores, WRITE } from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const KHALID = "khalid"
const KHALID_PATH = "/men/homs/sq2/khalid/"

beforeEach(() => clearRegistryForTests())

describe("ق-٦٣ — الأميرُ يقبض لمسجده بنفسه **بلا طابور اعتماد**", () => {
  it("قبضُ الأمير ⇒ **قيدٌ في الدفتر فوراً** بسندٍ مرقّم، ولا فعلَ معلَّقٌ ينتظر بتّاً", () => {
    const stores = seedBoxStores()
    const done = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "received",
      unitId: KHALID,
      operationId: "mf-1",
      memoAr: "تبرعُ أهل الحيّ",
      lines: [{ currency: "USD", amount: c(8_000) }],
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(stores.ledger.entries()).toHaveLength(1)
    expect(stores.ledger.actions()).toHaveLength(0)
    expect(done.value.voucherNo).toMatch(/^R-/)
    expect(mosqueFinanceView(stores, KHALID_PATH).balances.get("USD")?.net).toBe(8_000)
  })

  it("**وبالمقابل**: المسؤولُ الماليُّ يقترح فيُنتج **فعلاً معلَّقاً بلا قيد** (ق-٥٣)", async () => {
    const stores = seedBoxStores()
    const ledgerEp = makeLedgerEndpoints(stores.ledger, SETTINGS)
    const proposed = await ledgerEp.proposeOperation.invoke(
      {
        operation: {
          verb: "received",
          unitId: KHALID,
          currency: "USD",
          amount: c(8_000),
          memoAr: "قبضُ المسؤول المالي",
        },
      },
      canonicalActor("u-finance"),
      WRITE,
    )
    expect(proposed.ok).toBe(true)
    expect(stores.ledger.actions()).toHaveLength(1)
    expect(stores.ledger.entries()).toHaveLength(0)
  })

  it("وصرفُ الأمير المحلّيُّ مباشرٌ كذلك — بفئةٍ من القاموس المغلق (ق-٦٤)", () => {
    const stores = seedBoxStores()
    recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "received",
      unitId: KHALID,
      operationId: "mf-2",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(5_000) }],
    })
    const spent = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "paid",
      unitId: KHALID,
      operationId: "mf-3",
      memoAr: "صرفتُ محروقات",
      categoryId: "fuel",
      currency: "USD",
      amount: c(1_500),
    })
    expect(spent.ok).toBe(true)
    expect(mosqueFinanceView(stores, KHALID_PATH).flow.get("USD")).toEqual({
      incoming: 5_000,
      outgoing: 1_500,
      net: 3_500,
    })
  })

  it("**والفئةُ المجهولة تُرفض هنا أيضاً** — بابُ المسجد ليس بابَ التفاف على ق-٦٤", () => {
    const stores = seedBoxStores()
    const spent = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "paid",
      unitId: KHALID,
      operationId: "mf-4",
      memoAr: "صرفٌ بفئةٍ مخترعة",
      categoryId: "مخترعة",
      currency: "USD",
      amount: c(100),
    })
    expect(spent.ok).toBe(false)
    if (spent.ok) return
    expect(spent.error.code).toBe("UNKNOWN_CATEGORY")
  })

  it("**والمقيَّدُ شرعاً يبقى محروساً في مالية المسجد** (ق-٥٥ لا يُلتفّ عليه بالباب المحلّي)", () => {
    const stores = seedBoxStores()
    const spent = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "paid",
      unitId: KHALID,
      operationId: "mf-5",
      memoAr: "صرفٌ من زكاةٍ لا رصيدَ لها",
      categoryId: "fuel",
      currency: "USD",
      amount: c(100),
      fundId: "zakat",
    })
    expect(spent.ok).toBe(false)
    if (spent.ok) return
    expect(spent.error.code).toBe("RESTRICTED_FUND_OVERSPEND")
  })
})

describe("ق-٣٠ — خصوصيةُ المالية المركزية عن الأمير", () => {
  it("**الأميرُ يستدعي عرضَ مالية المركز مباشرةً ⇒ مرفوض** (لا يملك `finance.view`)", async () => {
    const stores = seedBoxStores()
    const ledgerEp = makeLedgerEndpoints(stores.ledger, SETTINGS)
    const balances = await ledgerEp.balances.invoke({ unitId: "root" }, canonicalActor("u-amir"), DECISION)
    const entries = await ledgerEp.entries.invoke({ unitId: "root" }, canonicalActor("u-amir"), DECISION)
    expect(balances.ok).toBe(false)
    expect(entries.ok).toBe(false)
    if (balances.ok) return
    expect(balances.decision.reason).toBe("DENIED_NO_CAPABILITY")
  })

  it("**ولا يستدعيها على مسجده هو** — القدرةُ غائبةٌ عنه لا النطاق", async () => {
    const stores = seedBoxStores()
    const ledgerEp = makeLedgerEndpoints(stores.ledger, SETTINGS)
    const r = await ledgerEp.balances.invoke({ unitId: KHALID }, canonicalActor("u-amir"), DECISION)
    expect(r.ok).toBe(false)
  })

  it("**وبابُه هو** مالية مسجده: يفتحها ويرى رصيدَه وإجمالياته", async () => {
    const stores = seedBoxStores()
    const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
    recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "received",
      unitId: KHALID,
      operationId: "mf-6",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(2_000) }],
    })
    const r = await ep.mosqueFinanceView.invoke({ unitId: KHALID }, canonicalActor("u-amir"), DECISION)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.balances.get("USD")?.net).toBe(2_000)
  })

  it("**والمسؤولُ الماليُّ لا يسجّل في مالية المسجد** — `mosqueFinance.manage` ليست له", async () => {
    const stores = seedBoxStores()
    const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
    const r = await ep.mosqueFinanceRecord.invoke(
      {
        verb: "received",
        unitId: KHALID,
        operationId: "mf-7",
        memoAr: "قبض",
        lines: [{ currency: "USD", amount: c(10) }],
      },
      canonicalActor("u-finance"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**ولا مشرفُ المربع** — `mosqueFinance.manage` نطاقُها «ذ» على المسجد بعينه", async () => {
    const stores = seedBoxStores()
    const ep = makeBoxEndpoints(stores, SETTINGS, canonicalDirectory)
    const r = await ep.mosqueFinanceRecord.invoke(
      {
        verb: "received",
        unitId: KHALID,
        operationId: "mf-8",
        memoAr: "قبض",
        lines: [{ currency: "USD", amount: c(10) }],
      },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})
