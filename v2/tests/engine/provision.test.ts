import { describe, it, expect } from "vitest"
import { canProvision } from "../../src/authorization/provision.js"
import type { Actor, Assignment, DecisionContext } from "../../src/authorization/can.js"
import { ROLES, ROLE_IDS } from "../../src/authorization/generated/roles.generated.js"

const CTX: DecisionContext = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "write",
  isFeatureEnabled: () => true,
}

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    roleId: "amir",
    scopePath: "/men/homs/sq2/khalid/",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    approvalStatus: "approved",
    unitArchived: false,
    ...over,
  }
}

function actor(over: Partial<Actor> = {}): Actor {
  return {
    personId: "p",
    accountStatus: "active",
    sessionEpoch: 1,
    currentSessionEpoch: 1,
    assignments: [assignment()],
    overrides: [],
    ...over,
  }
}

const amir = actor({ personId: "p-amir" })
const squareHead = actor({
  personId: "p-square",
  assignments: [assignment({ roleId: "square", scopePath: "/men/homs/sq2/" })],
})
const admin = actor({
  personId: "p-admin",
  assignments: [assignment({ roleId: "admin", scopePath: "/" })],
})

describe("ش١ — القدرة: من لا يملك users.provision لا يوفّر", () => {
  it("المعلّم لا يوفّر أحداً", () => {
    const teacher = actor({
      personId: "p-teacher",
      assignments: [assignment({ roleId: "teacher" })],
    })
    const d = canProvision(teacher, "student", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش١")
  })
})

describe("ش٢ — الرتبة الأدنى قطعاً: استحالة الاستنساخ والتصعيد", () => {
  it("الأمير يوفّر معلّماً على مسجده (٦ > ٥)", () => {
    const d = canProvision(amir, "teacher", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(true)
  })

  it("والأمير يوفّر مسؤول لجنة كذلك — فيموت بلاغا ع-٤ وع-٢٧", () => {
    expect(canProvision(amir, "committee_head", "/men/homs/sq2/khalid/", "mosque", CTX).allowed).toBe(
      true,
    )
  })

  it("ولا يوفّر أميراً مثله — الرتبة نفسها ممنوعة (استحالة الاستنساخ)", () => {
    const d = canProvision(amir, "amir", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٢")
  })

  it("ولا يوفّر مسؤول مربع فوقه — استحالة التصعيد", () => {
    const d = canProvision(amir, "square", "/men/homs/sq2/", "square", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٢")
  })

  it("ومسؤول المربع يوفّر أميراً على مساجد مربعه (٥ > ٤) — فيموت ع-٣٢", () => {
    expect(canProvision(squareHead, "amir", "/men/homs/sq2/khalid/", "mosque", CTX).allowed).toBe(
      true,
    )
  })
})

describe("ش٣ — نوع الوحدة", () => {
  it("«أمير» على منطقة مرفوض", () => {
    const d = canProvision(admin, "amir", "/men/homs/", "region", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٣")
  })

  it("«معلّم» على حلقة مقبول", () => {
    expect(
      canProvision(amir, "teacher", "/men/homs/sq2/khalid/c1/", "circle", CTX).allowed,
    ).toBe(true)
  })

  it("و«مسؤول لجنة» على حلقة مرفوض", () => {
    const d = canProvision(amir, "committee_head", "/men/homs/sq2/khalid/c1/", "circle", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٣")
  })
})

describe("ش٤ — الاحتواء: لا توفير خارج النطاق", () => {
  it("الأمير لا يوفّر في المسجد المجاور", () => {
    const d = canProvision(amir, "teacher", "/men/homs/sq2/bilal/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٤")
  })

  it("ولا في القسم الآخر", () => {
    const d = canProvision(squareHead, "amir", "/women/homs/sq2/nour/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٤")
  })
})

describe("ش٥ — الأدوار العليا محجوزة (ق-٢٦، يقفل خ-٤)", () => {
  it("مَن حُجبت عنه القدرة الجذرية لا يوفّر دوراً عالياً ولو كانت رتبته تسمح", () => {
    // مديرٌ محجوبةٌ عنه `user.role.grant.elevated` بتجاوز فردي: ش٢ و٣ و٤ تمرّ، وش٥ وحدها تسقط.
    const blockedAdmin = actor({
      personId: "p-admin-blocked",
      assignments: [assignment({ roleId: "admin", scopePath: "/" })],
      overrides: [
        {
          capId: "user.role.grant.elevated",
          scopePath: "/",
          effect: "deny",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "إيقاف مؤقت لصلاحية منح الأدوار العليا",
        },
      ],
    })
    const d = canProvision(blockedAdmin, "section_head", "/men/", "section", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٥")
  })

  it("ومشرف عام القسم لا يوفّر مشرف قسم مثله — ش٢ تسبقها فالرتبة لا تُتجاوز", () => {
    const sectionHead = actor({
      personId: "p-section",
      assignments: [assignment({ roleId: "section_head", scopePath: "/men/" })],
    })
    const d = canProvision(sectionHead, "section_head", "/men/", "section", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٢")
  })

  it("والمدير يوفّرهما لأنه يملك user.role.grant.elevated الجذرية", () => {
    expect(canProvision(admin, "section_head", "/men/", "section", CTX).allowed).toBe(true)
  })

  it("ولا يوفّر مديراً مثله — ش٢ تسبق ش٥ فالرتبة لا تُتجاوز بقدرة", () => {
    const d = canProvision(admin, "admin", "/", "root", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٢")
  })
})

describe("برهان استحالة التصعيد — على كل الأدوار لا على عيّنة", () => {
  it("لا دور يستطيع توفير دورٍ في رتبته أو أعلى، مهما كان النطاق ونوع الوحدة", () => {
    const violations: string[] = []
    for (const provisionerRole of ROLE_IDS) {
      const p = actor({
        personId: "p-x",
        assignments: [assignment({ roleId: provisionerRole, scopePath: "/" })],
      })
      for (const targetRole of ROLE_IDS) {
        if (ROLES[targetRole].rank > ROLES[provisionerRole].rank) continue
        for (const unitType of ["root", "section", "region", "square", "mosque", "circle"] as const) {
          const d = canProvision(p, targetRole, "/", unitType, CTX)
          if (d.allowed) violations.push(`${provisionerRole} → ${targetRole} على ${unitType}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it("وسلسلة التوفير متناقصة السلطة حتماً: كل موفَّرٍ رتبتُه أكبر قطعاً", () => {
    const p = actor({
      personId: "p-square",
      assignments: [assignment({ roleId: "square", scopePath: "/men/homs/sq2/" })],
    })
    const d = canProvision(p, "amir", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(true)
    expect(ROLES.amir.rank).toBeGreaterThan(ROLES.square.rank)
  })
})

describe("الإسناد غير الفعّال لا يوسّع مدى التوفير (اختبار إعادة إنتاج)", () => {
  // شخصٌ كان مسؤول مربع (انتهى تكليفه) وصار أميراً: يجب ألّا يبقى مدى المربع بيده.
  const demoted = actor({
    personId: "p-demoted",
    assignments: [
      assignment({
        roleId: "square",
        scopePath: "/men/homs/sq2/",
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      }),
      assignment({ roleId: "amir", scopePath: "/men/homs/sq2/khalid/" }),
    ],
  })

  it("يوفّر في مسجده الحالي", () => {
    expect(canProvision(demoted, "teacher", "/men/homs/sq2/khalid/", "mosque", CTX).allowed).toBe(
      true,
    )
  })

  it("ولا يوفّر في مسجدٍ كان تحت مربعه المنتهي — الإسناد المنتهي يسقط فوراً (ق-٢٤)", () => {
    const d = canProvision(demoted, "teacher", "/men/homs/sq2/bilal/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش٤")
  })

  it("والإسناد المعلّق لا يوفّر شيئاً (ق-٢٥)", () => {
    const pending = actor({
      personId: "p-pending",
      assignments: [assignment({ roleId: "amir", approvalStatus: "pending" })],
    })
    const d = canProvision(pending, "teacher", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش١")
  })

  it("وإسناد الوحدة المؤرشفة كذلك", () => {
    const archived = actor({
      personId: "p-archived",
      assignments: [assignment({ roleId: "amir", unitArchived: true })],
    })
    const d = canProvision(archived, "teacher", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("ش١")
  })
})

describe("الدور الموقوف لا يظهر في التوفير (قب-٧)", () => {
  it("لا يُوفَّر دورٌ موقوف ولو تحققت الشروط الخمسة", () => {
    const d = canProvision(amir, "secretary", "/men/homs/sq2/khalid/", "mosque", CTX)
    expect(d.allowed).toBe(false)
    expect(d.failedCondition).toBe("موقوف")
  })
})
