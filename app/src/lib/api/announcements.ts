import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لإعلانات المنصّة (المنطق في src/server/announcements.server.ts)

export const createAnnouncement = createServerFn({ method: "POST" })
  .validator(z.object({
    title: z.string().min(2).max(120),
    body: z.string().min(2).max(1000),
    scopePath: z.string().optional(),
    audience: z.enum(["all", "leaders", "students"]).optional(),
  }))
  .handler(async ({ data }) => {
    const { createAnnouncementData } = await import("@/server/announcements.server");
    return createAnnouncementData(data);
  });

export const getAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { announcementsListData } = await import("@/server/announcements.server");
  return announcementsListData();
});

export const getAnnounceScopes = createServerFn({ method: "GET" }).handler(async () => {
  const { announceScopesData } = await import("@/server/announcements.server");
  return announceScopesData();
});
