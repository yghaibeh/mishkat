/**
 * ق-٤٥ — **حدودُ اليوم والأسبوع بتوقيت الإعداد لا بـUTC** (قب-٦/G14).
 *
 * الخطأُ المكلّف الذي تقتله هذه الوحدة: نافذةُ ٠٠:٠٠–٠٣:٠٠ الدمشقية كانت تنسب عملَ اليوم
 * إلى أمس، لأنّ الحدَّ كان محسوباً بـUTC. وهنا **لا منطقةَ ولا يومَ بدءٍ مثبَّتان**: كلاهما
 * يُقرأ من سجل الإعدادات (`time.zone` · `time.week_start_day`) ويُمرَّر إلى هذه الدوالّ.
 *
 * و**صفر رقمٍ في هذا الملفّ** (G14): أسماءُ الأيام قائمةٌ مسمّاة، وحسابُ الإزاحة على طولها،
 * والتواريخُ تُبنى من **مفاتيح نصّية** لا من ثوابتَ زمنية.
 */

/** أسماءُ الأيام بترتيبها القياسيّ — مصدرُ الإزاحة، فلا رقمَ يومٍ في الكود. */
export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const

export type WeekdayName = (typeof WEEKDAY_NAMES)[number]

/** مفتاحُ اليوم `YYYY-MM-DD` **في المنطقة المضبوطة** — هو وحدةُ القياس في كل ما يلي. */
export function dayKeyIn(at: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at)
}

/** مرساةُ اليوم: منتصفُ ليله بـUTC — بها يصير حسابُ الأيام جبراً على المفاتيح لا على اللحظات. */
export function dayAnchor(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`)
}

export function shiftDayKey(dayKey: string, days: number): string {
  const d = dayAnchor(dayKey)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]!
}

export function weekdayOfDayKey(dayKey: string): WeekdayName {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" })
    .format(dayAnchor(dayKey))
    .toLowerCase()
  return name as WeekdayName
}

/** مفتاحُ الأسبوع = **يومُ بدئه** — والبدءُ إعدادٌ حيّ (`time.week_start_day`). */
export function weekKeyOf(dayKey: string, weekStart: string): string {
  const startIndex = WEEKDAY_NAMES.indexOf(weekStart as WeekdayName)
  if (startIndex < 0) throw new TypeError(`يومُ بدءِ أسبوعٍ غيرُ معروف: ${weekStart}`)
  const dayIndex = WEEKDAY_NAMES.indexOf(weekdayOfDayKey(dayKey))
  const back = (dayIndex - startIndex + WEEKDAY_NAMES.length) % WEEKDAY_NAMES.length
  return shiftDayKey(dayKey, -back)
}

/** أوّلُ لحظةٍ **بعد** أسبوعٍ بدأ عند `weekKey` — حدٌّ أعلى مفتوحٌ يصلح للقفل الزمنيّ. */
export function weekEndExclusive(weekKey: string): Date {
  return dayAnchor(shiftDayKey(weekKey, WEEKDAY_NAMES.length))
}

/**
 * ق-٤٣ — **عددُ أيام بدء الأسبوع الواقعة في المدى** (سُبوتُ الشهر حين يكون البدءُ سبتاً).
 * القياسُ على **التقويم** لا على عدد السجلات المُدخَلة — وهذا لبُّ القاعدة.
 */
export function weekStartsInSpan(
  fromDayKey: string,
  toDayKey: string,
  weekStart: string,
): number {
  if (WEEKDAY_NAMES.indexOf(weekStart as WeekdayName) < 0) {
    throw new TypeError(`يومُ بدءِ أسبوعٍ غيرُ معروف: ${weekStart}`)
  }
  let count = 0
  let key = fromDayKey
  while (key <= toDayKey) {
    if (weekdayOfDayKey(key) === weekStart) count += 1
    key = shiftDayKey(key, 1)
  }
  return count
}
