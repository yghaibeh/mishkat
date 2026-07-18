import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للنشاطات والمتابعة (المنطق في src/server/activities.server.ts)

export const getMyDuties = createServerFn({ method: "GET" }).handler(async () => {
  const { myDutiesData } = await import("@/server/activities.server");
  return myDutiesData();
});

export const getActivityScopes = createServerFn({ method: "GET" }).handler(async () => {
  const { activityScopesData } = await import("@/server/activities.server");
  return activityScopesData();
});

export const createActivity = createServerFn({ method: "POST" })
  .validator(z.object({
    scopeKind: z.enum(["circle", "mosque"]),
    scopeId: z.string().min(1),
    title: z.string().min(2).max(140),
    details: z.string().max(1000).optional(),
    dueAt: z.number().int().positive().optional(),
    required: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const { createActivityData } = await import("@/server/activities.server");
    return createActivityData(data);
  });

export const respondActivity = createServerFn({ method: "POST" })
  .validator(z.object({ activityId: z.string().min(1), body: z.string().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const { respondActivityData } = await import("@/server/activities.server");
    return respondActivityData(data);
  });

export const getMyActivities = createServerFn({ method: "GET" }).handler(async () => {
  const { myActivitiesData } = await import("@/server/activities.server");
  return myActivitiesData();
});

export const reviewResponse = createServerFn({ method: "POST" })
  .validator(z.object({ responseId: z.string().min(1), status: z.enum(["seen", "accepted"]) }))
  .handler(async ({ data }) => {
    const { reviewResponseData } = await import("@/server/activities.server");
    return reviewResponseData(data);
  });

export const closeActivity = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { closeActivityData } = await import("@/server/activities.server");
    return closeActivityData(data.id);
  });

// «مهامّي» — ملخّص كلّ المطلوب من المستخدم عبر الوحدات (المنطق في src/server/myTasks.server.ts)
export const getMyTasksSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { myTasksSummaryData } = await import("@/server/myTasks.server");
  return myTasksSummaryData();
});
