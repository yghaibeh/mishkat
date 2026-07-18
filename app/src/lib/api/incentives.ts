import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة «الحوافز التشغيلية» (المنطق في src/server/incentives.server.ts)

export const getIncentives = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().optional() }))
  .handler(async ({ data }) => {
    const { incentivesData } = await import("@/server/incentives.server");
    return incentivesData(data.month);
  });

export const addIncentive = createServerFn({ method: "POST" })
  .validator(z.object({ recipientName: z.string().min(2), month: z.string().min(4), amount: z.number().positive(), reason: z.string().optional() }))
  .handler(async ({ data }) => {
    const { addIncentiveData } = await import("@/server/incentives.server");
    return addIncentiveData(data);
  });

export const removeIncentive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeIncentiveData } = await import("@/server/incentives.server");
    return removeIncentiveData(data);
  });
