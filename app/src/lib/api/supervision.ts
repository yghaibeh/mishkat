import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للسجل الإشرافيّ على الحلقات (المنطق في src/server/supervision.server.ts)

export const getSupervisionVisits = createServerFn({ method: "GET" }).handler(async () => {
  const { supervisionVisitsData } = await import("@/server/supervision.server");
  return supervisionVisitsData();
});

export const getSupervisableCircles = createServerFn({ method: "GET" }).handler(async () => {
  const { supervisableCirclesData } = await import("@/server/supervision.server");
  return supervisableCirclesData();
});

export const getSupervisionDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supervisionDashboardData } = await import("@/server/supervision.server");
  return supervisionDashboardData();
});

export const createSupervisionVisit = createServerFn({ method: "POST" })
  .validator(z.object({
    circleKind: z.enum(["tahfeez", "baseera"]),
    circleRefId: z.string().min(1),
    visitDateHijri: z.string().optional(),
    monthlyVisitNo: z.number().int().min(0).optional(),
    studentCount: z.number().int().min(0).optional(),
    finalScore: z.number().int().min(0).max(100).optional(),
    notes: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }))
  .handler(async ({ data }) => {
    const { createSupervisionVisitData } = await import("@/server/supervision.server");
    return createSupervisionVisitData(data);
  });

export const submitSupervisionVisit = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { submitSupervisionVisitData } = await import("@/server/supervision.server");
    return submitSupervisionVisitData(data.id);
  });

export const approveSupervisionVisit = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { approveSupervisionVisitData } = await import("@/server/supervision.server");
    return approveSupervisionVisitData(data.id);
  });
