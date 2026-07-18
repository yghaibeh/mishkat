import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة «اللجان» (المنطق في src/server/committees.server.ts)

export const getCommittees = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { committeesData } = await import("@/server/committees.server");
    return committeesData(data.mosqueId);
  });

export const createCommittee = createServerFn({ method: "POST" })
  .validator(z.object({ mosqueId: z.string().min(1), name: z.string().min(2), type: z.enum(["main", "sub"]), headName: z.string().optional() }))
  .handler(async ({ data }) => {
    const { createCommitteeData } = await import("@/server/committees.server");
    return createCommitteeData(data);
  });

export const assignCommitteeHead = createServerFn({ method: "POST" })
  .validator(z.object({
    committeeId: z.string().min(1),
    headName: z.string().min(2).max(120).optional(),
    newHead: z.object({ fullName: z.string().min(2).max(120), login: z.string().min(3).max(40), password: z.string().min(6).max(100) }).optional(),
  }))
  .handler(async ({ data }) => {
    const { assignCommitteeHeadData } = await import("@/server/committees.server");
    return assignCommitteeHeadData(data);
  });

// «لجنتي» — لجانُ مسؤول اللجنة
export const getMyCommittees = createServerFn({ method: "GET" }).handler(async () => {
  const { myCommitteesData } = await import("@/server/committees.server");
  return myCommitteesData();
});

export const addCommitteePlan = createServerFn({ method: "POST" })
  .validator(z.object({ committeeId: z.string().min(1), title: z.string().min(2), recurring: z.boolean().optional(), monthHijri: z.string().nullable().optional() }))
  .handler(async ({ data }) => {
    const { addCommitteePlanData } = await import("@/server/committees.server");
    return addCommitteePlanData(data);
  });

export const setCommitteePlanStatus = createServerFn({ method: "POST" })
  .validator(z.object({ planId: z.string().min(1), status: z.enum(["planned", "done", "cancelled"]) }))
  .handler(async ({ data }) => {
    const { setCommitteePlanStatusData } = await import("@/server/committees.server");
    return setCommitteePlanStatusData(data);
  });
