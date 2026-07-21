/**
 * الذرّات السبع — SPEC_design_system §٢-أ.
 * كلُّ ذرّةٍ دالةٌ نقيّة من عقدها إلى عقدة عرض؛ لا قيمةٌ بصرية خام ولا حرفٌ عربيّ (§١-٩/§٥-٣).
 */

import { node, label, type CapabilityDeclaration, type Tone, type UiNode } from "./kernel.js"
import type { TextKey } from "../text/dictionary.js"
import { formatHijri, formatMoney, formatRelativeDays } from "../text/format.js"

// ── ذ-١ الزر ────────────────────────────────────────────────────────────────
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonState = "idle" | "loading" | "disabled"

export type ButtonProps = {
  readonly labelKey: TextKey
  readonly variant: ButtonVariant
  /** الزرُّ بلا قدرةٍ مسموحة **لا يُعرَض** أصلاً؛ وهنا يُعلن أيَّ قدرةٍ يمثّل (§٣-١). */
  readonly capability: CapabilityDeclaration
  readonly state?: ButtonState
  readonly iconName?: string
}

export function button(props: ButtonProps): UiNode {
  const state = props.state ?? "idle"
  return node({
    component: "Button",
    capability: props.capability,
    textKeys: [props.labelKey],
    ...(props.iconName === undefined ? {} : { iconName: props.iconName }),
    a11y: { role: "button", nameAr: label(props.labelKey) },
    meta: {
      variant: props.variant,
      state,
      // «مُحمَّل» يُعطّل النقر: لا إرسالَ مزدوج (ت-٨ + مطابرة `client_uuid`).
      disabled: String(state !== "idle"),
    },
  })
}

// ── ذ-٢ الرابط ──────────────────────────────────────────────────────────────
export type LinkProps = {
  readonly labelKey: TextKey
  readonly href: string
  readonly capability: CapabilityDeclaration
  readonly current?: boolean
}

export function link(props: LinkProps): UiNode {
  return node({
    component: "Link",
    capability: props.capability,
    textKeys: [props.labelKey],
    a11y: { role: "link", nameAr: label(props.labelKey) },
    meta: { href: props.href, current: String(props.current === true) },
  })
}

// ── ذ-٣ الأيقونة ────────────────────────────────────────────────────────────
export type IconProps = { readonly name: string; readonly labelKey: TextKey }

export function icon(props: IconProps): UiNode {
  if (props.name.trim().length === 0) {
    throw new Error("أيقونةٌ بلا اسمٍ من المصدر المركزي (ق-١١٨) — كل أيقونةٍ من معجمها")
  }
  return node({
    component: "Icon",
    textKeys: [props.labelKey],
    iconName: props.name,
    // الأيقونةُ وحدها باسمٍ بديل (§٤-٤) — ولا تحمل المعنى وحدها (§٤-٥).
    a11y: { role: "img", nameAr: label(props.labelKey) },
  })
}

// ── ذ-٤ الشارة ──────────────────────────────────────────────────────────────
export type BadgeProps = {
  readonly labelKey: TextKey
  readonly tone: Tone
  readonly iconName: string
}

export function badge(props: BadgeProps): UiNode {
  return node({
    component: "Badge",
    textKeys: [props.labelKey],
    tone: props.tone,
    iconName: props.iconName,
    a11y: { role: "status", nameAr: label(props.labelKey) },
  })
}

// ── ذ-٥ الطابع الزمني الهجري ────────────────────────────────────────────────
export type HijriDateProps = {
  readonly at: Date
  readonly withTime?: boolean
  /** لحظةُ القياس للنسبيّ — تُمرَّر ولا تُقرأ من الساعة (حتميّة + ق-١١٢). */
  readonly relativeTo?: Date
}

export function hijriDate(props: HijriDateProps): UiNode {
  const textAr = formatHijri(props.at, { withTime: props.withTime === true })
  const relativeAr =
    props.relativeTo === undefined ? "" : formatRelativeDays(props.at, props.relativeTo)
  return node({
    component: "HijriDate",
    a11y: { role: "time", nameAr: textAr },
    meta: { textAr, relativeAr, calendar: "islamic-umalqura" },
  })
}

// ── ذ-٦ المبلغ المالي ───────────────────────────────────────────────────────
export type MoneyProps = {
  readonly amount: number
  /** من الإعدادات الحية (قب-٦) — لا عملةَ صلبةٌ في العرض. */
  readonly currencyCode: string
  readonly fractionDigits: number
}

export function money(props: MoneyProps): UiNode {
  const textAr = formatMoney(props)
  const sign = props.amount < 0 ? "negative" : props.amount > 0 ? "positive" : "zero"
  return node({
    component: "Money",
    a11y: { role: "text", nameAr: textAr },
    // الإشارةُ في النصّ نفسه لا في اللون وحده (§٤-٥).
    meta: { textAr, sign, currency: props.currencyCode },
  })
}

// ── ذ-٧ الصورة الرمزية / رمز الوحدة ─────────────────────────────────────────
export type AvatarProps = {
  readonly kind: "person" | "unit"
  readonly nameAr: string
  readonly iconName: string
  /** قاصر؟ رمزٌ مجرّدٌ لا صورةٌ شخصية حتى حسم سياسة القُصَّر (قب-١٩ — ⛔ معلّق). */
  readonly isMinor?: boolean
}

export function avatar(props: AvatarProps): UiNode {
  const minor = props.isMinor === true
  return node({
    component: "Avatar",
    iconName: props.iconName,
    a11y: { role: "img", nameAr: props.nameAr },
    meta: {
      kind: props.kind,
      rendering: minor ? "glyph" : "photo-or-glyph",
      photoAllowed: String(!minor),
    },
  })
}
