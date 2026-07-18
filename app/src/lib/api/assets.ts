import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للعُهدة والأصول (المنطق في src/server/assets.server.ts)

export const getAssets = createServerFn({ method: "GET" }).handler(async () => {
  const { assetsData } = await import("@/server/assets.server");
  return assetsData();
});

export const saveAsset = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().optional(),
    kind: z.enum(["personal_custody", "vehicle", "equipment"]),
    name: z.string().min(2).max(120),
    details: z.string().max(300).optional(),
    orgUnitId: z.string().optional(),
    holderPersonId: z.string().optional(),
    holderName: z.string().max(80).optional(),
  }))
  .handler(async ({ data }) => {
    const { saveAssetData } = await import("@/server/assets.server");
    return saveAssetData(data);
  });

export const setAssetStatus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), status: z.enum(["active", "returned", "retired"]) }))
  .handler(async ({ data }) => {
    const { setAssetStatusData } = await import("@/server/assets.server");
    return setAssetStatusData(data);
  });

export const saveAssetExpense = createServerFn({ method: "POST" })
  .validator(z.object({
    assetId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    fuelAmount: z.number().min(0).max(100000000),
    otherAmount: z.number().min(0).max(100000000).optional(),
    note: z.string().max(200).optional(),
  }))
  .handler(async ({ data }) => {
    const { saveAssetExpenseData } = await import("@/server/assets.server");
    return saveAssetExpenseData(data);
  });
