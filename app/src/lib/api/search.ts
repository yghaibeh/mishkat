import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للبحث على الخادم (type-ahead) — المنطق في src/server/search.server.ts

export const searchPersons = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => {
    const { searchPersons } = await import("@/server/search.server");
    return searchPersons(data.q);
  });

export const searchTeachers = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => {
    const { searchTeachers } = await import("@/server/search.server");
    return searchTeachers(data.q);
  });

export const searchVenues = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => {
    const { searchVenues } = await import("@/server/search.server");
    return searchVenues(data.q);
  });

export const searchOrgUnits = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string(), types: z.array(z.string()).optional() }))
  .handler(async ({ data }) => {
    const { searchOrgUnits } = await import("@/server/search.server");
    return searchOrgUnits(data.q, data.types);
  });

export const getOrgTree = createServerFn({ method: "GET" }).handler(async () => {
  const { orgTree } = await import("@/server/search.server");
  return orgTree();
});
