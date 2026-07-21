/**
 * قب-١٨/CR-006 — عزلُ الشبكة في المال (`SPEC_finance_ledger` §٨.١).
 * هنا الاختبار الإلزاميّ الثامن: **فاعلٌ في شبكةٍ لا يرى ولا يُرحّل في دفتر شبكةٍ أخرى**
 * — **ولو تطابق مسارُه النسبيّ**، وهو عينُ ما يجعل التطابقَ خطراً لا أماناً.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import { LedgerTenantRegistry, globalLedgerPath } from "../../../src/features/ledger/data/tenant.js"
import { makeLedgerEndpoints } from "../../../src/features/ledger/server/endpoints.js"
import { postJournal } from "../../../src/features/ledger/services/journal.js"
import { balancesByCurrency } from "../../../src/features/ledger/services/balances.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import type { DecisionContext } from "../../../src/authorization/can.js"
import { c, canonicalActor, ledgerContext, MAIN_TENANT_ID, NOW, SECOND_TENANT_ID, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const SETTINGS = createSettingsResolver([])
const KHALID = "/men/homs/sq2/khalid/"

/** شبكةٌ ثانيةٌ **بنفس المسارات النسبيّة عمداً** — فيثبت أن التطابق لا يسرّب. */
function seedSecond(): LedgerStore {
  const store = seedStore(SECOND_TENANT_ID)
  postJournal(store, ledgerContext("b-finance"), {
    at: NOW,
    unitId: "khalid",
    memoAr: "تبرعُ شبكةِ حلب",
    sourceType: "donation",
    sourceId: "b-1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(99_000) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(99_000) },
    ],
  })
  return store
}

describe("قب-١٨ — `tenantId` مشتقٌّ من المستودع لا من مدخل العميل", () => {
  it("المستودعُ يختم شبكتَه على كلِّ كيانٍ يحفظه — والوافدُ الملفَّق يُطمس", () => {
    const store = new LedgerStore(MAIN_TENANT_ID)
    store.saveAccount({ tenantId: SECOND_TENANT_ID, id: "cash", ar: "النقد", kind: "asset" })
    store.saveFund({ tenantId: SECOND_TENANT_ID, id: "zakat", ar: "الزكاة", restricted: true })
    store.saveUnit({ tenantId: SECOND_TENANT_ID, id: "khalid", path: KHALID })
    expect(store.getAccount("cash")?.tenantId).toBe(MAIN_TENANT_ID)
    expect(store.getFund("zakat")?.tenantId).toBe(MAIN_TENANT_ID)
    expect(store.getUnit("khalid")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("والقيدُ وسطورُه وفعلُه المعلَّق تحمل شبكةَ المستودع", () => {
    const store = seedStore()
    const posted = postJournal(store, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرع",
      sourceType: "donation",
      sourceId: "d-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(100) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(100) },
      ],
    })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return
    expect(posted.value.tenantId).toBe(MAIN_TENANT_ID)
    expect(store.lines().every((l) => l.tenantId === MAIN_TENANT_ID)).toBe(true)
  })

  it("والعنوانُ المادّيّ الكونيّ بادئتُه معرّفُ الشبكة، والمسارُ النسبيُّ يبقى للمحرّك", () => {
    expect(globalLedgerPath(MAIN_TENANT_ID, KHALID)).toBe("/t-main/men/homs/sq2/khalid/")
    expect(globalLedgerPath(SECOND_TENANT_ID, KHALID)).toBe("/t-aleppo/men/homs/sq2/khalid/")
    expect(globalLedgerPath(MAIN_TENANT_ID, KHALID)).not.toBe(globalLedgerPath(SECOND_TENANT_ID, KHALID))
  })
})

describe("قب-١٨ — العزلُ بنيويّ: لا مِقبضَ عابرٌ أصلاً (الاختبار الإلزاميّ ٨)", () => {
  it("سجلُّ الشبكات يوجّه كلَّ استعلامٍ إلى **مستودع شبكته** ولا يخلطهما", () => {
    const registry = new LedgerTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    const b = registry.storeFor(SECOND_TENANT_ID)
    expect(a).not.toBe(b)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(a)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**والمساراتُ النسبيّةُ متطابقةٌ ومع ذلك لا يُرى رصيدُ الأخرى**", () => {
    const main = seedStore()
    const second = seedSecond()
    postJournal(main, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرعُ الشبكة الأولى",
      sourceType: "donation",
      sourceId: "a-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(1_000) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(1_000) },
      ],
    })
    expect(balancesByCurrency(main, KHALID, "cash").get("USD")?.net).toBe(1_000)
    expect(balancesByCurrency(second, KHALID, "cash").get("USD")?.net).toBe(99_000)
    // ولا سطرَ من هذه في تلك — رغم تطابق `unitPath` حرفياً.
    expect(main.lines().some((l) => l.tenantId === SECOND_TENANT_ID)).toBe(false)
    expect(second.lines().some((l) => l.tenantId === MAIN_TENANT_ID)).toBe(false)
  })
})

describe("قب-١٨ — الفاعلُ عبر دوال الخادم لا يبلغ دفترَ شبكةٍ أخرى", () => {
  beforeEach(() => clearRegistryForTests())

  it("**فاعلُ الشبكة الأولى يقرأ عبر نقطة شبكته فيرى رصيدَها هي لا رصيدَ الأخرى**", async () => {
    const main = seedStore()
    postJournal(main, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرعٌ محلّيّ",
      sourceType: "donation",
      sourceId: "m-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(2_000) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(2_000) },
      ],
    })

    const ep = makeLedgerEndpoints(main, SETTINGS)
    const r = await ep.balances.invoke({ unitId: "khalid" }, canonicalActor("u-finance"), DECISION)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.byCurrency.USD?.net).toBe(2_000)
  })

  it("**وكيانُ الشبكة الأخرى غيرُ مُدرَكٍ من نقطة هذه** ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const main = seedStore()
    const second = seedStore(SECOND_TENANT_ID)
    second.saveUnit({ tenantId: SECOND_TENANT_ID, id: "aleppo-only", path: "/men/aleppo/" })

    const ep = makeLedgerEndpoints(main, SETTINGS)
    const r = await ep.balances.invoke({ unitId: "aleppo-only" }, canonicalActor("u-finance"), DECISION)
    expect(r.ok, "بلغ فاعلُ شبكةٍ كيانَ شبكةٍ أخرى").toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})
