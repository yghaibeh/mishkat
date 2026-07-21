/**
 * الطبقة الثانية من E2E — مصفوفةُ شاشات نواة الدفتر (TESTING_POLICY §٤ الطبقة الثانية، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور وغيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ الزر
 * وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظة صدق منهجيّة** (كما أعلنت مصفوفةُ `org`): لا إطار واجهةٍ في v2 بعد (قب-٢٦ أجّل
 * الحسم إلى **هذه الشاشة بالذات** — انظر `SPEC_finance_ledger` §٩)، فهذه المصفوفة تُجسّد
 * الطبقة الثانية على **مستوى نموذج العرض** + رفض الخادم، لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { makeLedgerEndpoints } from "../../src/features/ledger/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { computeLedgerCaps } from "../../src/features/ledger/screens/caps.js"
import { approvalsScreen, ledgerScreen } from "../../src/features/ledger/screens/screens.js"
import { proposeAction } from "../../src/features/ledger/services/dualControl.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { DecisionContext } from "../../src/authorization/can.js"
import type { LedgerStore } from "../../src/features/ledger/data/store.js"
import { c, canonicalActor, ledgerContext, NOW, seedStore } from "../features/ledger/_seed.js"

const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const WRITE: DecisionContext = { ...DECISION, intent: "write" }
const SETTINGS = createSettingsResolver([])
const CTX = ledgerContext("u-finance")

type RoleFixture = { readonly label: string; readonly personId: string; readonly scopePath: string }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ من العشرة — من العالم القانوني لا من عالمٍ ثانٍ. */
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", personId: "u-admin", scopePath: "/" },
  { label: "section_head", personId: "u-section-head", scopePath: "/men/" },
  { label: "rabita", personId: "u-rabita", scopePath: "/men/homs/" },
  { label: "square", personId: "u-square", scopePath: "/men/homs/sq2/" },
  { label: "amir", personId: "u-amir", scopePath: "/men/homs/sq2/khalid/" },
  { label: "teacher", personId: "u-teacher", scopePath: "/men/homs/sq2/khalid/c1/" },
  { label: "committee_head", personId: "u-committee-head", scopePath: "/men/homs/sq2/khalid/" },
  { label: "media", personId: "u-media", scopePath: "/" },
  { label: "finance_officer", personId: "u-finance", scopePath: "/" },
  { label: "student", personId: "u-student", scopePath: "/men/homs/sq2/khalid/c1/" },
]

type Ep = ReturnType<typeof makeLedgerEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (store: LedgerStore, caps: ReadonlySet<CapId>, f: RoleFixture) => boolean
  readonly serverInvoke: (ep: Ep, store: LedgerStore, f: RoleFixture) => Promise<{ ok: boolean }>
}

const MANUAL = {
  entry: {
    at: NOW,
    unitId: "khalid",
    memoAr: "قيدٌ يدويّ",
    sourceType: "manualJournal" as const,
    sourceId: "mx-1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit" as const, amount: c(700) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit" as const, amount: c(700) },
    ],
  },
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "ledger",
    element: "لوحُ الدفتر (الأرصدة والحركات وبرهان التوازن)",
    cap: "finance.view",
    shown: (store, caps, f) => ledgerScreen(caps, store, f.scopePath, CTX).kind === "granted",
    serverInvoke: (ep, _s, f) => ep.balances.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "ledger",
    element: "زرُّ تسجيل عمليةٍ مبسَّطة (قبضت/دفعت/سلّمت)",
    cap: "finance.entry",
    shown: (store, caps, f) => {
      const v = ledgerScreen(caps, store, f.scopePath, CTX)
      return v.kind === "granted" && v.actions.proposeOperation
    },
    serverInvoke: (ep, _s, f) =>
      ep.proposeOperation.invoke(
        {
          operation: {
            verb: "received",
            unitId: "khalid",
            currency: "USD",
            amount: c(300),
            memoAr: "قبضتُ",
          },
        },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "ledger",
    element: "زرُّ اقتراح القيد المحاسبيّ اليدويّ",
    cap: "ledger.journal.entry",
    shown: (store, caps, f) => {
      const v = ledgerScreen(caps, store, f.scopePath, CTX)
      return v.kind === "granted" && v.actions.proposeJournal
    },
    serverInvoke: (ep, _s, f) => ep.proposeJournal.invoke(MANUAL, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "approvals",
    element: "شاشةُ البتّ في المقترحات",
    cap: "finance.supervise",
    shown: (store, caps, f) => approvalsScreen(caps, store, f.scopePath).kind === "granted",
    serverInvoke: (ep, _s, f) => ep.pending.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
]

describe("مصفوفةُ شاشات الدفتر — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const store = seedStore()
        proposeAction(store, CTX, {
          unitId: "khalid",
          requestedBy: "u-finance",
          payload: {
            kind: "operation.simple",
            operation: { verb: "received", unitId: "khalid", currency: "USD", amount: c(900), memoAr: "قبضتُ" },
          },
        })
        const ep = makeLedgerEndpoints(store, SETTINGS)
        const caps = computeLedgerCaps(canonicalActor(f.personId), f.scopePath, DECISION)

        const allowed = caps.has(a.cap)
        expect(a.shown(store, caps, f), `${a.screen}/${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, store, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات الدفتر] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المسؤولُ الماليُّ لا يرى زرَّ اعتمادٍ قطّ** — الإعدادُ له والبتُّ للمدير (§٣ من العدسات)", () => {
    const store = seedStore()
    const caps = computeLedgerCaps(canonicalActor("u-finance"), "/", DECISION)
    expect(caps.has("finance.supervise")).toBe(false)
    expect(approvalsScreen(caps, store, "/").kind).toBe("denied")
  })

  it("**والمديرُ لا يرى زرَّ تأليف القيد الذي يعتمده** — فصلُ المهام مرسومٌ في المصفوفة", () => {
    const store = seedStore()
    const caps = computeLedgerCaps(canonicalActor("u-admin"), "/", DECISION)
    const view = ledgerScreen(caps, store, "/", CTX)
    if (view.kind !== "granted") throw new Error("حُجب الدفترُ عن المدير")
    expect(view.actions).toEqual({ proposeOperation: false, proposeJournal: false })
  })
})
