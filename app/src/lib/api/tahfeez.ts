import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة «التحفيظ» (المنطق في src/server/tahfeez.server.ts)

export const getTahfeez = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { tahfeezData } = await import("@/server/tahfeez.server");
    return tahfeezData(data.mosqueId);
  });

export const createTahfeezCircle = createServerFn({ method: "POST" })
  .validator(z.object({ mosqueId: z.string().min(1), name: z.string().min(2).max(80), teacherPersonId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { createTahfeezCircleData } = await import("@/server/tahfeez.server");
    return createTahfeezCircleData(data);
  });

export const getTahfeezStudents = createServerFn({ method: "GET" })
  .validator(z.object({ circleId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { tahfeezStudentsData } = await import("@/server/tahfeez.server");
    return tahfeezStudentsData(data.circleId);
  });

export const addTahfeezStudent = createServerFn({ method: "POST" })
  .validator(z.object({ circleId: z.string().min(1), name: z.string().min(2).max(80) }))
  .handler(async ({ data }) => {
    const { addTahfeezStudentData } = await import("@/server/tahfeez.server");
    return addTahfeezStudentData(data);
  });

export const removeTahfeezStudent = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeTahfeezStudentData } = await import("@/server/tahfeez.server");
    return removeTahfeezStudentData(data);
  });

// متابعة الحفظ (F4)
export const getTahfeezProgress = createServerFn({ method: "GET" })
  .validator(z.object({ studentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { tahfeezProgressData } = await import("@/server/tahfeez.server");
    return tahfeezProgressData(data.studentId);
  });

export const addTahfeezProgress = createServerFn({ method: "POST" })
  .validator(z.object({ studentId: z.string().min(1), scope: z.string().optional(), fromAyah: z.number().int().positive().optional(), toAyah: z.number().int().positive().optional(), rating: z.number().int().min(1).max(5).optional() }))
  .handler(async ({ data }) => {
    const { addTahfeezProgressData } = await import("@/server/tahfeez.server");
    return addTahfeezProgressData(data);
  });

export const removeTahfeezProgress = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { removeTahfeezProgressData } = await import("@/server/tahfeez.server");
    return removeTahfeezProgressData(data);
  });

// ===== المرحلة ب — سجلّ التحفيظ اليوميّ =====
export const getTahfeezSession = createServerFn({ method: "GET" })
  .validator(z.object({ circleId: z.string().min(1), dateHijri: z.string().optional() }))
  .handler(async ({ data }) => {
    const { tahfeezSessionData } = await import("@/server/tahfeez.server");
    return tahfeezSessionData(data.circleId, data.dateHijri);
  });

const dailyRec = z.object({
  studentId: z.string().min(1), attendance: z.enum(["present", "absent", "left", "excused"]),
  hifzMode: z.enum(["surah", "page"]).optional(), hifzSurah: z.number().int().min(1).max(114).optional(),
  hifzFrom: z.number().int().min(0).max(9999).optional(), hifzTo: z.number().int().min(0).max(9999).optional(), hifzGrade: z.number().int().min(0).max(100).optional(),
  reviewMode: z.enum(["surah", "page"]).optional(), reviewSurah: z.number().int().min(1).max(114).optional(),
  reviewFrom: z.number().int().min(0).max(9999).optional(), reviewTo: z.number().int().min(0).max(9999).optional(), reviewGrade: z.number().int().min(0).max(100).optional(),
  tajweedGrade: z.number().int().min(0).max(100).optional(), companionKind: z.string().max(80).optional(), companion: z.string().max(300).optional(), note: z.string().max(500).optional(),
});
export const saveTahfeezDaily = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().min(1), records: z.array(dailyRec) }))
  .handler(async ({ data }) => {
    const { saveTahfeezDailyData } = await import("@/server/tahfeez.server");
    return saveTahfeezDailyData(data);
  });

export const getTahfeezStudentHistory = createServerFn({ method: "GET" })
  .validator(z.object({ studentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { tahfeezStudentHistoryData } = await import("@/server/tahfeez.server");
    return tahfeezStudentHistoryData(data.studentId);
  });

// تقييم الحلقات الدوريّ — ترتيبٌ بالحضور والإنجاز آخر ٣٠ يومًا (المنطق في tahfeez.server.ts)
export const getCircleRankings = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { circleRankingsData } = await import("@/server/tahfeez.server");
    return circleRankingsData(data.mosqueId);
  });

// حلقات التحفيظ التي أعلّمها — منفذ المعلّم في «حلقاتي»
export const getMyTahfeezCircles = createServerFn({ method: "GET" }).handler(async () => {
  const { myTahfeezCirclesData } = await import("@/server/tahfeez.server");
  return myTahfeezCirclesData();
});

// «تقدّمي في الحفظ» — سجلّ الطالب بنفسه (غ٣)
export const getMyStudentProgress = createServerFn({ method: "GET" }).handler(async () => {
  const { myStudentProgressData } = await import("@/server/tahfeez.server");
  return myStudentProgressData();
});

// حفظ سجلّ اليوم بالحلقة والتاريخ (غ٤ — مسار الأوفلاين: get-or-create للجلسة، وإعادة الإرسال آمنة)
export const saveTahfeezDailyByCircle = createServerFn({ method: "POST" })
  .validator(z.object({ circleId: z.string().min(1), dateHijri: z.string().min(6), records: z.array(dailyRec), clientUuid: z.string().optional() }))
  .handler(async ({ data }) => {
    const { saveTahfeezDailyByCircleData } = await import("@/server/tahfeez.server");
    return saveTahfeezDailyByCircleData(data);
  });

// رابط وليّ الأمر (غ٥): توليدٌ للمعلّم/الأمير + عرضٌ عامّ بالرمز
export const getGuardianLink = createServerFn({ method: "POST" })
  .validator(z.object({ studentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { guardianLinkData } = await import("@/server/tahfeez.server");
    return guardianLinkData(data.studentId);
  });

export const getGuardianView = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(16) }))
  .handler(async ({ data }) => {
    const { guardianViewData } = await import("@/server/tahfeez.server");
    return guardianViewData(data.token);
  });
