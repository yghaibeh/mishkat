import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للمصادقة (المنطق في src/server/auth.server.ts، يُستورد ديناميكياً)

export const login = createServerFn({ method: "POST" })
  .validator(z.object({
    login: z.string().min(1),
    password: z.string().min(1),
    totp: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { loginUser } = await import("@/server/auth.server");
    return loginUser(data);
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutUser } = await import("@/server/auth.server");
  return logoutUser();
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const { meUser } = await import("@/server/auth.server");
  return meUser();
});
