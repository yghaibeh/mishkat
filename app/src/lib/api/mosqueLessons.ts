import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لدروس المسجد (المنطق في src/server/mosqueLessons.server.ts)

export const getMosqueLessons = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { mosqueLessonsData } = await import("@/server/mosqueLessons.server");
    return mosqueLessonsData(data.mosqueId);
  });

export const saveLesson = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().optional(),
    mosqueId: z.string().min(1),
    title: z.string().min(2).max(120),
    description: z.string().max(500).optional(),
    place: z.string().max(80).optional(),
    startsAt: z.number().int().positive(),
    durationMin: z.number().int().min(5).max(600),
    materialId: z.string().optional(),
    force: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const { saveLessonData } = await import("@/server/mosqueLessons.server");
    return saveLessonData(data);
  });

export const setLessonStatus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), status: z.enum(["scheduled", "confirmed", "delivered", "cancelled"]) }))
  .handler(async ({ data }) => {
    const { setLessonStatusData } = await import("@/server/mosqueLessons.server");
    return setLessonStatusData(data);
  });

export const getLessonAttendance = createServerFn({ method: "GET" })
  .validator(z.object({ lessonId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { lessonAttendanceData } = await import("@/server/mosqueLessons.server");
    return lessonAttendanceData(data.lessonId);
  });

export const addLessonAttendee = createServerFn({ method: "POST" })
  .validator(z.object({ lessonId: z.string().min(1), name: z.string().min(2).max(80) }))
  .handler(async ({ data }) => {
    const { addLessonAttendeeData } = await import("@/server/mosqueLessons.server");
    return addLessonAttendeeData(data);
  });

export const removeLessonAttendee = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeLessonAttendeeData } = await import("@/server/mosqueLessons.server");
    return removeLessonAttendeeData(data.id);
  });
