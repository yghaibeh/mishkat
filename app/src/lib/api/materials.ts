import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للمكتبة التدريبيّة (المنطق في src/server/materials.server.ts)

export const getMyLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const { myLibraryData } = await import("@/server/materials.server");
  return myLibraryData();
});

export const markMaterialOpened = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { markMaterialOpenedData } = await import("@/server/materials.server");
    return markMaterialOpenedData(data.id);
  });

export const markMaterialCompleted = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { markMaterialCompletedData } = await import("@/server/materials.server");
    return markMaterialCompletedData(data.id);
  });

export const listMaterialsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { listMaterialsAdminData } = await import("@/server/materials.server");
  return listMaterialsAdminData();
});

export const createMaterial = createServerFn({ method: "POST" })
  .validator(z.object({
    title: z.string().min(2).max(120),
    category: z.string().min(1),
    kind: z.enum(["pdf", "audio", "link"]),
    r2Key: z.string().optional(),
    externalUrl: z.string().url().optional(),
    contentType: z.string().optional(),
    sizeBytes: z.number().int().positive().optional(),
    description: z.string().max(500).optional(),
    audience: z.string().min(1),
    mandatory: z.boolean(),
    sortOrder: z.number().int().optional(),
  }))
  .handler(async ({ data }) => {
    const { createMaterialData } = await import("@/server/materials.server");
    return createMaterialData(data);
  });

export const updateMaterial = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().min(1),
    mandatory: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(["active", "archived"]).optional(),
    title: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
  }))
  .handler(async ({ data }) => {
    const { updateMaterialData } = await import("@/server/materials.server");
    return updateMaterialData(data);
  });

export const getMaterialTracking = createServerFn({ method: "GET" }).handler(async () => {
  const { materialTrackingData } = await import("@/server/materials.server");
  return materialTrackingData();
});
