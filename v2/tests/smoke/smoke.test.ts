/**
 * طقم الدخان — بوابة G8، TESTING_POLICY §٦.
 * أصغر مجموعة تثبت أن السلسلة موصولة: دخول بثلاثة أدوار، رئيسية، فعل واحد، ومنع.
 * (لا يختبر حسابات — تلك وحدوية. يختبر أن السياج قائم وموصول.)
 */
import { describe, it, expect } from "vitest"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { loginView } from "../../src/routes/login.js"
import { dashboardView } from "../../src/routes/dashboard.js"
import { can, type DecisionContext } from "../../src/authorization/can.js"
import { unitScope, selfScope } from "../../src/authorization/scope.js"

const CTX: DecisionContext = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "read",
  isFeatureEnabled: () => true,
}

const world = buildCanonicalWorld()
const person = (id: string) => world.people.find((p) => p.personId === id)!

describe("الدخان: صفحة الدخول حيّة", () => {
  it("تعرض حقلَي الدخول بالعربية", () => {
    const v = loginView()
    expect(v.fields.map((f) => f.name)).toEqual(["username", "password"])
    expect(v.submitLabelAr).toBe("دخول")
  })
})

describe("الدخان: ثلاثة أدوار مختارة — مدير · أمير · محفّظ", () => {
  it("المدير يفتح لوحته", () => {
    const d = can(person("u-admin"), "admin.view", unitScope("/"), CTX)
    expect(dashboardView(d).kind).toBe("granted")
  })

  it("والأمير يفتح لوحة مسجده وينفّذ فعله المميز: إدارة الحلقة", () => {
    const amir = person("u-amir")
    expect(dashboardView(can(amir, "report.view", unitScope("/men/homs/sq2/khalid/"), CTX)).kind).toBe(
      "granted",
    )
    expect(can(amir, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(true)
  })

  it("والمحفّظ يفتح «حلقاتي» بالملكية", () => {
    const t = person("u-teacher")
    expect(can(t, "circle.teach", selfScope("u-teacher", "circle", "c1"), CTX).allowed).toBe(true)
  })
})

describe("الدخان: الصفحة المحروسة تمنع فعلاً وتقول لماذا", () => {
  it("الطالب يُمنع من التهيئة برسالة عربية مفهومة لا شاشة بيضاء", () => {
    const d = can(person("u-student"), "admin.view", unitScope("/men/homs/sq2/khalid/c1/"), CTX)
    const v = dashboardView(d)
    expect(v.kind).toBe("denied")
    if (v.kind === "denied") expect(v.messageAr.length).toBeGreaterThan(10)
  })

  it("والمدير لا ينشر تغطية — الشمول اطّلاع لا عمل (ق-٢٧)", () => {
    const d = can(person("u-admin"), "media.post", selfScope("u-media", "coverage", "cv1"), CTX)
    expect(d.allowed).toBe(false)
    // **CR-012/قب-٣٨**: المديرُ يُردّ عند الشرط الأول — `admin × media.post = ·` في المصفوفة
    // صارت نافذةً، فلا يُردُّ لأنّ الكيان ليس كيانه بل لأنه **لا ينشر أصلاً**.
    expect(d.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })
})
