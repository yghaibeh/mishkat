/**
 * ق-٥٣ + ق-٥٤ — الاعتماد الثنائي **نقطةَ خنقٍ واحدةً لا تُلتف** وفصلُ المهام
 * (`SPEC_finance_ledger` §٥)، وقب-٨ الوجهُ المبسَّط (§٦.٤)، وب-٣٩ب حدُّ الرصيد الافتتاحيّ (§٧.٢).
 * هنا الاختبار الإلزاميّ الخامس.
 */
import { describe, it, expect } from "vitest"
import {
  decideAction,
  pendingActionsFor,
  proposeAction,
  type ProposeInput,
} from "../../../src/features/ledger/services/dualControl.js"
import { describeEntry } from "../../../src/features/ledger/services/simpleFace.js"
import { balanceProof } from "../../../src/features/ledger/services/journal.js"
import { ACTION_KINDS, type ActionKind } from "../../../src/features/ledger/types.js"
import { c, ledgerContext, seedStore } from "./_seed.js"

const CTX = ledgerContext("u-finance")
const MAKER = "u-finance"
const CHECKER = "u-admin"

function manualProposal(over: Partial<ProposeInput> = {}): ProposeInput {
  return {
    unitId: "khalid",
    requestedBy: MAKER,
    payload: {
      kind: "journal.manual",
      entry: {
        at: CTX.now,
        unitId: "khalid",
        memoAr: "تسويةُ فرقٍ محاسبيّ",
        sourceType: "manualJournal",
        sourceId: "mj-1",
        lines: [
          { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(2_500) },
          { accountId: "revenue.donations", unitId: "khalid", currency: "USD", side: "credit", amount: c(2_500) },
        ],
      },
    },
    ...over,
  }
}

function simpleProposal(): ProposeInput {
  return {
    unitId: "khalid",
    requestedBy: MAKER,
    payload: {
      kind: "operation.simple",
      operation: {
        verb: "received",
        unitId: "khalid",
        currency: "USD",
        amount: c(30_000),
        memoAr: "قبضتُ تبرعاً",
      },
    },
  }
}

describe("ق-٥٣ — نقطةُ الخنق: الاقتراحُ لا يُرحِّل، والبتُّ وحده يُرحِّل", () => {
  it("**الاقتراحُ لا يلمس الدفتر** — لا قيدَ ولا سطرَ حتى يُبتّ", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    expect(proposed.ok).toBe(true)
    if (proposed.ok) expect(proposed.value.status).toBe("pending")
    expect(store.entries()).toHaveLength(0)
    expect(store.lines()).toHaveLength(0)
  })

  it("والاعتمادُ يُرحّل **بنفس الحمولة حرفياً** — المعاينةُ تطابق الترحيل", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")

    const decided = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: true,
    })
    expect(decided.ok).toBe(true)
    if (!decided.ok) return
    expect(decided.value.status).toBe("approved")
    expect(store.entries()).toHaveLength(1)
    const entry = store.getEntry(decided.value.resultEntryId ?? "")
    expect(entry?.memoAr).toBe("تسويةُ فرقٍ محاسبيّ")
    expect(entry?.sourceType).toBe("manualJournal")
    expect(store.lines().map((l) => l.debit + l.credit)).toEqual([2_500, 2_500])
    expect(balanceProof(store).balanced).toBe(true)
  })

  it("والرفضُ لا يترك أثراً في الدفتر، وسببُه إلزاميٌّ يصل المقترِح", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")

    const noReason = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: false,
    })
    expect(noReason.ok).toBe(false)
    if (!noReason.ok) expect(noReason.error.code).toBe("REASON_REQUIRED")

    const rejected = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: false,
      reasonAr: "المستندُ ناقص",
    })
    expect(rejected.ok).toBe(true)
    if (rejected.ok) {
      expect(rejected.value.status).toBe("rejected")
      expect(rejected.value.reasonAr).toBe("المستندُ ناقص")
    }
    expect(store.entries()).toHaveLength(0)
  })

  it("**والحمولةُ مجمَّدةٌ** بين الاقتراح والبتّ — لا تُبدَّل بعد الختم", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    expect(Object.isFrozen(proposed.value.payload)).toBe(true)
    expect(() => {
      ;(proposed.value.payload as { kind: string }).kind = "operation.simple"
    }).toThrow(TypeError)
  })

  it("**والكتالوجُ مغلقٌ وليس فيه فعلُ حذف** — فلا مسارَ للمحو أصلاً (§٢.٤)", () => {
    expect([...ACTION_KINDS]).toEqual(["journal.manual", "journal.reverse", "operation.simple"])
    expect(ACTION_KINDS.some((k) => /delete|remove/i.test(k))).toBe(false)

    const store = seedStore()
    const r = proposeAction(store, CTX, {
      ...manualProposal(),
      payload: { kind: "journal.delete" as unknown as ActionKind } as never,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_ACTION")
  })
})

