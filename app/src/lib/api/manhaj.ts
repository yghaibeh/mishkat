import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لمنهاج «على بصيرة» (عامّة) — شجرة خفيفة + درسٌ عند الطلب.

export const getManhajTree = createServerFn({ method: "GET" }).handler(async () => {
  const { manhajTreeData } = await import("@/server/manhaj.server");
  return manhajTreeData();
});

export const getManhajLesson = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { manhajLessonData } = await import("@/server/manhaj.server");
    const lesson = await manhajLessonData(data.id);
    return { lesson };
  });
