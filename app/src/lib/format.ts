// تنسيق أرقام موحّد في النظام — فاصل آلاف، أرقام لاتينية (متسقة مع font-mono-nums).
export const fmtNum = (n: number): string => Number(n ?? 0).toLocaleString("en-US");
export const fmtMoney = (n: number): string =>
  Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// تاريخ هجري موحّد (تقويم أم القرى) من طابع زمني (ms) — التقويم الهجري أساسي في النظام.
// timeZone UTC ليتطابق العرض مع مفاتيح الشهر (الخادم + خيارات الأشهر) ويتجنّب فرق يومٍ عند الحدود
const HIJRI_LONG = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const HIJRI_SHORT = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtHijri = (ts: number): string => HIJRI_LONG.format(new Date(ts));
export const fmtHijriShort = (ts: number): string => HIJRI_SHORT.format(new Date(ts));

// أسماء الأشهر الهجرية (للتسمية بلا عكس تقويم)
const HIJRI_MONTH_NAMES = ["محرّم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوّال", "ذو القعدة", "ذو الحجة"];
// تسمية شهرٍ هجري من مفتاحه 'YYYY-MM' → «جمادى الآخرة 1447هـ»
export function hijriMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${HIJRI_MONTH_NAMES[(m || 1) - 1] ?? ""} ${y}هـ`;
}
const HIJRI_KEY_FMT = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { year: "numeric", month: "2-digit", timeZone: "UTC" });
function hijriKeyOf(d: Date): string {
  const o = Object.fromEntries(HIJRI_KEY_FMT.formatToParts(d).map((p) => [p.type, p.value]));
  return `${o.year}-${String(o.month).padStart(2, "0")}`;
}
// قائمة الأشهر الهجرية ابتداءً من الشهر الحالي (لمنتقي الشهر)
export function hijriMonthOptions(count = 14): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  let t = Date.now();
  while (out.length < count) {
    const key = hijriKeyOf(new Date(t));
    if (!seen.has(key)) { seen.add(key); out.push({ value: key, label: hijriMonthLabel(key) }); }
    t += 15 * 86_400_000;
  }
  return out;
}
