import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للتسجيل الذاتيّ الهرميّ (المنطق في src/server/registration.server.ts)

export const getPublicOrgTree = createServerFn({ method: "GET" }).handler(async () => {
  const { publicOrgTreeData } = await import("@/server/registration.server");
  return publicOrgTreeData();
});

export const submitRegistration = createServerFn({ method: "POST" })
  .validator(z.object({
    kind: z.enum(["student", "teacher", "amir", "square", "rabita"]),
    fullName: z.string().min(5).max(80),
    gender: z.enum(["male", "female"]),
    login: z.string().min(3).max(32),
    password: z.string().min(8).max(128),
    phone: z.string().max(20).optional(),
    note: z.string().max(500).optional(),
    targetUnitId: z.string().optional(),
    proposedUnitName: z.string().max(80).optional(),
    proposedParentId: z.string().optional(),
    circleId: z.string().optional(),
    website: z.string().optional(), // honeypot
  }))
  .handler(async ({ data }) => {
    const { submitRegistrationData } = await import("@/server/registration.server");
    return submitRegistrationData(data);
  });

export const getRegistrationStatus = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(10) }))
  .handler(async ({ data }) => {
    const { registrationStatusData } = await import("@/server/registration.server");
    return registrationStatusData(data.token);
  });

export const getPendingRegistrations = createServerFn({ method: "GET" }).handler(async () => {
  const { pendingRegistrationsData } = await import("@/server/registration.server");
  return pendingRegistrationsData();
});

export const approveRegistration = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { approveRegistrationData } = await import("@/server/registration.server");
    return approveRegistrationData(data.id);
  });

export const rejectRegistration = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), reason: z.string().min(2).max(300) }))
  .handler(async ({ data }) => {
    const { rejectRegistrationData } = await import("@/server/registration.server");
    return rejectRegistrationData(data.id, data.reason);
  });
