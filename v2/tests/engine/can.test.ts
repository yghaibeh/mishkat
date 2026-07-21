import { describe, it, expect } from "vitest"
import { can } from "../../src/authorization/can.js"
import type { Actor, Assignment, Override, DecisionContext } from "../../src/authorization/can.js"
import { unitScope, rootScope, selfScope, NO_SCOPE } from "../../src/authorization/scope.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"

const NOW = new Date("2026-07-20T00:00:00.000Z")

const CTX: DecisionContext = {
  now: NOW,
  intent: "read",
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
    personId: "p-amir",
    accountStatus: "active",
    sessionEpoch: 1,
    currentSessionEpoch: 1,
    assignments: [assignment()],
    overrides: [],
    ...over,
  }
}

// ═══ خطوة ٠ — تحقّق الكتالوج ═══
describe("خطوة ٠: القدرة خارج الكتالوج", () => {
  it("معرّف مخترع يُرفض بسبب مصنَّف لا بصمت", () => {
    const d = can(actor(), "circle.invent" as CapId, unitScope("/men/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_UNKNOWN_CAPABILITY")
  })
})

// ═══ خطوة ١ — بوابات الهوية ═══
describe("خطوة ١: بوابات الهوية تسبق كل شيء", () => {
  it("الحساب الموقوف يُمنع قبل أي فحص آخر (ق-٢٢)", () => {
    const d = can(
      actor({ accountStatus: "suspended" }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_ACCOUNT_SUSPENDED")
  })

  it("الحساب الملغى كذلك", () => {
    const d = can(actor({ accountStatus: "cancelled" }), "report.view", unitScope("/men/"), CTX)
    expect(d.reason).toBe("DENIED_ACCOUNT_SUSPENDED")
  })

  it("حِقبة الجلسة القديمة تُرفض فوراً على كل الأجهزة (ق-٢٣)", () => {
    const d = can(
      actor({ sessionEpoch: 1, currentSessionEpoch: 2 }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_SESSION_STALE")
  })

  it("الحساب الموقوف يغلب حِقبة الجلسة — الترتيب ملزم", () => {
    const d = can(
      actor({ accountStatus: "suspended", sessionEpoch: 1, currentSessionEpoch: 9 }),
      "report.view",
      unitScope("/men/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_ACCOUNT_SUSPENDED")
  })
})

// ═══ الانتحال القرائي ═══
describe("جلسة الانتحال القرائي (ب-٤٠أ)", () => {
  it("تقرأ بعين المنتحَل", () => {
    const d = can(
      actor({ impersonatedBy: "p-admin" }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(true)
  })

  it("وكل فعل كاتب يُرفض", () => {
    const d = can(
      actor({ impersonatedBy: "p-admin" }),
      "dailyLog.edit",
      unitScope("/men/homs/sq2/khalid/"),
      { ...CTX, intent: "write" },
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_IMPERSONATION_READONLY")
  })

  it("والفعل الكاتب في جلسة عادية لا يتأثر", () => {
    const d = can(actor(), "dailyLog.edit", unitScope("/men/homs/sq2/khalid/"), {
      ...CTX,
      intent: "write",
    })
    expect(d.allowed).toBe(true)
  })
})

// ═══ مفتاح التفعيل ═══
describe("القدرة خلف مفتاح تفعيل مطفأ", () => {
  it("تُرفض بسبب صريح", () => {
    const fin = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
    })
    const d = can(fin, "ledger.journal.entry", unitScope("/men/"), {
      ...CTX,
      isFeatureEnabled: () => false,
    })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_FEATURE_DISABLED")
  })

  it("وتمرّ حين يكون المفتاح مشتعلاً", () => {
    const fin = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
    })
    const d = can(fin, "ledger.journal.entry", unitScope("/men/"), CTX)
    expect(d.allowed).toBe(true)
  })
})

// ═══ خطوة ٢ — القدرة الشخصية ═══
describe("خطوة ٢: مسار القدرة الشخصية لا يلتقي بمسار الأدوار (ق-٢٧)", () => {
  const teacher = actor({
    personId: "p-teacher",
    assignments: [assignment({ roleId: "teacher", scopePath: "/men/homs/sq2/khalid/" })],
  })

  it("صاحب الكيان يمرّ", () => {
    const d = can(teacher, "circle.teach", selfScope("p-teacher", "circle", "c1"), CTX)
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_PERSONAL_OWNER")
  })

  it("غير الصاحب يُرفض — والمدير كذلك: الشمول اطّلاع لا عمل", () => {
    const admin = actor({
      personId: "p-admin",
      assignments: [assignment({ roleId: "admin", scopePath: "/" })],
    })
    const d = can(admin, "media.post", selfScope("p-media", "coverage", "cv1"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("القدرة الشخصية بنطاق وحدة تُرفض — لا تُفحص بالشجرة أصلاً", () => {
    const d = can(teacher, "circle.teach", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("المخرج الوحيد لغير الصاحب: منحٌ فرديّ صريح عند شغور الدور", () => {
    const stand: Override = {
      capId: "media.post",
      scopePath: "/",
      effect: "grant",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      reason: "شغور مسؤول الإعلام",
    }
    const deputy = actor({ personId: "p-deputy", overrides: [stand] })
    const d = can(deputy, "media.post", selfScope("p-media", "coverage", "cv1"), CTX)
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_BY_GRANT")
  })

  it("والمنح المنتهي لا يفتح شيئاً", () => {
    const expired: Override = {
      capId: "media.post",
      scopePath: "/",
      effect: "grant",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-02-01T00:00:00.000Z"),
      reason: "انتهت",
    }
    const deputy = actor({ personId: "p-deputy", overrides: [expired] })
    const d = can(deputy, "media.post", selfScope("p-media", "coverage", "cv1"), CTX)
    expect(d.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("الحجب يغلب حتى على القدرة الشخصية لصاحبها", () => {
    const blocked = actor({
      personId: "p-teacher",
      assignments: [assignment({ roleId: "teacher" })],
      overrides: [
        {
          capId: "circle.teach",
          scopePath: "/",
          effect: "deny",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "إيقاف مؤقت للتحقيق",
        },
      ],
    })
    const d = can(blocked, "circle.teach", selfScope("p-teacher", "circle", "c1"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_EXPLICIT_BLOCK")
  })
})

// ═══ خطوة ٣ — القدرة الجذرية ═══
describe("خطوة ٣: القدرة الجذرية نطاقها الجذر حصراً", () => {
  const admin = actor({
    personId: "p-admin",
    assignments: [assignment({ roleId: "admin", scopePath: "/" })],
  })

  it("تمرّ على الجذر", () => {
    const d = can(admin, "featureFlag.manage", rootScope(), CTX)
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_BY_ROLE")
  })

  it("وتُرفض على أي نطاق آخر ولو كان المدير", () => {
    const d = can(admin, "featureFlag.manage", unitScope("/men/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_ROOT_SCOPE_REQUIRED")
  })

  it("والقدرة الجذرية بنطاق شخصي تُرفض كذلك", () => {
    const d = can(admin, "featureFlag.manage", selfScope("p-admin", "flag", "f1"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_ROOT_SCOPE_REQUIRED")
  })
})

// ═══ NO_SCOPE ═══
describe("النطاق المعدوم يُقفل ولا يُفتح (§٥.٢ ثابت ٣)", () => {
  it("كيان غير موجود ⇒ رفض لا مرور", () => {
    const d = can(actor(), "circle.manage", NO_SCOPE, CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("والقدرة المنطاقة بنطاق شخصي تُرفض", () => {
    const d = can(actor(), "report.view", selfScope("p-amir", "report", "r1"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})

// ═══ خطوة ٤ — الإسنادات الفعّالة زمنياً ═══
describe("خطوة ٤: الإسنادات الفعّالة زمنياً (ق-٢٤، ق-٢٥)", () => {
  it("بلا إسناد ولا تجاوز ⇒ رفض مشخِّص", () => {
    const d = can(actor({ assignments: [] }), "report.view", unitScope("/men/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("التكليف المعلّق لا يدخل الحساب إطلاقاً (ق-١٤/ق-٢٥)", () => {
    const d = can(
      actor({ assignments: [assignment({ approvalStatus: "pending" })] }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("والتكليف المرفوض كذلك", () => {
    const d = can(
      actor({ assignments: [assignment({ approvalStatus: "rejected" })] }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("الإسناد المنتهي يسقط فوراً ولو بقي اسمه (ق-٢٤)", () => {
    const d = can(
      actor({
        assignments: [assignment({ endDate: new Date("2026-06-01T00:00:00.000Z") })],
      }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("والإسناد الذي لم يبدأ بعدُ لا يسري", () => {
    const d = can(
      actor({ assignments: [assignment({ startDate: new Date("2027-01-01T00:00:00.000Z") })] }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("إسناد الوحدة المؤرشفة لا يُحتسب — لا «أمير شبح»", () => {
    const d = can(
      actor({ assignments: [assignment({ unitArchived: true })] }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("لكن وجود تجاوز فرديّ يمنع القفز إلى «لا إسناد»", () => {
    const granted = actor({
      assignments: [],
      overrides: [
        {
          capId: "report.view",
          scopePath: "/men/",
          effect: "grant",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "تكليف مؤقت",
        },
      ],
    })
    const d = can(granted, "report.view", unitScope("/men/homs/"), CTX)
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_BY_GRANT")
  })
})

// ═══ خطوة ٥ — تفعيل الدور ═══
describe("خطوة ٥: الدور الموقوف يعيد سبباً صريحاً لا صمتاً (قب-٧، ج-١)", () => {
  it("إسناد على دور موقوف لا يضم قدراته", () => {
    const d = can(
      actor({
        personId: "p-bloc",
        assignments: [assignment({ roleId: "bloc_head", scopePath: "/men/" })],
      }),
      "report.view",
      unitScope("/men/homs/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_ROLE_SUSPENDED")
  })

  it("ومَن له دور موقوف وآخر فعّال يمرّ بالفعّال", () => {
    const d = can(
      actor({
        personId: "p-two",
        assignments: [
          assignment({ roleId: "bloc_head", scopePath: "/men/" }),
          assignment({ roleId: "square", scopePath: "/men/homs/sq2/" }),
        ],
      }),
      "report.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(true)
  })
})

// ═══ خطوة ٩ — النطاق والاحتواء ═══
describe("خطوات ٦ و٩: اتحاد القدرات وفحص النطاق", () => {
  it("الدور الحامل للقدرة على نطاقٍ محتوٍ يمرّ", () => {
    const d = can(
      actor({
        personId: "p-rabita",
        assignments: [assignment({ roleId: "rabita", scopePath: "/men/homs/" })],
      }),
      "circle.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_BY_ROLE")
    expect(d.grantedVia).toEqual({ roleId: "rabita", assignmentScope: "/men/homs/" })
  })

  it("ومَن لا يحملها في أي دور يُرفض بـ«لا قدرة»", () => {
    const d = can(
      actor({
        personId: "p-student",
        assignments: [assignment({ roleId: "student", scopePath: "/men/homs/sq2/khalid/" })],
      }),
      "finance.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_NO_CAPABILITY")
  })

  it("ومَن يحملها على نطاق آخر يُرفض بـ«خارج النطاق» — لا بـ«لا قدرة»", () => {
    const d = can(
      actor({
        personId: "p-rabita",
        assignments: [assignment({ roleId: "rabita", scopePath: "/men/homs/" })],
      }),
      "circle.view",
      unitScope("/men/idlib/sq1/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("مسؤول المنطقة لا يصل القسم النسائي (الفصل بالاحتواء وحده)", () => {
    const d = can(
      actor({
        personId: "p-rabita",
        assignments: [assignment({ roleId: "rabita", scopePath: "/men/homs/" })],
      }),
      "circle.view",
      unitScope("/women/homs/"),
      CTX,
    )
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("ومَن نطاقه الجذر يصل القسمين — لأن أحداً منحه الجذر صراحةً (ب-٢٦)", () => {
    const globalFin = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
    })
    expect(can(globalFin, "finance.view", unitScope("/men/homs/"), CTX).allowed).toBe(true)
    expect(can(globalFin, "finance.view", unitScope("/women/homs/"), CTX).allowed).toBe(true)
  })
})

// ═══ نطاق «ذ» — الوحدة بعينها حصراً ═══
describe("نطاق «ذ»: الوحدة بعينها حصراً لا ما تحتها (§٣.٢)", () => {
  it("الأمير يقبض في صندوق مسجده", () => {
    const d = can(actor(), "box.receive", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d.allowed).toBe(true)
  })

  it("ومشرف القسم لا يقبض في صندوق مسجدٍ تحته — «ذ» تمنع الهبوط", () => {
    const d = can(
      actor({
        personId: "p-section",
        assignments: [assignment({ roleId: "section_head", scopePath: "/men/" })],
      }),
      "box.receive",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("بينما القدرة الهابطة «و» تمرّ لنفس الشخص على نفس المسجد", () => {
    const d = can(
      actor({
        personId: "p-section",
        assignments: [assignment({ roleId: "section_head", scopePath: "/men/" })],
      }),
      "box.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(true)
  })
})

// ═══ خطوتا ٧ و٨ — التجاوزات والحجب يغلب ═══
describe("خطوتا ٧ و٨: التجاوز الفردي — والحجب يغلب دائماً", () => {
  const denyWomen: Override = {
    capId: "finance.view",
    scopePath: "/women/",
    effect: "deny",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    reason: "فصل مهام مؤقت",
  }

  it("منحٌ فوق الدور ينجح على نطاق المنح وما تحته", () => {
    const d = can(
      actor({
        personId: "p-square",
        assignments: [assignment({ roleId: "square", scopePath: "/men/homs/sq2/" })],
        overrides: [
          {
            capId: "finance.view",
            scopePath: "/men/homs/sq2/",
            effect: "grant",
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: null,
            reason: "تفويض مؤقت",
          },
        ],
      }),
      "finance.view",
      unitScope("/men/homs/sq2/khalid/"),
      CTX,
    )
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe("ALLOWED_BY_GRANT")
    expect(d.grantedVia).toEqual({ override: "grant" })
  })

  it("وحجبٌ تحت الدور يُرفض ولو كان الدور يمنحها", () => {
    const globalFin = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [denyWomen],
    })
    const d = can(globalFin, "finance.view", unitScope("/women/homs/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_EXPLICIT_BLOCK")
    expect(d.deniedBy).toEqual({ override: "deny", scope: "/women/" })
  })

  it("ويبقى الرجالي مفتوحاً له — التجاوز منطاقٌ هو الآخر", () => {
    const globalFin = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [denyWomen],
    })
    expect(can(globalFin, "finance.view", unitScope("/men/homs/"), CTX).allowed).toBe(true)
  })

  it("الحجب يغلب المنح الأضيق المعارض — وإلا لم يكن أداة أمان", () => {
    const both = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [
        denyWomen,
        {
          capId: "finance.view",
          scopePath: "/women/homs/",
          effect: "grant",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          reason: "محاولة التفاف",
        },
      ],
    })
    const d = can(both, "finance.view", unitScope("/women/homs/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_EXPLICIT_BLOCK")
  })

  it("والحجب المنتهي لا يحجب", () => {
    const expired = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [{ ...denyWomen, endDate: new Date("2026-02-01T00:00:00.000Z") }],
    })
    expect(can(expired, "finance.view", unitScope("/women/homs/"), CTX).allowed).toBe(true)
  })

  it("والحجب الذي لم يبدأ لا يحجب", () => {
    const future = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [{ ...denyWomen, startDate: new Date("2027-01-01T00:00:00.000Z") }],
    })
    expect(can(future, "finance.view", unitScope("/women/homs/"), CTX).allowed).toBe(true)
  })

  it("وحجبٌ على قدرة أخرى لا يمسّ هذه", () => {
    const other = actor({
      personId: "p-fin",
      assignments: [assignment({ roleId: "finance_officer", scopePath: "/" })],
      overrides: [{ ...denyWomen, capId: "payroll.view" }],
    })
    expect(can(other, "finance.view", unitScope("/women/homs/"), CTX).allowed).toBe(true)
  })
})

// ═══ حالة الحافّة: تعدد الأدوار بنطاقين ═══
describe("حالة حافّة: شخص بدورين ونطاقين — لا تسريب بينهما (§٤.٤)", () => {
  const dual = actor({
    personId: "p-dual",
    assignments: [
      assignment({ roleId: "amir", scopePath: "/men/homs/sq2/khalid/" }),
      assignment({ roleId: "teacher", scopePath: "/men/idlib/sq9/bilal/" }),
    ],
  })

  it("يدير حلقات مسجده بصفته أميراً", () => {
    expect(can(dual, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(true)
  })

  it("ولا يدير حلقات المسجد الذي هو فيه محفّظ فقط", () => {
    const d = can(dual, "circle.manage", unitScope("/men/idlib/sq9/bilal/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})

// ═══ الميزانية: صفر استعلام ═══
describe("ميزانية الأداء (§٤.٥): صفر استعلام قاعدة بيانات لكل قرار", () => {
  it("القرار دالة نقية على بيانات في الذاكرة", () => {
    const d1 = can(actor(), "report.view", unitScope("/men/homs/sq2/khalid/"), CTX)
    const d2 = can(actor(), "report.view", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d1.allowed).toBe(d2.allowed)
    expect(d1.reason).toBe(d2.reason)
  })
})
