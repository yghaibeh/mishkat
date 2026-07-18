import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لإعدادات المعدّلات المالية (المنطق في src/server/settings.server.ts)

export const getRates = createServerFn({ method: "GET" }).handler(async () => {
  const { listRatesData } = await import("@/server/settings.server");
  return listRatesData();
});

export const setRate = createServerFn({ method: "POST" })
  .validator(z.object({
    kind: z.enum(["point_rate", "hourly_rate", "fixed_salary"]),
    amount: z.number().min(0),
    perUnit: z.number().int().positive().nullable().optional(),
    currency: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { setRateData } = await import("@/server/settings.server");
    return setRateData(data);
  });

export const getGeneralSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { generalSettingsData } = await import("@/server/settings.server");
  return generalSettingsData();
});

export const setWeeklyTarget = createServerFn({ method: "POST" })
  .validator(z.object({ track: z.enum(["male", "female"]), target: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { setWeeklyTargetData } = await import("@/server/settings.server");
    return setWeeklyTargetData(data);
  });

export const setFeature = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().min(1), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const { setFeatureData } = await import("@/server/settings.server");
    return setFeatureData(data);
  });

export const setBrand = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().optional(), letter: z.string().optional(), currency: z.string().optional() }))
  .handler(async ({ data }) => {
    const { setBrandData } = await import("@/server/settings.server");
    return setBrandData(data);
  });
