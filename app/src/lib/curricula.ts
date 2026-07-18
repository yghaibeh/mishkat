// مناهج حلقات المدرّس/المحفّظ — مشترك بين الخادم والعميل.
// المالية تُحتسَب لـ«على بصيرة» فقط (قرار D3).

export const CURRICULA = [
  { value: "baseera", label: "على بصيرة", financial: true },
  { value: "tahfeez", label: "تحفيظ قرآن", financial: false },
  { value: "rashidi", label: "منهج الرشيدي", financial: false },
  { value: "general", label: "حلقة عامة", financial: false },
] as const;

export type Curriculum = (typeof CURRICULA)[number]["value"];

const BY_VALUE = new Map<string, (typeof CURRICULA)[number]>(CURRICULA.map((c) => [c.value, c]));

export function curriculumLabel(v?: string | null): string {
  return (v && BY_VALUE.get(v)?.label) || "على بصيرة";
}
export function curriculumIsFinancial(v?: string | null): boolean {
  return !!(v && BY_VALUE.get(v)?.financial);
}
export const CURRICULUM_OPTIONS = CURRICULA.map((c) => ({ value: c.value, label: c.label }));
