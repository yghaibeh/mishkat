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
