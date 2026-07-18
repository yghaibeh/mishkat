// «الصندوق» الهرمي — أغلفة RPC (ق-د٢، الوثيقة ٣٩)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CurrencyLines = z.array(z.object({ currency: z.string().min(1), amount: z.number().positive() })).min(1);

export const getUnitBox = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    const { unitBoxData } = await import("@/server/boxes.server");
    return unitBoxData(data?.unitId);
  });

export const boxReceive = createServerFn({ method: "POST" })
  .validator(z.object({ unitId: z.string(), fundId: z.string().optional(), lines: CurrencyLines, donorName: z.string().optional(), memo: z.string().optional() }))
  .handler(async ({ data }) => {
    const { boxReceiveData } = await import("@/server/boxes.server");
    return boxReceiveData(data);
  });

export const boxSpend = createServerFn({ method: "POST" })
  .validator(z.object({ unitId: z.string(), fundId: z.string().optional(), category: z.string(), lines: CurrencyLines, payeeName: z.string().optional(), memo: z.string().optional(), entitlementId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { boxSpendData } = await import("@/server/boxes.server");
    return boxSpendData(data);
  });

export const boxHandover = createServerFn({ method: "POST" })
  .validator(z.object({ fromUnitId: z.string(), toUnitId: z.string(), purpose: z.string(), batchId: z.string().optional(), lines: CurrencyLines, note: z.string().optional() }))
  .handler(async ({ data }) => {
    const { boxHandoverData } = await import("@/server/boxes.server");
    return boxHandoverData(data);
  });

export const boxAcknowledge = createServerFn({ method: "POST" })
  .validator(z.object({ handoverId: z.string() }))
  .handler(async ({ data }) => {
    const { boxAcknowledgeData } = await import("@/server/boxes.server");
    return boxAcknowledgeData(data);
  });

export const getSalariesPlan = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    const { salariesPlanData } = await import("@/server/boxes.server");
    return salariesPlanData(data?.month);
  });

export const distributeSalariesFn = createServerFn({ method: "POST" })
  .validator(z.object({ month: z.string() }))
  .handler(async ({ data }) => {
    const { distributeSalariesData } = await import("@/server/boxes.server");
    return distributeSalariesData(data);
  });

export const submitBoxClosingFn = createServerFn({ method: "POST" })
  .validator(z.object({ unitId: z.string(), month: z.string().optional() }))
  .handler(async ({ data }) => {
    const { submitClosingData } = await import("@/server/boxes.server");
    return submitClosingData(data);
  });

export const getPendingClosings = createServerFn({ method: "GET" }).handler(async () => {
  const { pendingClosingsData } = await import("@/server/boxes.server");
  return pendingClosingsData();
});

export const approveBoxClosingFn = createServerFn({ method: "POST" })
  .validator(z.object({ closingId: z.string() }))
  .handler(async ({ data }) => {
    const { approveClosingData } = await import("@/server/boxes.server");
    return approveClosingData(data);
  });
