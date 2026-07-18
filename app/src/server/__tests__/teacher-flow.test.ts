import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

// حالة قابلة للتبديل تُحقن في useDb()/currentUser() — hoisted لتسبق vi.mock
const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({
  useDb: () => state.db,
  getCloudflareEnv: () => ({}),
  setCloudflareEnv: () => {},
}));
vi.mock("@/server/auth.server", () => ({
  currentUser: async () => state.user,
}));

import * as ala from "@/server/alaBaseera.server";
import { teacherHoursTrack } from "@/server/services/alaBaseera";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };

const teacherA = makeUser("teacher", "sq-1", "/idlib/sq-1/", { personId: "p-teacherA" });
const teacherB = makeUser("teacher", "sq-1", "/idlib/sq-1/", { personId: "p-teacherB" });
const admin = makeUser("admin", "root", "/");
const amirSq1 = makeUser("amir", "sq-1", "/idlib/sq-1/", { personId: "p-amir-sq1" });
const amirOther = makeUser("amir", "m-other", "/idlib/sq-2/m-other/", { personId: "p-amir-other" });

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  state.db = db;
  state.user = null;
});

describe("الارتباطات: المدرّس يملك حلقاته (curriculum + venue على المربع)", () => {
  it("createMyHalaqa ينشئ معلّماً + مكاناً على وحدة المدرّس + حلقة بالمنهج", async () => {
    setUser(teacherA);
    const res = await ala.createMyHalaqaData({ name: "حلقة تجريبية", curriculum: "tahfeez", genderTrack: "female" });
    expect(res.ok).toBe(true);

    const my = await ala.myCirclesData();
    expect(my.kpis.circles).toBe(1);
    expect(my.items[0].curriculum).toBe("tahfeez");
    expect(my.items[0].genderTrack).toBe("female");

    // المكان مرتبط بوحدة المدرّس الإشرافية (sq-1) — فيراها المشرف
    const venues = await db.select().from(schema.venues).all();
    expect(venues[0].orgUnitId).toBe("sq-1");
    // المعلّم مرتبط بشخص المستخدم
    const teachers = await db.select().from(schema.teachers).all();
    expect(teachers[0].personId).toBe("p-teacherA");
  });
});

describe("الصلاحيات: عزل الملكية الصارم بين المدرّسين", () => {
  it("المدرّس لا يرى إلا حلقاته، والآخر لا يديرها", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "حلقة (أ)", curriculum: "baseera" });

    // المدرّس B: لا حلقات له، ولا يستطيع إضافة طالب لحلقة A
    setUser(teacherB);
    expect((await ala.myCirclesData()).kpis.circles).toBe(0);
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "طالب" })).rejects.toThrow();

    // المدرّس A: يستطيع
    setUser(teacherA);
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "أحمد" })).resolves.toMatchObject({ ok: true });
  });

  it("الإدخال للمعلّم/أمير المكان فقط — المدير لا يُدخل (يوافق فقط)", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "حلقة", curriculum: "baseera" });

    setUser(admin); // المدير لا يُدخل (منعاً للغش)
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "ط1" })).rejects.toThrow();

    setUser(amirSq1); // أمير وحدة المكان (sq-1) — مُدخِلٌ محلّي
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "ط2" })).resolves.toMatchObject({ ok: true });

    setUser(amirOther); // أمير خارج النطاق
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "ط3" })).rejects.toThrow();

    setUser(null); // غير مسجّل
    await expect(ala.addHalaqaStudentData({ halaqaId: a.id!, name: "ط4" })).rejects.toThrow();
  });

  it("الموافقة/الرفض للمدير والمشرف ضمن النطاق فقط — لا للمعلّم", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "حلقة", curriculum: "baseera" });
    const les = await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1, lessonTitle: "د" });
    const lid = (les as { id: string }).id;

    setUser(teacherA); // المعلّم لا يعتمد نفسه
    await expect(ala.setLessonStatusData({ lessonId: lid, status: "approved" })).rejects.toThrow();
    setUser(amirOther); // مشرف/أمير خارج النطاق
    await expect(ala.setLessonStatusData({ lessonId: lid, status: "approved" })).rejects.toThrow();
    setUser(admin); // المدير يوافق
    await expect(ala.setLessonStatusData({ lessonId: lid, status: "approved" })).resolves.toMatchObject({ ok: true });
  });

  it("غير المدرّس لا يصل لـmyCircles", async () => {
    setUser(amirSq1);
    await expect(ala.myCirclesData()).rejects.toThrow();
  });

  it("العمل دون اتصال: إعادة إرسال درسٍ بنفس clientUuid لا تُنشئ جلسةً ثانية (idempotent)", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "حلقة", curriculum: "baseera" });
    const uuid = "offline-uuid-1";
    const r1 = await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1, lessonTitle: "درس", clientUuid: uuid });
    const r2 = await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1, lessonTitle: "درس", clientUuid: uuid });
    expect((r1 as { id: string }).id).toBe((r2 as { id: string }).id); // نفس الجلسة
    const lessons = await ala.halaqaLessonsData(a.id!);
    expect(lessons.items.length).toBe(1); // صفٌّ واحد رغم الإرسالين
  });

  it("السجل الغنيّ: حضور (حاضر/غائب/مستأذن) لكل طالبة + كشف مجمّع + مَن اعتمد", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "حلقة نسائية — تجربة", curriculum: "baseera", genderTrack: "female" });
    const s1 = await ala.addHalaqaStudentData({ halaqaId: a.id!, name: "سعاد" });
    const s2 = await ala.addHalaqaStudentData({ halaqaId: a.id!, name: "هند" });
    const e1 = (s1 as { id: string }).id, e2 = (s2 as { id: string }).id;
    // درسٌ بحضور: سعاد حاضرة، هند غائبة
    await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1, lessonTitle: "المجلس الأول", attendance: [{ enrollmentId: e1, state: "present" }, { enrollmentId: e2, state: "absent" }] });
    // درسٌ آخر: كلتاهما حاضرة (بمجلسٍ لتحديث المنهج آليًّا)
    const les2 = await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1, lessonTitle: "المجلس الثاني", majlis: "المجلس الثاني", attendance: [{ enrollmentId: e1, state: "present" }, { enrollmentId: e2, state: "present" }] });

    const roster = await ala.halaqaRosterData(a.id!);
    expect(roster.lessonsCount).toBe(2);
    const suad = roster.students.find((x) => x.id === e1)!;
    const hind = roster.students.find((x) => x.id === e2)!;
    expect(suad.present).toBe(2); expect(suad.absent).toBe(0);
    expect(hind.present).toBe(1); expect(hind.absent).toBe(1);

    // الاعتماد يُسجّل من اعتمد ويظهر اسمه (يلزم صفّا users+persons لحلّ الاسم)
    await db.insert(schema.persons).values({ id: admin.personId, fullName: "المدير العام", gender: "male", status: "active", createdAt: 0 }).run();
    await db.insert(schema.users).values({ id: admin.userId, personId: admin.personId, login: "admin", passwordHash: "x", mfaEnabled: false, createdAt: 0 }).run();
    setUser(admin);
    await ala.setLessonStatusData({ lessonId: (les2 as { id: string }).id, status: "approved" });
    const lessons = await ala.halaqaLessonsData(a.id!);
    const approved = lessons.items.find((l) => l.status === "approved")!;
    expect(approved.approvedByName).toBeTruthy();
    expect(approved.attendance).toMatchObject({ present: 2, absent: 0 });

    // تقدّم المنهج: اعتماد درس المجلس الثاني (بحضور الطالبتين) ⇒ أكملتا المجلس آليًّا
    const curr = await ala.halaqaCurriculumData(a.id!);
    expect(curr.majalis).toContain("المجلس الثاني");
    expect(curr.students.find((x) => x.id === e1)?.progress).toBe(100);
  });
});

