import { createServerFn } from "@tanstack/react-start";

// تشغيل المهامّ المجدولة يدوياً (إدارة عليا) — المنطق في scheduled.server.ts
export const runScheduledTasks = createServerFn({ method: "POST" }).handler(async () => {
  const { runScheduledTasksManual } = await import("@/server/scheduled.server");
  return runScheduledTasksManual();
});
