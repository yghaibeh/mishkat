/**
 * حدودُ اليوم **بتوقيت الإعداد لا بـUTC** (ق-٤٥، قب-٦/G14).
 *
 * الخطأُ المكلف الذي تقتله هذه الدوالّ: نافذةُ ٠٠:٠٠–٠٣:٠٠ الدمشقية كانت تنسب عملَ اليوم
 * إلى أمس لأنّ الحدَّ محسوبٌ بـUTC. وهنا **المنطقةُ تُمرَّر** من سجل الإعدادات (`time.zone`)
 * ولا تُثبَّت في الكود، **وصفر رقمٍ في هذا الملفّ**: الحسابُ جبرٌ على مفاتيح نصّية لا على
 * ثوابتَ زمنية (لا `86400000` ولا ما يشبهه).
 *
 * و**مفتاحُ اليوم يُشتقّ ولا يُستقبَل نصاً**: فلا صيغةَ يتحقّق منها الخادمُ، ولا مدخلَ عميلٍ
 * يقرّر إلى أيّ يومٍ يُنسب العمل.
 */

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

/** إزاحةُ مفتاحٍ بأيام — بحساب التقويم لا بضرب ميلي ثانية (فيسلم من الصيف والكبس). */
export function shiftDayKey(dayKey: string, days: number): string {
  const d = dayAnchor(dayKey)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]!
}
