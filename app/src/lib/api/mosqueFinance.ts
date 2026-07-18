import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للمالية الداخلية للمسجد (المنطق في src/server/mosqueFinance.server.ts)

export const getMosqueFinance = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { mosqueFinanceData } = await import("@/server/mosqueFinance.server");
    return mosqueFinanceData(data.mosqueId);
  });

export const getMosqueTxns = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1), kind: z.enum(["donation", "expense"]), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { mosqueTxns } = await import("@/server/mosqueFinance.server");
    return mosqueTxns(data.mosqueId, data.kind, data.offset ?? 0);
  });

export const addDonation = createServerFn({ method: "POST" })
  .validator(z.object({ mosqueId: z.string().min(1), donorName: z.string().max(120).optional(), amount: z.number().positive().max(1000000000000), note: z.string().max(500).optional(), fund: z.enum(["general","zakat","sadaqah","waqf","projects"]).optional(), currency: z.string().max(8).optional() }))
  .handler(async ({ data }) => {
    const { addDonationData } = await import("@/server/mosqueFinance.server");
    return addDonationData(data);
  });

export const addExpense = createServerFn({ method: "POST" })
  .validator(z.object({ mosqueId: z.string().min(1), category: z.string().max(120).optional(), amount: z.number().positive().max(1000000000000), note: z.string().max(500).optional(), fund: z.enum(["general","zakat","sadaqah","waqf","projects"]).optional(), currency: z.string().max(8).optional() }))
  .handler(async ({ data }) => {
    const { addExpenseData } = await import("@/server/mosqueFinance.server");
    return addExpenseData(data);
  });
