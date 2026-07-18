// مرجع القرآن الكريم — مصدر الحقيقة لتهذيب حقول التحفيظ (سورة/آية) + وضع الصفحات (مصحف المدينة).
// عدد الآيات بعدّ الكوفة (حفص). يُستعمَل للتحقّق من نطاقات الحفظ/المراجعة.

export type Surah = { n: number; name: string; ayat: number };

export const SURAHS: Surah[] = [
  { n: 1, name: "الفاتحة", ayat: 7 }, { n: 2, name: "البقرة", ayat: 286 }, { n: 3, name: "آل عمران", ayat: 200 },
  { n: 4, name: "النساء", ayat: 176 }, { n: 5, name: "المائدة", ayat: 120 }, { n: 6, name: "الأنعام", ayat: 165 },
  { n: 7, name: "الأعراف", ayat: 206 }, { n: 8, name: "الأنفال", ayat: 75 }, { n: 9, name: "التوبة", ayat: 129 },
  { n: 10, name: "يونس", ayat: 109 }, { n: 11, name: "هود", ayat: 123 }, { n: 12, name: "يوسف", ayat: 111 },
  { n: 13, name: "الرعد", ayat: 43 }, { n: 14, name: "إبراهيم", ayat: 52 }, { n: 15, name: "الحجر", ayat: 99 },
  { n: 16, name: "النحل", ayat: 128 }, { n: 17, name: "الإسراء", ayat: 111 }, { n: 18, name: "الكهف", ayat: 110 },
  { n: 19, name: "مريم", ayat: 98 }, { n: 20, name: "طه", ayat: 135 }, { n: 21, name: "الأنبياء", ayat: 112 },
  { n: 22, name: "الحج", ayat: 78 }, { n: 23, name: "المؤمنون", ayat: 118 }, { n: 24, name: "النور", ayat: 64 },
  { n: 25, name: "الفرقان", ayat: 77 }, { n: 26, name: "الشعراء", ayat: 227 }, { n: 27, name: "النمل", ayat: 93 },
  { n: 28, name: "القصص", ayat: 88 }, { n: 29, name: "العنكبوت", ayat: 69 }, { n: 30, name: "الروم", ayat: 60 },
  { n: 31, name: "لقمان", ayat: 34 }, { n: 32, name: "السجدة", ayat: 30 }, { n: 33, name: "الأحزاب", ayat: 73 },
  { n: 34, name: "سبأ", ayat: 54 }, { n: 35, name: "فاطر", ayat: 45 }, { n: 36, name: "يس", ayat: 83 },
  { n: 37, name: "الصافات", ayat: 182 }, { n: 38, name: "ص", ayat: 88 }, { n: 39, name: "الزمر", ayat: 75 },
  { n: 40, name: "غافر", ayat: 85 }, { n: 41, name: "فصلت", ayat: 54 }, { n: 42, name: "الشورى", ayat: 53 },
  { n: 43, name: "الزخرف", ayat: 89 }, { n: 44, name: "الدخان", ayat: 59 }, { n: 45, name: "الجاثية", ayat: 37 },
  { n: 46, name: "الأحقاف", ayat: 35 }, { n: 47, name: "محمد", ayat: 38 }, { n: 48, name: "الفتح", ayat: 29 },
  { n: 49, name: "الحجرات", ayat: 18 }, { n: 50, name: "ق", ayat: 45 }, { n: 51, name: "الذاريات", ayat: 60 },
  { n: 52, name: "الطور", ayat: 49 }, { n: 53, name: "النجم", ayat: 62 }, { n: 54, name: "القمر", ayat: 55 },
  { n: 55, name: "الرحمن", ayat: 78 }, { n: 56, name: "الواقعة", ayat: 96 }, { n: 57, name: "الحديد", ayat: 29 },
  { n: 58, name: "المجادلة", ayat: 22 }, { n: 59, name: "الحشر", ayat: 24 }, { n: 60, name: "الممتحنة", ayat: 13 },
  { n: 61, name: "الصف", ayat: 14 }, { n: 62, name: "الجمعة", ayat: 11 }, { n: 63, name: "المنافقون", ayat: 11 },
  { n: 64, name: "التغابن", ayat: 18 }, { n: 65, name: "الطلاق", ayat: 12 }, { n: 66, name: "التحريم", ayat: 12 },
  { n: 67, name: "الملك", ayat: 30 }, { n: 68, name: "القلم", ayat: 52 }, { n: 69, name: "الحاقة", ayat: 52 },
  { n: 70, name: "المعارج", ayat: 44 }, { n: 71, name: "نوح", ayat: 28 }, { n: 72, name: "الجن", ayat: 28 },
  { n: 73, name: "المزمل", ayat: 20 }, { n: 74, name: "المدثر", ayat: 56 }, { n: 75, name: "القيامة", ayat: 40 },
  { n: 76, name: "الإنسان", ayat: 31 }, { n: 77, name: "المرسلات", ayat: 50 }, { n: 78, name: "النبأ", ayat: 40 },
  { n: 79, name: "النازعات", ayat: 46 }, { n: 80, name: "عبس", ayat: 42 }, { n: 81, name: "التكوير", ayat: 29 },
  { n: 82, name: "الانفطار", ayat: 19 }, { n: 83, name: "المطففين", ayat: 36 }, { n: 84, name: "الانشقاق", ayat: 25 },
  { n: 85, name: "البروج", ayat: 22 }, { n: 86, name: "الطارق", ayat: 17 }, { n: 87, name: "الأعلى", ayat: 19 },
  { n: 88, name: "الغاشية", ayat: 26 }, { n: 89, name: "الفجر", ayat: 30 }, { n: 90, name: "البلد", ayat: 20 },
  { n: 91, name: "الشمس", ayat: 15 }, { n: 92, name: "الليل", ayat: 21 }, { n: 93, name: "الضحى", ayat: 11 },
  { n: 94, name: "الشرح", ayat: 8 }, { n: 95, name: "التين", ayat: 8 }, { n: 96, name: "العلق", ayat: 19 },
  { n: 97, name: "القدر", ayat: 5 }, { n: 98, name: "البينة", ayat: 8 }, { n: 99, name: "الزلزلة", ayat: 8 },
  { n: 100, name: "العاديات", ayat: 11 }, { n: 101, name: "القارعة", ayat: 11 }, { n: 102, name: "التكاثر", ayat: 8 },
  { n: 103, name: "العصر", ayat: 3 }, { n: 104, name: "الهمزة", ayat: 9 }, { n: 105, name: "الفيل", ayat: 5 },
  { n: 106, name: "قريش", ayat: 4 }, { n: 107, name: "الماعون", ayat: 7 }, { n: 108, name: "الكوثر", ayat: 3 },
  { n: 109, name: "الكافرون", ayat: 6 }, { n: 110, name: "النصر", ayat: 3 }, { n: 111, name: "المسد", ayat: 5 },
  { n: 112, name: "الإخلاص", ayat: 4 }, { n: 113, name: "الفلق", ayat: 5 }, { n: 114, name: "الناس", ayat: 6 },
];

export const TOTAL_PAGES = 604; // مصحف المدينة

const BY_N = new Map(SURAHS.map((s) => [s.n, s]));
export function surahByN(n?: number | null): Surah | undefined { return n ? BY_N.get(n) : undefined; }
export function surahName(n?: number | null): string { return surahByN(n)?.name ?? ""; }
export function surahAyat(n?: number | null): number { return surahByN(n)?.ayat ?? 0; }
export const SURAH_OPTIONS = SURAHS.map((s) => ({ value: String(s.n), label: `${s.n}. ${s.name}` }));

// تحقّق نطاق آيات ضمن سورة، أو نطاق صفحات ضمن المصحف
export function validAyahRange(surahN: number, from?: number | null, to?: number | null): boolean {
  const max = surahAyat(surahN); if (!max) return false;
  const f = from ?? 1, t = to ?? f;
  return f >= 1 && t >= f && t <= max;
}
export function validPageRange(from?: number | null, to?: number | null): boolean {
  const f = from ?? 1, t = to ?? f;
  return f >= 1 && t >= f && t <= TOTAL_PAGES;
}
