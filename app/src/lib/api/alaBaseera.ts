import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة «على بصيرة» (المنطق في src/server/alaBaseera.server.ts)

export const getAlaBaseera = createServerFn({ method: "GET" })
  .validator(z.object({ section: z.enum(["men", "women"]).optional() }).optional())
  .handler(async ({ data }) => {
    const { alaBaseeraData } = await import("@/server/alaBaseera.server");
    return alaBaseeraData(data?.section);
  });

export const getHalaqat = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().optional(), offset: z.number().int().min(0).optional(), section: z.enum(["men", "women"]).optional() }))
  .handler(async ({ data }) => {
    const { listHalaqat } = await import("@/server/alaBaseera.server");
    return listHalaqat(data.q, data.offset ?? 0, data.section);
  });

export const getHalaqatTree = createServerFn({ method: "GET" })
  .validator(z.object({ section: z.enum(["men", "women"]).optional() }).optional())
  .handler(async ({ data }) => {
    const { halaqatTreeData } = await import("@/server/alaBaseera.server");
    return halaqatTreeData(data?.section);
  });

export const getUnitHalaqat = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { unitHalaqatLeavesData } = await import("@/server/alaBaseera.server");
    return unitHalaqatLeavesData(data.unitId);
  });

export const getMosqueHalaqat = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { mosqueHalaqatData } = await import("@/server/alaBaseera.server");
    return mosqueHalaqatData(data.mosqueId, data.offset ?? 0);
  });

export const createVenue = createServerFn({ method: "POST" })
  .validator(z.object({ type: z.enum(["mosque", "institute", "home"]), name: z.string().min(2).max(120), orgUnitId: z.string().optional(), genderTrack: z.enum(["male", "female"]).optional() }))
  .handler(async ({ data }) => {
    const { createVenueData } = await import("@/server/alaBaseera.server");
    return createVenueData(data);
  });

export const createTeacher = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().min(1), qualification: z.string().optional() }))
  .handler(async ({ data }) => {
    const { createTeacherData } = await import("@/server/alaBaseera.server");
    return createTeacherData(data);
  });

export const createHalaqa = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().min(2).max(120), venueId: z.string().min(1),
    teacherId: z.string().min(1).optional(),
    genderTrack: z.enum(["male", "female"]).optional(), capacity: z.number().int().min(1).max(1000).optional(),
    curriculum: z.enum(["baseera", "tahfeez", "rashidi", "general"]).optional(),
    newTeacher: z.object({ fullName: z.string().min(2).max(120), login: z.string().min(3).max(40), password: z.string().min(6).max(100) }).optional(),
  }))
  .handler(async ({ data }) => {
    const { createHalaqaData } = await import("@/server/alaBaseera.server");
    return createHalaqaData(data);
  });

export const enrollStudent = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), personId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { enrollStudentData } = await import("@/server/alaBaseera.server");
    return enrollStudentData(data.halaqaId, data.personId);
  });

export const recordLesson = createServerFn({ method: "POST" })
  .validator(z.object({
    halaqaId: z.string().min(1), durationHours: z.number().positive().max(24),
    lessonTitle: z.string().max(200).optional(), majlis: z.string().max(120).optional(),
    attendanceCount: z.number().int().min(0).optional(), selfEval: z.number().int().min(1).max(5).optional(),
    companionActivities: z.string().max(500).optional(),
    attendance: z.array(z.object({ enrollmentId: z.string().min(1), state: z.enum(["present", "absent", "excused"]) })).optional(),
    clientUuid: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { recordLessonData } = await import("@/server/alaBaseera.server");
    return recordLessonData(data);
  });

export const getHalaqaRoster = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { halaqaRosterData } = await import("@/server/alaBaseera.server");
    return halaqaRosterData(data.halaqaId);
  });

export const getHalaqaCurriculum = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { halaqaCurriculumData } = await import("@/server/alaBaseera.server");
    return halaqaCurriculumData(data.halaqaId);
  });

export const setCurriculumProgress = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), enrollmentId: z.string().min(1), manhajKey: z.string().min(1), status: z.enum(["not_started", "in_progress", "completed"]) }))
  .handler(async ({ data }) => {
    const { setCurriculumProgressData } = await import("@/server/alaBaseera.server");
    return setCurriculumProgressData(data);
  });

