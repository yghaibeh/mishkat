import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لمركز الإعلام (المنطق في src/server/mediaHub.server.ts)

export const getMediaGallery = createServerFn({ method: "GET" })
  .validator(z.object({ offset: z.number().int().min(0).max(100000).optional() }))
  .handler(async ({ data }) => {
    const { mediaGalleryData } = await import("@/server/mediaHub.server");
    return mediaGalleryData(data.offset ?? 0);
  });

export const getMediaAssets = createServerFn({ method: "GET" }).handler(async () => {
  const { mediaAssetsData } = await import("@/server/mediaHub.server");
  return mediaAssetsData();
});

export const getCoverage = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { coverageDetailData } = await import("@/server/mediaHub.server");
    return coverageDetailData(data.id);
  });

export const createCoverage = createServerFn({ method: "POST" })
  .validator(z.object({
    title: z.string().min(1).max(160),
    kind: z.string().min(1).max(32),
    orgUnitId: z.string().min(1),
    occurredAt: z.number().int(),
    body: z.string().max(2000).optional(),
  }))
  .handler(async ({ data }) => {
    const { createCoverageData } = await import("@/server/mediaHub.server");
    return createCoverageData(data);
  });

export const deleteCoverage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { deleteCoverageData } = await import("@/server/mediaHub.server");
    return deleteCoverageData(data.id);
  });
