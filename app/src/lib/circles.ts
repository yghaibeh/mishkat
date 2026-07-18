// أنواع الحلقات في المسجد — مشتركة بين الخادم والعميل.
// المسجد الواحد قد يحوي عدة حلقات بأنواع مختلفة (تحفيظ، رشيدي، على بصيرة، علمية).
// قرار اللجنة: «المسجد المؤثر» اسمُ المسجد الفعّال لا نوعُ حلقةٍ — استُبدل بحلقة «علمية» (0048).

export type CircleType = "tahfeez" | "rashidi" | "ala_baseera" | "ilmiyya";
export type GenderTrack = "male" | "female";

export interface CircleTypeDef {
  type: CircleType;
  label: string;
  desc: string;
  // المسارات المتاحة لهذا النوع
  genders: GenderTrack[];
}

export const CIRCLE_TYPES: CircleTypeDef[] = [
  {
    type: "tahfeez",
    label: "تحفيظ القرآن",
    desc: "حلقة تحفيظ وتجويد القرآن الكريم",
    genders: ["male", "female"],
  },
  {
    type: "rashidi",
    label: "الرشيدي وتعليم القراءة",
    desc: "تعليم القراءة والكتابة والمبادئ الشرعية",
    genders: ["male", "female"],
  },
  {
    type: "ala_baseera",
    label: "على بصيرة",
    desc: "منهاج التعليم الشبابي الأسري «على بصيرة»",
    genders: ["male", "female"],
  },
  {
    type: "ilmiyya",
    label: "علمية",
    desc: "حلقة علمية (فقه/عقيدة/حديث…)",
    genders: ["male", "female"],
  },
];

const BY_TYPE = new Map(CIRCLE_TYPES.map((c) => [c.type, c]));

export function circleTypeLabel(type?: string | null): string {
  if (!type) return "";
  return BY_TYPE.get(type as CircleType)?.label ?? type;
}

export function circleTypeDef(type?: string | null): CircleTypeDef | undefined {
  if (!type) return undefined;
  return BY_TYPE.get(type as CircleType);
}

// هل يسمح النوع بمسار جنس معيّن؟
export function circleAllowsGender(type: string, gender: GenderTrack): boolean {
  return BY_TYPE.get(type as CircleType)?.genders.includes(gender) ?? false;
}

export const CIRCLE_TYPE_OPTIONS = CIRCLE_TYPES.map((c) => ({ value: c.type, label: c.label }));