export const setLessonStatus = createServerFn({ method: "POST" })
  .validator(z.object({ lessonId: z.string().min(1), status: z.enum(["approved", "rejected"]), reason: z.string().optional() }))
  .handler(async ({ data }) => {
    const { setLessonStatusData } = await import("@/server/alaBaseera.server");
    return setLessonStatusData(data);
  });

export const getCircleReport = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { circleGeneralReportData } = await import("@/server/alaBaseera.server");
    return circleGeneralReportData(data.halaqaId);
  });

export const removeLessonAttachment = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeLessonAttachmentData } = await import("@/server/alaBaseera.server");
    return removeLessonAttachmentData(data);
  });

// ===== التقييم الأسبوعي =====

export const getWeeklyHalaqa = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1), weekStart: z.string().optional() }))
  .handler(async ({ data }) => {
    const { weeklyHalaqaData } = await import("@/server/alaBaseera.server");
    return weeklyHalaqaData(data.halaqaId, data.weekStart);
  });

export const saveWeeklyNotes = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), weekStart: z.string().optional(), supervisorNotes: z.string().max(1000).optional(), adminNotes: z.string().max(1000).optional() }))
  .handler(async ({ data }) => {
    const { saveWeeklyNotesData } = await import("@/server/alaBaseera.server");
    return saveWeeklyNotesData(data);
  });

export const addGroupActivity = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), weekStart: z.string().optional(), description: z.string().min(2).max(500), dateHijri: z.string().optional() }))
  .handler(async ({ data }) => {
    const { addGroupActivityData } = await import("@/server/alaBaseera.server");
    return addGroupActivityData(data);
  });

export const removeGroupActivity = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeGroupActivityData } = await import("@/server/alaBaseera.server");
    return removeGroupActivityData(data);
  });

export const setStudentEvaluation = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), enrollmentId: z.string().min(1), lessonSessionId: z.string().min(1), score: z.number().int().min(0).max(100).optional(), note: z.string().max(500).optional(), externalActivities: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    const { setStudentEvaluationData } = await import("@/server/alaBaseera.server");
    return setStudentEvaluationData(data);
  });

// ===== لوحة المدرّس: حلقاتي + طلاب الحلقة بأسماء حرّة =====

export const getMyCircles = createServerFn({ method: "GET" }).handler(async () => {
  const { myCirclesData } = await import("@/server/alaBaseera.server");
  return myCirclesData();
});

// ملاحظة: أُزيل RPC «createMyHalaqa» — إنشاءُ الحلقات صار من صلاحية أمير المسجد (المعلّم لا يُنشئ).
// دالّةُ الخادم createMyHalaqaData تبقى للاختبارات/الجسر الداخليّ فقط، بلا منفذٍ للعميل.

export const getHalaqaAccess = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { halaqaAccessData } = await import("@/server/alaBaseera.server");
    return halaqaAccessData(data.halaqaId);
  });

export const getHalaqaStudents = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { halaqaStudentsData } = await import("@/server/alaBaseera.server");
    return halaqaStudentsData(data.halaqaId);
  });

export const addHalaqaStudent = createServerFn({ method: "POST" })
  .validator(z.object({ halaqaId: z.string().min(1), name: z.string().min(2).max(80) }))
  .handler(async ({ data }) => {
    const { addHalaqaStudentData } = await import("@/server/alaBaseera.server");
    return addHalaqaStudentData(data);
  });

export const removeHalaqaStudent = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeHalaqaStudentData } = await import("@/server/alaBaseera.server");
    return removeHalaqaStudentData(data);
  });

export const getHalaqaLessons = createServerFn({ method: "GET" })
  .validator(z.object({ halaqaId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { halaqaLessonsData } = await import("@/server/alaBaseera.server");
    return halaqaLessonsData(data.halaqaId);
  });

export const updateMyHalaqa = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), name: z.string().max(120).optional(), curriculum: z.enum(["baseera", "tahfeez", "rashidi", "general"]).optional(), capacity: z.number().int().min(1).max(1000).optional() }))
  .handler(async ({ data }) => {
    const { updateMyHalaqaData } = await import("@/server/alaBaseera.server");
    return updateMyHalaqaData(data);
  });

export const archiveMyHalaqa = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { archiveMyHalaqaData } = await import("@/server/alaBaseera.server");
    return archiveMyHalaqaData(data);
  });
