// الأسبوع التشغيلي يبدأ السبت (مطابق للسجل الورقي)

// خادمُ Cloudflare يعمل بـUTC، والمستخدمون في سوريا (UTC+3 ثابتًا بلا توقيتٍ صيفيّ منذ ٢٠٢٢).
// نُثبّت كلَّ حدود اليوم/الأسبوع/الشهر على توقيت دمشق (ق٣) — كان الحدُّ ينقلب باكرًا ٣ ساعات
// فتقعُ إدخالاتُ ما بعد منتصف الليل الدمشقيّ في «أمسِ»، وتتأخّر تذكيراتُ الكرون عبر تبدُّل التاريخ.
const SYRIA_OFFSET_MS = 3 * 3_600_000
const dmsc = (d: Date): Date => new Date(d.getTime() + SYRIA_OFFSET_MS)

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayCode = typeof DAYS[number]

// رمز اليوم من تاريخ (sat..fri) — بتوقيت دمشق
export function dayCode(d: Date): DayCode {
  return DAYS[dmsc(d).getUTCDay()]
}

// تاريخ بداية الأسبوع (السبت) الذي يقع فيه d، بصيغة YYYY-MM-DD — بتوقيت دمشق
export function weekStartSaturday(d: Date): string {
  const l = dmsc(d)
  const dow = l.getUTCDay()          // 0=الأحد .. 6=السبت (دمشق)
  const sinceSaturday = (dow + 1) % 7 // السبت=0، الأحد=1، ... الجمعة=6
  const start = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - sinceSaturday))
  return start.toISOString().slice(0, 10)
}

// ترتيب أيام الأسبوع للعرض/التحقق
export const WEEK_DAYS: DayCode[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']

export function isValidDay(day: string): day is DayCode {
  return (WEEK_DAYS as string[]).includes(day)
}

// ===== التقويم الهجري (أم القرى) عبر Intl — بلا تبعيات، متوافق مع Workers =====
const HIJRI_FMT = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
})

function hijriParts(d: Date): { year: string; month: string; day: string } {
  // نُقوّم بتوقيت دمشق (ق٣) — إزاحةُ ٣ ساعاتٍ ثم تنسيقٌ بـUTC ⇒ التاريخُ الهجريُّ المحلّيّ
  const o = Object.fromEntries(HIJRI_FMT.formatToParts(dmsc(d)).map((p) => [p.type, p.value]))
  return { year: o.year!, month: o.month!, day: o.day! }
}

// مفتاح الشهر الهجري لتاريخ ميلادي: 'YYYY-MM'
export function hijriMonthKey(d: Date): string {
  const p = hijriParts(d)
  return `${p.year}-${p.month.padStart(2, '0')}`
}

// التاريخ الهجري الكامل: 'YYYY-MM-DD'
export function hijriDateStr(d: Date): string {
  const p = hijriParts(d)
  return `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`
}

// مفتاح الشهر الهجري من بداية أسبوع 'YYYY-MM-DD' (ميلادي)
export function hijriMonthFromWeekStart(weekStart: string): string {
  return hijriMonthKey(new Date(`${weekStart}T00:00:00Z`))
}

// الـ formatter العربي لنطاق الأسبوع الهجري
const HIJRI_AR_LONG = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})
const HIJRI_AR_DAY = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric', timeZone: 'UTC',
})

// أوّل لحظة ميلادية (UTC) لشهرٍ هجري 'YYYY-MM' — بحثٌ ثنائي باستخدام مُنسّق أم القرى كمرجع (حتميّ، بلا ثوابت تقريبية)
export function hijriMonthStartMs(monthKey: string): number {
  let lo = Date.UTC(1900, 0, 1)
  let hi = Date.UTC(2200, 0, 1)
  const DAY = 86_400_000
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2 / DAY) * DAY
    if (hijriMonthKey(new Date(mid)) < monthKey) lo = mid + DAY
    else hi = mid
  }
  return lo // منتصف ليل أوّل يومٍ هجري في الشهر
}

// عدد أسابيع الشهر الهجري = عدد السُّبوت الواقعة فيه (٤ أو ٥) — لحساب هدف الشهر (ق-10)
export function weeksInHijriMonth(monthKey: string): number {
  const DAY = 86_400_000
  const start = hijriMonthStartMs(monthKey)
  const [hy, hm] = monthKey.split('-').map(Number)
  const nextKey = hm === 12 ? `${hy + 1}-01` : `${hy}-${String(hm + 1).padStart(2, '0')}`
  const end = hijriMonthStartMs(nextKey)
  // أوّل سبتٍ عند/بعد بداية الشهر (السبت = يوم دمشق ٦)
  let d = start + ((6 - dmsc(new Date(start)).getUTCDay() + 7) % 7) * DAY
  let count = 0
  while (d < end) { count++; d += 7 * DAY }
  return count
}

// نطاق الأسبوع الهجري من تاريخ بدايته (السبت): "٦ – ١٢ محرم ١٤٤٦ هـ"
export function weekHijriRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(start.getTime() + 6 * 86_400_000) // الجمعة
  const sp = hijriParts(start)
  const ep = hijriParts(end)
  if (sp.month === ep.month && sp.year === ep.year) {
    return `${HIJRI_AR_DAY.format(start)} – ${HIJRI_AR_LONG.format(end)}` // Intl يلحق «هـ» بنفسه — لا إلحاق يدوي (كانت «هـ هـ»)
  }
  return `${HIJRI_AR_LONG.format(start)} – ${HIJRI_AR_LONG.format(end)}`
}
