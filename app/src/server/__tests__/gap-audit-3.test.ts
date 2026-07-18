// الجولة الثالثة من تدقيق الفجوات (ف١–ف١٠) — الوصول والدورة الحياتيّة والجنس والأرشفة والحدود.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "@/server/database/schema";
import { and, eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });
const amir = makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir", userId: "u-amir" });
const sectionHead = makeUser("section_head", "men", "/men/", { personId: "p-sh", userId: "u-sh", fullName: "مشرف عام القسم" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور", status: "active", createdAt: 0 },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "قسم الإناث", status: "active", createdAt: 0 },
    { id: "aleppo", parentId: "men", path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: 0 },
    { id: "sq", parentId: "aleppo", path: "/men/aleppo/sq/", type: "square", section: "men", genderTrack: "male", name: "مربع", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq", path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد ١", status: "active", createdAt: 0 },
    { id: "h-w1", parentId: "women", path: "/women/h-w1/", type: "halaqa", section: "women", genderTrack: "female", name: "حلقة نساء", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-amir", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    // ق1-د: لا مربعَ ولا منطقةَ مُكلَّفَين ⇒ رأسُ القسم هو الطبقةُ الأقربُ (NESSA) للمسجد وللزيارة — حالةُ المالك حرفيًّا.
    { id: "ra-sh", personId: "p-sh", role: "section_head", orgUnitId: "men", orgPath: "/men/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
});

describe("ف٣: تطابق الجنس في التسجيل الذاتيّ", () => {
  it("ذكرٌ نحو وحدة/حلقة نساء يُرفض تقديمًا؛ وطلبٌ قديمٌ مخالفٌ يُرفض اعتمادًا", async () => {
    const { submitRegistrationData, approveRegistrationData } = await import("@/server/registration.server");
    const male = await submitRegistrationData({
      kind: "student", fullName: "ذكرٌ نحو النساء", gender: "male",
      login: "male.to.women", password: "P@ssw0rd123", targetUnitId: "h-w1",
    });
    expect("error" in male && male.error).toContain("لا يطابق");
    // حلقةٌ نسائيّة داخل وحدة النساء + متقدّمة أنثى بجنسٍ محرَّفٍ برمجيًّا
    await db.insert(schema.circles).values({ id: "c-w", mosqueId: "h-w1", type: "tahfeez", genderTrack: "female", name: "نور", teacherPersonId: null, capacity: null, notes: null, status: "active", createdAt: 0 }).run();
    const mismatchCircle = await submitRegistrationData({
      kind: "student", fullName: "متقدّمٌ لحلقة إناث", gender: "female",
      login: "ok.female", password: "P@ssw0rd123", targetUnitId: "h-w1", circleId: "c-w",
    });
    expect("ok" in mismatchCircle && mismatchCircle.ok).toBe(true); // أنثى ⇒ تمرّ
    // طلبٌ مخالفٌ زُرع مباشرةً (سبق الشرط) ⇒ الاعتماد يصدّه
    await db.insert(schema.registrationRequests).values({
      id: "req-old", kind: "student", fullName: "قديمٌ مخالف", gender: "male", login: "old.male",
      passwordHash: "h", phone: null, targetUnitId: "h-w1", targetPath: "/women/h-w1/",
      proposedUnitName: null, proposedParentId: null, circleId: null, note: null, status: "pending", createdAt: 0,
    }).run();
    setUser(admin);
    const res = await approveRegistrationData("req-old");
    expect("error" in res && res.error).toContain("لا يطابق");
  });
});

describe("ف٤: مشرف عام القسم يعتمد فعلًا", () => {
  it("زيارةٌ إشرافيّةٌ مقدَّمة من مشرف مربعٍ يعتمدها رأس القسم", async () => {
    await db.insert(schema.supervisionVisits).values({
      id: "v1", circleRefId: "tc-x", circleKind: "tahfeez", circleName: "الفجر", mosqueName: "مسجد ١",
      visitedBy: "u-sq", visitedByName: "مشرف", submitterPath: "/men/aleppo/sq/", status: "submitted",
      notes: null, rating: null, createdAt: 0, updatedAt: 0,
    } as never).run();
    setUser(sectionHead);
    const { approveSupervisionVisitData } = await import("@/server/supervision.server");
    const r = await approveSupervisionVisitData("v1");
    expect("ok" in r && r.ok).toBe(true);
  });

  it("تقرير مسجدٍ بحالة amir_approved يعتمده رأس القسم نهائيًّا", async () => {
    await db.insert(schema.weeklyRecords).values({
      id: "wr1", mosqueId: "m1", mosquePath: "/men/aleppo/sq/m1/", weekStart: "2026-06-20", hijriMonth: "1448-01",
      schemeId: "scheme-male", totalPoints: 50, status: "amir_approved", locked: false, createdAt: 0,
    } as never).run();
    setUser(sectionHead);
    const { approveMonthForMosque } = await import("@/server/data.server");
    const r = await approveMonthForMosque("m1");
    expect("advanced" in r && r.advanced).toBe(1);
    const rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.id, "wr1")).all())[0];
    expect(rec.status).toBe("layer_approved");
  });
});

