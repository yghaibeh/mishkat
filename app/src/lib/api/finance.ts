import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للملف المالي (المنطق في src/server/finance.server.ts)

export const getFinance = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().optional() }))
  .handler(async ({ data }) => {
    const { financeData } = await import("@/server/finance.server");
    return financeData(data.month);
  });

export const getFinanceRows = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().min(1), q: z.string().optional(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { financeRows } = await import("@/server/finance.server");
    return financeRows(data.month, data.q, data.offset ?? 0);
  });

export const getFinanceTree = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { financeTreeData } = await import("@/server/finance.server");
    return financeTreeData(data.month);
  });

export const computeFinance = createServerFn({ method: "POST" })
  .validator(z.object({ month: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { computeFinanceData } = await import("@/server/finance.server");
    return computeFinanceData(data.month);
  });

export const approveFinance = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { approveFinanceData } = await import("@/server/finance.server");
    return approveFinanceData(data.id);
  });

export const payoutFinance = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), paidAmount: z.number().min(0).max(1000000000), reference: z.string().max(200).optional() }))
  .handler(async ({ data }) => {
    const { payoutFinanceData } = await import("@/server/finance.server");
    return payoutFinanceData(data.id, data.paidAmount, data.reference);
  });
