/**
 * **الزيارةُ الإشرافية: سلسلةُ ق-١٦ عبر المحرّك، وصفرُ سطرِ اعتمادٍ في وحدة الإشراف.**
 *
 * ق-١٦ نصاً: «من يزور الحلقة ومن يعتمد الزيارة = الأقرب. المشرفُ يزور ما هو أقرب طبقةٍ له،
 * **يرفع زيارته فتظهر عند الأقرب فوقه (لا المدير)، ولا يعتمد زيارته بنفسه**». وهذا كلُّه
 * **سلوكُ المحرّك** — والتسجيلُ هنا **سطرُ بيان**: نوعٌ يعلن كيانَه وقدراته وأثرَي بتّه.
 *
 * وثلاثةُ ثوابتٍ تُقاس هنا بعينها:
 *  ١. **المرساةُ وحدةُ الزائر**: زيارةُ المربع تصعد إلى **المنطقة** لا إلى المدير (عطبُ v1).
 *  ٢. **الشغورُ يصعد تلقائياً** (ق-٢): زيارةٌ مرساتُها المنطقة يعتمدها رأسُ القسم.
 *  ٣. **اسمُ المعتمِد يصل الوحدةَ بالمنفذ** (ق-١٠٢) — من طرف السلسلة إلى طرف العرض.
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  SUPERVISION_VISIT,
  supervisionVisitPayloadSource,
  supervisionVisitPeriodOf,
  supervisionVisitVerdict,
} from "../../../src/features/approval/registered/supervisionVisit.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
  type ApprovalContext,
} from "../../../src/features/approval/services/engine.js"
import {
  breakGlassApprove,
  overrideApprove,
} from "../../../src/features/approval/services/exceptions.js"
import { pendingForApprover } from "../../../src/features/approval/services/inbox.js"
import { recordVisit } from "../../../src/features/supervision/services/visits.js"
import { visitsInScope } from "../../../src/features/supervision/services/views.js"
import type { SupervisionStore } from "../../../src/features/supervision/data/store.js"
import type { SupervisionVisit } from "../../../src/features/supervision/types.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  BASEERA_DETAILS,
  C1,
  C2,
  CORE,
  HOMS_PATH,
  NOW,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  canonicalPeople,
  seedSupervisionStore,
  supervisionContext,
} from "../supervision/_seed.js"

type World = { readonly supervision: SupervisionStore; readonly approval: ApprovalStore }

function world(): World {
  return { supervision: seedSupervisionStore(), approval: new ApprovalStore("t-main") }
}

function approvalContext(
  w: World,
  actorPersonId: string,
  options: { readonly people?: readonly Actor[] } = {},
): ApprovalContext {
  const people = options.people ?? canonicalPeople()
  return {
    now: NOW,
    actorPersonId,
    people,
    settings: createSettingsResolver([]),
    holds: makeCapabilityCheck(people, { now: NOW, intent: "read", isFeatureEnabled: () => true }),
    payloadFor: supervisionVisitPayloadSource(w.supervision),
  }
}

/** زيارةٌ مسجَّلةٌ بالمسار المشروع — ثم تُرفع للاعتماد كما يرفعها صاحبُها. */
function visited(w: World, personId: string, targetId: string): SupervisionVisit {
  const details = targetId === C2 ? BASEERA_DETAILS : TAHFEEZ_DETAILS
  const r = recordVisit(w.supervision, supervisionContext(personId), {
    targetId,
    visitedAt: NOW,
    core: CORE,
    details,
  })
  if (!r.ok) throw new Error(`تعذّر تسجيلُ الزيارة: ${r.error.code}`)
  return r.value
}

function submit(w: World, visit: SupervisionVisit, personId: string) {
  return submitForApproval(w.approval, approvalContext(w, personId), {
    typeId: SUPERVISION_VISIT.id,
    unitPath: visit.supervisorPath,
    period: supervisionVisitPeriodOf(visit),
  })
}

