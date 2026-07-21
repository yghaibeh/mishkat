/** إثبات منطق G15 — تصنيف التسليم (CHANGE_PROTOCOL §٣). */
import { describe, it, expect } from "vitest"
// @ts-expect-error — أداة بوابة بصيغة mjs بلا تعريفات أنواع؛ منطقها المفحوص هنا نقيّ
import { classifyDelivery } from "../../tools/gates/g15-classify.mjs"

describe("G15 — كل تسليم جوهري يشير لطلب CR معتمد (قب-١٠)", () => {
  it("تسليمٌ عادي لا يمسّ أصلاً حسّاساً يمرّ بلا CR", () => {
    const r = classifyDelivery(["v2/src/routes/login.ts"], "تحسين نص زر الدخول", [])
    expect(r.verdict).toBe("pass")
    expect(r.substantive).toBe(false)
  })

  it("وتعديلُ المصفوفة الذهبية بلا CR يُرفض", () => {
    const r = classifyDelivery(
      ["v2/src/authorization/matrix/authorization.matrix.json"],
      "منح الأمير قدرة الإشراف المالي",
      ["001"],
    )
    expect(r.verdict).toBe("fail")
    expect(r.substantive).toBe(true)
  })

  it("وتعديلُ سجل الإعدادات بلا CR يُرفض كذلك", () => {
    const r = classifyDelivery(["v2/src/settings/registry.ts"], "رفع الهدف الأسبوعي", ["001"])
    expect(r.verdict).toBe("fail")
  })

  it("والإشارةُ إلى CR غير موجود تُرفض — لا رقم وهمي يمرّ", () => {
    const r = classifyDelivery(
      ["v2/src/server/publicRoutes.ts"],
      "فتح مسار عام جديد CR-999",
      ["001"],
    )
    expect(r.verdict).toBe("fail")
    expect(r.cr).toBe("999")
  })

  it("والإشارةُ إلى CR معتمد قائم تمرّ", () => {
    const r = classifyDelivery(
      ["v2/src/authorization/matrix/authorization.matrix.json"],
      "تنطيق قدرة المسابقة — CR-001",
      ["001"],
    )
    expect(r.verdict).toBe("pass")
    expect(r.cr).toBe("001")
  })
})
