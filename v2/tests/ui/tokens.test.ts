/**
 * رموز الهوية (قب-٢٠) — SPEC_design_system §١.
 *
 * تُحاكَم الرموزُ إلى عقدها لا إلى ذوق كاتبها: سبعُ عائلات، وضعان بتباينٍ ≥ AA **محسوباً
 * لا مفترَضاً** (§٤-٤)، خطٌّ مُضمَّنٌ بلا CDN (المادة ٢)، أرقامٌ عربية-هندية، وحركةٌ تحترم
 * `prefers-reduced-motion` (§١-٨). كل توكيدٍ هنا بندٌ في قب-٢٠ أو §١.
 */
import { describe, it, expect } from "vitest"
import { fileURLToPath } from "node:url"
import { TOKENS, COLOR_ROLES, MODES, type ColorRole } from "../../src/ui/tokens/tokens.js"
import { contrastRatio, relativeLuminance, meetsContrast } from "../../src/ui/tokens/contrast.js"
import { EMBEDDED_FONT } from "../../src/ui/tokens/font.js"
import { renderTokensCss } from "../../src/ui/tokens/css.js"

const HEX = /^#[0-9A-F]{6}$/
const TOKENS_CSS_PATH = fileURLToPath(
  new URL("../../src/ui/tokens/tokens.generated.css", import.meta.url),
)

/** الأزواج الحرجة: نصٌّ عاديّ ≥ ٤٫٥:١ · عنصرُ واجهةٍ/حدٌّ ≥ ٣:١ (WCAG AA — §٤-٤). */
const CRITICAL_PAIRS: readonly (readonly [ColorRole, ColorRole, number])[] = [
  ["text-primary", "surface-base", 4.5],
  ["text-primary", "surface-raised", 4.5],
  ["text-primary", "surface-sunken", 4.5],
  ["text-secondary", "surface-base", 4.5],
  ["text-secondary", "surface-raised", 4.5],
  ["text-secondary", "surface-sunken", 4.5],
  ["text-on-accent", "brand", 4.5],
  ["text-on-accent", "brand-hover", 4.5],
  ["text-on-inverse", "surface-inverse", 4.5],
  ["success", "surface-base", 4.5],
  ["warning", "surface-base", 4.5],
  ["danger", "surface-base", 4.5],
  ["info", "surface-base", 4.5],
  ["neutral", "surface-base", 4.5],
  ["success", "success-muted", 4.5],
  ["warning", "warning-muted", 4.5],
  ["danger", "danger-muted", 4.5],
  ["info", "info-muted", 4.5],
  ["neutral", "neutral-muted", 4.5],
  ["brand", "surface-base", 3],
  ["border-strong", "surface-base", 3],
  ["border-focus", "surface-base", 3],
  ["border-focus", "surface-raised", 3],
]

describe("رموز الهوية — حاسبة التباين نفسها صحيحة قبل أن نحاكم بها", () => {
  it("الأبيض على الأسود = ٢١:١ والأبيض على الأبيض = ١:١", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1)
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5)
  })

  it("سطوعُ الأسود صفرٌ وسطوعُ الأبيض واحد", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5)
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5)
  })

  it("ترتيب اللونين لا يغيّر النسبة (النسبة تناظرية)", () => {
    expect(contrastRatio("#2E6B4F", "#FBFAF7")).toBeCloseTo(contrastRatio("#FBFAF7", "#2E6B4F"), 6)
  })

  it("`meetsContrast` يرفض ما دون العتبة ويقبل ما بلغها", () => {
    expect(meetsContrast("#777777", "#FFFFFF", 4.5)).toBe(false)
    expect(meetsContrast("#000000", "#FFFFFF", 4.5)).toBe(true)
  })
})

