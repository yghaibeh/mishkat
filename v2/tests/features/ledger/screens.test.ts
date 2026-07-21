/**
 * الشاشتان الدنيا للنواة — إثباتُ الحراسة لا واجهةٌ ماليةٌ كاملة (G20، قب-٨).
 * الشاشةُ **لا تقرر**: تستقبل قدراتٍ محسوبةً على الخادم وتعرض بها فقط (المادة ٤/٦).
 */
import { describe, it, expect } from "vitest"
import {
  approvalsScreen,
  ledgerScreen,
  LEDGER_CONTRACT,
  APPROVALS_CONTRACT,
} from "../../../src/features/ledger/screens/screens.js"
import { computeLedgerCaps, SCREEN_SURFACE_CAPS } from "../../../src/features/ledger/screens/caps.js"
import { validateContract } from "../../../src/ui/screens/contract.js"
import { postJournal } from "../../../src/features/ledger/services/journal.js"
import { proposeAction } from "../../../src/features/ledger/services/dualControl.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"
import type { DecisionContext } from "../../../src/authorization/can.js"
import { c, canonicalActor, ledgerContext, NOW, seedStore } from "./_seed.js"

const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const CTX = ledgerContext("u-finance")

function caps(...ids: CapId[]): ReadonlySet<CapId> {
  return new Set(ids)
}

function seedWithEntry() {
  const store = seedStore()
  postJournal(store, CTX, {
    at: NOW,
    unitId: "khalid",
    memoAr: "تبرع",
    sourceType: "donation",
    sourceId: "s-1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(1_200) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(1_200) },
    ],
  })
  return store
}

describe("عقدا الشاشتين (G20/١) — لا شاشةَ بلا عقدٍ صالح", () => {
  it("العقدان صالحان: مسارٌ وسطحٌ وعدساتٌ وموطنٌ ومصدرُ بياناتٍ واحدٌ وفراغان", () => {
    expect(validateContract(LEDGER_CONTRACT)).toEqual([])
    expect(validateContract(APPROVALS_CONTRACT)).toEqual([])
  })

  it("وموطنُ «المحاسبة المركزية» القانونيّ شاشةُ الدفتر وحدها (IA §١ ك-٢٧)", () => {
    expect(LEDGER_CONTRACT.canonicalHome).toEqual(["centralAccounting"])
    expect(APPROVALS_CONTRACT.canonicalHome).toEqual([])
  })

  it("والقدراتُ المستهلَكةُ أربعٌ لا خامسةَ لها — من الكتالوج لا مخترعة", () => {
    expect([...SCREEN_SURFACE_CAPS]).toEqual([
      "finance.view",
      "finance.entry",
      "ledger.journal.entry",
      "finance.supervise",
    ])
  })
})

describe("شاشةُ الدفتر — تعرض ما تملكه القدرةُ وحده", () => {
  it("بلا `finance.view` لا تُفتح أصلاً — فراغٌ مُشخِّصٌ لا شاشةٌ بيضاء (ق-١١٢)", () => {
    expect(ledgerScreen(caps(), seedWithEntry(), "/men/homs/sq2/khalid/", CTX).kind).toBe("denied")
  })

  it("وبـ`finance.view` وحدها: يرى الأرصدةَ والحركاتِ وبرهانَ التوازن **بلا زرَّي اقتراح**", () => {
    const view = ledgerScreen(caps("finance.view"), seedWithEntry(), "/men/homs/sq2/khalid/", CTX)
    expect(view.kind).toBe("granted")
    if (view.kind !== "granted") return
    expect(view.balanced).toBe(true)
    expect(view.rows).toHaveLength(1)
    expect(view.balances.get("USD")?.net).toBe(1_200)
    expect(view.actions).toEqual({ proposeOperation: false, proposeJournal: false })
  })

  it("وبالقدرات الثلاث يرى الزرّين — الإظهارُ إسقاطُ القدرة لا قرارُ الشاشة", () => {
    const view = ledgerScreen(
      caps("finance.view", "finance.entry", "ledger.journal.entry"),
      seedWithEntry(),
      "/men/homs/sq2/khalid/",
      CTX,
    )
    if (view.kind !== "granted") throw new Error("حُجبت الشاشة عن حاملِ قدراتها")
    expect(view.actions).toEqual({ proposeOperation: true, proposeJournal: true })
  })

  it("**والخصوماتُ محجوبةٌ افتراضاً** وتظهر بمفتاح الإدارة وحده (ب-٣١)", () => {
    const store = seedWithEntry()
    const hidden = ledgerScreen(caps("finance.view"), store, "/men/homs/sq2/khalid/", CTX)
    if (hidden.kind !== "granted") throw new Error("حُجبت الشاشة")
    expect(hidden.deductionsShown).toBe(false)

    const shownCtx = ledgerContext("u-finance", [
      {
        settingId: "finance.deductions.display_enabled",
        scopePath: "/",
        value: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    const shown = ledgerScreen(caps("finance.view"), store, "/men/homs/sq2/khalid/", shownCtx)
    if (shown.kind !== "granted") throw new Error("حُجبت الشاشة")
    expect(shown.deductionsShown).toBe(true)
  })
})

describe("شاشةُ البتّ — للمعتمِد وحده", () => {
  it("بلا `finance.supervise` لا تُفتح — والماليُّ محظورٌ عليها نصاً (§٣ من عدسات الأدوار)", () => {
    expect(approvalsScreen(caps("finance.view"), seedStore(), "/").kind).toBe("denied")
  })

  it("وبها يرى المعلَّقَ في نطاقه بفعلَي الاعتماد والرفض", () => {
    const store = seedStore()
    proposeAction(store, CTX, {
      unitId: "khalid",
      requestedBy: "u-finance",
      payload: {
        kind: "operation.simple",
        operation: { verb: "received", unitId: "khalid", currency: "USD", amount: c(500), memoAr: "قبضتُ" },
      },
    })
    const view = approvalsScreen(caps("finance.supervise"), store, "/")
    if (view.kind !== "granted") throw new Error("حُجبت شاشةُ البتّ عن حاملِ قدرتها")
    expect(view.rows).toHaveLength(1)
    expect(view.actions).toEqual({ approve: true, reject: true })
  })
})

describe("قشرةُ القدرات المحسوبة — الخادمُ يحسب والواجهةُ تعرض", () => {
  it("الماليُّ على الجذر يحصل على ثلاثٍ ولا يحصل على البتّ (فصلُ المهام في المصفوفة نفسها)", () => {
    const granted = computeLedgerCaps(canonicalActor("u-finance"), "/", DECISION)
    expect([...granted].sort()).toEqual(["finance.entry", "finance.view", "ledger.journal.entry"])
  })

  it("والمديرُ يحصل على العرض والبتّ ولا يحصل على تأليف القيد الذي يعتمده", () => {
    const granted = computeLedgerCaps(canonicalActor("u-admin"), "/", DECISION)
    expect([...granted].sort()).toEqual(["finance.supervise", "finance.view"])
  })

  it("وأميرُ المسجد لا يحصل على شيءٍ من المحاسبة المركزية", () => {
    expect(computeLedgerCaps(canonicalActor("u-amir"), "/men/homs/sq2/khalid/", DECISION).size).toBe(0)
  })
})
