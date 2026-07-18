import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { saveLessonData, mosqueLessonsData, setLessonStatusData, addLessonAttendeeData, lessonAttendanceData } from "@/server/mosqueLessons.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const amir = makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir", userId: "u-amir", fullName: "أمير النور" });
const otherAmir = makeUser("amir", "m2", "/men/aleppo/sq/m2/", { personId: "p-amir2", userId: "u-amir2", fullName: "أمير آخر" });

const HOUR = 3_600_000;
const base = Date.now() + 24 * HOUR;

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "m1", parentId: null, path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 },
    { id: "m2", parentId: null, path: "/men/aleppo/sq/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد آخر", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة", teacherPersonId: null, capacity: null, notes: null, status: "active", createdAt: 0 }).run();
  await db.insert(schema.circleStudents).values({ id: "cs1", circleId: "c1", name: "أحمد الطالب", personId: null, notes: null, status: "active", createdAt: 0 }).run();
});

describe("د — دروس المسجد", () => {
  it("أمير المسجد يضيف درسًا؛ وأمير مسجدٍ آخر لا يضيف", async () => {
    setUser(otherAmir);
    const denied = await saveLessonData({ mosqueId: "m1", title: "تفسير سورة الكهف", startsAt: base, durationMin: 45 });
    expect("error" in denied && denied.error).toBeTruthy();
    setUser(amir);
    const ok = await saveLessonData({ mosqueId: "m1", title: "تفسير سورة الكهف", startsAt: base, durationMin: 45 });
    expect("ok" in ok && ok.ok).toBe(true);
  });

  it("كشف التعارض: تداخلٌ زمنيّ يحذّر، وforce يتجاوز، ولا تعارض بعد انتهاء المدّة", async () => {
    setUser(amir);
    await saveLessonData({ mosqueId: "m1", title: "الدرس الأوّل", startsAt: base, durationMin: 60 });
    const clash = await saveLessonData({ mosqueId: "m1", title: "درسٌ متداخل", startsAt: base + 30 * 60_000, durationMin: 45 });
    expect("conflictWith" in clash && clash.conflictWith?.title).toBe("الدرس الأوّل");
    const forced = await saveLessonData({ mosqueId: "m1", title: "درسٌ متداخل", startsAt: base + 30 * 60_000, durationMin: 45, force: true });
    expect("ok" in forced && forced.ok).toBe(true);
    const after = await saveLessonData({ mosqueId: "m1", title: "درسٌ لاحق", startsAt: base + 2 * HOUR, durationMin: 45 });
    expect("ok" in after && after.ok).toBe(true);
  });

  it("جلسات اليوم/القادم/المُلقاة + الحضور باقتراح طلاب الحلقات", async () => {
    setUser(amir);
    const l1 = await saveLessonData({ mosqueId: "m1", title: "درس الغد", startsAt: base, durationMin: 45 });
    const id = (l1 as { id: string }).id;
    const data = await mosqueLessonsData("m1");
    if ("error" in data) throw new Error(data.error);
    expect(data.upcoming.map((x) => x.title)).toContain("درس الغد");
    // حضور: اقتراح طالب الحلقة ثم إضافته (ولا تكرار)
    const att0 = await lessonAttendanceData(id);
    if ("error" in att0) throw new Error(att0.error);
    expect(att0.suggestions).toContain("أحمد الطالب");
    expect((await addLessonAttendeeData({ lessonId: id, name: "أحمد الطالب" }) as { ok?: boolean }).ok).toBe(true);
    const dup = await addLessonAttendeeData({ lessonId: id, name: "أحمد الطالب" });
    expect("error" in dup && dup.error).toBeTruthy();
    // أُلقي ⇒ ينتقل للمُلقاة
    await setLessonStatusData({ id, status: "delivered" });
    const data2 = await mosqueLessonsData("m1");
    if ("error" in data2) throw new Error(data2.error);
    expect(data2.delivered.map((x) => x.title)).toContain("درس الغد");
    expect(data2.delivered.find((x) => x.id === id)!.attendees).toBe(1);
  });
});
