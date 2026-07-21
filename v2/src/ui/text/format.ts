/**
 * التنسيقاتُ المركزية — ذ-٥ (الهجري) وذ-٦ (المبلغ) + قب-٢٠ (أرقام عربية-هندية ٤٥).
 *
 * **لا تنسيقٌ محليٌّ في مكوّن**: التاريخُ والمبلغُ والرقمُ تمرّ من هنا حصراً، فيستحيل أن
 * تتنافر شاشتان في شكل رقمٍ أو تاريخ. ثلاثةُ ثوابت من دروس v1:
 *  - `Intl` بلا تبعية، **ومنطقةٌ زمنيةٌ مثبَّتة** ⇒ الناتجُ حتميٌّ قابلٌ لإعادة الإنتاج.
 *  - **لا إلحاق «هـ» يدوياً** فوق ما يُلحقه `Intl` (خطأ «١٤٤٨ هـ هـ» المكلف).
 *  - العملةُ والمنزلةُ **من الإعدادات** (قب-٦) تُمرَّران مُعاملَين — لا ثابتَ عملةٍ في العرض.
 */

const LOCALE_HIJRI = "ar-SA-u-ca-islamic-umalqura-nu-arab"
const LOCALE_NUMERIC = "ar-SA-u-nu-arab"
/** التقويمُ والساعةُ مثبَّتان لاتساق الشبكة كلها (وحتميّةِ الاختبار). */
const TIME_ZONE = "Asia/Riyadh"

const MS_PER_DAY = 86_400_000

/** فاصلُ القوائم العربيّ — في طبقة النصوص لا في مكوّن (§٥-٣). */
export const LIST_SEPARATOR_AR = "، "

/** رقمٌ عربيٌّ-هنديّ بلا فواصل تجميعٍ ضالّة. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE_NUMERIC, { useGrouping: false }).format(value)
}

/** تاريخٌ هجريٌّ بأمّ القرى — «هـ» يُلحقها `Intl` ولا نكرّرها. */
export function formatHijri(at: Date, options: { readonly withTime?: boolean } = {}): string {
  const withTime = options.withTime === true
  return new Intl.DateTimeFormat(
    LOCALE_HIJRI,
    withTime
      ? { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }
      : { dateStyle: "long", timeZone: TIME_ZONE },
  ).format(at)
}

/**
 * «منذ يومين» **من سجلٍّ حيٍّ لا نصٍّ جامد** (ق-١١٢): الفرقُ يُحسب من لحظتين حقيقيتين،
 * والساعةُ تُمرَّر ولا تُقرأ من داخل الدالة (حتميّة — TESTING_POLICY §٥).
 */
export function formatRelativeDays(at: Date, now: Date): string {
  const days = Math.round((at.getTime() - now.getTime()) / MS_PER_DAY)
  return new Intl.RelativeTimeFormat(LOCALE_NUMERIC, { numeric: "auto" }).format(days, "day")
}

export type MoneyInput = {
  readonly amount: number
  /** رمزُ العملة من الإعدادات (قب-٦) — لا عملةَ صلبةٌ في طبقة العرض. */
  readonly currencyCode: string
  /** منزلةُ الكسر من الإعدادات كذلك (تختلف بالعملة). */
  readonly fractionDigits: number
}

/**
 * مبلغٌ بعملةٍ ومنزلةٍ متسقتين، **والسالبُ يحمل علامتَه في النصّ** — فالدلالةُ لا تُحمَل
 * باللون وحده (§٤-٥، عمى الألوان). الواجهةُ المالية مبسّطةٌ لغير المحاسب (قب-٨).
 */
export function formatMoney(input: MoneyInput): string {
  const magnitude = new Intl.NumberFormat(LOCALE_NUMERIC, {
    style: "currency",
    currency: input.currencyCode,
    minimumFractionDigits: input.fractionDigits,
    maximumFractionDigits: input.fractionDigits,
  }).format(Math.abs(input.amount))
  return input.amount < 0 ? `−${magnitude}` : magnitude
}
