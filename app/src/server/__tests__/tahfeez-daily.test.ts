import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { tahfeezSessionData, saveTahfeezDailyData, tahfeezStudentHistoryData } from "@/server/tahfeez.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });
const teacher = makeUser("teacher", "m1", "/men/m1/", { personId: "p-teach", userId: "u-teach" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = admin;
  const now = 0;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: now }).run();
  await db.insert(schema.tahfeezCircles).values({ id: "tc1", mosqueId: "m1", name: "حلقة الفجر", teacherPersonId: "p-teach", createdAt: now }).run();
  await db.insert(schema.tahfeezStudents).values([
    { id: "s1", circleId: "tc1", personId: "", studentName: "أحمد", status: "active", createdAt: 1 },
    { id: "s2", circleId: "tc1", personId: "", studentName: "خالد", status: "active", createdAt: 2 },
  ]).run();
});

describe("ب — سجلّ التحفيظ اليوميّ", () => {
  it("جلسة اليوم تُنشأ وتُرجع كشف الطلاب مُهيّأً حضورًا", async () => {
    const r = await tahfeezSessionData("tc1", "1447-12-05");
    expect(r.sessionId).toBeTruthy();
    expect(r.students.map((s) => s.name)).toEqual(["أحمد", "خالد"]);
    expect(r.students[0].record.attendance).toBe("present");
  });

  it("حفظ سجلّ اليوم بنطاقٍ مُهيكَل (سورة/آية) ثمّ استرجاعه — يُشتقّ اسم السورة", async () => {
    const s = await tahfeezSessionData("tc1", "1447-12-05");
    await saveTahfeezDailyData({ sessionId: s.sessionId, records: [
      { studentId: "s1", attendance: "present", hifzMode: "surah", hifzSurah: 2, hifzFrom: 1, hifzTo: 5, hifzGrade: 95, reviewMode: "surah", reviewSurah: 1, reviewGrade: 100, tajweedGrade: 90, companionKind: "baseera" },
      { studentId: "s2", attendance: "absent" },
    ] });
    const again = await tahfeezSessionData("tc1", "1447-12-05");
    const a = again.students.find((x) => x.id === "s1")!;
    expect(a.record.attendance).toBe("present");
    expect(a.record.hifzMode).toBe("surah");
    expect(a.record.hifzSurah).toBe(2);
    expect(a.record.hifzScope).toBe("البقرة");   // مُشتقٌّ من رقم السورة (لا حرّ)
    expect(a.record.hifzGrade).toBe(95);
    expect(a.record.companionKind).toBe("baseera");
    expect(again.students.find((x) => x.id === "s2")!.record.attendance).toBe("absent");
  });

  it("وضع الصفحات يُحفظ نطاقًا رقميًّا؛ ونطاقٌ غير صالح (آية تتجاوز السورة) يُبطَل", async () => {
    const s = await tahfeezSessionData("tc1", "1447-12-05");
    await saveTahfeezDailyData({ sessionId: s.sessionId, records: [
      { studentId: "s1", attendance: "present", hifzMode: "page", hifzFrom: 1, hifzTo: 3 },      // صفحات صالحة
      { studentId: "s2", attendance: "present", hifzMode: "surah", hifzSurah: 1, hifzFrom: 1, hifzTo: 300 }, // آية ٣٠٠ في الفاتحة ⇒ تُبطَل
    ] });
    const again = await tahfeezSessionData("tc1", "1447-12-05");
    const p = again.students.find((x) => x.id === "s1")!;
    expect(p.record.hifzMode).toBe("page");
    expect(p.record.hifzFrom).toBe(1); expect(p.record.hifzTo).toBe(3);
    const bad = again.students.find((x) => x.id === "s2")!;
    expect(bad.record.hifzTo).toBeNull();  // النطاق غير الصالح لم يُحفَظ
  });

  it("سجلّ الطالب التراكميّ يجمع أيّامه", async () => {
    const d1 = await tahfeezSessionData("tc1", "1447-12-05");
    await saveTahfeezDailyData({ sessionId: d1.sessionId, records: [{ studentId: "s1", attendance: "present", hifzMode: "surah", hifzSurah: 2, hifzFrom: 1, hifzTo: 10, hifzGrade: 90 }] });
    const d2 = await tahfeezSessionData("tc1", "1447-12-06");
    await saveTahfeezDailyData({ sessionId: d2.sessionId, records: [{ studentId: "s1", attendance: "absent" }] });
    const h = await tahfeezStudentHistoryData("s1");
    if ("error" in h) throw new Error("expected history");
    expect(h.summary.days).toBe(2);
    expect(h.summary.present).toBe(1);
    expect(h.summary.absent).toBe(1);
    expect(h.rows[0].dateHijri).toBe("1447-12-06"); // الأحدث أولًا
  });

  it("المعلّم نفسه يستطيع التسجيل (لا الأمير فقط)", async () => {
    state.user = teacher;
    const r = await tahfeezSessionData("tc1", "1447-12-07");
    expect(r.students.length).toBe(2);
  });

  it("غيرُ المخوّل يُمنع", async () => {
    state.user = makeUser("amir", "other", "/men/other/", { personId: "p-x", userId: "u-x" });
    await expect(tahfeezSessionData("tc1", "1447-12-08")).rejects.toThrow();
  });
});

