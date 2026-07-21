/**
 * دوالُّ خادم النواة — `SPEC_authorization` §٥.٢ + `SPEC_finance_ledger` §٥.
 *
 * ثلاثةُ ثوابتٍ تُثبَت هنا:
 *  ١. **لا دالةَ خادمٍ تُرحِّل مباشرةً**: كلُّ سطحٍ إمّا اقتراحٌ أو بتٌّ أو قراءة (ق-٥٣).
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن** والغائبُ ⇒ `NO_SCOPE` ⇒ رفض.
 *  ٣. **حالاتُ السلب أكثرُ من الإيجاب** — النظامُ يُعرَّف بما يمنعه.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeLedgerEndpoints } from "../../../src/features/ledger/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import type { DecisionContext } from "../../../src/authorization/can.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"
import { c, canonicalActor, NOW, seedStore } from "./_seed.js"

const CTX: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const SETTINGS = createSettingsResolver([])

function endpoints() {
  clearRegistryForTests()
  const store = seedStore()
  return { store, ep: makeLedgerEndpoints(store, SETTINGS) }
}

const MANUAL = {
  entry: {
    at: NOW,
    unitId: "khalid",
    memoAr: "تسويةٌ يدوية",
    sourceType: "manualJournal" as const,
    sourceId: "mj-e1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit" as const, amount: c(1_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit" as const, amount: c(1_000) },
    ],
  },
}

const OPERATION = {
  operation: {
    verb: "received" as const,
    unitId: "khalid",
    currency: "USD",
    amount: c(4_000),
    memoAr: "قبضتُ تبرعاً",
  },
}

describe("G7 — كلُّ سطحٍ يعلن قدرتَه ونطاقَه (§٥.٢)", () => {
  beforeEach(() => clearRegistryForTests())

  it("الدوالُّ السبعُ معلَنةٌ بقدراتها من الكتالوج — لا قدرةَ مخترعة", () => {
    const { ep } = endpoints()
    const declared = Object.values(ep).map((f) => [f.declaration.name, f.declaration.capability])
    expect(declared).toEqual([
      ["ledger.journal.propose", "ledger.journal.entry"],
      ["ledger.reversal.propose", "ledger.journal.entry"],
      ["ledger.operation.propose", "finance.entry"],
      ["ledger.action.decide", "finance.supervise"],
      ["ledger.actions.pending", "finance.supervise"],
      ["ledger.balances.view", "finance.view"],
      ["ledger.entries.view", "finance.view"],
    ])
  })

  it("وكلٌّ منها يعلن مُحلِّلَ نطاقٍ واسمَ فعلٍ في سجل التدقيق", () => {
    const { ep } = endpoints()
    for (const fn of Object.values(ep)) {
      expect(fn.declaration.scope, fn.declaration.name).toBeTypeOf("function")
      expect(fn.declaration.audit.length, fn.declaration.name).toBeGreaterThan(0)
    }
  })

  it("**ولا دالةَ كاتبةٍ إلا بتّاً أو اقتراحاً** — الاقتراحُ نيّةُ كتابةٍ والقراءةُ قراءة", () => {
    const { ep } = endpoints()
    const writers = Object.values(ep)
      .filter((f) => f.declaration.intent === "write")
      .map((f) => f.declaration.name)
    expect(writers).toEqual([
      "ledger.journal.propose",
      "ledger.reversal.propose",
      "ledger.operation.propose",
      "ledger.action.decide",
    ])
  })
})

describe("ق-٥٣ — نقطةُ الخنق على مستوى الخادم: الاقتراحُ لا يُرحِّل", () => {
  it("**اقتراحُ الماليّ لا يُنتج قيداً** — الدفترُ فارغٌ بعد نجاح الاقتراح", async () => {
    const { store, ep } = endpoints()
    const r = await ep.proposeJournal.invoke(MANUAL, canonicalActor("u-finance"), {
      ...CTX,
      intent: "write",
    })
    expect(r.ok).toBe(true)
    expect(store.entries(), "رُحِّل قيدٌ من دالة اقتراح").toHaveLength(0)
    expect(store.actions()).toHaveLength(1)
  })

  it("والبتُّ وحده يُرحِّل — والمعتمِدُ غيرُ المُقترِح", async () => {
    const { store, ep } = endpoints()
    const proposed = await ep.proposeJournal.invoke(MANUAL, canonicalActor("u-finance"), {
      ...CTX,
      intent: "write",
    })
    if (!proposed.ok || !proposed.value.ok) throw new Error("لم يُسجَّل الاقتراح")
    const decided = await ep.decide.invoke(
      { actionId: proposed.value.value.id, approve: true },
      canonicalActor("u-admin"),
      { ...CTX, intent: "write" },
    )
    expect(decided.ok).toBe(true)
    expect(store.entries()).toHaveLength(1)
  })

  it("**والمُقترِحُ يؤخذ من الفاعل لا من المدخل** — فلا يُزوَّر اعتمادٌ ذاتيّ", async () => {
    const { store, ep } = endpoints()
    const proposed = await ep.proposeOperation.invoke(OPERATION, canonicalActor("u-finance"), {
      ...CTX,
      intent: "write",
    })
    if (!proposed.ok || !proposed.value.ok) throw new Error("لم يُسجَّل الاقتراح")
    expect(store.getAction(proposed.value.value.id)?.requestedBy).toBe("u-finance")
  })
})

describe("§٥.٢ — النطاقُ من الكيان المخزَّن، والغائبُ يُقفل ولا يُفتح", () => {
  it("وحدةٌ غيرُ مخزَّنةٍ ⇒ `NO_SCOPE` ⇒ رفضٌ ولو كان الفاعلُ على الجذر", async () => {
    const { ep } = endpoints()
    const r = await ep.balances.invoke({ unitId: "وحدةٌ-ملفَّقة" }, canonicalActor("u-finance"), CTX)
    expect(r.ok).toBe(false)
  })

  it("وقيدٌ غيرُ موجودٍ في اقتراح العكس ⇒ رفضٌ كذلك", async () => {
    const { ep } = endpoints()
    const r = await ep.proposeReversal.invoke(
      { entryId: "قيدٌ-وهميّ", reasonAr: "سبب" },
      canonicalActor("u-finance"),
      { ...CTX, intent: "write" },
    )
    expect(r.ok).toBe(false)
  })
})

describe("قب-٧ — القيدُ اليدويّ خلف مفتاح تفعيله (`feature.manual_journal_entry`)", () => {
  it("بإطفاء المفتاح يُرفض اقتراحُ القيد اليدويّ ولو ملك الماليُّ قدرتَه", async () => {
    const { ep } = endpoints()
    const r = await ep.proposeJournal.invoke(MANUAL, canonicalActor("u-finance"), {
      ...CTX,
      intent: "write",
      isFeatureEnabled: (flag) => flag !== "feature.manual_journal_entry",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_FEATURE_DISABLED")
  })
})

describe("المصفوفةُ الذهبية على الخادم — إيجاباً وسلباً (السلبُ أكثر)", () => {
  type Probe = {
    readonly label: string
    readonly cap: CapId
    readonly run: (ep: ReturnType<typeof makeLedgerEndpoints>, person: string) => Promise<{ ok: boolean }>
  }

  const PROBES: readonly Probe[] = [
    {
      label: "اقتراحُ قيدٍ يدويّ",
      cap: "ledger.journal.entry",
      run: (ep, person) => ep.proposeJournal.invoke(MANUAL, canonicalActor(person), { ...CTX, intent: "write" }),
    },
    {
      label: "اقتراحُ عمليةٍ مبسَّطة",
      cap: "finance.entry",
      run: (ep, person) => ep.proposeOperation.invoke(OPERATION, canonicalActor(person), { ...CTX, intent: "write" }),
    },
    {
      label: "عرضُ الأرصدة",
      cap: "finance.view",
      run: (ep, person) => ep.balances.invoke({ unitId: "khalid" }, canonicalActor(person), CTX),
    },
    {
      label: "عرضُ الحركات",
      cap: "finance.view",
      run: (ep, person) => ep.entries.invoke({ unitId: "khalid" }, canonicalActor(person), CTX),
    },
    {
      label: "قائمةُ المنتظِر",
      cap: "finance.supervise",
      run: (ep, person) => ep.pending.invoke({ unitId: "khalid" }, canonicalActor(person), CTX),
    },
  ]

  /** مَن يملك القدرةَ فعلاً في الملفّ الذهبيّ — لا رأيَ لنا فيها. */
  const HOLDERS: Readonly<Record<string, readonly string[]>> = {
    "ledger.journal.entry": ["u-finance"],
    "finance.entry": ["u-finance"],
    "finance.view": ["u-finance", "u-admin"],
    "finance.supervise": ["u-admin"],
  }

  const PEOPLE = [
    "u-admin",
    "u-section-head",
    "u-rabita",
    "u-square",
    "u-amir",
    "u-teacher",
    "u-committee-head",
    "u-media",
    "u-finance",
    "u-student",
  ]

  it("لكل قدرةٍ × كل دور: النجاحُ للحامل وحده، والرفضُ لغيره", async () => {
    let positives = 0
    let negatives = 0
    for (const probe of PROBES) {
      for (const person of PEOPLE) {
        const { ep } = endpoints()
        const allowed = (HOLDERS[probe.cap] ?? []).includes(person)
        const r = await probe.run(ep, person)
        expect(r.ok, `${probe.label} · ${person}`).toBe(allowed)
        if (allowed) positives += 1
        else negatives += 1
      }
    }
    console.log(`[دوال خادم الدفتر] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })
})
