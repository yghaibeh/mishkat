import { describe, it, expect } from "vitest"
import { REASON_CODES, REASON_LABELS_AR } from "../../src/authorization/reasons.js"

describe("مجموعة الأسباب المغلقة (SPEC_authorization §٤.١)", () => {
  it("خمسة عشر رمزاً لا أكثر ولا أقل", () => {
    expect(REASON_CODES).toHaveLength(15)
  })

  it("ثلاثة أسباب سماح واثنا عشر سبب رفض", () => {
    expect(REASON_CODES.filter((r) => r.startsWith("ALLOWED_"))).toHaveLength(3)
    expect(REASON_CODES.filter((r) => r.startsWith("DENIED_"))).toHaveLength(12)
  })

  it("لكل رمز رسالة عربية — فلا يرى المستخدم «تعذرت الإضافة» أبداً (ع-٥)", () => {
    for (const code of REASON_CODES) {
      const label = REASON_LABELS_AR[code]
      expect(label, `الرمز ${code} بلا رسالة`).toBeTruthy()
      expect(label.length, `رسالة ${code} أقصر من أن تُفهم`).toBeGreaterThan(10)
    }
  })

  it("ولا رسالة يتيمة بلا رمز — المعجم مغلق من الطرفين", () => {
    expect(Object.keys(REASON_LABELS_AR).sort()).toEqual([...REASON_CODES].sort())
  })

  it("ولا تكرار في الرموز", () => {
    expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length)
  })
})
