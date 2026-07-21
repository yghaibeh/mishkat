import { describe, it, expect } from "vitest"
import { ROOT_PATH, contains, isValidScopePath, unitScope, rootScope, selfScope, NO_SCOPE } from "../../src/authorization/scope.js"

describe("ثابت تمثيل المسار (SPEC_authorization §١.٥)", () => {
  it("يقبل الجذر والمسارات التي تبدأ بشرطة وتنتهي بشرطة", () => {
    expect(isValidScopePath("/")).toBe(true)
    expect(isValidScopePath("/men/")).toBe(true)
    expect(isValidScopePath("/men/homs/sq2/khalid/")).toBe(true)
  })

  it("يرفض المسار بلا شرطة ختامية — وهو ثابتٌ لا تفصيل تجميلي", () => {
    expect(isValidScopePath("/men")).toBe(false)
    expect(isValidScopePath("/men/homs")).toBe(false)
  })

  it("يرفض المسار بلا شرطة بادئة والمسار الفارغ والشرطات المزدوجة", () => {
    expect(isValidScopePath("men/")).toBe(false)
    expect(isValidScopePath("")).toBe(false)
    expect(isValidScopePath("//")).toBe(false)
    expect(isValidScopePath("/men//homs/")).toBe(false)
  })
})

describe("الاحتواء (contains) — قاتل تسريب النطاق الصامت", () => {
  it("الجذر يحتوي كل شيء", () => {
    expect(contains(ROOT_PATH, "/men/")).toBe(true)
    expect(contains(ROOT_PATH, "/women/homs/")).toBe(true)
    expect(contains(ROOT_PATH, ROOT_PATH)).toBe(true)
  })

  it("النطاق يحتوي نفسه", () => {
    expect(contains("/men/homs/", "/men/homs/")).toBe(true)
  })

  it("النطاق يحتوي ما تحته ولا يحتوي ما فوقه", () => {
    expect(contains("/men/", "/men/homs/sq2/")).toBe(true)
    expect(contains("/men/homs/", "/men/")).toBe(false)
  })

  it("المنطقة ١ لا ترى المنطقة ١٠ — الشرطة الختامية تمنع تسريب البادئة", () => {
    expect(contains("/men/r1/", "/men/r10/")).toBe(false)
    expect(contains("/men/r1/", "/men/r1/sq1/")).toBe(true)
  })

  it("القسمان معزولان بالاحتواء وحده", () => {
    expect(contains("/men/", "/women/")).toBe(false)
    expect(contains("/women/", "/men/homs/")).toBe(false)
  })

  it("يرمي على مسار غير صالح بدل أن يجيب صامتاً", () => {
    expect(() => contains("/men", "/men/homs/")).toThrow()
    expect(() => contains("/men/", "/men/homs")).toThrow()
  })
})

describe("بناة النطاق الثلاثة (SPEC_authorization §٥.٢ — لا رابع)", () => {
  it("unitScope يبني نطاق وحدة صالحاً", () => {
    expect(unitScope("/men/homs/")).toEqual({ kind: "unit", path: "/men/homs/" })
  })

  it("unitScope لكيان غير موجود يعطي NO_SCOPE — يُقفل ولا يُفتح", () => {
    expect(unitScope(null)).toBe(NO_SCOPE)
    expect(unitScope(undefined)).toBe(NO_SCOPE)
  })

  it("rootScope هو الجذر", () => {
    expect(rootScope()).toEqual({ kind: "unit", path: ROOT_PATH })
  })

  it("selfScope يحمل صاحب الكيان ونوعه ومعرّفه", () => {
    expect(selfScope("p1", "custody", "c9")).toEqual({
      kind: "self",
      ownerPersonId: "p1",
      entityType: "custody",
      entityId: "c9",
    })
  })
})
