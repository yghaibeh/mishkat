/**
 * حاسبةُ التباين (WCAG 2.1) — SPEC_design_system §٤-٤: التباينُ **يُحسب من أدوار اللون في
 * الوضعين، لا يُفترَض**. دالةٌ نقيّةٌ بلا تبعية، تُستدعى في الاختبار فيصير معيارُ الوصول
 * **قابلاً للفحص** لا وعداً في وثيقة.
 */

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function parseHex(hex: string): readonly [number, number, number] {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (m === null) throw new Error(`لونٌ غير صالح (يُنتظر #RRGGBB): ${hex}`)
  const h = m[1] as string
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

/** السطوعُ النسبيّ (WCAG): الأسود ٠ والأبيض ١. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** نسبةُ التباين بين لونين — تناظريّةٌ لا تتأثر بترتيبهما. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** هل يبلغ الزوجُ العتبةَ المطلوبة؟ (نصٌّ عاديّ ٤٫٥ · كبيرٌ/عنصرُ واجهة ٣). */
export function meetsContrast(fg: string, bg: string, minimum: number): boolean {
  return contrastRatio(fg, bg) >= minimum
}
