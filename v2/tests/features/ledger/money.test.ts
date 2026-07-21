/**
 * ق-٤٨ — المال بالسنتات الصحيحة (`SPEC_finance_ledger` §١).
 * الاختبار الإلزاميّ التاسع: **تمريرُ كسرٍ عشريّ ⇒ مرفوضٌ عند الحدّ** لا مقرَّبٌ صامتاً.
 */
import { describe, it, expect } from "vitest"
import {
  addCents,
  cents,
  convertWithRate,
  fromCents,
  positiveCents,
  sumCents,
  toCents,
} from "../../../src/features/ledger/services/money.js"
import { c } from "./_seed.js"

describe("ق-٤٨/١ — نوعُ المال صريحٌ ومنعُ الكسور عند الحدّ", () => {
  it("يقبل العدد الصحيح من السنتات", () => {
    const r = cents(1999)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(1999)
  })

  it("**يرفض الكسر العشريّ ولا يقرّبه صامتاً** — الرفضُ عند الحدّ", () => {
    for (const bad of [19.99, 0.5, -3.25, 1e-3]) {
      const r = cents(bad)
      expect(r.ok, `قُبل كسرٌ عشريّ: ${bad}`).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("FRACTIONAL_AMOUNT")
    }
  })

  it("يرفض NaN واللانهاية وما يتجاوز حدّ السلامة العددية", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 60]) {
      const r = cents(bad)
      expect(r.ok, `قُبل عددٌ غير آمن: ${bad}`).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("AMOUNT_NOT_SAFE")
    }
  })

  it("يرفض المبلغ السالب حيث يُشترط الموجب — الاتجاه بالطرف لا بالإشارة", () => {
    const r = positiveCents(-1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("NEGATIVE_AMOUNT")
  })
})

describe("ق-٤٨/٢ — نقطةُ التحويل الوحيدة بلا انجرافٍ عائم", () => {
  it("يحوّل «19.99» إلى ١٩٩٩ سنتاً بالضبط (حيث يُخطئ الضربُ العائم)", () => {
    const r = toCents("19.99")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(1999)
    // برهانُ الحاجة: الطريقُ العائم ينحرف فعلاً على هذا المدخل بالذات.
    expect(19.99 * 100).not.toBe(1999)
  })

  it("يحوّل المنزلة الواحدة والصفر والسالب حتمياً", () => {
    expect(toCents("7.5")).toEqual({ ok: true, value: 750 })
    expect(toCents("0")).toEqual({ ok: true, value: 0 })
    expect(toCents("-3.07")).toEqual({ ok: true, value: -307 })
  })

  it("**يرفض نصَّ مبلغٍ بأكثر من منزلتين** — لا تقريبَ عند الحدّ", () => {
    for (const bad of ["19.999", "0.001", "1.2345"]) {
      const r = toCents(bad)
      expect(r.ok, `قُبل نصٌّ بأكثر من منزلتين: ${bad}`).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("FRACTIONAL_AMOUNT")
    }
  })

  it("يرفض النصَّ غير الرقميّ ولا يعيد صفراً صامتاً", () => {
    for (const bad of ["", "abc", "1,000", "1.2.3", "١٩"]) {
      expect(toCents(bad).ok, `قُبل نصٌّ فاسد: ${bad}`).toBe(false)
    }
  })

  it("يعرض السنتات بالوحدة الكبرى بقسمةٍ صحيحةٍ لا عائمة", () => {
    expect(fromCents(c(1999))).toBe("19.99")
    expect(fromCents(c(700))).toBe("7.00")
    expect(fromCents(c(5))).toBe("0.05")
    expect(fromCents(c(-307))).toBe("-3.07")
  })
})

describe("ق-٤٨/٣ — الحساب يبقى صحيحاً", () => {
  it("يجمع السنتات ويرمي عند تجاوز حدّ السلامة العددية بدل الالتفاف الصامت", () => {
    expect(addCents(c(1999), c(1))).toBe(2000)
    expect(sumCents([c(10), c(20), c(30)])).toBe(60)
    expect(() => addCents(c(Number.MAX_SAFE_INTEGER), c(2))).toThrow(RangeError)
  })

  it("يحوّل بسعرٍ معلنٍ بعددين صحيحين — بلا عددٍ عائمٍ في الطريق", () => {
    // ١٠٬٠٠٠ ليرة والسعرُ المعلن: ١٠٠ سنتاً من الأساس مقابل ٥٠٬٠٠٠ سنتاً من العملة.
    expect(convertWithRate(c(10_000), c(100), c(50_000))).toBe(20)
    expect(() => convertWithRate(c(1), c(1), c(0))).toThrow(RangeError)
  })
})