describe("ق-٥٤ — فصلُ المهام: المُدخِل ليس المعتمِد (الاختبار الإلزاميّ ٥)", () => {
  it("**المُقترِحُ نفسُه يحاول الاعتماد ⇒ مرفوض** ولا أثرَ في الدفتر", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")

    const selfApprove = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: MAKER,
      approve: true,
    })
    expect(selfApprove.ok).toBe(false)
    if (!selfApprove.ok) expect(selfApprove.error.code).toBe("SELF_APPROVAL_REJECTED")
    expect(store.entries(), "رُحِّل قيدٌ باعتمادٍ ذاتيّ").toHaveLength(0)
    expect(store.getAction(proposed.value.id)?.status).toBe("pending")
  })

  it("**والرفضُ الذاتيُّ مرفوضٌ كذلك** — البتُّ كلُّه لغير المُدخِل", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    const r = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: MAKER,
      approve: false,
      reasonAr: "عدلتُ عن رأيي",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("SELF_APPROVAL_REJECTED")
  })

  it("**والفحصُ على الشخص لا على الدور**: حاملُ القدرتين لا يعتمد اقتراحَ نفسه", () => {
    const store = seedStore()
    // نفسُ الشخص يقترح ويبتّ — ولو ملك قدرةَ البتّ بمنحٍ فوق دوره (انظر `actorWithBothCaps`).
    const proposed = proposeAction(store, CTX, manualProposal({ requestedBy: "u-dual" }))
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    const r = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: "u-dual",
      approve: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("SELF_APPROVAL_REJECTED")
  })

  it("والبتُّ **مرةً واحدةً لا غير** (idempotency البتّ)", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, manualProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    expect(decideAction(store, CTX, { actionId: proposed.value.id, decidedBy: CHECKER, approve: true }).ok).toBe(true)
    const again = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: true,
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("ALREADY_DECIDED")
    expect(store.entries(), "ازدوج الترحيلُ ببتٍّ ثانٍ").toHaveLength(1)
  })

  it("وفعلٌ لا وجود له ⇒ مرفوضٌ لا صامت", () => {
    const r = decideAction(seedStore(), CTX, { actionId: "لا-وجود", decidedBy: CHECKER, approve: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ACTION_NOT_FOUND")
  })

  it("**والفشلُ بعد الاعتماد يُسجَّل بسببه** ولا يُعلن نجاحاً كاذباً", () => {
    const store = seedStore()
    const proposed = proposeAction(
      store,
      CTX,
      manualProposal({
        payload: {
          kind: "journal.manual",
          entry: {
            at: CTX.now,
            unitId: "khalid",
            memoAr: "قيدٌ سيفشل عند التنفيذ",
            sourceType: "manualJournal",
            sourceId: "mj-bad",
            lines: [
              { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(100) },
              { accountId: "حسابٌ-مجهول", unitId: "khalid", currency: "USD", side: "credit", amount: c(100) },
            ],
          },
        },
      }),
    )
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    const decided = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: true,
    })
    expect(decided.ok).toBe(false)
    if (!decided.ok) expect(decided.error.code).toBe("UNKNOWN_ACCOUNT")
    const after = store.getAction(proposed.value.id)
    expect(after?.status).toBe("failed")
    expect(after?.failureCode).toBe("UNKNOWN_ACCOUNT")
    expect(store.entries()).toHaveLength(0)
  })
})

