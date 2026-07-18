// المناطق الإدارية في سوريا — مصدر للقائمة المنسدلة عند تحديد موقع المسجد.
// المستوى: محافظة (governorate) ← منطقة إدارية/قضاء (district).
// تُخزَّن في قاعدة البيانات بالرموز (gov code + district code) وتُعرض بالأسماء.
// ملاحظة: «المنطقة» التنظيمية في النظام (الطبقة العليا) قد تضمّ عدة محافظات (مثل الساحل)
// — وهي طبقة مستقلة عن هذا التصنيف الجغرافي الإداري.

export interface SyriaDistrict {
  code: string;
  name: string;
}
export interface SyriaGovernorate {
  code: string;
  name: string;
  districts: SyriaDistrict[];
}

export const SYRIA_GOVERNORATES: SyriaGovernorate[] = [
  {
    code: "idlib",
    name: "إدلب",
    districts: [
      { code: "idlib", name: "إدلب" },
      { code: "ariha", name: "أريحا" },
      { code: "harem", name: "حارم" },
      { code: "jisr_shughur", name: "جسر الشغور" },
      { code: "maarrat_numan", name: "معرة النعمان" },
    ],
  },
  {
    code: "aleppo",
    name: "حلب",
    districts: [
      { code: "jabal_semaan", name: "جبل سمعان" },
      { code: "afrin", name: "عفرين" },
      { code: "atarib", name: "أتاريب" },
      { code: "ayn_alarab", name: "عين العرب" },
      { code: "azaz", name: "أعزاز" },
      { code: "albab", name: "الباب" },
      { code: "deir_hafir", name: "دير حافر" },
      { code: "jarabulus", name: "جرابلس" },
      { code: "manbij", name: "منبج" },
      { code: "safira", name: "السفيرة" },
    ],
  },
  {
    code: "hama",
    name: "حماة",
    districts: [
      { code: "hama", name: "حماة" },
      { code: "masyaf", name: "مصياف" },
      { code: "mahardah", name: "محردة" },
      { code: "salamiyah", name: "سلمية" },
      { code: "suqaylabiyah", name: "السقيلبية" },
    ],
  },
  {
    code: "homs",
    name: "حمص",
    districts: [
      { code: "homs", name: "حمص" },
      { code: "mukharram", name: "المخرّم" },
      { code: "qusayr", name: "القصير" },
      { code: "rastan", name: "الرستن" },
      { code: "tadmur", name: "تدمر" },
      { code: "taldou", name: "تلدو" },
      { code: "talkalakh", name: "تلكلخ" },
    ],
  },
  {
    code: "latakia",
    name: "اللاذقية",
    districts: [
      { code: "latakia", name: "اللاذقية" },
      { code: "haffah", name: "الحفة" },
      { code: "jableh", name: "جبلة" },
      { code: "qardaha", name: "القرداحة" },
    ],
  },
  {
    code: "tartus",
    name: "طرطوس",
    districts: [
      { code: "tartus", name: "طرطوس" },
      { code: "baniyas", name: "بانياس" },
      { code: "duraykish", name: "الدريكيش" },
      { code: "safita", name: "صافيتا" },
      { code: "shaykh_badr", name: "الشيخ بدر" },
    ],
  },
  {
    code: "deir_ezzor",
    name: "دير الزور",
    districts: [
      { code: "deir_ezzor", name: "دير الزور" },
      { code: "abu_kamal", name: "البوكمال" },
      { code: "mayadin", name: "الميادين" },
    ],
  },
  {
    code: "hasakah",
    name: "الحسكة",
    districts: [
      { code: "hasakah", name: "الحسكة" },
      { code: "malikiyah", name: "المالكية" },
      { code: "qamishli", name: "القامشلي" },
      { code: "ras_alayn", name: "رأس العين" },
      { code: "shaddadah", name: "الشدادة" },
    ],
  },
  {
    code: "raqqa",
    name: "الرقة",
    districts: [
      { code: "raqqa", name: "الرقة" },
      { code: "tell_abyad", name: "تل أبيض" },
      { code: "tabqa", name: "الطبقة" },
    ],
  },
  {
    code: "damascus",
    name: "دمشق",
    districts: [{ code: "damascus", name: "دمشق" }],
  },
  {
    code: "rif_dimashq",
    name: "ريف دمشق",
    districts: [
      { code: "markaz_rif_dimashq", name: "مركز ريف دمشق" },
      { code: "darayya", name: "داريا" },
      { code: "douma", name: "دوما" },
      { code: "nabek", name: "النبك" },
      { code: "qatana", name: "قطنا" },
      { code: "qudsaya", name: "قدسيا" },
      { code: "qutayfah", name: "القطيفة" },
      { code: "tall", name: "التل" },
      { code: "yabroud", name: "يبرود" },
      { code: "zabadani", name: "الزبداني" },
    ],
  },
  {
    code: "daraa",
    name: "درعا",
    districts: [
      { code: "daraa", name: "درعا" },
      { code: "izraa", name: "إزرع" },
      { code: "sanamayn", name: "الصنمين" },
    ],
  },
  {
    code: "suwayda",
    name: "السويداء",
    districts: [
      { code: "suwayda", name: "السويداء" },
      { code: "salkhad", name: "صلخد" },
      { code: "shahba", name: "شهبا" },
    ],
  },
  {
    code: "quneitra",
    name: "القنيطرة",
    districts: [
      { code: "quneitra", name: "القنيطرة" },
      { code: "fiq", name: "فيق" },
    ],
  },
];

// فهارس سريعة للبحث بالرمز
const GOV_BY_CODE = new Map(SYRIA_GOVERNORATES.map((g) => [g.code, g]));

export function govLabel(code?: string | null): string {
  if (!code) return "";
  return GOV_BY_CODE.get(code)?.name ?? code;
}

export function districtsOf(govCode?: string | null): SyriaDistrict[] {
  if (!govCode) return [];
  return GOV_BY_CODE.get(govCode)?.districts ?? [];
}

export function districtLabel(govCode?: string | null, districtCode?: string | null): string {
  if (!districtCode) return "";
  return districtsOf(govCode).find((d) => d.code === districtCode)?.name ?? districtCode;
}

// تسمية موقع مختصرة: «إدلب · حارم» أو «إدلب» إن لا منطقة
export function regionLabel(govCode?: string | null, districtCode?: string | null): string {
  const g = govLabel(govCode);
  const d = districtLabel(govCode, districtCode);
  if (g && d) return `${g} · ${d}`;
  return g || "";
}

export const GOV_OPTIONS = SYRIA_GOVERNORATES.map((g) => ({ value: g.code, label: g.name }));
