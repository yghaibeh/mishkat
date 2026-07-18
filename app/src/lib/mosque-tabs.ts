import { hasCap } from "./capabilities";

// تبويبات صفحة المسجد — مشتركة بين الشريط العلوي (لطاقم المسجد) وصفحة المسجد (للمشرف).
// كانت ١١ تبويباً متراكماً بلا نظام (تدقيق ٣٣ هـ-١)؛ جُمعت في ٤ مساحات عمل (الوثيقة ٣٦ §٢):
// التقرير (نظرة/سجل/شهري) · التعليم (حلقات/بصيرة/تحفيظ/دروس) · الأسرة (اجتماعات/لجان) · الصندوق.
export type MosqueTab = { k: string; l: string; g: string };

export function mosqueTabs(caps: string[] = [], features: Record<string, boolean> = {}): MosqueTab[] {
  const on = (k: string) => features[k] !== false; // الغياب = مُفعَّل
  return ([
    { k: "overview", l: "نظرة", g: "التقرير", show: true },
    { k: "daily", l: "سجل اليوم", g: "التقرير", show: hasCap(caps, "dailyLog.view") },
    { k: "report", l: "التقرير الشهري", g: "التقرير", show: hasCap(caps, "report.view") },
    { k: "circles", l: "الحلقات", g: "التعليم", show: on("circles") && hasCap(caps, "circles.view") },
    { k: "halaqat", l: "على بصيرة", g: "التعليم", show: on("alaBaseera") && hasCap(caps, "alaBaseera.view") },
    { k: "tahfeez", l: "التحفيظ", g: "التعليم", show: on("tahfeez") && hasCap(caps, "tahfeez.view") },
    { k: "lessons", l: "الدروس", g: "التعليم", show: on("lessons") && hasCap(caps, "dailyLog.view") },
    { k: "meetings", l: "الاجتماعات", g: "الأسرة", show: on("meetings") && hasCap(caps, "meetings.view") },
    { k: "committees", l: "اللجان", g: "الأسرة", show: on("committees") && hasCap(caps, "committees.view") },
    { k: "finance", l: "المالية الداخلية", g: "الصندوق", show: hasCap(caps, "mosqueFinance.view") },
  ] as Array<MosqueTab & { show: boolean }>).filter((t) => t.show).map(({ k, l, g }) => ({ k, l, g }));
}
