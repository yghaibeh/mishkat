/**
 * حرّاسُ الحوافّ — الحالاتُ التي **يجب أن تُردّ** ولا تُنسى (عقدُ الوحدة §٧/§٨/§٩).
 *
 * كلُّها سلبٌ: نوعٌ مجهول · طلبٌ مجهول · حمولةٌ فارغة · شخصٌ خارج اللقطة · إعدادٌ بنوعٍ خاطئ ·
 * معرّفٌ مكرَّر · معاملةٌ ترتدّ. **الفراغُ يُشخَّص ولا يُخفى** (ق-١١٢)، والخطأُ قيمةٌ لا صمت.
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import { ApprovalTenantRegistry } from "../../../src/features/approval/data/tenant.js"
import {
  approvalType,
  clearApprovalTypesForTests,
  defineApprovalType,
  registeredApprovalTypes,
} from "../../../src/features/approval/registry.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
} from "../../../src/features/approval/services/engine.js"
import {
  amendLocked,
  breakGlassApprove,
  overrideApprove,
} from "../../../src/features/approval/services/exceptions.js"
import {
  escalationNoticesFor,
  pendingForApprover,
} from "../../../src/features/approval/services/inbox.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import {
  escalationDays,
  isPeriodTimeLocked,
  isWithdrawalEnabled,
} from "../../../src/features/approval/services/locking.js"
import { approvalErr, approvalOk } from "../../../src/features/approval/types.js"
import type { SettingsResolver } from "../../../src/settings/resolver.js"
import {
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  PERIOD,
  READ,
  SECOND_TENANT_ID,
  approvalContext,
  canonicalPeople,
} from "./_seed.js"

const TYPE = "unit.report"
const UNKNOWN = "unit.unknown"

function store(): ApprovalStore {
  return new ApprovalStore(MAIN_TENANT_ID)
}

function submitted(s: ApprovalStore, submitter = "u-amir") {
  const r = submitForApproval(s, approvalContext(submitter), {
    typeId: TYPE,
    unitPath: KHALID_PATH,
    period: PERIOD,
  })
  if (!r.ok) throw new Error(r.error.code)
  return r.value
}

describe("سجلُّ الأنواع — ما ليس فيه غيرُ موجود", () => {
  it("نوعٌ مجهولٌ يُردّ في كل مسار: تقديمٌ وسحبٌ وتدخّلٌ وطابورٌ وتصعيد", () => {
    const s = store()
    const ctx = approvalContext("u-amir")
    expect(approvalType(UNKNOWN)).toBeNull()

    const submit = submitForApproval(s, ctx, { typeId: UNKNOWN, unitPath: KHALID_PATH, period: PERIOD })
    expect(!submit.ok && submit.error.code).toBe("UNKNOWN_APPROVAL_TYPE")
    expect(pendingForApprover(s, ctx, { typeId: UNKNOWN, scopePath: "/" })).toEqual([])
    expect(escalationNoticesFor(s, ctx, { typeId: UNKNOWN })).toEqual([])
  })

  it("والمعرّفُ المكرَّر يرمي — نوعان بمعرّفٍ واحدٍ عيبُ مصدرِ حقيقةٍ لا تفصيل", () => {
    expect(() =>
      defineApprovalType({
        id: TYPE,
        entityAr: "تكرارٌ مقصود",
        scopeKind: "unit",
        submitCapability: "report.submit",
        approveCapability: "report.approve",
        overrideCapability: null,
        retractCapability: null,
        uniquePerPeriod: true,
        payloadRequired: true,
        approvalLocks: true,
        rejectionReturnsToDraft: true,
        rejectionRequiresReason: true,
      }),
    ).toThrow(/مكرَّرُ المعرّف/)
  })

  it("والمسجَّلُ اليوم نوعان: الإقفالُ في المحرّك، والتقريرُ يسجّله الاختبارُ من خارجه", () => {
    const ids = registeredApprovalTypes().map((t) => t.id).sort()
    expect(ids).toEqual(["box.closing", "unit.report"])
    expect(approvalType("box.closing")?.retractCapability).toBeNull()
  })
})

describe("طلبٌ مجهولٌ يُردّ في كل فعل — لا فعلَ على عدم", () => {
  it("اعتمادٌ ورفضٌ وسحبٌ وتدخّلٌ وكسرُ زجاجٍ وتعديلُ مقفلٍ على معرّفٍ لا وجود له", () => {
    const s = store()
    const ctx = approvalContext("u-square")
    const input = { requestId: "ghost", reasonAr: "سبب" }
    for (const action of [
      approveRequest,
      rejectRequest,
      retractSubmission,
      overrideApprove,
      breakGlassApprove,
      amendLocked,
    ]) {
      const r = action(s, ctx, input)
      expect(!r.ok && r.error.code).toBe("REQUEST_NOT_FOUND")
    }
  })

  it("وتعديلُ المقفل لا يقع على غير مقفل", () => {
    const s = store()
    const request = submitted(s)
    const r = amendLocked(s, approvalContext("u-rabita"), { requestId: request.id, reasonAr: "سبب" })
    expect(!r.ok && r.error.code).toBe("NOT_SUBMITTED")
  })

  it("وتعديلُ المقفل بلا سببٍ مرفوضٌ ولو من الطبقة الأعلى", () => {
    const s = store()
    const request = submitted(s)
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    const r = amendLocked(s, approvalContext("u-rabita"), { requestId: request.id, reasonAr: "  " })
    expect(!r.ok && r.error.code).toBe("REASON_REQUIRED")
  })
})

describe("حمولةٌ فارغةٌ لا تُقدَّم — لا تقديمَ على فراغ (ق-١٠)", () => {
  it("مُولِّدٌ يعيد بنيةً فارغة ⇒ `EMPTY_PAYLOAD`", () => {
    const s = store()
    const ctx = { ...approvalContext("u-amir"), payloadFor: () => ({}) }
    const r = submitForApproval(s, ctx, { typeId: TYPE, unitPath: KHALID_PATH, period: PERIOD })
    expect(!r.ok && r.error.code).toBe("EMPTY_PAYLOAD")
  })
})

describe("سؤالُ القدرة — شخصٌ خارج اللقطة لا يملك شيئاً", () => {
  it("معرّفٌ مجهولٌ في الدليل ⇒ لا", () => {
    const holds = makeCapabilityCheck(canonicalPeople(), READ)
    expect(holds("u-ghost", "report.approve", KHALID_PATH)).toBe(false)
  })

  it("ولا يصير الأقربَ ولا يتدخّل ولا يكسر الزجاج", () => {
    const s = store()
    const request = submitted(s)
    const ctx = approvalContext("u-ghost")
    expect(!approveRequest(s, ctx, { requestId: request.id }).ok).toBe(true)
    const override = overrideApprove(s, ctx, { requestId: request.id, reasonAr: "سبب" })
    expect(!override.ok && override.error.code).toBe("NO_OVERRIDE_CAPABILITY")
    const broken = breakGlassApprove(s, ctx, { requestId: request.id })
    expect(!broken.ok && broken.error.code).toBe("NO_BREAK_GLASS_CAPABILITY")
  })
})

describe("الإعداداتُ تُقرأ بأنواعٍ صريحة — والنوعُ الخاطئ خطأٌ برمجيٌّ يُرمى", () => {
  const wrong: SettingsResolver = () => "نصٌّ مكان رقم"
  const ctx = { now: NOW, settings: wrong }

  it("مدةُ القفل الرجعيّ ليست رقماً ⇒ يرمي", () => {
    expect(() => isPeriodTimeLocked(ctx, KHALID_PATH, PERIOD)).toThrow(/ليس رقماً/)
  })

  it("ومدةُ التصعيد كذلك", () => {
    expect(() => escalationDays(ctx, KHALID_PATH)).toThrow(/ليس رقماً/)
  })

  it("ومفتاحُ السحب ليس مفتاحاً ⇒ يرمي", () => {
    expect(() => isWithdrawalEnabled(ctx, KHALID_PATH)).toThrow(/ليس مفتاحاً/)
  })
})

describe("المستودعُ: مفتاحٌ طبيعيٌّ · ذرّيةٌ · وسجلٌّ لا يُمحى", () => {
  it("المفتاحُ الطبيعيُّ لا يُطابق وحدةً أخرى ولا فترةً أخرى", () => {
    const s = store()
    const request = submitted(s)
    expect(s.findByKey(TYPE, KHALID_PATH, PERIOD.id)?.id).toBe(request.id)
    expect(s.findByKey(TYPE, "/men/homs/", PERIOD.id)).toBeNull()
    expect(s.findByKey(TYPE, KHALID_PATH, "1440-01")).toBeNull()
    expect(s.getRequest("ghost")).toBeNull()
  })

  it("والمعاملةُ ترتدّ بكاملها: طلبٌ وإشعارٌ وتدقيقٌ معاً (ع-٣٣)", () => {
    const s = store()
    submitted(s)
    const requestsBefore = s.requests().length
    const noticesBefore = s.notices().length
    const auditBefore = s.audit().length
    expect(() =>
      s.transaction(() => {
        s.appendNotice({ at: NOW, kind: "escalation", requestId: "x", recipients: [] })
        s.appendAudit({ at: NOW, actorPersonId: "u-x", action: "a", targetId: "x", scopePath: "/", reason: null })
        throw new Error("عطبٌ في منتصف الدفعة")
      }),
    ).toThrow()
    expect(s.requests()).toHaveLength(requestsBefore)
    expect(s.notices()).toHaveLength(noticesBefore)
    expect(s.audit()).toHaveLength(auditBefore)
  })

  it("وكلُّ فعلٍ يترك أثراً في سجلٍّ لا يُمحى (المادة ٤/٨)", () => {
    const s = store()
    const request = submitted(s)
    rejectRequest(s, approvalContext("u-square"), { requestId: request.id, reasonAr: "ناقص" })
    submitForApproval(s, approvalContext("u-amir"), { typeId: TYPE, unitPath: KHALID_PATH, period: PERIOD })
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    expect(s.audit().map((a) => a.action)).toEqual([
      "approval.submit",
      "approval.reject",
      "approval.submit",
      "approval.approve",
    ])
    expect(s.audit().every((a) => a.tenantId === MAIN_TENANT_ID && a.scopePath === KHALID_PATH)).toBe(true)
  })
})

describe("سجلُّ الشبكات ونتائجُ العمل", () => {
  it("`has` يعرف ما أُنشئ ولا يخترع شبكة", () => {
    const registry = new ApprovalTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)
    registry.storesFor(MAIN_TENANT_ID)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has(SECOND_TENANT_ID)).toBe(false)
  })

  it("والخطأُ قيمةٌ مصنَّفةٌ بتفصيلٍ اختياريّ", () => {
    expect(approvalOk("قيمة")).toEqual({ ok: true, value: "قيمة" })
    expect(approvalErr("LOCKED")).toEqual({ ok: false, error: { code: "LOCKED" } })
    expect(approvalErr("LOCKED", "apr-1")).toEqual({ ok: false, error: { code: "LOCKED", detail: "apr-1" } })
  })

  // **آخرُ اختبارٍ في المِلفّ عمداً**: تفريغُ السجل يُفقد الأنواعَ لِما بعده.
  it("وتفريغُ السجل يُفرغه — أداةُ اختبارٍ معلنةٌ لا بابٌ خلفيّ", () => {
    clearApprovalTypesForTests()
    expect(registeredApprovalTypes()).toEqual([])
    expect(approvalType(TYPE)).toBeNull()
  })
})
