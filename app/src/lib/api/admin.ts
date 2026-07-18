import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للتهيئة الإدارية (المنطق في src/server/admin.server.ts)

export const listOrgUnits = createServerFn({ method: "GET" }).handler(async () => {
  const { adminListOrgUnits } = await import("@/server/admin.server");
  return adminListOrgUnits();
});

export const updateOrgUnit = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    genderTrack: z.enum(["male", "female"]).optional(),
    governorate: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const { adminUpdateOrgUnit } = await import("@/server/admin.server");
    return adminUpdateOrgUnit(data);
  });

export const moveOrgUnit = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), newParentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminMoveOrgUnit } = await import("@/server/admin.server");
    return adminMoveOrgUnit(data);
  });

export const archiveOrgUnit = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminArchiveOrgUnit } = await import("@/server/admin.server");
    return adminArchiveOrgUnit(data);
  });

export const listUsers = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().optional(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { adminListUsers } = await import("@/server/admin.server");
    return adminListUsers(data.q, data.offset ?? 0);
  });

export const listUnitUsers = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminUnitUsers } = await import("@/server/admin.server");
    return adminUnitUsers(data.unitId);
  });

export const updateUser = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().min(1), fullName: z.string().optional(), login: z.string().optional(), gender: z.enum(["male", "female"]).optional() }))
  .handler(async ({ data }) => {
    const { adminUpdateUser } = await import("@/server/admin.server");
    return adminUpdateUser(data);
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().min(1), status: z.enum(["active", "disabled", "deleted"]), reason: z.string().optional() }))
  .handler(async ({ data }) => {
    const { adminSetUserStatus } = await import("@/server/admin.server");
    return adminSetUserStatus(data);
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().min(1), password: z.string().min(6) }))
  .handler(async ({ data }) => {
    const { adminResetPassword } = await import("@/server/admin.server");
    return adminResetPassword(data);
  });

export const updateRole = createServerFn({ method: "POST" })
  .validator(z.object({ assignmentId: z.string().min(1), role: z.string().min(1), orgUnitId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminUpdateRole } = await import("@/server/admin.server");
    return adminUpdateRole(data);
  });

export const approveRole = createServerFn({ method: "POST" })
  .validator(z.object({ assignmentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminApproveRole } = await import("@/server/admin.server");
    return adminApproveRole(data);
  });

export const removeRole = createServerFn({ method: "POST" })
  .validator(z.object({ assignmentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { adminRemoveRole } = await import("@/server/admin.server");
    return adminRemoveRole(data);
  });

export const createOrgUnit = createServerFn({ method: "POST" })
  .validator(z.object({
    parentId: z.string().nullable(),
    type: z.enum(["section", "rabita", "square", "mosque", "halaqa"]),
    section: z.enum(["men", "women"]).optional(),
    genderTrack: z.enum(["male", "female"]),
    name: z.string().min(2),
    governorate: z.string().optional(),
    district: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { adminCreateOrgUnit } = await import("@/server/admin.server");
    return adminCreateOrgUnit(data);
  });

export const createUserWithRole = createServerFn({ method: "POST" })
  .validator(z.object({
    fullName: z.string().min(3),
    login: z.string().min(3),
    password: z.string().min(6),
    gender: z.enum(["male", "female"]),
    role: z.string().min(1),
    orgUnitId: z.string().min(1),
    portfolio: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { adminCreateUserWithRole } = await import("@/server/admin.server");
    return adminCreateUserWithRole(data);
  });
