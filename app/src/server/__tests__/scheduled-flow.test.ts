import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({
  useDb: () => state.db,
  getCloudflareEnv: () => ({}), // لا توكن تيليغرام ⇒ إشعارات داخلية فقط
  setCloudflareEnv: () => {},
}));

import { runDueTasksData } from "@/server/scheduled.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const DAY = 86_400_000;

beforeEach(async () => {
  db = (await createTestDb()).db;
  state.db = db;
  const now = Date.now();
  // مسجد + أمير + مربع مُشرف
  await db.insert(schema.orgUnits).values([
    { id: "sq-1", parentId: "idlib", path: "/idlib/sq-1/", type: "square", name: "مربع", createdAt: 0 },
    { id: "m1", parentId: "sq-1", path: "/idlib/sq-1/m1/", type: "mosque", name: "مسجد ١", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-amir", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/idlib/sq-1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-sq", personId: "p-sq", role: "square", orgUnitId: "sq-1", orgPath: "/idlib/sq-1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  // سجلّ اعتمده الأمير وتأخّر >٧ أيام ⇒ تصعيد
  await db.insert(schema.weeklyRecords).values({
    id: "wr-old", mosqueId: "m1", mosquePath: "/idlib/sq-1/m1/", weekStart: "2026-05-30", schemeId: "s1",
    totalPoints: 60, status: "amir_approved", locked: false, amirApprovedAt: now - 8 * DAY, createdAt: 0,
  }).run();
});

describe("F2: المهامّ المجدولة (تذكير + تصعيد + لا تكرار)", () => {
  it("تشغيلٌ أوّل: تذكير للأمير + تصعيد للمربع", async () => {
    const r = await runDueTasksData();
    expect(r.reminders).toBeGreaterThanOrEqual(1); // المسجد بلا سجلّ لأسبوع الحالي
    expect(r.escalations).toBeGreaterThanOrEqual(1); // سجلّ متأخّر >٧ أيام

    const notifs = await db.select().from(schema.notifications).all();
    const kinds = notifs.map((n) => n.kind).sort();
    expect(kinds).toContain("entry_reminder");
    expect(kinds).toContain("layer_approval_needed");
    // الإشعارات داخلية تظهر بالجرس
    expect(notifs.every((n) => n.channel === "inapp")).toBe(true);
  });

  it("إعادة التشغيل: لا تكرار (idempotent)", async () => {
    await runDueTasksData();
    const before = (await db.select().from(schema.notifications).all()).length;
    const r2 = await runDueTasksData();
    expect(r2.reminders).toBe(0);
    expect(r2.escalations).toBe(0);
    expect(r2.supervisionDue).toBe(0);
    const after = (await db.select().from(schema.notifications).all()).length;
    expect(after).toBe(before); // لم تُضَف صفوف جديدة
  });

  it("تذكير المكتبة: إلزاميّةٌ اسْتُلمت منذ ١٤+ يومًا بلا إنجاز ⇒ تذكيرٌ بلا تكرار", async () => {
    const now = Date.now();
    await db.insert(schema.materials).values([
      { id: "mat-1", title: "دليل الأمير", category: "admin_training", kind: "pdf", r2Key: "materials/x.pdf", audience: "amir", mandatory: true, sortOrder: 0, status: "active", createdAt: 0 },
      { id: "mat-2", title: "اختياريّة", category: "fiqh", kind: "pdf", r2Key: "materials/y.pdf", audience: "amir", mandatory: false, sortOrder: 0, status: "active", createdAt: 0 },
    ]).run();
    await db.insert(schema.materialProgress).values([
      { id: "mp-1", materialId: "mat-1", personId: "p-amir", deliveredAt: now - 20 * DAY, openedAt: null, completedAt: null },   // متأخّرة ⇒ تذكير
      { id: "mp-2", materialId: "mat-1", personId: "p-sq", deliveredAt: now - 20 * DAY, openedAt: now, completedAt: now },        // مُنجزة ⇒ لا
      { id: "mp-3", materialId: "mat-2", personId: "p-amir", deliveredAt: now - 40 * DAY, openedAt: null, completedAt: null },   // غير إلزاميّة ⇒ لا
    ]).run();
    const r = await runDueTasksData();
    expect(r.materialReminders).toBe(1);
    const rem = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "material_reminder");
    expect(rem.length).toBe(1);
    expect(rem[0].personId).toBe("p-amir");
    const r2 = await runDueTasksData();
    expect(r2.materialReminders).toBe(0); // idempotent
  });

  it("التذكيرات النسبيّة: درسٌ خلال ٣ ساعات + نشاطٌ يستحقّ غدًا لغير المجيب، بلا تكرار", async () => {
    const now = Date.now();
    await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "الفجر", teacherPersonId: null, capacity: null, notes: null, status: "active", createdAt: 0 }).run();
    await db.insert(schema.circleStudents).values([
      { id: "cs1", circleId: "c1", name: "طالبٌ موصول", personId: "p-st", notes: null, status: "active", createdAt: 0 },
      { id: "cs2", circleId: "c1", name: "طالبٌ مجيب", personId: "p-st2", notes: null, status: "active", createdAt: 0 },
    ]).run();
    // درسٌ بعد ساعتين + آخر بعد يومين (لا يُذكَّر به)
    await db.insert(schema.mosqueLessons).values([
      { id: "l1", mosqueId: "m1", title: "درسٌ قريب", startsAt: now + 2 * 3_600_000, durationMin: 45, status: "confirmed", createdAt: 0, updatedAt: 0 },
      { id: "l2", mosqueId: "m1", title: "درسٌ بعيد", startsAt: now + 48 * 3_600_000, durationMin: 45, status: "scheduled", createdAt: 0, updatedAt: 0 },
    ]).run();
    // نشاطٌ يستحقّ خلال ١٢ ساعة — أجاب عنه p-st2 فقط
    await db.insert(schema.activities).values({ id: "a1", scopeKind: "circle", scopeId: "c1", mosqueId: "m1", title: "نشاطٌ مستحقّ", details: null, dueAt: now + 12 * 3_600_000, required: true, status: "active", createdBy: "p-x", createdByName: null, createdAt: 0 }).run();
    await db.insert(schema.activityResponses).values({ id: "ar1", activityId: "a1", personId: "p-st2", personName: null, body: "تمّ", submittedAt: now, reviewStatus: "pending" }).run();

    const r = await runDueTasksData();
    const notifs = await db.select().from(schema.notifications).all();
    const lessonRem = notifs.filter((n) => n.kind === "lesson_reminder");
    expect(lessonRem.length).toBe(3); // الطالبان + أمير المسجد (غ٦) — للدرس القريب فقط
    expect(new Set(lessonRem.map((n) => JSON.parse(n.payload!).refId))).toEqual(new Set(["l1"]));
    const actDue = notifs.filter((n) => n.kind === "activity_due");
    expect(actDue.length).toBe(1);
    expect(actDue[0].personId).toBe("p-st"); // غير المجيب فقط
    expect(r.relativeReminders).toBe(4);
    // إعادة التشغيل: صفر
    const r2 = await runDueTasksData();
    expect(r2.relativeReminders).toBe(0);
  });

  it("تذكير الإشراف الميدانيّ: حلقةٌ لم تُزَر ⇒ إشعارٌ للمشرف المغطّي، بلا تكرار", async () => {
    // حلقةٌ تحفيظيّةٌ تحت المسجد بلا زيارة ⇒ حالة never
    await db.insert(schema.tahfeezCircles).values({ id: "tc-x", mosqueId: "m1", name: "حلقة الفجر", teacherPersonId: null, createdAt: 0 }).run();
    const r = await runDueTasksData();
    expect(r.supervisionDue).toBeGreaterThanOrEqual(1);
    const dues = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "supervision_due");
    expect(dues.length).toBe(1);
    expect(dues[0].personId).toBe("p-sq"); // المشرف المغطّي (المربع)
    const p = JSON.parse(dues[0].payload!);
    expect(p.status).toBe("never");
    expect(p.circleRefId).toBe("tc-x");
    // إعادة التشغيل: لا تكرار
    const r2 = await runDueTasksData();
    expect(r2.supervisionDue).toBe(0);
  });
  it("تذكير سجلّ اليوم (غ٦): حلقةٌ بطلابٍ ومعلّمٍ بلا جلسة اليوم ⇒ تذكيرٌ للمعلّم مرّةً، ولا تذكير لمن سجّل", async () => {
    const { hijriDateStr } = await import("@/server/utils/week");
    const today = hijriDateStr(new Date());
    await db.insert(schema.tahfeezCircles).values([
      { id: "tcr1", mosqueId: "m1", name: "لم تُسجَّل", teacherPersonId: "p-teach1", createdAt: 0 },
      { id: "tcr2", mosqueId: "m1", name: "سجّلت", teacherPersonId: "p-teach2", createdAt: 0 },
      { id: "tcr3", mosqueId: "m1", name: "بلا طلاب", teacherPersonId: "p-teach3", createdAt: 0 },
    ]).run();
    await db.insert(schema.tahfeezStudents).values([
      { id: "tsr1", circleId: "tcr1", personId: "", studentName: "أ", status: "active", createdAt: 0 },
      { id: "tsr2", circleId: "tcr2", personId: "", studentName: "ب", status: "active", createdAt: 0 },
    ]).run();
    await db.insert(schema.tahfeezSessions).values({ id: "sess-t", circleId: "tcr2", dateHijri: today, mosqueId: "m1", createdAt: Date.now() }).run();
    await runDueTasksData();
    const rem = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "tahfeez_register_due");
    expect(rem.map((n) => n.personId)).toEqual(["p-teach1"]); // لا للمُسجِّلة ولا لبلا طلاب
    await runDueTasksData();
    const rem2 = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "tahfeez_register_due");
    expect(rem2.length).toBe(1); // idempotent
  });
});