describe("رموز الهوية — العائلات السبع ومصدرها الواحد (§١-٢)", () => {
  it("العائلات السبع كلُّها حاضرة: لون وخط ومسافة وحجم وظل وزاوية وحركة", () => {
    expect(Object.keys(TOKENS).sort()).toEqual(
      ["color", "elevation", "font", "meta", "motion", "radius", "size", "space"].sort(),
    )
  })

  it("الوضعان يحملان **الأدوار نفسها** — لا دورَ يعيش في وضعٍ دون أخيه (§١-٣)", () => {
    const light = Object.keys(TOKENS.color.light).sort()
    const dark = Object.keys(TOKENS.color.dark).sort()
    expect(dark).toEqual(light)
    expect(light).toEqual([...COLOR_ROLES].sort())
  })

  it("كل قيمة لونٍ سداسيّةٌ صالحة بحروفٍ كبيرة (شكلٌ واحد لا شكلان)", () => {
    for (const mode of MODES) {
      for (const [role, value] of Object.entries(TOKENS.color[mode])) {
        expect(value, `${mode}/${role}`).toMatch(HEX)
      }
    }
  })

  it("سلّمُ المسافة هندسيٌّ من قاعدة ٤ بكسل، تصاعديٌّ بلا «١٣ بكسل» (§١-٥)", () => {
    const values = Object.values(TOKENS.space).map((v) => Number.parseFloat(v) * 16)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    for (const px of values) expect(px % 4, `قيمة ${px} خارج قاعدة الأربعة`).toBe(0)
  })

  it("هدفُ اللمس الأدنى ≥ ٤٤ نقطة — معيارُ a11y مُلزِم (§١-٦/§٤-٢)", () => {
    expect(Number.parseFloat(TOKENS.size["touch-min"]) * 16).toBeGreaterThanOrEqual(44)
    expect(Number.parseFloat(TOKENS.size["touch-comfortable"]) * 16).toBeGreaterThanOrEqual(
      Number.parseFloat(TOKENS.size["touch-min"]) * 16,
    )
  })

  it("الأوزانُ ثلاثةٌ لا أكثر — كثرةُ الأوزان تنافر (§١-٤)", () => {
    expect(Object.keys(TOKENS.font.weights)).toEqual(["regular", "medium", "bold"])
  })

  it("سلّمُ الارتفاع دلاليٌّ بأربع درجات، والزوايا عائلةٌ واحدة (§١-٧)", () => {
    expect(Object.keys(TOKENS.elevation)).toEqual(["flat", "raised", "overlay", "modal"])
    expect(Object.keys(TOKENS.radius)).toEqual(["none", "sm", "md", "lg", "pill", "circle"])
  })

  it("الاستدارةُ الافتراضية ناعمةٌ والكثافةُ مريحة (قب-٢٠ م-٤)", () => {
    expect(TOKENS.meta.radiusDefault).toBe("md")
    expect(TOKENS.meta.density).toBe("comfortable")
  })

  it("مددُ الحركة أربعٌ هادئةٌ مقتصدة ومنحنيان (قب-٢٠ م-٣ · §١-٨)", () => {
    expect(Object.keys(TOKENS.motion.duration)).toEqual(["instant", "fast", "base", "slow"])
    expect(Object.keys(TOKENS.motion.easing)).toEqual(["standard", "emphasized"])
    const ms = Object.values(TOKENS.motion.duration).map((d) => Number.parseInt(d, 10))
    expect(ms).toEqual([...ms].sort((a, b) => a - b))
    expect(Math.max(...ms)).toBeLessThanOrEqual(400) // هادئةٌ لا استعراضية (ضعف الشبكة §٤-٣)
  })
})