describe("تقييم الحلقات الدوريّ (ص٥)", () => {
  it("يرتّب بالحضور والعلامات ويصفّر الخاملة", async () => {
    const { circleRankingsData } = await import("@/server/tahfeez.server");
    const now = Date.now();
    // حلقة ثانية خاملة (بلا جلسات) وثالثة ضعيفة الحضور
    await db.insert(schema.tahfeezCircles).values([
      { id: "tc-idle", mosqueId: "m1", name: "خاملة", teacherPersonId: null, createdAt: 0 },
      { id: "tc-weak", mosqueId: "m1", name: "ضعيفة", teacherPersonId: null, createdAt: 0 },
    ]).run();
    await db.insert(schema.tahfeezSessions).values([
      { id: "s-good", circleId: "tc1", dateHijri: "1448-01-20", mosqueId: "m1", createdAt: now },
      { id: "s-weak", circleId: "tc-weak", dateHijri: "1448-01-20", mosqueId: "m1", createdAt: now },
    ]).run();
    await db.insert(schema.tahfeezDailyRecords).values([
      { id: "r1", sessionId: "s-good", studentId: "st1", attendance: "present", hifzGrade: 95, createdAt: now },
      { id: "r2", sessionId: "s-good", studentId: "st2", attendance: "present", reviewGrade: 90, createdAt: now },
      { id: "r3", sessionId: "s-weak", studentId: "st3", attendance: "absent", createdAt: now },
      { id: "r4", sessionId: "s-weak", studentId: "st4", attendance: "present", hifzGrade: 40, createdAt: now },
    ]).run();
    state.user = admin;
    const r = await circleRankingsData("m1");
    if ("error" in r) throw new Error(r.error);
    expect(r.items[0].id).toBe("tc1");            // ١٠٠٪ حضور وعلامات عالية
    expect(r.items[0].score).toBeGreaterThan(80);
    expect(r.items.at(-1)!.id).toBe("tc-idle");   // الخاملة أخيرًا بصفر
    expect(r.items.at(-1)!.score).toBe(0);
    const weak = r.items.find((x) => x.id === "tc-weak")!;
    expect(weak.attendancePct).toBe(50);
  });
});

describe("منفذ المعلّم الكامل (توجيه اللجنة)", () => {
  it("معلّم الحلقة يضيف طلابه بنفسه ويرى حلقاته؛ ومعلّمٌ آخر ممنوع", async () => {
    const { addTahfeezStudentData, tahfeezStudentsData, myTahfeezCirclesData } = await import("@/server/tahfeez.server");
    state.user = teacher; // p-teach هو معلّم tc1
    const r = await addTahfeezStudentData({ circleId: "tc1", name: "طالبٌ أضافه المعلّم" });
    expect("ok" in r && r.ok).toBe(true);
    expect((await tahfeezStudentsData("tc1")).map((s) => s.name)).toContain("طالبٌ أضافه المعلّم");
    const mine = await myTahfeezCirclesData();
    expect(mine.items.map((c) => c.id)).toContain("tc1");
    expect(mine.items[0].mosqueName).toBeTruthy();
    // معلّمٌ غريب لا يضيف
    state.user = makeUser("teacher", "x", "/men/x/", { personId: "p-stranger", userId: "u-str" });
    await expect(addTahfeezStudentData({ circleId: "tc1", name: "دخيل" })).rejects.toThrow();
    expect((await myTahfeezCirclesData()).items.length).toBe(0);
  });
});