describe("المالية: ساعات «على بصيرة» فقط تُحتسَب (D3)", () => {
  it("teacherHoursTrack يستبعد مناهج التحفيظ/الرشيدي", async () => {
    const now = Date.now();
    await db.insert(schema.teachers).values({ id: "t1", personId: "pT", active: true, createdAt: now }).run();
    await db.insert(schema.halaqat).values([
      { id: "hB", name: "بصيرة", venueId: "v1", teacherId: "t1", genderTrack: "male", curriculum: "baseera", capacity: 30, createdAt: now },
      { id: "hT", name: "تحفيظ", venueId: "v1", teacherId: "t1", genderTrack: "male", curriculum: "tahfeez", capacity: 30, createdAt: now },
    ]).run();
    await db.insert(schema.lessonSessions).values([
      { id: "lsB", halaqaId: "hB", teacherId: "t1", hijriMonth: "1447-06", durationHours: 2, status: "approved", createdAt: now },
      { id: "lsB2", halaqaId: "hB", teacherId: "t1", hijriMonth: "1447-06", durationHours: 5, status: "recorded", createdAt: now }, // غير معتمد ⇒ لا يُحتسب
      { id: "lsT", halaqaId: "hT", teacherId: "t1", hijriMonth: "1447-06", durationHours: 3, status: "approved", createdAt: now }, // تحفيظ ⇒ مُستبعَد بالمنهج
    ]).run();

    const track = await teacherHoursTrack(db, "pT", "1447-06");
    expect(track?.hours).toBe(2); // بصيرة معتمَد فقط (٢)؛ غير المعتمد (٥) والتحفيظ (٣) مُستبعَدان
  });
});

describe("تعديل/أرشفة الحلقة + قائمة الدروس", () => {
  it("التعديل يغيّر الاسم والمنهج؛ والأرشفة تُخفيها من حلقاتي", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "قديم", curriculum: "baseera" });
    await ala.updateMyHalaqaData({ id: a.id!, name: "جديد", curriculum: "rashidi", capacity: 12 });
    let my = await ala.myCirclesData();
    expect(my.items[0].name).toBe("جديد");
    expect(my.items[0].curriculum).toBe("rashidi");

    await ala.archiveMyHalaqaData({ id: a.id! });
    my = await ala.myCirclesData();
    expect(my.kpis.circles).toBe(0); // مؤرشفة ⇒ لا تظهر
  });

  it("قائمة الدروس تعكس ما سُجّل، والمدرّس الآخر لا يعدّل/يؤرشف", async () => {
    setUser(teacherA);
    const a = await ala.createMyHalaqaData({ name: "ح", curriculum: "baseera" });
    await ala.recordLessonData({ halaqaId: a.id!, durationHours: 1.5, lessonTitle: "الدرس الأول" });
    const lessons = await ala.halaqaLessonsData(a.id!);
    expect(lessons.items).toHaveLength(1);
    expect(lessons.items[0].title).toBe("الدرس الأول");
    expect(lessons.items[0].status).toBe("recorded");

    setUser(teacherB);
    await expect(ala.updateMyHalaqaData({ id: a.id!, name: "اختراق" })).rejects.toThrow();
    await expect(ala.archiveMyHalaqaData({ id: a.id! })).rejects.toThrow();
  });
});
