/**
 * حرّاسُ العمق — ثوابتُ طبقة البيانات وأطرافُ الخدمات التي لا يبلغها المسارُ السعيد.
 *
 * ليست حشواً لرفع نسبة: كلُّ حالةٍ هنا **بابٌ يُقفَل**. الدفاعُ في العمق لا قيمةَ له إن لم
 * يُختبر — والفرقُ بين حارسٍ وحارسٍ ديكوريّ هو هذا الملفّ (درسُ «البوابات الديكور»، قب-١٥).
 */
import { describe, it, expect } from "vitest"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import { LedgerTenantRegistry } from "../../../src/features/ledger/data/tenant.js"
import { makeLedgerEndpoints } from "../../../src/features/ledger/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver, type SettingsResolver } from "../../../src/settings/resolver.js"
import { postJournal, type LedgerContext } from "../../../src/features/ledger/services/journal.js"
import { postEventSafely } from "../../../src/features/ledger/services/posting.js"
import { deductionsVisible } from "../../../src/features/ledger/services/deductions.js"
import {
  ACCOUNT_ROLES,
  describeEntry,
  simpleOperationLines,
  sourceTypeOfVerb,
} from "../../../src/features/ledger/services/simpleFace.js"
import { fromCents, isCents, ZERO_CENTS } from "../../../src/features/ledger/services/money.js"
import { LedgerStorageError } from "../../../src/features/ledger/types.js"
import type { DecisionContext } from "../../../src/authorization/can.js"
import { c, canonicalActor, ledgerContext, MAIN_TENANT_ID, NOW, SECOND_TENANT_ID, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const WRITE: DecisionContext = { ...DECISION, intent: "write" }
const SETTINGS = createSettingsResolver([])

function draftHeader(store: LedgerStore): string {
  return store.openEntry({
    voucherNo: "R-000001",
    voucherSeq: 1,
    at: NOW,
    unitPath: "/men/homs/sq2/khalid/",
    memoAr: "رأسٌ للاختبار",
    sourceType: "manualJournal",
    sourceId: "g-1",
    postingKey: null,
    reversalOf: null,
    reasonAr: null,
    postedBy: "u-finance",
  })
}

const LINE = {
  accountId: "cash",
  unitPath: "/men/homs/sq2/khalid/",
  fundId: null,
  currency: "USD",
  kind: "normal" as const,
  deductionKind: null,
}

describe("ثوابتُ طبقة البيانات — تُرمى فترتدّ المعاملة (§٢.٣)", () => {
  it("سطرٌ بطرفين معاً مرفوض — الاتجاهُ واحدٌ لا اثنان", () => {
    const store = seedStore()
    const id = draftHeader(store)
    expect(() => store.appendLine(id, { ...LINE, debit: c(100), credit: c(100) })).toThrow(
      LedgerStorageError,
    )
  })

  it("وسطرٌ صفريُّ الطرفين مرفوض، والسالبُ مرفوض", () => {
    const store = seedStore()
    const id = draftHeader(store)
    expect(() => store.appendLine(id, { ...LINE, debit: ZERO_CENTS, credit: ZERO_CENTS })).toThrow(
      LedgerStorageError,
    )
    expect(() => store.appendLine(id, { ...LINE, debit: c(-1), credit: ZERO_CENTS })).toThrow(
      LedgerStorageError,
    )
  })

  it("وسطرٌ على رأسٍ لا وجود له مرفوض — لا سطرَ يتيمٌ في الدفتر", () => {
    const store = seedStore()
    expect(() =>
      store.appendLine("قيدٌ-وهميّ", { ...LINE, debit: c(100), credit: ZERO_CENTS }),
    ).toThrow(LedgerStorageError)
  })

  it("وختمُ رأسٍ لا وجود له مرفوض، وربطُ عكسٍ بأصلٍ مفقود مرفوض", () => {
    const store = seedStore()
    expect(() => store.sealEntry("قيدٌ-وهميّ")).toThrow(LedgerStorageError)
    expect(() => store.linkReversal("قيدٌ-وهميّ", "آخر")).toThrow(LedgerStorageError)
  })

  it("والوحدةُ بمسارٍ غير مخزَّن تعود عدماً — لا اشتقاقَ نطاقٍ من فراغ", () => {
    expect(seedStore().unitByPath("/لا/وجود/")).toBeNull()
    expect(seedStore().getFund("لا-وجود")).toBeNull()
    expect(seedStore().getAccount("لا-وجود")).toBeNull()
  })

  it("وسجلُّ الشبكات يعرف مَن أنشأ ومَن لم يُنشأ بعد", () => {
    const registry = new LedgerTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)
    registry.storeFor(MAIN_TENANT_ID)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has(SECOND_TENANT_ID)).toBe(false)
  })

  it("وسجلُّ التدقيق يُقرأ ولا يُنتزع منه قيد (المادة ٤/٨)", () => {
    const store = seedStore()
    store.audit.append({
      at: NOW,
      actorPersonId: "u-finance",
      action: "x",
      unitPath: "/khalid/",
      capability: null,
      targetType: "test",
      targetId: "t",
      reason: null,
    })
    expect(store.audit.all()).toHaveLength(1)
    expect(() => (store.audit.all() as unknown as unknown[]).splice(0, 1)).toThrow(TypeError)
  })
})

