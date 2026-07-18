import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة «الاجتماعات» (المنطق في src/server/meetings.server.ts)

export const getMeetings = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { meetingsData } = await import("@/server/meetings.server");
    return meetingsData(data.mosqueId, data.offset ?? 0);
  });

export const createMeeting = createServerFn({ method: "POST" })
  .validator(z.object({
    mosqueId: z.string().min(1),
    type: z.enum(["periodic", "extraordinary"]),
    scheduledAt: z.number().int().positive(),
    memberCount: z.number().int().min(0).optional(),
    minutes: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { createMeetingData } = await import("@/server/meetings.server");
    return createMeetingData(data);
  });

export const setMeetingMinutes = createServerFn({ method: "POST" })
  .validator(z.object({ meetingId: z.string().min(1), minutes: z.string() }))
  .handler(async ({ data }) => {
    const { setMeetingMinutesData } = await import("@/server/meetings.server");
    return setMeetingMinutesData(data);
  });

export const addDecision = createServerFn({ method: "POST" })
  .validator(z.object({
    meetingId: z.string().min(1),
    title: z.string().min(2),
    kind: z.enum(["binding", "advisory"]),
    result: z.enum(["passed", "failed"]).optional(),
    note: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { addDecisionData } = await import("@/server/meetings.server");
    return addDecisionData(data);
  });

export const removeDecision = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeDecisionData } = await import("@/server/meetings.server");
    return removeDecisionData(data);
  });