describe("النوعُ **بيانٌ يُعلن** — لا وحدةُ منطقٍ تُكتب (عقدُ المحرّك §٧)", () => {
  it("مسجَّلٌ بقدرتَي الزيارة ونطاقُه وحدة، وحرّاسُه لا تُعطَّل", () => {
    expect(SUPERVISION_VISIT.id).toBe("supervision.visit")
    expect(SUPERVISION_VISIT.scopeKind).toBe("unit")
    expect(SUPERVISION_VISIT.submitCapability).toBe("visit.conduct")
    expect(SUPERVISION_VISIT.approveCapability).toBe("visit.approve")
    expect(SUPERVISION_VISIT.approvalLocks).toBe(true)
    expect(SUPERVISION_VISIT.rejectionReturnsToDraft).toBe(true)
    expect(SUPERVISION_VISIT.rejectionRequiresReason).toBe(true)
  })

  it("**ولا مسارَ سحبٍ ولا تدخّلٍ فوقيٍّ لهذا النوع** — ما لم يُعلَن لا يُمارَس", () => {
    expect(SUPERVISION_VISIT.overrideCapability).toBeNull()
    expect(SUPERVISION_VISIT.retractCapability).toBeNull()
  })

  it("**والحمولةُ تُشتقّ من الزيارة المسجَّلة**: زيارةٌ لا وجود لها ⇒ حمولةٌ فارغةٌ ⇒ رفض", () => {
    const w = world()
    const r = submitForApproval(w.approval, approvalContext(w, "u-square"), {
      typeId: SUPERVISION_VISIT.id,
      unitPath: SQ2_PATH,
      period: { id: "vst-ghost", endsAt: NOW },
    })
    expect(!r.ok && r.error.code).toBe("EMPTY_PAYLOAD")
  })
})