describe("قب-٦ — الإعدادُ بنوعٍ خاطئ يرمي ولا يُفترض له قيمة", () => {
  const wrongTypes: SettingsResolver = () => "نصٌّ مكان رقم"
  const ctx: LedgerContext = { now: NOW, settings: wrongTypes, actorPersonId: "u-finance" }

  it("مُحلِّلٌ يعيد نصاً مكان مفتاحٍ أو رقمٍ ⇒ خطأٌ برمجيٌّ صريح لا سلوكٌ صامت", () => {
    expect(() => deductionsVisible(ctx, "/")).toThrow(TypeError)
    expect(() =>
      postJournal(seedStore(), ctx, {
        at: NOW,
        unitId: "khalid",
        memoAr: "قيد",
        sourceType: "donation",
        sourceId: "w-1",
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(1) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(1) },
        ],
      }),
    ).toThrow(TypeError)
  })

  it("**والترحيلُ التابع لا يرمي حتى على خطأٍ برمجيّ** — يُدوَّن ويمضي الحدث (§٣.٤)", () => {
    const store = seedStore()
    const r = postEventSafely(store, ctx, {
      sourceType: "donation",
      sourceId: "w-2",
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرع",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(1) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(1) },
      ],
    })
    expect(r.posted).toBe(false)
    if (!r.posted) expect(r.code).toBe("POSTING_FAILED")
    expect(store.audit.all().some((a) => a.action === "ledger.post.failed")).toBe(true)
  })
})

describe("قب-٨ — الأفعالُ الثلاثة كلُّها تولّد قيوداً مزدوجةً صحيحة", () => {
  it("«دفعتُ»: مدينُه المصروفُ ودائنُه النقد — وبوسمِ صندوقه", () => {
    const lines = simpleOperationLines({
      verb: "paid",
      unitId: "khalid",
      currency: "USD",
      amount: c(700),
      memoAr: "دفعتُ",
      fundId: "general",
    })
    expect(lines.map((l) => [l.accountId, l.side, l.fundId])).toEqual([
      [ACCOUNT_ROLES.generalExpense, "debit", "general"],
      [ACCOUNT_ROLES.cash, "credit", "general"],
    ])
  })

  it("«سلّمتُ»: مقاصّةٌ على الوجهة ونقدٌ من المصدر — ولا وسمَ صندوقٍ في التسليم", () => {
    const lines = simpleOperationLines({
      verb: "handedOver",
      unitId: "sq2",
      toUnitId: "khalid",
      currency: "USD",
      amount: c(700),
      memoAr: "سلّمتُ",
    })
    expect(lines.map((l) => [l.accountId, l.unitId, l.fundId])).toEqual([
      [ACCOUNT_ROLES.handoverClearing, "khalid", undefined],
      [ACCOUNT_ROLES.cash, "sq2", undefined],
    ])
  })

  it("و«قبضتُ» بلا وسمِ صندوقٍ تبقى صحيحة", () => {
    const lines = simpleOperationLines({
      verb: "received",
      unitId: "khalid",
      currency: "USD",
      amount: c(50),
      memoAr: "قبضتُ",
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]?.fundId).toBeUndefined()
  })

  it("وكلُّ فعلٍ نوعُ مصدرٍ من الكتالوج المغلق", () => {
    expect(sourceTypeOfVerb("received")).toBe("donation")
    expect(sourceTypeOfVerb("paid")).toBe("expense")
    expect(sourceTypeOfVerb("handedOver")).toBe("handover")
  })

  it("والوصفُ يعيد للمستخدم البسيط فعلَه — والقيدُ اليدويُّ يبقى «قيداً» بلا تبسيطٍ كاذب", () => {
    const store = seedStore()
    const manual = postJournal(store, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تسويةٌ يدوية",
      sourceType: "manualJournal",
      sourceId: "d-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(60) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(60) },
      ],
    })
    if (!manual.ok) throw new Error("لم يُرحَّل")
    expect(describeEntry(manual.value, store.linesOf(manual.value.id)).verb).toBe("journal")

    const paid = postJournal(store, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "دفعتُ",
      sourceType: "expense",
      sourceId: "d-2",
      lines: simpleOperationLines({
        verb: "paid",
        unitId: "khalid",
        currency: "USD",
        amount: c(20),
        memoAr: "دفعتُ",
      }),
    })
    if (!paid.ok) throw new Error("لم يُرحَّل")
    expect(describeEntry(paid.value, store.linesOf(paid.value.id)).verb).toBe("paid")
  })
})

