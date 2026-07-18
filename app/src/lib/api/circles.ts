import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لحلقات المسجد (المنطق في src/server/circles.server.ts)

const CIRCLE_TYPE = z.enum(["tahfeez", "rashidi", "ala_baseera", "influential_mosque"]);
const GENDER = z.enum(["male", "female"]);

export const getMosqueCircles = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { circlesForMosque } = await import("@/server/circles.server");
    return circlesForMosque(data.mosqueId);
  });

export const createCircle = createServerFn({ method: "POST" })
  .validator(z.object({
    mosqueId: z.string().min(1),
    type: CIRCLE_TYPE,
    genderTrack: GENDER,
    name: z.string().min(2),
    teacherPersonId: z.string().nullable().optional(),
    capacity: z.number().int().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const { createCircle } = await import("@/server/circles.server");
    return createCircle(data);
  });

export const updateCircle = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().min(1),
    name: z.string().min(2).optional(),
    genderTrack: GENDER.optional(),
    teacherPersonId: z.string().nullable().optional(),
    capacity: z.number().int().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const { updateCircle } = await import("@/server/circles.server");
    return updateCircle(data);
  });

export const archiveCircle = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { archiveCircle } = await import("@/server/circles.server");
    return archiveCircle(data);
  });

export const getCircleStudents = createServerFn({ method: "GET" })
  .validator(z.object({ circleId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { studentsForCircle } = await import("@/server/circles.server");
    return studentsForCircle(data.circleId);
  });

export const addCircleStudent = createServerFn({ method: "POST" })
  .validator(z.object({ circleId: z.string().min(1), name: z.string().min(2), notes: z.string().nullable().optional() }))
  .handler(async ({ data }) => {
    const { addCircleStudent } = await import("@/server/circles.server");
    return addCircleStudent(data);
  });

export const removeCircleStudent = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeCircleStudent } = await import("@/server/circles.server");
    return removeCircleStudent(data);
  });

// خيارات معلّمي المسجد — لمنتقي المعلّم في بطاقة الحلقة (غ٢)
export const getMosqueTeacherOptions = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { mosqueTeacherOptionsData } = await import("@/server/circles.server");
    return mosqueTeacherOptionsData(data.mosqueId);
  });
