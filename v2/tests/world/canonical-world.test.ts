import { describe, it, expect } from "vitest"
import { buildCanonicalWorld } from "../../src/../tests/fixtures/canonical-world.js"
import { ROLE_IDS, ROLES } from "../../src/authorization/generated/roles.generated.js"
import { isValidScopePath, unitScope } from "../../src/authorization/scope.js"
import { can } from "../../src/authorization/can.js"

const CTX = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "read" as const,
  isFeatureEnabled: () => true,
}

describe("العالم القانوني حتمي (TESTING_POLICY §٥)", () => {
  it("تشغيلان متتاليان ⇒ نتيجة واحدة حرفياً", () => {
    const a = buildCanonicalWorld()
    const b = buildCanonicalWorld()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("ولا تاريخَ زمنِ تشغيلٍ ولا عشوائية — كل التواريخ مثبتة", () => {
    const w = buildCanonicalWorld()
    const stamps = w.people.flatMap((p) => p.assignments.map((a) => a.startDate.toISOString()))
    expect(stamps.length).toBeGreaterThan(0)
    for (const s of stamps) expect(s).toMatch(/^20\d\d-\d\d-\d\dT00:00:00\.000Z$/)
  })
})

describe("بنية الشجرة (قسمان ومنطقة ومربعان وثلاثة مساجد وحلقات)", () => {
  const w = buildCanonicalWorld()
  const byType = (t: string) => w.units.filter((u) => u.type === t)

  it("قسمان", () => expect(byType("section")).toHaveLength(2))
  it("منطقة", () => expect(byType("region")).toHaveLength(1))
  it("مربعان", () => expect(byType("square")).toHaveLength(2))
  it("ثلاثة مساجد", () => expect(byType("mosque")).toHaveLength(3))
  it("وحلقات", () => expect(byType("circle").length).toBeGreaterThanOrEqual(2))

  it("ولا وحدة من نوع «الكتلة» — الطبقة الموقوفة غيابُ صفوف لا حالةٌ خاصة (§١.٧)", () => {
    expect(byType("bloc")).toHaveLength(0)
  })
})

describe("ت-٢: مقاطع المسار = معرفات الوحدات — القاعدة الحرجة", () => {
  const w = buildCanonicalWorld()

  it("كل مسار صالح بثابت التمثيل", () => {
    for (const u of w.units) {
      expect(isValidScopePath(u.path), `${u.id} مساره ${u.path}`).toBe(true)
    }
  })

  it("وآخر مقطع في مسار كل وحدة هو معرّفها بالضبط", () => {
    for (const u of w.units) {
      if (u.path === "/") continue
      const segments = u.path.split("/").filter((s) => s.length > 0)
      expect(segments[segments.length - 1], `${u.id} ← ${u.path}`).toBe(u.id)
    }
  })

  it("ومسار كل وحدة = مسار أبيها + معرّفها", () => {
    const byId = new Map(w.units.map((u) => [u.id, u]))
    for (const u of w.units) {
      if (u.parentId === null) continue
      const parent = byId.get(u.parentId)
      expect(parent, `أب مفقود لـ${u.id}`).toBeDefined()
      expect(u.path).toBe(`${parent!.path}${u.id}/`)
    }
  })
})

describe("الطبقة الشاغرة عمداً (لاختبار NESSA وكسر الزجاج)", () => {
  const w = buildCanonicalWorld()

  it("مربعٌ واحدٌ بلا مكلَّف — والآخر مكلَّف", () => {
    const squares = w.units.filter((u) => u.type === "square")
    const assignedScopes = new Set(
      w.people.flatMap((p) => p.assignments.map((a) => a.scopePath)),
    )
    const vacant = squares.filter((s) => !assignedScopes.has(s.path))
    expect(vacant).toHaveLength(1)
    expect(vacant[0]!.id).toBe("sq7")
  })

  it("والمسجد تحت المربع الشاغر له أمير — فالشغور فوقه لا فيه", () => {
    const assignedScopes = new Set(
      w.people.flatMap((p) => p.assignments.map((a) => a.scopePath)),
    )
    expect(assignedScopes.has("/men/homs/sq7/omar/")).toBe(true)
  })

  it("ووحدةٌ مكتملة السلّم من المسجد إلى الجذر", () => {
    const assignedScopes = new Set(
      w.people.flatMap((p) => p.assignments.map((a) => a.scopePath)),
    )
    for (const p of ["/men/homs/sq2/khalid/", "/men/homs/sq2/", "/men/homs/", "/men/", "/"]) {
      expect(assignedScopes.has(p), `الطبقة ${p} شاغرة والسلّم يُفترض مكتملاً`).toBe(true)
    }
  })
})

describe("المستخدمون القانونيون (TESTING_POLICY §٥ + ملحق ب/٣)", () => {
  const w = buildCanonicalWorld()

  it("مستخدم قانوني واحد لكل دور حيّ من العشرة", () => {
    const liveRoles = ROLE_IDS.filter((r) => ROLES[r].state === "active")
    for (const role of liveRoles) {
      const holders = w.people.filter((p) =>
        p.assignments.some((a) => a.roleId === role && a.approvalStatus === "approved"),
      )
      expect(holders.length, `الدور ${role} بلا مستخدم قانوني`).toBeGreaterThanOrEqual(1)
    }
  })

  it("وذو منحة فوق دوره", () => {
    const p = w.people.find((x) => x.personId === "u-granted")
    expect(p?.overrides.some((o) => o.effect === "grant")).toBe(true)
  })

  it("وذو حجب تحت دوره", () => {
    const p = w.people.find((x) => x.personId === "u-blocked")
    expect(p?.overrides.some((o) => o.effect === "deny")).toBe(true)
  })

  it("وذو دورين بنطاقين مختلفين", () => {
    const p = w.people.find((x) => x.personId === "u-dual")
    expect(p?.assignments).toHaveLength(2)
    expect(new Set(p?.assignments.map((a) => a.scopePath)).size).toBe(2)
    expect(new Set(p?.assignments.map((a) => a.roleId)).size).toBe(2)
  })

  it("وشخصٌ على دور موقوف (لاختبار DENIED_ROLE_SUSPENDED)", () => {
    const p = w.people.find((x) => x.personId === "u-suspended-role")
    expect(p).toBeDefined()
    const d = can(p!, "meetings.manage", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d.reason).toBe("DENIED_ROLE_SUSPENDED")
  })

  it("وإسنادٌ على الجذر (لاختبار العبور فوق القسمين)", () => {
    const rootHolders = w.people.filter((p) => p.assignments.some((a) => a.scopePath === "/"))
    expect(rootHolders.length).toBeGreaterThanOrEqual(2)
    const fin = w.people.find((p) => p.personId === "u-finance")!
    expect(can(fin, "finance.view", unitScope("/men/homs/"), CTX).allowed).toBe(true)
    expect(can(fin, "finance.view", unitScope("/women/"), CTX).allowed).toBe(true)
  })
})

describe("العالم يُثبت العزل فعلاً لا ادعاءً", () => {
  const w = buildCanonicalWorld()
  const person = (id: string) => w.people.find((p) => p.personId === id)!

  it("أمير خالد يرى مسجده ولا يرى المسجد المجاور", () => {
    const amir = person("u-amir")
    expect(can(amir, "mosqueFinance.view", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(
      true,
    )
    expect(can(amir, "mosqueFinance.view", unitScope("/men/homs/sq2/bilal/"), CTX).allowed).toBe(
      false,
    )
  })

  it("ومسؤول المنطقة لا يعبر إلى القسم النسائي", () => {
    const d = can(person("u-rabita"), "circle.view", unitScope("/women/"), CTX)
    expect(d.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("وذو الدورين لا يتسرب أحد نطاقيه إلى الآخر", () => {
    const dual = person("u-dual")
    expect(can(dual, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(true)
    expect(can(dual, "circle.manage", unitScope("/men/homs/sq7/omar/"), CTX).allowed).toBe(false)
  })
})