describe("ق-١٦ — يرفعها فيعتمدها **الأقربُ فوقه**، ولا يعتمدها بنفسه", () => {
  it("**زيارةُ المربع تصعد إلى المنطقة** — والمنطقةُ تعتمد فتُقفل", () => {
    const w = world()
    const visit = visited(w, "u-square", C1)
    const submitted = submit(w, visit, "u-square")
    expect(submitted.ok && submitted.value.unitPath).toBe(SQ2_PATH)

    const decided = approveRequest(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(decided.ok && decided.value.state).toBe("approved")
    expect(decided.ok && decided.value.route).toBe("nearest")
    expect(decided.ok && decided.value.approvedBy).toBe("u-rabita")
    expect(decided.ok && decided.value.lockedAt).not.toBeNull()
  })

  it("**ومَن ليس الأقربَ مردودٌ ولو ملك القدرة** — رأسُ القسم فوق منطقةٍ حيّة", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")
    const r = approveRequest(w.approval, approvalContext(w, "u-section-head"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!r.ok && r.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**والزائرُ لا يعتمد زيارتَه** — استحالةٌ من الخوارزمية: وحدتُه ليست من أسلافها", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")
    const r = approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!r.ok && r.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**ولا المديرُ** (ق-٣/ق-٤): لا يعتمد ولا يظهر في صندوق «بانتظار اعتمادك»", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")

    const decided = approveRequest(w.approval, approvalContext(w, "u-admin"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!decided.ok && decided.error.code).toBe("NOT_NEAREST_LAYER")

    expect(
      pendingForApprover(w.approval, approvalContext(w, "u-admin"), {
        typeId: SUPERVISION_VISIT.id,
        scopePath: "/",
      }),
    ).toEqual([])
    expect(
      pendingForApprover(w.approval, approvalContext(w, "u-rabita"), {
        typeId: SUPERVISION_VISIT.id,
        scopePath: HOMS_PATH,
      }),
    ).toHaveLength(1)
  })

  it("**والشغورُ يصعد تلقائياً** (ق-٢): زيارةُ المنطقة يعتمدها رأسُ القسم", () => {
    const w = world()
    // المربعُ السابع شاغرٌ عمداً، فمسؤولُ المنطقة هو أقربُ من يزور حلقتَه.
    const visit = visited(w, "u-rabita", C2)
    expect(visit.supervisorPath).toBe(HOMS_PATH)

    const submitted = submit(w, visit, "u-rabita")
    const decided = approveRequest(w.approval, approvalContext(w, "u-section-head"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(decided.ok && decided.value.state).toBe("approved")
  })

  it("**والرفضُ بسببٍ إلزاميّ يعيدها مسودةً** ويُشعر الزائر (ق-٧)", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")

    const bare = rejectRequest(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!bare.ok && bare.error.code).toBe("REASON_REQUIRED")

    const rejected = rejectRequest(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
      reasonAr: "النموذجُ ناقصُ الملاحظة الميدانية",
    })
    expect(rejected.ok && rejected.value.state).toBe("draft")
    expect(
      w.approval.notices().some((n) => n.kind === "rejected" && n.recipients.includes("u-square")),
    ).toBe(true)
  })

  it("**ولا سحبَ ولا تدخّلَ فوقيّ**: ما لم يُعلَن في النوع مردودٌ صراحةً", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")
    const id = submitted.ok ? submitted.value.id : ""

    const retracted = retractSubmission(w.approval, approvalContext(w, "u-square"), { requestId: id })
    expect(!retracted.ok && retracted.error.code).toBe("RETRACT_NOT_AVAILABLE")

    const overridden = overrideApprove(w.approval, approvalContext(w, "u-section-head"), {
      requestId: id,
      reasonAr: "تدخّلٌ فوقيّ",
    })
    expect(!overridden.ok && overridden.error.code).toBe("OVERRIDE_NOT_AVAILABLE")
  })

  it("**وكسرُ الزجاج مردودٌ ما دامت طبقةٌ نشطة** (ق-٣)", () => {
    const w = world()
    const submitted = submit(w, visited(w, "u-square", C1), "u-square")
    const r = breakGlassApprove(w.approval, approvalContext(w, "u-admin"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!r.ok && r.error.code).toBe("LAYER_NOT_VACANT")
  })
})

describe("ق-٨ — القفل: المعتمَدةُ لا يُكتب عليها ولا تُرفع ثانيةً", () => {
  it("**اعتمادٌ ثانٍ مردود، وإعادةُ رفعِ الزيارة نفسِها مردودة**", () => {
    const w = world()
    const visit = visited(w, "u-square", C1)
    const submitted = submit(w, visit, "u-square")
    const id = submitted.ok ? submitted.value.id : ""

    approveRequest(w.approval, approvalContext(w, "u-rabita"), { requestId: id })

    const again = approveRequest(w.approval, approvalContext(w, "u-rabita"), { requestId: id })
    expect(!again.ok && again.error.code).toBe("LOCKED")

    const resubmitted = submit(w, visit, "u-square")
    expect(!resubmitted.ok && resubmitted.error.code).toBe("DUPLICATE_PERIOD")
  })
})

describe("ق-١٠٢ — **اسمُ المعتمِد يصل وحدةَ الإشراف بالمنفذ** (من طرف السلسلة إلى طرف العرض)", () => {
  it("قبل الاعتماد: بلا معتمِد. وبعده: **باسم مَن اعتمد** — بلا حقلٍ يُملأ يدوياً", () => {
    const w = world()
    const visit = visited(w, "u-square", C1)
    const verdictOf = supervisionVisitVerdict(w.approval)

    const before = visitsInScope(w.supervision, supervisionContext("u-rabita", { verdictOf }), SQ2_PATH)
    expect(before[0]?.verdict.approved).toBe(false)
    expect(before[0]?.verdict.approvedByPersonId).toBeNull()

    const submitted = submit(w, visit, "u-square")
    approveRequest(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })

    const after = visitsInScope(w.supervision, supervisionContext("u-rabita", { verdictOf }), SQ2_PATH)
    expect(after[0]?.verdict.approved).toBe(true)
    expect(after[0]?.verdict.approvedByPersonId).toBe("u-rabita")
  })

  it("**والمرفوضةُ ليست معتمَدة** — العودةُ إلى المسودة تُسقط الحكمَ ولا تُبقي اسماً", () => {
    const w = world()
    const visit = visited(w, "u-square", C1)
    const submitted = submit(w, visit, "u-square")
    rejectRequest(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
      reasonAr: "أعد الزيارةَ بحضورٍ أوسع",
    })

    const seen = visitsInScope(
      w.supervision,
      supervisionContext("u-rabita", { verdictOf: supervisionVisitVerdict(w.approval) }),
      SQ2_PATH,
    )
    expect(seen[0]?.verdict.approved).toBe(false)
    expect(seen[0]?.verdict.approvedByPersonId).toBeNull()
  })
})