describe("ب-٣٩ب — الرصيدُ الافتتاحيّ عبر الاستيراد وحده (§٧.٢)", () => {
  it("**اقتراحُ رصيدٍ افتتاحيٍّ من القيد اليدويّ يُرفض** — لا بابَ خلفيّ", () => {
    const store = seedStore()
    const r = proposeAction(
      store,
      CTX,
      manualProposal({
        payload: {
          kind: "journal.manual",
          entry: {
            at: CTX.now,
            unitId: "khalid",
            memoAr: "رصيدٌ افتتاحيّ",
            sourceType: "openingBalance",
            sourceId: "ob-1",
            lines: [
              { accountId: "cash", unitId: "khalid", currency: "USD", side: "debit", amount: c(100) },
              { accountId: "netAssets.opening", unitId: "khalid", currency: "USD", side: "credit", amount: c(100) },
            ],
          },
        },
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("OPENING_BALANCE_VIA_IMPORT_ONLY")
  })
})

describe("قب-٨ — المحرّك محاسبيٌّ كامل والوجه يتبسّط (§٦.٤)", () => {
  it("«قبضتُ» تولّد **قيداً مزدوجاً متوازناً** تحتها بلا أن يرى المستخدمُ حساباً", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, simpleProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    const decided = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: true,
    })
    expect(decided.ok).toBe(true)
    const lines = store.lines()
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.accountId === "cash")?.debit).toBe(30_000)
    expect(lines.find((l) => l.accountId === "revenue.donations")?.credit).toBe(30_000)
    expect(balanceProof(store).balanced).toBe(true)
  })

  it("«سلّمتُ» قيدٌ واحدٌ **بطرفين** ينقص المصدرَ ويثبت المقاصّة على الوجهة (ق-٦١ روحاً)", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, {
      unitId: "sq2",
      requestedBy: MAKER,
      payload: {
        kind: "operation.simple",
        operation: {
          verb: "handedOver",
          unitId: "sq2",
          toUnitId: "khalid",
          currency: "USD",
          amount: c(8_000),
          memoAr: "سلّمتُ للمسجد",
        },
      },
    })
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    expect(decideAction(store, CTX, { actionId: proposed.value.id, decidedBy: CHECKER, approve: true }).ok).toBe(true)
    const lines = store.lines()
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.credit > 0)?.unitPath).toBe("/men/homs/sq2/")
    expect(lines.find((l) => l.debit > 0)?.unitPath).toBe("/men/homs/sq2/khalid/")
    expect(balanceProof(store).balanced).toBe(true)
  })

  it("والطريقُ ذو اتجاهين: القيدُ يُوصَف للمستخدم البسيط **بفعله** لا بسطور اليومية", () => {
    const store = seedStore()
    const proposed = proposeAction(store, CTX, simpleProposal())
    if (!proposed.ok) throw new Error("لم يُسجَّل الاقتراح")
    const decided = decideAction(store, CTX, {
      actionId: proposed.value.id,
      decidedBy: CHECKER,
      approve: true,
    })
    if (!decided.ok) throw new Error("لم يُعتمد الفعل")
    const entry = store.getEntry(decided.value.resultEntryId ?? "")
    expect(entry).not.toBeNull()
    const described = describeEntry(entry!, store.linesOf(entry!.id))
    expect(described.verb).toBe("received")
    expect(described.voucherNo).toBe(entry!.voucherNo)
    expect(described.amountsByCurrency.get("USD")).toBe(30_000)
  })
})

describe("قائمةُ المنتظِر — عرضُ المعتمِد منطوقٌ بنطاقه", () => {
  it("تُعيد المعلَّقَ في نطاقٍ بالاحتواء دون المبتوت", () => {
    const store = seedStore()
    const a = proposeAction(store, CTX, manualProposal())
    const b = proposeAction(store, CTX, simpleProposal())
    if (!a.ok || !b.ok) throw new Error("لم تُسجَّل الاقتراحات")
    decideAction(store, CTX, { actionId: a.value.id, decidedBy: CHECKER, approve: true })
    expect(pendingActionsFor(store, "/").map((x) => x.id)).toEqual([b.value.id])
    expect(pendingActionsFor(store, "/men/homs/sq2/bilal/")).toHaveLength(0)
  })
})
