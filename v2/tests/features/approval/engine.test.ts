/**
 * ق-٥/ق-٧/ق-٨/ق-٩/ق-١١ + ب-٣٠(أ/ب/ج) — **آلةُ الحالات وحرّاسُها** (عقدُ الوحدة §٢/§٤/§٥).
 *
 * ستةٌ من الثلاثةَ عشرَ الإلزامية تعيش هنا: القدرةُ لازمةٌ لا كافية · ب-٣٠أ · الرفض · القفل ·
 * لا اعتمادَ ذاتياً · السحب · التصعيد الإشعاريّ. وكلُّ حارسٍ يُختبر **بالخرق** لا بالوصف.
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
} from "../../../src/features/approval/services/engine.js"
import {
  amendLocked,
} from "../../../src/features/approval/services/exceptions.js"
import {
  escalationNoticesFor,
  pendingForApprover,
} from "../../../src/features/approval/services/inbox.js"
import { approverLayerFor } from "../../../src/features/approval/services/routing.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import type { ApprovalRequest } from "../../../src/features/approval/types.js"
import {
  HOMS_APPROVERS,
  KHALID_PATH,
  NOW,
  OLD_PERIOD,
  OMAR_PATH,
  PERIOD,
  READ,
  LAYERS_ABOVE_KHALID,
  SQ2_APPROVERS,
  SQ2_PATH,
  approvalContext,
  canonicalPeople,
  peopleWithout,
  withEndedAssignments,
} from "./_seed.js"

const TYPE = "unit.report"

function store(): ApprovalStore {
  return new ApprovalStore("t-main")
}

/** تقديمٌ ناجحٌ من أمير مسجد خالد — نقطةُ البدء لأكثر الحالات. */
function submitted(s: ApprovalStore, submitter = "u-amir", unitPath = KHALID_PATH): ApprovalRequest {
  const result = submitForApproval(s, approvalContext(submitter), {
    typeId: TYPE,
    unitPath,
    period: PERIOD,
  })
  if (!result.ok) throw new Error(`تعذّر التقديم: ${result.error.code}`)
  return result.value
}

