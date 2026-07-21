/**
 * رموز التصميم — **المصدر الواحد** لكل قيمةٍ بصرية في v2 (SPEC_design_system §١، قب-٢٠).
 *
 * القيمُ تعيش في `tokens.json` (بياناتٌ لا كود) ويُشتق منها كلُّ شيء: هذا الملفُّ يُنطِّقها،
 * و`css.ts` يصبُّها ورقةَ أنماط. **قاعدةُ الرمز** (§١-١): لا قيمةٌ بصرية خام في مكوّنٍ أو
 * شاشة — الشاشة تستدعي الاسمَ الدلاليّ (`color-surface-sunken`) لا الصبغة، فيُبدَّل الوضعُ
 * أو الهويةُ كلُّها من مصدرٍ واحد دون لمس شاشة. **الحارس**: G20 (بُعد الرموز).
 *
 * الفرقُ عن الإعدادات الحية (قب-٦): هنا **الجماليُّ الصرف** فقط؛ ورقمُ العمل (هدفُ ٧٠،
 * عتبةُ ٧٠٪) إعدادٌ في السجل — وG14 تحرس ألا يتسرّب رقمٌ تشغيليٌّ إلى الرموز.
 */

import raw from "./tokens.json"

export const MODES = ["light", "dark"] as const
export type Mode = (typeof MODES)[number]

/** أدوارُ اللون الدلاليّة — لا أسماءَ ألوانٍ خام (§١-٣). لكلٍّ قيمتان: فاتحٌ وداكن. */
export const COLOR_ROLES = [
  "surface-base",
  "surface-raised",
  "surface-sunken",
  "surface-inverse",
  "text-primary",
  "text-secondary",
  "text-disabled",
  "text-on-accent",
  "text-on-inverse",
  "border-subtle",
  "border-strong",
  "border-focus",
  "brand",
  "brand-hover",
  "brand-muted",
  "success",
  "success-muted",
  "warning",
  "warning-muted",
  "danger",
  "danger-muted",
  "info",
  "info-muted",
  "neutral",
  "neutral-muted",
] as const
export type ColorRole = (typeof COLOR_ROLES)[number]

export type SpaceStep = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
export type SizeStep =
  | "touch-min"
  | "touch-comfortable"
  | "icon-sm"
  | "icon-md"
  | "icon-lg"
  | "container-narrow"
  | "container-wide"
  | "container-full"
  | "bp-mobile"
  | "bp-tablet"
  | "bp-desktop"
export type ElevationStep = "flat" | "raised" | "overlay" | "modal"
export type RadiusStep = "none" | "sm" | "md" | "lg" | "pill" | "circle"
export type MotionDuration = "instant" | "fast" | "base" | "slow"
export type MotionEasing = "standard" | "emphasized"
export type FontStep = "display" | "title" | "body" | "caption" | "numeric"

export type FontFace = { readonly size: string; readonly lineHeight: string; readonly weight: string }

export type TokenSet = {
  readonly meta: {
    readonly decision: string
    readonly identityAr: string
    /** القيمُ المعلنة نصّاً (تُحاكَم في الاختبار): الاستدارة `md` والكثافة `comfortable`. */
    readonly radiusDefault: string
    readonly density: string
    readonly motionTone: string
    readonly note: string
  }
  readonly color: Readonly<Record<Mode, Readonly<Record<ColorRole, string>>>>
  readonly font: {
    readonly familyStack: string
    /** نظامُ الأرقام: `arab` = عربية-هندية ٤٥ موحّدةً عبر النظام (قب-٢٠ م-٢، ق-١١٧). */
    readonly numberingSystem: string
    readonly weights: { readonly regular: string; readonly medium: string; readonly bold: string }
    readonly scale: Readonly<Record<FontStep, FontFace>>
  }
  readonly space: Readonly<Record<SpaceStep, string>>
  readonly size: Readonly<Record<SizeStep, string>>
  readonly elevation: Readonly<
    Record<ElevationStep, { readonly light: string; readonly dark: string }>
  >
  readonly radius: Readonly<Record<RadiusStep, string>>
  readonly motion: {
    readonly duration: Readonly<Record<MotionDuration, string>>
    readonly easing: Readonly<Record<MotionEasing, string>>
  }
}

/** الرموزُ مُنطَّقةً — البنيةُ تُفحص زمنَ البناء (G1)، والقيمُ تبقى في مصدرها الواحد. */
export const TOKENS: TokenSet = raw

export const CSS_VAR_PREFIX = "--mishkat-"

/** اسمُ المتغيّر لدورٍ لونيّ — الشاشةُ تستدعي هذا لا الصبغة (§١-١). */
export function colorVar(role: ColorRole): string {
  return `var(${CSS_VAR_PREFIX}color-${role})`
}

export function spaceVar(step: SpaceStep): string {
  return `var(${CSS_VAR_PREFIX}space-${step})`
}

export function radiusVar(step: RadiusStep): string {
  return `var(${CSS_VAR_PREFIX}radius-${step})`
}

export function sizeVar(step: SizeStep): string {
  return `var(${CSS_VAR_PREFIX}size-${step})`
}