describe("ق-٤٨ — أطرافُ العرض والفحص", () => {
  it("العرضُ يتعامل مع الصفر والسالب بلا قسمةٍ عائمة", () => {
    expect(fromCents(ZERO_CENTS)).toBe("0.00")
    expect(fromCents(c(-5))).toBe("-0.05")
  })

  it("و`isCents` تفصل الصحيحَ الآمنَ عمّا سواه", () => {
    expect(isCents(1999)).toBe(true)
    expect(isCents(19.99)).toBe(false)
    expect(isCents(Number.MAX_SAFE_INTEGER + 2)).toBe(false)
  })
})

describe("الخطأُ البرمجيُّ لا يُبتلع ولا يترك أثراً (المادة ٣/٤)", () => {
  /** يمرّ بفحوص التأريخ والعملات ثم ينهار **داخل المعاملة** عند تنسيق رقم السند. */
  const brokenAtVoucher: SettingsResolver = (id, path, at) =>
    id === "finance.receipt.prefix" ? 0 : createSettingsResolver([])(id, path, at)
  const ctx: LedgerContext = { now: NOW, settings: brokenAtVoucher, actorPersonId: "u-finance" }
  const input = {
    at: NOW,
    unitId: "khalid",
    memoAr: "قيد",
    sourceType: "donation" as const,
    sourceId: "b-1",
    lines: [
      { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit" as const, amount: c(5) },
      { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit" as const, amount: c(5) },
    ],
  }

  it("انهيارٌ برمجيٌّ **داخل** المعاملة يُعاد رميه — ولا يُخلَّف رأسٌ ولا سطر", () => {
    const store = seedStore()
    expect(() => postJournal(store, ctx, input)).toThrow(TypeError)
    expect(store.entries()).toHaveLength(0)
    expect(store.lines()).toHaveLength(0)
  })

  it("وكذلك في إعادة الترحيل — لا يُبتلع خلف قناع «فشلِ عمل»", async () => {
    const { repostEvent } = await import("../../../src/features/ledger/services/posting.js")
    const store = seedStore()
    expect(() => repostEvent(store, ctx, { ...input, lines: input.lines })).toThrow(TypeError)
    expect(store.entries()).toHaveLength(0)
  })

  it("وسببُ القيد يُحفظ حين يُمرَّر ويبقى عدماً حين لا يُمرَّر", () => {
    const store = seedStore()
    const withReason = postJournal(store, CTX, { ...input, sourceId: "b-2", reasonAr: "تصحيحُ إدخال" })
    const without = postJournal(store, CTX, { ...input, sourceId: "b-3" })
    if (!withReason.ok || !without.ok) throw new Error("لم يُرحَّل")
    expect(withReason.value.reasonAr).toBe("تصحيحُ إدخال")
    expect(without.value.reasonAr).toBeNull()
  })
})

describe("قيمُ الخطأ المعلنة — بتفصيلٍ وبدونه (المادة ٣/٤)", () => {
  it("`err` تعيد الرمزَ وحده أو الرمزَ بتفصيلٍ آليّ — لا رسالةَ مستخدمٍ في الخدمة", async () => {
    const { err, ok } = await import("../../../src/features/ledger/types.js")
    expect(err("UNBALANCED")).toEqual({ ok: false, error: { code: "UNBALANCED" } })
    expect(err("UNBALANCED", "USD")).toEqual({ ok: false, error: { code: "UNBALANCED", detail: "USD" } })
    expect(ok(7)).toEqual({ ok: true, value: 7 })
  })

  it("و`positiveCents` ترفض الكسرَ قبل أن تسأل عن الإشارة", async () => {
    const { positiveCents } = await import("../../../src/features/ledger/services/money.js")
    const r = positiveCents(19.99)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("FRACTIONAL_AMOUNT")
  })
})

describe("شجرةُ عرض الشاشة — كلُّ تركيبةِ قدراتٍ تُبنى بلا انهيار", () => {
  it("حاملُ العرضِ والقيدِ اليدويِّ دون الإدخال المبسَّط يرى نموذجَ القيد وحده", async () => {
    const { ledgerScreenNodes, approvalsScreenNodes } = await import(
      "../../../src/features/ledger/screens/screens.js"
    )
    const nodes = ledgerScreenNodes(new Set(["finance.view", "ledger.journal.entry"]))
    expect(nodes.component).toBe("Form")

    const viewOnly = ledgerScreenNodes(new Set(["finance.view"]))
    expect(viewOnly.component).toBe("StatCard")

    expect(ledgerScreenNodes(new Set()).component).toBe("EmptyState")
    expect(approvalsScreenNodes(new Set()).component).toBe("EmptyState")
    expect(approvalsScreenNodes(new Set(["finance.supervise"])).component).toBe("DataTable")
  })
})

describe("دوالُّ الخادم — المساراتُ التي لا يبلغها الرفض", () => {
  it("اقتراحُ العكس على قيدٍ قائمٍ ينجح ثم يبتُّه المديرُ فيولد القيدُ العاكس", async () => {
    clearRegistryForTests()
    const store = seedStore()
    const posted = postJournal(store, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرعٌ سيُصحَّح",
      sourceType: "donation",
      sourceId: "r-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(300) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(300) },
      ],
    })
    if (!posted.ok) throw new Error("لم يُرحَّل الأصل")

    const ep = makeLedgerEndpoints(store, SETTINGS)
    const proposed = await ep.proposeReversal.invoke(
      { entryId: posted.value.id, reasonAr: "مبلغٌ خاطئ" },
      canonicalActor("u-finance"),
      WRITE,
    )
    if (!proposed.ok || !proposed.value.ok) throw new Error("لم يُسجَّل اقتراحُ العكس")

    const decided = await ep.decide.invoke(
      { actionId: proposed.value.value.id, approve: true, reasonAr: "موافقٌ على التصحيح" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(decided.ok).toBe(true)
    expect(store.entries()).toHaveLength(2)
    expect(store.getEntry(posted.value.id)?.reversedBy).not.toBeNull()
  })

  it("وقراءتا الحركات والمنتظِر تعيدان ما في النطاق وحده", async () => {
    clearRegistryForTests()
    const store = seedStore()
    postJournal(store, CTX, {
      at: NOW,
      unitId: "khalid",
      memoAr: "تبرع",
      sourceType: "donation",
      sourceId: "e-1",
      lines: [
        { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(10) },
        { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(10) },
      ],
    })
    const ep = makeLedgerEndpoints(store, SETTINGS)

    const entries = await ep.entries.invoke({ unitId: "khalid" }, canonicalActor("u-finance"), DECISION)
    expect(entries.ok).toBe(true)
    if (entries.ok) expect(entries.value.entries).toHaveLength(1)

    const sibling = await ep.entries.invoke({ unitId: "bilal" }, canonicalActor("u-finance"), DECISION)
    expect(sibling.ok).toBe(true)
    if (sibling.ok) expect(sibling.value.entries).toHaveLength(0)

    const pending = await ep.pending.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    expect(pending.ok).toBe(true)
    if (pending.ok) expect(pending.value).toHaveLength(0)
  })
})