describe("رموز الهوية — التباين ≥ AA محسوباً في الوضعين (§٤-٤، قب-٢٠ م-١)", () => {
  for (const mode of MODES) {
    for (const [fg, bg, min] of CRITICAL_PAIRS) {
      it(`${mode}: «${fg}» على «${bg}» ≥ ${min}:١`, () => {
        const palette = TOKENS.color[mode]
        const ratio = contrastRatio(palette[fg], palette[bg])
        expect(ratio, `${mode} ${fg}/${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min)
      })
    }
  }
})

describe("رموز الهوية — الخط مُضمَّنٌ لا مُستجلَب (المادة ٢، قب-٢٠ م-٢)", () => {
  it("عائلةُ الخط عصريّةٌ هندسية (Cairo) وهي أولُ الرصّة", () => {
    expect(EMBEDDED_FONT.family).toBe("Cairo")
    expect(TOKENS.font.familyStack.startsWith('"Cairo"')).toBe(true)
  })

  it("المصدرُ `data:` مُضمَّنٌ في الشجرة — صفر طلبٍ شبكيّ", () => {
    expect(EMBEDDED_FONT.dataUri.startsWith("data:font/woff2;base64,")).toBe(true)
    expect(EMBEDDED_FONT.dataUri.length).toBeGreaterThan(1000)
  })

  it("رخصةُ الخط معلنةٌ في الشجرة (لا أصلٌ مجهولُ الحقّ)", () => {
    expect(EMBEDDED_FONT.license).toContain("OFL")
  })

  it("ورقةُ الأنماط المولّدة **لا تحمل أي مرجعٍ شبكيّ** (لا CDN ولا خطٌّ مُستجلَب)", () => {
    const css = renderTokensCss()
    expect(css).not.toMatch(/https?:\/\//)
    expect(css).not.toMatch(/@import/)
    expect(css).toContain("@font-face")
  })
})

describe("رموز الهوية — العربية والاتجاه والحركة في ورقة الأنماط (§١-٨، §٤-٤/٤-٦)", () => {
  const css = renderTokensCss()

  it("الاتجاهُ واللغةُ جذريّان على الوثيقة لا على مكوّن (ق-١١٧)", () => {
    expect(css).toMatch(/direction:\s*rtl/)
    expect(css).toMatch(/:root/)
  })

  it("الأرقامُ عربية-هندية موحّدةً عبر النظام (قب-٢٠ م-٢)", () => {
    expect(TOKENS.font.numberingSystem).toBe("arab")
    expect(css).toMatch(/font-variant-numeric|--mishkat-font-numeral-system/)
  })

  it("الوضعُ الداكن يعمل بتفضيل النظام **وبمفتاحٍ صريح** معاً", () => {
    expect(css).toContain("prefers-color-scheme: dark")
    expect(css).toContain('[data-theme="dark"]')
  })

  it("من طلب تقليلَ الحركة تُختصر إلى `instant` بلا انزلاق (§١-٨ مُلزِمة)", () => {
    expect(css).toContain("prefers-reduced-motion: reduce")
    const block = css.slice(css.indexOf("prefers-reduced-motion"))
    expect(block).toMatch(/--mishkat-motion-duration-(fast|base|slow):\s*0ms/)
  })

  it("كل دورٍ لونيٍّ يظهر متغيّراً في :root — الشاشة تستدعي الدور لا القيمة (§١-١)", () => {
    for (const role of COLOR_ROLES) expect(css).toContain(`--mishkat-color-${role}:`)
  })
})

describe("رموز الهوية — الأثرُ المُخرَج مطابقٌ لمصدره (مصدرٌ واحد، المادة ١/٢)", () => {
  it("`tokens.generated.css` المُلتزَم مطابقٌ حرفياً لما يولّده المصدر (حارسُ الانحراف)", async () => {
    // الأثرُ يُولَّد ويُحرَس بالمِلفّ نفسه: تغييرُ رمزٍ يُفشل هذا الاختبار حتى يُعاد التوليد
    // (`npm run gen:tokens-css`) — فلا تنحرف الورقةُ عن مصدرها صامتةً.
    await expect(renderTokensCss()).toMatchFileSnapshot(TOKENS_CSS_PATH)
  })
})