describe("ف٥+ف٦: توجيه التذكيرات — الأمير الحاليّ لا السابق، ولا مساجد مؤرشفة", () => {
  it("أميرٌ منتهي التكليف لا يُذكَّر؛ الحاليّ يُذكَّر؛ والمسجد المؤرشف صامت", async () => {
    const { runDueTasksData } = await import("@/server/scheduled.server");
    // أميران على m1: سابقٌ (endDate) وحاليّ
    await db.insert(schema.roleAssignments).values([
      { id: "ra-old", personId: "p-old-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", startDate: 0, endDate: 100, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    ]).run();
    // مسجدٌ مؤرشفٌ له أميرٌ نشط — لا يُذكَّر
    await db.insert(schema.orgUnits).values({ id: "m-arch", parentId: "sq", path: "/men/aleppo/sq/m-arch/", type: "mosque", section: "men", genderTrack: "male", name: "مؤرشف", status: "archived", createdAt: 0 }).run();
    await db.insert(schema.roleAssignments).values([
      { id: "ra-arch", personId: "p-arch-amir", role: "amir", orgUnitId: "m-arch", orgPath: "/men/aleppo/sq/m-arch/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    ]).run();
    // حُذف ra-old قبل الإصلاح كان أوّلَ صفٍّ فيستلم التذكير
    await runDueTasksData();
    const rem = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "entry_reminder");
    expect(rem.map((n) => n.personId)).toEqual(["p-amir"]); // الحاليّ فقط — لا السابق ولا أمير المؤرشف
  });
});

describe("ف٢+ف٧: الأرشفة والتكليف المنتهي يقطعان المنافذ", () => {
  it("معلّمٌ بلا أيّ تكليفٍ نشطٍ يُصدّ عن سجلّ حلقته وإن بقي اسمه عليها", async () => {
    await db.insert(schema.tahfeezCircles).values({ id: "tc1", mosqueId: "m1", name: "الفجر", teacherPersonId: "p-ghost", status: "active", createdAt: 0 }).run();
    const ghost: FakeUser = { userId: "u-ghost", personId: "p-ghost", fullName: "معلّمٌ منتهٍ", assignments: [] };
    setUser(ghost);
    const { addTahfeezStudentData } = await import("@/server/tahfeez.server");
    await expect(addTahfeezStudentData({ circleId: "tc1", name: "طالب" })).rejects.toThrow();
  });

  it("حلقةٌ مؤرشفةٌ: لا كتابة عليها، ورابط وليّ الأمر يموت، وواجباتها واختباراتها تسقط عن الطالب", async () => {
    const now = Date.now();
    await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "الفجر", teacherPersonId: null, capacity: null, notes: null, status: "archived", createdAt: 0 }).run();
    await db.insert(schema.tahfeezCircles).values({ id: "tc-c1", mosqueId: "m1", name: "الفجر", teacherPersonId: "p-amir", status: "archived", createdAt: 0 }).run();
    await db.insert(schema.tahfeezStudents).values({ id: "ts1", circleId: "tc-c1", personId: "p-st", studentName: "طالب", status: "active", guardianToken: "tok-1234567890123456", createdAt: 0 } as never).run();
    await db.insert(schema.circleStudents).values({ id: "cs1", circleId: "c1", name: "طالب", personId: "p-st", notes: null, status: "active", createdAt: 0 }).run();
    await db.insert(schema.activities).values({ id: "a1", scopeKind: "circle", scopeId: "c1", mosqueId: "m1", title: "نشاط", details: null, dueAt: now + 10 * 3_600_000, required: true, status: "active", createdBy: "p-x", createdByName: null, createdAt: 0 }).run();
    await db.insert(schema.exams).values({ id: "e1", scopeKind: "circle", scopeId: "c1", mosqueId: "m1", title: "اختبار", kind: "exam", dueAt: now + 10 * 3_600_000, status: "published", createdBy: "p-x", createdByName: null, createdAt: 0 } as never).run();

    setUser(amir);
    const { saveTahfeezDailyByCircleData, guardianViewData } = await import("@/server/tahfeez.server");
    await expect(saveTahfeezDailyByCircleData({ circleId: "tc-c1", dateHijri: "1448-01-01", records: [] })).rejects.toThrow(/مؤرشفة/);
    const g = await guardianViewData("tok-1234567890123456");
    expect("error" in g).toBe(true);

    const student: FakeUser = { userId: "u-st", personId: "p-st", fullName: "طالب", assignments: [{ role: "student", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/" }] };
    setUser(student);
    const { myDutiesData } = await import("@/server/activities.server");
    const { myExamsData } = await import("@/server/exams.server");
    expect((await myDutiesData()).items.length).toBe(0);
    expect((await myExamsData()).items.length).toBe(0);
    // ولا تذكيرات كرون لأعضائها
    const { runDueTasksData } = await import("@/server/scheduled.server");
    await runDueTasksData();
    const kinds = (await db.select().from(schema.notifications).all()).map((n) => n.kind);
    expect(kinds).not.toContain("activity_due");
    expect(kinds).not.toContain("exam_due");
  });
});

describe("ف٨: لوحة تحفيظ مسجدٍ بمئةٍ وثلاثين طالبًا لا تنكسر", () => {
  it("tahfeezData يعدّ عبر دفعاتٍ تحت حدّ D1", async () => {
    await db.insert(schema.tahfeezCircles).values({ id: "tc-big", mosqueId: "m1", name: "كبيرة", teacherPersonId: null, status: "active", createdAt: 0 }).run();
    for (let i = 0; i < 130; i++) {
      await db.insert(schema.tahfeezStudents).values({ id: `ts-${i}`, circleId: "tc-big", personId: "", studentName: `طالب ${i}`, status: "active", createdAt: 0 }).run();
    }
    setUser(amir);
    const { tahfeezData } = await import("@/server/tahfeez.server");
    const r = await tahfeezData("m1");
    expect(r.kpis.students).toBe(130);
  });
});

describe("ف١: حارس قراءة الوسائط", () => {
  it("لا جلسة ⇒ رفض؛ جمهورٌ غير مطابقٍ ⇒ رفض؛ المطابق والإدارة ⇒ سماح؛ وغير المكتبة تكفيه الجلسة", async () => {
    const { canReadMediaKey } = await import("@/server/media.server");
    await db.insert(schema.materials).values({ id: "mat1", title: "دليل الأمراء", category: "admin_training", kind: "pdf", r2Key: "materials/x.pdf", audience: "amir", mandatory: true, sortOrder: 0, status: "active", createdAt: 0 }).run();
    const teacher: FakeUser = { userId: "u-t", personId: "p-t", fullName: "معلّم", assignments: [{ role: "teacher", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/" }] };
    expect(await canReadMediaKey(null, "materials/x.pdf", db as never)).toBe(false);
    expect(await canReadMediaKey(teacher, "materials/x.pdf", db as never)).toBe(false); // جمهورها الأمراء
    expect(await canReadMediaKey(amir, "materials/x.pdf", db as never)).toBe(true);
    expect(await canReadMediaKey(sectionHead, "materials/x.pdf", db as never)).toBe(true); // إدارة
    expect(await canReadMediaKey(teacher, "daily/rec1/photo.jpg", db as never)).toBe(true); // غير المكتبة: تكفي الجلسة
    expect(await canReadMediaKey(null, "daily/rec1/photo.jpg", db as never)).toBe(false);
  });
});

describe("ق٢: المسار الجنسيّ مشتقٌّ من القسم حصرًا", () => {
  it("وحدةٌ تحت قسم النساء تُنشأ female وإن مُرّر خلاف ذلك", async () => {
    const { createOrgUnit } = await import("@/server/services/orgUnits");
    const r = await createOrgUnit(db as never, { parentId: "women", type: "halaqa", genderTrack: "male", name: "حلقة مشتقّة" });
    const row = (await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, r.id)).all())[0];
    expect(row.genderTrack).toBe("female");
    expect(row.section).toBe("women");
  });
});
