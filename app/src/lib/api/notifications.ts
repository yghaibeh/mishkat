import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لإشعارات داخل الموقع (المنطق في src/server/notifications.server.ts)

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { myNotificationsData } = await import("@/server/notifications.server");
  return myNotificationsData();
});

export const markNotificationsRead = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string()).optional() }))
  .handler(async ({ data }) => {
    const { markNotificationsReadData } = await import("@/server/notifications.server");
    return markNotificationsReadData(data.ids);
  });

export const linkTelegram = createServerFn({ method: "POST" }).handler(async () => {
  const { linkTelegramData } = await import("@/server/notifications.server");
  return linkTelegramData();
});

export const getTelegramStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { telegramStatusData } = await import("@/server/notifications.server");
  return telegramStatusData();
});

// FR2.4 — Web Push
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { pushPublicKeyData } = await import("@/server/notifications.server");
  return pushPublicKeyData();
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .validator(z.object({ endpoint: z.string().url(), p256dh: z.string().min(1), auth: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { savePushSubscriptionData } = await import("@/server/notifications.server");
    return savePushSubscriptionData(data);
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .validator(z.object({ endpoint: z.string().url() }))
  .handler(async ({ data }) => {
    const { deletePushSubscriptionData } = await import("@/server/notifications.server");
    return deletePushSubscriptionData(data);
  });
