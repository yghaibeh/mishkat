import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للعُهد (المنطق في src/server/custody.server.ts)

export const getScopeCustody = createServerFn({ method: "GET" }).handler(async () => {
  const { scopeCustodyData } = await import("@/server/custody.server");
  return scopeCustodyData();
});

export const getMyCustody = createServerFn({ method: "GET" }).handler(async () => {
  const { myCustodyData } = await import("@/server/custody.server");
  return myCustodyData();
});

export const getCustodyTimeline = createServerFn({ method: "GET" })
  .validator(z.object({ assetId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { custodyTimelineData } = await import("@/server/custody.server");
    return custodyTimelineData(data.assetId);
  });

export const assignCustody = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1), toPersonId: z.string().min(1), condition: z.string().optional(), note: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    const { assignCustodyData } = await import("@/server/custody.server");
    return assignCustodyData(data);
  });

export const acknowledgeCustody = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { acknowledgeCustodyData } = await import("@/server/custody.server");
    return acknowledgeCustodyData(data.eventId);
  });

export const returnCustody = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1), condition: z.string().optional(), note: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    const { returnCustodyData } = await import("@/server/custody.server");
    return returnCustodyData(data);
  });

export const reportCustody = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1), state: z.enum(["damaged", "lost", "retire"]), note: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    const { reportCustodyData } = await import("@/server/custody.server");
    return reportCustodyData(data);
  });
