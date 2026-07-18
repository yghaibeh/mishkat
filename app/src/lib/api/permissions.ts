import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لإدارة الصلاحيات (المنطق في src/server/permissions.server.ts)

export const getPermissionMatrix = createServerFn({ method: "GET" }).handler(async () => {
  const { permissionMatrixData } = await import("@/server/permissions.server");
  return permissionMatrixData();
});

export const setPermission = createServerFn({ method: "POST" })
  .validator(z.object({ role: z.string().min(1), capability: z.string().min(1), state: z.enum(["grant", "revoke", "default"]) }))
  .handler(async ({ data }) => {
    const { setPermissionData } = await import("@/server/permissions.server");
    return setPermissionData(data);
  });
