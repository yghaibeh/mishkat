import { hasCap } from "./capabilities";

// تبويبات صفحة المسجد — مشتركة بين الشريط العلوي (لطاقم المسجد) وصفحة المسجد (للمشرف).
export type MosqueTab = { k: string; l: string };

export function mosqueTabs(caps: string[] = [], features: Record<string, boolean> = {}): MosqueTab[] {
  const on = (k: string) => features[k] !== false; // الغياب = مُفعَّل
  return ([
    { k: "overview", l: "نظرة", show: true },
    { k: "daily", l: "سجل اليوم", show: hasCap(caps, "dailyLog.view") },
    { k: "report", l: "التقرير الشهري", show: hasCap(caps, "report.view") },
    { k: "circles", l: "الحلقات", show: on("circles") && hasCap(caps, "circles.view") },
    { k: "finance", l: "المالية الداخلية", show: hasCap(caps, "mosqueFinance.view") },
    { k: "halaqat", l: "على بصيرة", show: on("alaBaseera") && hasCap(caps, "alaBaseera.view") },
    { k: "tahfeez", l: "التحفيظ", show: on("tahfeez") && hasCap(caps, "tahfeez.view") },
    { k: "lessons", l: "الدروس", show: on("lessons") && hasCap(caps, "dailyLog.view") },
    { k: "meetings", l: "الاجتماعات", show: on("meetings") && hasCap(caps, "meetings.view") },
    { k: "committees", l: "اللجان", show: on("committees") && hasCap(caps, "committees.view") },
  ] as Array<MosqueTab & { show: boolean }>).filter((t) => t.show).map(({ k, l }) => ({ k, l }));
}
