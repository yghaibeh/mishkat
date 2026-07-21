/**
 * المال بالسنتات الصحيحة — ق-٤٨ (`SPEC_finance_ledger` §١).
 *
 * **نقطةُ التحويل الوحيدة** بين عالم «الوحدات الكبرى» (الدولار) والدفتر. تكرارُ التحويل في
 * مواضعَ متفرقة هو ما أنتج انجرافَ `REAL` في v1؛ فهو هنا في دالتين لا غير.
 *
 * **لا عددٌ عائمٌ في أي خطوة**: التحويل من النصّ يقع بجمعٍ وضربٍ صحيحين على مقاطعِ الرقم،
 * لا بـ`Number.parseFloat` ولا بـ`Math.round(x * ١٠٠)` — فـ`19.99 * 100` في العشريّ العائم
 * ليست `1999`. والعرضُ يقسم قسمةً صحيحة ويُبطّن الباقي، فلا قسمةَ عائمةً حتى في الإخراج.
 */

import { err, ok, type Cents, type Result } from "../types.js"

/** خانات الوحدة الصغرى في العملات المتداولة (سنتان عشريان) — خاصّةُ عملةٍ لا رقمُ عمل. */
const MINOR_UNITS_PER_MAJOR = 100

/** الصفرُ الموسوم — يُعاد استعماله فلا يُبنى في كل سطر. */
export const ZERO_CENTS: Cents = 0 as Cents

/** هل هذا العددُ صالحٌ سنتاتٍ؟ صحيحٌ وضمن حدّ السلامة العددية. */
export function isCents(value: number): boolean {
  return Number.isSafeInteger(value)
}

/**
 * حدُّ الدخول الوحيد لعددٍ يدّعي أنه سنتات — **يرفض ولا يقرّب صامتاً** (§١.٣).
 */
export function cents(value: number): Result<Cents> {
  if (Number.isNaN(value) || !Number.isFinite(value)) return err("AMOUNT_NOT_SAFE", String(value))
  if (!Number.isInteger(value)) return err("FRACTIONAL_AMOUNT", String(value))
  if (!Number.isSafeInteger(value)) return err("AMOUNT_NOT_SAFE", String(value))
  return ok(value as Cents)
}

/** كسنتاتٍ موجبة — الاتجاه بالطرف لا بالإشارة (§٢.٢). */
export function positiveCents(value: number): Result<Cents> {
  const c = cents(value)
  if (!c.ok) return c
  if (c.value < 0) return err("NEGATIVE_AMOUNT", String(value))
  return c
}

/** نصُّ المبلغ بالوحدة الكبرى: أرقامٌ، ونقطةٌ واحدةٌ بمنزلتين على الأكثر. */
const AMOUNT_TEXT = /^(-?)(\d+)(?:\.(\d+))?$/

/**
 * `toCents` — التحويل الوحيد من نصّ الوحدة الكبرى إلى السنتات (§١.٢).
 * أكثرُ من منزلتين ⇒ `FRACTIONAL_AMOUNT`: **الرفضُ عند الحدّ** لا تقريبٌ صامت.
 */
export function toCents(major: string): Result<Cents> {
  const m = AMOUNT_TEXT.exec(major.trim())
  if (m === null) return err("FRACTIONAL_AMOUNT", major)
  const [, sign, whole, fraction] = m
  const frac = fraction ?? ""
  if (frac.length > String(MINOR_UNITS_PER_MAJOR).length - 1) {
    return err("FRACTIONAL_AMOUNT", major)
  }
  const minor = Number(frac.padEnd(String(MINOR_UNITS_PER_MAJOR).length - 1, "0"))
  const total = Number(whole) * MINOR_UNITS_PER_MAJOR + minor
  const signed = sign === "-" ? -total : total
  return cents(signed)
}

/** العرضُ بالوحدة الكبرى — قسمةٌ صحيحةٌ وتبطينٌ، لا قسمةَ عائمة (§١.٢). */
export function fromCents(value: Cents): string {
  const negative = value < 0
  const abs = Math.abs(value)
  const whole = Math.trunc(abs / MINOR_UNITS_PER_MAJOR)
  const minor = abs % MINOR_UNITS_PER_MAJOR
  const padded = String(minor).padStart(String(MINOR_UNITS_PER_MAJOR).length - 1, "0")
  return `${negative ? "-" : ""}${whole}.${padded}`
}

/** جمعٌ يبقى داخل حدّ السلامة العددية — تجاوزُه خطأٌ لا التفافٌ صامت. */
export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError(`تجاوزُ حدّ السلامة العددية في جمع السنتات: ${a} + ${b}`)
  }
  return sum as Cents
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((acc, v) => addCents(acc, v), ZERO_CENTS)
}

/** تحويلٌ بسعرٍ **معلن** بعددين صحيحين — قسمةٌ صحيحةٌ نحو الأسفل، لا عددَ عائم (§٤.٣). */
export function convertWithRate(amount: Cents, baseCents: Cents, foreignCents: Cents): Cents {
  if (foreignCents <= 0) throw new RangeError("مقامُ سعر الصرف يجب أن يكون موجباً")
  return Math.trunc((amount * baseCents) / foreignCents) as Cents
}
