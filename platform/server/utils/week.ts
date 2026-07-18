// الأسبوع التشغيلي يبدأ السبت (مطابق للسجل الورقي)

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayCode = typeof DAYS[number]

// رمز اليوم من تاريخ (sat..fri)
export function dayCode(d: Date): DayCode {
  return DAYS[d.getUTCDay()]
}

// تاريخ بداية الأسبوع (السبت) الذي يقع فيه d، بصيغة YYYY-MM-DD
export function weekStartSaturday(d: Date): string {
  const dow = d.getUTCDay()          // 0=الأحد .. 6=السبت
  const sinceSaturday = (dow + 1) % 7 // السبت=0، الأحد=1، ... الجمعة=6
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceSaturday))
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
  const o = Object.fromEntries(HIJRI_FMT.formatToParts(d).map((p) => [p.type, p.value]))
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
