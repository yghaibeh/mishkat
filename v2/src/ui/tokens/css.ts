/**
 * صبُّ الرموز ورقةَ أنماط — الأثرُ الوحيد الذي يصل المتصفح، ومصدرُه `tokens.json` وحده.
 *
 * الشاشةُ لا تعرف الوضع (§١-٣): تستدعي الدورَ (`--mishkat-color-brand`) ويُبدَّل الوضعُ
 * من مفتاحٍ واحد — بتفضيل النظام **وبمفتاحٍ صريح** معاً. والحركةُ تُختصر إلى صفرٍ لمن
 * طلب تقليلها (§١-٨ مُلزِمة).
 *
 * الناتجُ **حتميّ** (بلا تاريخٍ ولا عشوائية) فيُلتزَم في الشجرة (`tokens.generated.css`)
 * ويُحرَس بالتطابق: أيُّ انحرافٍ بين المصدر والأثر يُفشِل الاختبار (المادة ١/٢).
 */

import { TOKENS, COLOR_ROLES, CSS_VAR_PREFIX, type Mode } from "./tokens.js"
import { EMBEDDED_FONT } from "./font.js"

const P = CSS_VAR_PREFIX

function colorBlock(mode: Mode, indent: string): string {
  return COLOR_ROLES.map((role) => `${indent}${P}color-${role}: ${TOKENS.color[mode][role]};`).join(
    "\n",
  )
}

function elevationBlock(mode: Mode, indent: string): string {
  return Object.entries(TOKENS.elevation)
    .map(([step, pair]) => `${indent}${P}elevation-${step}: ${pair[mode]};`)
    .join("\n")
}

/** ورقةُ الأنماط الجذرية — تُولَّد ولا تُحرَّر يدوياً. */
export function renderTokensCss(): string {
  const f = TOKENS.font
  const lines: string[] = []

  lines.push("/* ⚠️ ملف مولَّد من src/ui/tokens/tokens.json — لا يُحرَّر يدوياً.")
  lines.push(" * المولّد: src/ui/tokens/css.ts · الحارس: G20 (بُعد الرموز) + اختبار التطابق.")
  lines.push(` * الهوية: ${TOKENS.meta.identityAr} — قرار ${TOKENS.meta.decision}.`)
  lines.push(` * الخط: ${EMBEDDED_FONT.family} — ${EMBEDDED_FONT.license} */`)
  lines.push("")

  // الخطُّ مُضمَّنٌ لا مُستجلَب (المادة ٢).
  lines.push("@font-face {")
  lines.push(`  font-family: "${EMBEDDED_FONT.family}";`)
  lines.push("  font-style: normal;")
  lines.push(`  font-weight: ${EMBEDDED_FONT.weightRange};`)
  lines.push("  font-display: swap;")
  lines.push(`  src: url(${EMBEDDED_FONT.dataUri}) format("${EMBEDDED_FONT.format}");`)
  lines.push(`  unicode-range: ${EMBEDDED_FONT.unicodeRange};`)
  lines.push("}")
  lines.push("")

  lines.push(":root {")
  lines.push("  /* ١ — اللون: أدوارٌ دلاليّة (الوضع الفاتح أساساً) */")
  lines.push(colorBlock("light", "  "))
  lines.push("  /* ٢ — الخط: رصّةٌ عربيةٌ أولاً وسلّمٌ مسمّى */")
  lines.push(`  ${P}font-family: ${f.familyStack};`)
  lines.push(`  ${P}font-numeral-system: ${f.numberingSystem};`)
  for (const [weight, value] of Object.entries(f.weights)) {
    lines.push(`  ${P}font-weight-${weight}: ${value};`)
  }
  for (const [step, face] of Object.entries(f.scale)) {
    lines.push(`  ${P}font-${step}-size: ${face.size};`)
    lines.push(`  ${P}font-${step}-line-height: ${face.lineHeight};`)
    lines.push(`  ${P}font-${step}-weight: ${face.weight};`)
  }
  lines.push("  /* ٣ — المسافة: سلّمٌ هندسيٌّ واحد */")
  for (const [step, value] of Object.entries(TOKENS.space)) {
    lines.push(`  ${P}space-${step}: ${value};`)
  }
  lines.push("  /* ٤ — الحجم: لمسٌ وأيقونةٌ وحاويةٌ وكسر */")
  for (const [step, value] of Object.entries(TOKENS.size)) {
    lines.push(`  ${P}size-${step}: ${value};`)
  }
  lines.push("  /* ٥ — الظل: ارتفاعٌ دلاليّ */")
  lines.push(elevationBlock("light", "  "))
  lines.push("  /* ٦ — الزاوية: عائلةٌ واحدة */")
  for (const [step, value] of Object.entries(TOKENS.radius)) {
    lines.push(`  ${P}radius-${step}: ${value};`)
  }
  lines.push("  /* ٧ — الحركة: هادئةٌ مقتصدة */")
  for (const [step, value] of Object.entries(TOKENS.motion.duration)) {
    lines.push(`  ${P}motion-duration-${step}: ${value};`)
  }
  for (const [step, value] of Object.entries(TOKENS.motion.easing)) {
    lines.push(`  ${P}motion-ease-${step}: ${value};`)
  }
  lines.push("}")
  lines.push("")

  // الوضعُ الداكن: تفضيلُ النظام ما لم يُصرَّح بالفاتح.
  lines.push("@media (prefers-color-scheme: dark) {")
  lines.push('  :root:not([data-theme="light"]) {')
  lines.push(colorBlock("dark", "    "))
  lines.push(elevationBlock("dark", "    "))
  lines.push("  }")
  lines.push("}")
  lines.push("")
  lines.push('[data-theme="dark"] {')
  lines.push(colorBlock("dark", "  "))
  lines.push(elevationBlock("dark", "  "))
  lines.push("}")
  lines.push("")

  // احترامُ تقليل الحركة — مُلزِم (§١-٨).
  lines.push("@media (prefers-reduced-motion: reduce) {")
  lines.push("  :root {")
  lines.push(`    ${P}motion-duration-fast: 0ms;`)
  lines.push(`    ${P}motion-duration-base: 0ms;`)
  lines.push(`    ${P}motion-duration-slow: 0ms;`)
  lines.push("  }")
  lines.push("}")
  lines.push("")

  // الجذرُ العربيّ: الاتجاهُ واللغةُ على الوثيقة لا على مكوّن (ق-١١٧).
  lines.push("html {")
  lines.push("  direction: rtl;")
  lines.push(`  font-family: var(${P}font-family);`)
  lines.push(`  font-size: var(${P}font-body-size);`)
  lines.push(`  line-height: var(${P}font-body-line-height);`)
  lines.push(`  color: var(${P}color-text-primary);`)
  lines.push(`  background-color: var(${P}color-surface-base);`)
  lines.push("}")
  lines.push("")

  // حلقةُ التركيز على كل عنصرٍ تفاعليّ (§٤-٤) وهدفُ اللمس الأدنى (§٤-٢).
  lines.push(":focus-visible {")
  lines.push(`  outline: 2px solid var(${P}color-border-focus);`)
  lines.push("  outline-offset: 2px;")
  lines.push("}")
  lines.push("")
  lines.push("[data-interactive] {")
  lines.push(`  min-block-size: var(${P}size-touch-min);`)
  lines.push(`  min-inline-size: var(${P}size-touch-min);`)
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}
