import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC قابلة للاستيراد من العميل. المنطق في src/server/data.server.ts
// ويُستورد ديناميكياً داخل المعالج فقط (لا يتسرب إلى حزمة العميل).

export const getGovernorate = createServerFn({ method: "GET" }).handler(async () => {
  const { governorateData } = await import("@/server/data.server");
  return governorateData();
});

export const getMonthlyReport = createServerFn({ method: "GET" }).handler(async () => {
  const { monthlyReportData } = await import("@/server/data.server");
  return monthlyReportData();
});

export const approveMonth = createServerFn({ method: "POST" }).handler(async () => {
  const { approveMonthlyReportData } = await import("@/server/data.server");
  return approveMonthlyReportData();
});

export const getDailyActivities = createServerFn({ method: "GET" })
  .validator(z.object({ track: z.enum(["male", "female"]) }))
  .handler(async ({ data }) => {
    const { dailyActivitiesData } = await import("@/server/data.server");
    return dailyActivitiesData(data.track);
  });

export const saveDailyLog = createServerFn({ method: "POST" })
  .validator(z.object({
    track: z.enum(["male", "female"]),
    entries: z.array(z.object({ activityTypeId: z.string(), count: z.number().int().min(0).max(100000), participantCount: z.number().int().min(1).max(100000).optional(), clientUuid: z.string().optional(), recordedAt: z.number().optional() })),
    shura: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const { saveDailyLogData } = await import("@/server/data.server");
    return saveDailyLogData(data);
  });

export const saveWomenActivity = createServerFn({ method: "POST" })
  .validator(z.object({
    unitId: z.string().min(1),
    entries: z.array(z.object({ activityTypeId: z.string(), count: z.number().int().min(0).max(100000), participantCount: z.number().int().min(1).max(100000).optional(), clientUuid: z.string().optional(), recordedAt: z.number().optional() })),
    shura: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const { saveWomenActivityData } = await import("@/server/data.server");
    return saveWomenActivityData(data);
  });

export const getDailyAttachments = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { dailyAttachmentsData } = await import("@/server/data.server");
    return dailyAttachmentsData(data.mosqueId);
  });

export const deleteDailyAttachment = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { deleteDailyAttachmentData } = await import("@/server/data.server");
    return deleteDailyAttachmentData(data);
  });

// طلاب الأسرة المسجّلون (0047) — مرجع عتبة التزام الصلوات
export const getFamilyStudents = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { familyStudentsData } = await import("@/server/data.server");
    return familyStudentsData(data.mosqueId);
  });

export const setFamilyStudents = createServerFn({ method: "POST" })
  .validator(z.object({ count: z.number().int().min(0).max(500), mosqueId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { setFamilyStudentsData } = await import("@/server/data.server");
    return setFamilyStudentsData(data.count, data.mosqueId);
  });