describe("ق-٥ + ب-٣٠أ — لا اعتمادَ لمسودة، والتجاوزُ المنسوخُ لا أثرَ له", () => {
  it("طلبٌ لم يُقدَّم بعدُ لا يُعتمد — الاعتمادُ لا يقع إلا على **مقدَّم**", () => {
    const s = store()
    const request = submitted(s)
    const retracted = retractSubmission(s, approvalContext("u-amir"), { requestId: request.id })
    expect(retracted.ok && retracted.value.state).toBe("draft")

    const decided = approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    expect(decided.ok).toBe(false)
    expect(!decided.ok && decided.error.code).toBe("NOT_SUBMITTED")
  })

  /**
   * **CR-009 مُنفَّذ**: البندُ الذي كان يَعِد بإحياء ق-٦ (المنسوخة بب-٣٠أ) **شُطب من السجل**.
   * فالحارسُ اليوم مضاعَف: لا المحرّكُ يقرؤه (لم يقرأه قط)، **ولا السجلُّ يعرفه أصلاً** —
   * ومحاولةُ ضبطه ترتدّ من مُحلِّل الإعدادات نفسِه قبل أن تبلغ المحرّك.
   */
  it("**`approval.draft_bypass_enabled` غيرُ مسجَّلٍ فلا يُقرأ ولا يُضبط** (CR-009)", () => {
    expect(() =>
      approvalContext("u-square", {
        settings: [
          {
            settingId: "approval.draft_bypass_enabled",
            scopePath: "/",
            value: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }),
    ).toThrow(/غير مسجَّل/)
  })

  it("**واعتمادُ المسودة يبقى مردوداً** مهما ضُبط من إعدادات — ب-٣٠أ حارسٌ لا يُشترى", () => {
    const s = store()
    const request = submitted(s)
    retractSubmission(s, approvalContext("u-amir"), { requestId: request.id })

    const decided = approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    expect(!decided.ok && decided.error.code).toBe("NOT_SUBMITTED")
  })

  it("والتقديمُ مرتين لنفس الوحدة والفترة مرفوض (ق-٦٧: فريدٌ لكل وحدة/فترة)", () => {
    const s = store()
    submitted(s)
    const again = submitForApproval(s, approvalContext("u-amir"), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(!again.ok && again.error.code).toBe("ALREADY_SUBMITTED")
  })

  it("ونوعٌ غير مسجَّلٍ في المحرّك لا يُقدَّم أصلاً", () => {
    const s = store()
    const result = submitForApproval(s, approvalContext("u-amir"), {
      typeId: "visit.report",
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(!result.ok && result.error.code).toBe("UNKNOWN_APPROVAL_TYPE")
  })
})

describe("ق-١ — القدرةُ لازمةٌ لا كافية: **الأقربُ حصراً يعتمد**", () => {
  it("الأقربُ (المربع) يعتمد ⇒ معتمَدٌ مقفلٌ بطريقٍ «الأقرب»", () => {
    const s = store()
    const request = submitted(s)
    const decided = approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    expect(decided.ok).toBe(true)
    expect(decided.ok && decided.value.state).toBe("approved")
    expect(decided.ok && decided.value.route).toBe("nearest")
    expect(decided.ok && decided.value.approvedBy).toBe("u-square")
    expect(decided.ok && decided.value.lockedAt).not.toBeNull()
  })

  it("**طبقةٌ أعلى من الأقرب تعتمد ⇒ مرفوضة** ولو ملكت القدرةَ على نطاقٍ يحتوي الوحدة", () => {
    const s = store()
    const request = submitted(s)
    const holds = makeCapabilityCheck(canonicalPeople(), READ)
    expect(holds("u-rabita", "report.approve", KHALID_PATH)).toBe(true) // القدرة: نعم

    const decided = approveRequest(s, approvalContext("u-rabita"), { requestId: request.id })
    expect(!decided.ok && decided.error.code).toBe("NOT_NEAREST_LAYER") // والأقربيّة: لا
    expect(s.getRequest(request.id)?.state).toBe("submitted")
  })

  it("ومَن لا قدرةَ له أصلاً مرفوضٌ كذلك — الشرطان مستقلّان ومتلازمان", () => {
    const s = store()
    const request = submitted(s)
    const decided = approveRequest(s, approvalContext("u-teacher"), { requestId: request.id })
    expect(!decided.ok && decided.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("وتفريغُ تكليف الأقرب يفتح الاعتمادَ للمنطقة **بلا تغيير سطرِ كود** (ق-٢)", () => {
    const s = store()
    const request = submitted(s)
    const options = { people: withEndedAssignments(...SQ2_APPROVERS) }
    const decided = approveRequest(s, approvalContext("u-rabita", options), {
      requestId: request.id,
    })
    expect(decided.ok && decided.value.approvedBy).toBe("u-rabita")
  })
})

describe("ق-٩ — لا اعتمادَ ذاتياً: الحارسُ على **الشخص** لا على الدور", () => {
  it("مَن قدّم العملَ لا يعتمده ولو كان هو الطبقةَ الأقربَ بعينها", () => {
    const s = store()
    // مسجدُ عمر تحت مربعٍ شاغر ⇒ الأقربُ المنطقة؛ فإن قدّمت المنطقةُ عنه فهي المقدِّمة والأقرب معاً.
    const request = submitted(s, "u-rabita", OMAR_PATH)
    const layer = approverLayerFor(
      { now: NOW, people: canonicalPeople(), holds: makeCapabilityCheck(canonicalPeople(), READ) },
      "report.approve",
      OMAR_PATH,
    )
    expect(layer.kind === "layer" && layer.approvers).toContain("u-rabita")

    const decided = approveRequest(s, approvalContext("u-rabita"), { requestId: request.id })
    expect(!decided.ok && decided.error.code).toBe("SELF_APPROVAL_REJECTED")
  })

  it("وزميلُه في الطبقة نفسِها يعتمد — الحارسُ على الشخص، والطبقةُ لا تُشلّ", () => {
    const s = store()
    const request = submitted(s, "u-rabita", OMAR_PATH)
    const decided = approveRequest(s, approvalContext(HOMS_APPROVERS[0]), { requestId: request.id })
    expect(decided.ok && decided.value.approvedBy).toBe(HOMS_APPROVERS[0])
  })
})

describe("ق-٧ — الرفضُ فرديٌّ بسببٍ إلزاميّ يعيد مسودةً ويُشعر المقدِّم", () => {
  it("رفضٌ بلا سبب ⇒ مرفوض", () => {
    const s = store()
    const request = submitted(s)
    const rejected = rejectRequest(s, approvalContext("u-square"), {
      requestId: request.id,
      reasonAr: "   ",
    })
    expect(!rejected.ok && rejected.error.code).toBe("REASON_REQUIRED")
    expect(s.getRequest(request.id)?.state).toBe("submitted")
  })

  it("ورفضٌ بسببٍ ⇒ يعيد الحالةَ مسودةً ويحفظ السببَ ويُشعر المقدِّم وحده", () => {
    const s = store()
    const request = submitted(s)
    const rejected = rejectRequest(s, approvalContext("u-square"), {
      requestId: request.id,
      reasonAr: "الأرقامُ ناقصةٌ في الأسبوع الثالث",
    })
    expect(rejected.ok && rejected.value.state).toBe("draft")
    expect(rejected.ok && rejected.value.lastRejection?.reasonAr).toBe(
      "الأرقامُ ناقصةٌ في الأسبوع الثالث",
    )
    const notice = s.notices().filter((n) => n.kind === "rejected")
    expect(notice).toHaveLength(1)
    expect(notice[0]?.recipients).toEqual(["u-amir"])
  })

  it("ومَن ليس الطبقةَ الأقربَ لا يرفضها كما لا يعتمدها", () => {
    const s = store()
    const request = submitted(s)
    const rejected = rejectRequest(s, approvalContext("u-rabita"), {
      requestId: request.id,
      reasonAr: "سببٌ وجيه",
    })
    expect(!rejected.ok && rejected.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("والمردودُ يُعاد تقديمُه فيرجع إلى الطابور (السلسلةُ لا تنقطع)", () => {
    const s = store()
    const request = submitted(s)
    rejectRequest(s, approvalContext("u-square"), { requestId: request.id, reasonAr: "ناقص" })
    const again = submitForApproval(s, approvalContext("u-amir"), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(again.ok && again.value.state).toBe("submitted")
    expect(again.ok && again.value.id).toBe(request.id)
  })
})

describe("ق-٨ — القفل: لا كتابةَ على معتمَد، وتعديلُ المقفل للطبقات الأعلى حصراً", () => {
  it("كلُّ فعلٍ على معتمَدٍ مردود: تقديمٌ ثانٍ · رفضٌ · سحب", () => {
    const s = store()
    const request = submitted(s)
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })

    const resubmit = submitForApproval(s, approvalContext("u-amir"), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(!resubmit.ok && resubmit.error.code).toBe("DUPLICATE_PERIOD")

    const rejected = rejectRequest(s, approvalContext("u-square"), {
      requestId: request.id,
      reasonAr: "بدا لي",
    })
    expect(!rejected.ok && rejected.error.code).toBe("LOCKED")

    const retracted = retractSubmission(s, approvalContext("u-amir"), { requestId: request.id })
    expect(!retracted.ok && retracted.error.code).toBe("LOCKED")
  })

  it("**وتعديلُ المقفل من غير الطبقات الأعلى مرفوض** — ولو كان صاحبَ الوحدة", () => {
    const s = store()
    const request = submitted(s)
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })

    const byOwner = amendLocked(s, approvalContext("u-amir"), {
      requestId: request.id,
      reasonAr: "أريد التصحيح",
    })
    expect(!byOwner.ok && byOwner.error.code).toBe("NOT_ABOVE_UNIT")
  })

  it("وطبقةٌ أعلى تملك `records.editLocked` تفتحه بسببٍ مدقَّق", () => {
    const s = store()
    const request = submitted(s)
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })

    const amended = amendLocked(s, approvalContext("u-rabita"), {
      requestId: request.id,
      reasonAr: "تصحيحُ رقمٍ بطلبٍ من المسجد",
    })
    expect(amended.ok && amended.value.state).toBe("draft")
    expect(amended.ok && amended.value.lockedAt).toBeNull()
    expect(s.audit().some((a) => a.action === "approval.amendLocked")).toBe(true)
  })

  it("والمربعُ لا يفتح المقفل: `records.editLocked` ليست في حزمته (المصفوفةُ هي الحقيقة)", () => {
    const s = store()
    const request = submitted(s)
    approveRequest(s, approvalContext("u-square"), { requestId: request.id })
    const amended = amendLocked(s, approvalContext("u-square"), {
      requestId: request.id,
      reasonAr: "أعيدُ النظر",
    })
    expect(!amended.ok && amended.error.code).toBe("NOT_ABOVE_UNIT")
  })
})

describe("ب-٣٩د/قب-٦ — القفلُ الزمنيّ **إعدادٌ حيّ** لا رقمٌ صلب", () => {
  it("فترةٌ انتهت منذ أكثر من مدة القفل ⇒ تقديمٌ مرفوض", () => {
    const s = store()
    const result = submitForApproval(s, approvalContext("u-amir"), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: OLD_PERIOD,
    })
    expect(!result.ok && result.error.code).toBe("PERIOD_TIME_LOCKED")
  })

  it("**ورفعُ الإعداد وحده يقبلها — بلا تغيير سطرِ كود**", () => {
    const s = store()
    const generous = approvalContext("u-amir", {
      settings: [
        {
          settingId: "records.backdate_lock_days",
          scopePath: "/men/",
          value: 400,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const result = submitForApproval(s, generous, {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: OLD_PERIOD,
    })
    expect(result.ok && result.value.state).toBe("submitted")
  })
})

describe("ب-٣٠ج — السحبُ للمقدِّم قبل الاعتماد وحده", () => {
  it("غيرُ المقدِّم لا يسحب", () => {
    const s = store()
    const request = submitted(s)
    const retracted = retractSubmission(s, approvalContext("u-square"), { requestId: request.id })
    expect(!retracted.ok && retracted.error.code).toBe("NOT_SUBMITTER")
  })

  it("والمقدِّمُ يسحب فيعود مسودةً ويخرج من طابور الأقرب", () => {
    const s = store()
    const request = submitted(s)
    expect(pendingForApprover(s, approvalContext("u-square"), { typeId: TYPE, scopePath: "/" })).toHaveLength(1)

    const retracted = retractSubmission(s, approvalContext("u-amir"), { requestId: request.id })
    expect(retracted.ok && retracted.value.state).toBe("draft")
    expect(pendingForApprover(s, approvalContext("u-square"), { typeId: TYPE, scopePath: "/" })).toHaveLength(0)
  })

  it("وإطفاءُ `approval.amir_can_withdraw` يمنع السحب — سياسةٌ تُضبط، لا حارسٌ يُعطَّل", () => {
    const s = store()
    const request = submitted(s)
    const noWithdraw = approvalContext("u-amir", {
      settings: [
        {
          settingId: "approval.amir_can_withdraw",
          scopePath: "/",
          value: false,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const retracted = retractSubmission(s, noWithdraw, { requestId: request.id })
    expect(!retracted.ok && retracted.error.code).toBe("RETRACT_DISABLED")
  })
})

describe("ق-١١ + ب-٣٠ب — الإشعارُ للأقرب وحده، والتصعيدُ **إشعاريٌّ لا يفتح صلاحية**", () => {
  it("التقديمُ يُشعر مرشّحي الطبقة الأقرب **وحدهم** — لا الأعلى ولا الإدارة", () => {
    const s = store()
    submitted(s)
    const notices = s.notices().filter((n) => n.kind === "approvalNeeded")
    expect(notices).toHaveLength(1)
    expect(notices[0]?.recipients).toEqual([...SQ2_APPROVERS])
    expect(notices[0]?.recipients).not.toContain("u-rabita")
    expect(notices[0]?.recipients).not.toContain("u-admin")
  })

  it("وصندوقُ «بانتظار اعتمادك» يعرض ما أنا الأقربُ له وحده", () => {
    const s = store()
    submitted(s)
    const forNearest = pendingForApprover(s, approvalContext("u-square"), { typeId: TYPE, scopePath: "/" })
    expect(forNearest).toHaveLength(1)
    for (const person of ["u-rabita", "u-section-head", "u-admin"]) {
      expect(
        pendingForApprover(s, approvalContext(person), { typeId: TYPE, scopePath: "/" }),
        person,
      ).toHaveLength(0)
    }
  })

  it("**ومرورُ مدة التصعيد لا يمنح أحداً صلاحيةَ اعتماد**: يُذكَّر المرشّحون أنفسُهم لا غيرُهم", () => {
    const s = store()
    const request = submitted(s)
    const later = new Date("2026-08-20T00:00:00.000Z")

    const notices = escalationNoticesFor(s, approvalContext("u-admin", { now: later }), { typeId: TYPE })
    expect(notices).toHaveLength(1)
    expect(notices[0]?.recipients).toEqual([...SQ2_APPROVERS])

    // والتوجيهُ نفسُه لم يتغيّر — والمنطقةُ ما تزال مرفوضة بعد المدة.
    const decided = approveRequest(s, approvalContext("u-rabita", { now: later }), {
      requestId: request.id,
    })
    expect(!decided.ok && decided.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("ولا تصعيدَ لما لم تمضِ مدتُه", () => {
    const s = store()
    submitted(s)
    expect(escalationNoticesFor(s, approvalContext("u-admin"), { typeId: TYPE })).toHaveLength(0)
  })

  it("ولا يخلط المحرّكُ نوعاً بنوع: الطابورُ والتصعيدُ لنوعِ الطلب وحده", () => {
    const s = store()
    submitted(s)
    const ctx = approvalContext("u-square")
    expect(pendingForApprover(s, ctx, { typeId: "box.closing", scopePath: "/" })).toHaveLength(0)
    const later = approvalContext("u-admin", { now: new Date("2026-08-20T00:00:00.000Z") })
    expect(escalationNoticesFor(s, later, { typeId: "box.closing" })).toHaveLength(0)
  })

  it("ولا يعرض الطابورُ ما خارج نطاقِ السؤال (ق-١٧: الاطّلاعُ بالنطاق)", () => {
    const s = store()
    submitted(s)
    const ctx = approvalContext("u-square")
    expect(pendingForApprover(s, ctx, { typeId: TYPE, scopePath: SQ2_PATH })).toHaveLength(1)
    expect(pendingForApprover(s, ctx, { typeId: TYPE, scopePath: "/men/homs/sq7/" })).toHaveLength(0)
  })

  it("**وعند الشغور الكليّ يُصعَّد إلى حاملي كسر الزجاج** — الإشعارُ يتبع التوجيه دائماً", () => {
    const s = store()
    const vacant = { people: peopleWithout(...LAYERS_ABOVE_KHALID) }
    submitForApproval(s, approvalContext("u-amir", vacant), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    const later = approvalContext("u-admin", {
      ...vacant,
      now: new Date("2026-08-20T00:00:00.000Z"),
    })
    const notices = escalationNoticesFor(s, later, { typeId: TYPE })
    expect(notices).toHaveLength(1)
    expect(notices[0]?.recipients).toEqual(["u-admin"])
  })
})
