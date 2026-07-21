/**
 * ق-٣ + ق-١٢ — **المخرجان المحكومان**: كسرُ الزجاج والتدخلُ الفوقيّ (عقدُ الوحدة §٣).
 *
 * كلاهما بابٌ ضيّقٌ **بأثرٍ مدقَّقٍ ظاهر**؛ وشرطُهما يُختبر بالخرق: مع وجود طبقةٍ نشطةٍ
 * يُرفض كسرُ الزجاج، ومَن ليس **أعلى** من الأقرب لا يتدخّل فوقياً.
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  submitForApproval,
} from "../../../src/features/approval/services/engine.js"
import {
  breakGlassApprove,
  overrideApprove,
} from "../../../src/features/approval/services/exceptions.js"
import type { ApprovalRequest } from "../../../src/features/approval/types.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  KHALID_PATH,
  LAYERS_ABOVE_KHALID,
  OMAR_PATH,
  PERIOD,
  approvalContext,
  peopleWithout,
} from "./_seed.js"

const TYPE = "unit.report"
const VACANT = { people: peopleWithout(...LAYERS_ABOVE_KHALID) }

function submittedIn(s: ApprovalStore, options = {}): ApprovalRequest {
  const result = submitForApproval(s, approvalContext("u-amir", options), {
    typeId: TYPE,
    unitPath: KHALID_PATH,
    period: PERIOD,
  })
  if (!result.ok) throw new Error(`تعذّر التقديم: ${result.error.code}`)
  return result.value
}

describe("ق-٣ — كسرُ الزجاج: **عند شغور كل الطبقات وحده**", () => {
  it("مع وجود طبقةٍ نشطةٍ ⇒ **مرفوض** ولو ملك كاسرُه القدرةَ على الجذر", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s)
    const broken = breakGlassApprove(s, approvalContext("u-admin"), { requestId: request.id })
    expect(!broken.ok && broken.error.code).toBe("LAYER_NOT_VACANT")
    expect(s.getRequest(request.id)?.state).toBe("submitted")
  })

  it("وعند شغور الكلّ ⇒ مقبولٌ **بأثرٍ متميّزٍ مدقَّق**", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s, VACANT)
    const broken = breakGlassApprove(s, approvalContext("u-admin", VACANT), {
      requestId: request.id,
    })
    expect(broken.ok && broken.value.state).toBe("approved")
    expect(broken.ok && broken.value.route).toBe("breakGlass")
    expect(broken.ok && broken.value.approvedBy).toBe("u-admin")
    expect(s.audit().some((a) => a.action === "approval.breakGlass")).toBe(true)
  })

  it("وعند الشغور يُشعَر حاملو كسر الزجاج **وحدهم** (ق-١١: الإشعارُ يتبع التوجيه)", () => {
    const s = new ApprovalStore("t-main")
    submittedIn(s, VACANT)
    const notices = s.notices().filter((n) => n.kind === "approvalNeeded")
    expect(notices[0]?.recipients).toEqual(["u-admin"])
  })

  it("**ومَن لا يملك `approve.breakGlass` لا يكسر ولو شغر الكلّ** — الشغورُ لا يفتح البابَ للجميع", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s, VACANT)
    const broken = breakGlassApprove(s, approvalContext("u-amir-bilal", VACANT), {
      requestId: request.id,
    })
    expect(!broken.ok && broken.error.code).toBe("NO_BREAK_GLASS_CAPABILITY")
  })

  it("ولا يكسرُ الزجاجَ مقدِّمُ العمل نفسُه (ق-٩ يسري على كل المخارج)", () => {
    const s = new ApprovalStore("t-main")
    const request = submitForApproval(s, approvalContext("u-admin", VACANT), {
      typeId: TYPE,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(request.ok).toBe(true)
    const broken = breakGlassApprove(s, approvalContext("u-admin", VACANT), {
      requestId: request.ok ? request.value.id : "",
    })
    expect(!broken.ok && broken.error.code).toBe("SELF_APPROVAL_REJECTED")
  })
})

describe("ق-١٢ — التدخلُ الفوقيّ: للسلَف **الأعلى** من الأقرب بقدرةٍ صريحة", () => {
  it("المنطقةُ بقدرة التدخل تعتمد فوق المربع — **بطريقٍ موسومٍ لا صامت**", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s)
    const done = overrideApprove(s, approvalContext("u-rabita"), {
      requestId: request.id,
      reasonAr: "سفرُ مسؤول المربع دون تفريغ تكليفه",
    })
    expect(done.ok && done.value.state).toBe("approved")
    expect(done.ok && done.value.route).toBe("override")
    expect(s.audit().some((a) => a.action === "approval.override")).toBe(true)
  })

  it("**والأقربُ نفسُه لا «يتدخّل فوقياً»** ولو ملك القدرة — التدخلُ لِمن فوقه لا له", () => {
    const s = new ApprovalStore("t-main")
    // مسجدُ عمر تحت مربعٍ شاغر ⇒ الأقربُ المنطقةُ، وهي حاملةُ قدرةِ التدخل.
    const request = submitForApproval(s, approvalContext("u-amir-omar"), {
      typeId: TYPE,
      unitPath: OMAR_PATH,
      period: PERIOD,
    })
    expect(request.ok).toBe(true)
    const done = overrideApprove(s, approvalContext("u-rabita"), {
      requestId: request.ok ? request.value.id : "",
      reasonAr: "أنا الأقرب أصلاً",
    })
    expect(!done.ok && done.error.code).toBe("NOT_ABOVE_NEAREST")
  })

  it("ورأسُ القسم — وهو **فوق** المنطقة الأقرب — يتدخّل فوقياً بقدرته", () => {
    const s = new ApprovalStore("t-main")
    const request = submitForApproval(s, approvalContext("u-amir-omar"), {
      typeId: TYPE,
      unitPath: OMAR_PATH,
      period: PERIOD,
    })
    expect(request.ok).toBe(true)
    const done = overrideApprove(s, approvalContext("u-section-head"), {
      requestId: request.ok ? request.value.id : "",
      reasonAr: "تعذُّرُ المنطقة أسبوعين",
    })
    expect(done.ok && done.value.route).toBe("override")
  })

  it("**والإدارةُ ممنوعةٌ نصاً** (ق-١٢): لا `report.approve.override` في حزمتها", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s)
    const done = overrideApprove(s, approvalContext("u-admin"), {
      requestId: request.id,
      reasonAr: "أنا المدير",
    })
    expect(!done.ok && done.error.code).toBe("NO_OVERRIDE_CAPABILITY")
  })

  it("والمربعُ (أدنى طبقة) لا يملك التدخلَ أصلاً — ولا يعتمد به لغيره", () => {
    const s = new ApprovalStore("t-main")
    const request = submitForApproval(s, approvalContext("u-amir"), {
      typeId: TYPE,
      unitPath: `${KHALID_PATH}c1/`,
      period: PERIOD,
    })
    expect(request.ok).toBe(true)
    const done = overrideApprove(s, approvalContext("u-square"), {
      requestId: request.ok ? request.value.id : "",
      reasonAr: "أتدخّل فوق الأمير",
    })
    expect(!done.ok && done.error.code).toBe("NO_OVERRIDE_CAPABILITY")
  })

  it("**ومَن تدخّل فوقياً فوق عملِ نفسه مردود** — ق-٩ يسري على كل المخارج", () => {
    const s = new ApprovalStore("t-main")
    // رأسُ القسم يقدّم عن مسجد عمر، ثم يحاول اعتمادَه بالتدخل الفوقيّ فوق المنطقة الأقرب.
    const request = submitForApproval(s, approvalContext("u-section-head"), {
      typeId: TYPE,
      unitPath: OMAR_PATH,
      period: PERIOD,
    })
    expect(request.ok).toBe(true)
    const done = overrideApprove(s, approvalContext("u-section-head"), {
      requestId: request.ok ? request.value.id : "",
      reasonAr: "أنا الأعلى",
    })
    expect(!done.ok && done.error.code).toBe("SELF_APPROVAL_REJECTED")
  })

  it("**ولا تدخّلَ فوقياً حين لا أقربَ أصلاً**: الشغورُ الكليُّ بابُه كسرُ الزجاج لا التدخّل", () => {
    const s = new ApprovalStore("t-main")
    // شخصٌ يحمل قدرةَ التدخل **بمنحٍ فرديّ** بلا أي تكليف — فلا هو أقربُ ولا فوق أحد.
    const granted: Actor = {
      personId: "u-override-granted",
      accountStatus: "active",
      sessionEpoch: 1,
      currentSessionEpoch: 1,
      assignments: [],
      overrides: [
        {
          capId: "report.approve.override",
          scopePath: "/",
          effect: "grant",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "تفويضُ تدخّلٍ مؤقتٍ للاختبار",
        },
      ],
    }
    const people = [...peopleWithout(...LAYERS_ABOVE_KHALID), granted]
    const request = submittedIn(s, { people })
    const done = overrideApprove(s, approvalContext("u-override-granted", { people }), {
      requestId: request.id,
      reasonAr: "أتدخّل حيث لا أقرب",
    })
    expect(!done.ok && done.error.code).toBe("NOT_ABOVE_NEAREST")
  })

  it("والتدخلُ الفوقيّ بلا سببٍ مرفوض — المخرجُ المحكومُ يُعلَّل دائماً", () => {
    const s = new ApprovalStore("t-main")
    const request = submittedIn(s)
    const done = overrideApprove(s, approvalContext("u-rabita"), {
      requestId: request.id,
      reasonAr: "",
    })
    expect(!done.ok && done.error.code).toBe("REASON_REQUIRED")
  })
})
