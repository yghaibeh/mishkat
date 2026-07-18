import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { createCircle, updateCircle } from "@/server/circles.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const amir = makeUser("amir", "m1", "/men/a/m1/", { personId: "p-amir", userId: "u-amir", fullName: "الأمير" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/a/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد سعد", status: "active", createdAt: 0 }).run();
  await db.insert(schema.persons).values({ id: "p-t", fullName: "الشيخ محمود", gender: "male", status: "active", createdAt: 0 }).run();
});

describe("الجسر (0049): حلقة السجلّ تمتدّ لوحدتها", () => {
  it("حلقة تحفيظٍ من السجلّ تظهر فورًا في وحدة التحفيظ (tahfeez_circles)", async () => {
    setUser(amir);
    const r = await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة الفجر" });
    expect("ok" in r && r.ok).toBe(true);
    const tc = await db.select().from(schema.tahfeezCircles).where(eq(schema.tahfeezCircles.mosqueId, "m1")).all();
    expect(tc.map((x) => x.name)).toEqual(["حلقة الفجر"]);
    // تكرار الاسم لا يزدوج
    await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة الفجر" });
    expect((await db.select().from(schema.tahfeezCircles).all()).length).toBe(1);
  });

  it("حلقة «على بصيرة» بمعلّمٍ ⇒ مكانٌ ومعلّمٌ وحلقة halaqat فورًا؛ وبلا معلّمٍ ⇒ إشعارٌ ثم جسرٌ عند التعيين", async () => {
    setUser(amir);
    const withTeacher = await createCircle({ mosqueId: "m1", type: "ala_baseera", genderTrack: "male", name: "بصيرة ١", teacherPersonId: "p-t" });
    expect("ok" in withTeacher && withTeacher.ok).toBe(true);
    const hs = await db.select().from(schema.halaqat).all();
    expect(hs.length).toBe(1);
    expect(hs[0].curriculum).toBe("baseera");
    const v = (await db.select().from(schema.venues).all())[0];
    expect(v.orgUnitId).toBe("m1");
    // بلا معلّم: إشعار + لا حلقة بعد
    const noTeacher = await createCircle({ mosqueId: "m1", type: "ala_baseera", genderTrack: "male", name: "بصيرة ٢" });
    expect((noTeacher as { notice?: string }).notice).toContain("معلّم");
    expect((await db.select().from(schema.halaqat).all()).length).toBe(1);
    // تعيين المعلّم يُكمل الجسر
    await updateCircle({ id: (noTeacher as { id: string }).id, teacherPersonId: "p-t" });
    expect((await db.select().from(schema.halaqat).all()).length).toBe(2);
  });
});

describe("جسر الطلاب (0050): سجلٌّ واحدٌ من الجهتين", () => {
  it("طالبُ سجلّ الحلقات يظهر في سجلّ تحفيظ حلقته فورًا، وإزالتُه تُخمل مرآتَه", async () => {
    const { addCircleStudent, removeCircleStudent } = await import("@/server/circles.server");
    const { tahfeezStudentsData } = await import("@/server/tahfeez.server");
    setUser(amir);
    const c = await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة النور" });
    const circleId = (c as { id: string }).id;
    const st = await addCircleStudent({ circleId, name: "أحمد الجسر" });
    // في وحدة التحفيظ مباشرة
    const twin = (await db.select().from(schema.tahfeezCircles).where(eq(schema.tahfeezCircles.id, `tc-${circleId}`)).all())[0];
    let ts = await tahfeezStudentsData(twin.id);
    expect(ts.map((s) => s.name)).toContain("أحمد الجسر");
    // الإزالة تنعكس
    await removeCircleStudent({ id: (st as { id: string }).id });
    ts = await tahfeezStudentsData(twin.id);
    expect(ts.map((s) => s.name)).not.toContain("أحمد الجسر");
  });

  it("والعكس: طالبُ وحدة التحفيظ يظهر في عدّ سجلّ الحلقات، بلا ازدواجٍ عند تكرار الاسم", async () => {
    const { addTahfeezStudentData } = await import("@/server/tahfeez.server");
    setUser(amir);
    const c = await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة الضحى" });
    const circleId = (c as { id: string }).id;
    await addTahfeezStudentData({ circleId: `tc-${circleId}`, name: "خالد المرآة" });
    const cs = await db.select().from(schema.circleStudents).where(eq(schema.circleStudents.circleId, circleId)).all();
    expect(cs.filter((s) => s.status === "active").map((s) => s.name)).toContain("خالد المرآة");
    // إضافة نفس الاسم من الجهة الأخرى لا تُنشئ ازدواجًا
    const { addCircleStudent } = await import("@/server/circles.server");
    await addCircleStudent({ circleId, name: "خالد المرآة" });
    const ts = await db.select().from(schema.tahfeezStudents).where(eq(schema.tahfeezStudents.status, "active")).all();
    expect(ts.filter((s) => s.studentName === "خالد المرآة").length).toBe(1);
  });
});

describe("مزامنة التوائم (غ٨): التعديل والأرشفة ينعكسان على الامتداد", () => {
  it("تغيير اسم/معلّم حلقة تحفيظٍ يُزامَن لتوأمها، وأرشفتُها تُخفيه من المستهلكين", async () => {
    const { archiveCircle } = await import("@/server/circles.server");
    setUser(amir);
    const c = await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة العصر" });
    const circleId = (c as { id: string }).id;
    // تعيين المعلّم + إعادة التسمية من السجلّ
    await updateCircle({ id: circleId, name: "حلقة العصر الجديدة", teacherPersonId: "p-t" });
    let twin = (await db.select().from(schema.tahfeezCircles).where(eq(schema.tahfeezCircles.id, `tc-${circleId}`)).all())[0];
    expect(twin.name).toBe("حلقة العصر الجديدة");
    expect(twin.teacherPersonId).toBe("p-t");
    expect(twin.status).toBe("active");
    // الأرشفة تُخمل التوأم وتُسقطه من لوحة المسجد والإشراف والترتيب
    await archiveCircle({ id: circleId });
    twin = (await db.select().from(schema.tahfeezCircles).where(eq(schema.tahfeezCircles.id, `tc-${circleId}`)).all())[0];
    expect(twin.status).toBe("archived");
    const { tahfeezData, myTahfeezCirclesData } = await import("@/server/tahfeez.server");
    expect((await tahfeezData("m1")).kpis.circles).toBe(0);
    state.user = makeUser("teacher", "m1", "/men/a/m1/", { personId: "p-t", userId: "u-t", fullName: "الشيخ" });
    expect((await myTahfeezCirclesData()).items.length).toBe(0);
  });

  it("أرشفة/إعادة تسمية حلقة «على بصيرة» تنعكس على حلقة halaqat التوأم", async () => {
    const { archiveCircle } = await import("@/server/circles.server");
    setUser(amir);
    const c = await createCircle({ mosqueId: "m1", type: "ala_baseera", genderTrack: "male", name: "بصيرة المغرب", teacherPersonId: "p-t" });
    const circleId = (c as { id: string }).id;
    await updateCircle({ id: circleId, name: "بصيرة العشاء" });
    let h = (await db.select().from(schema.halaqat).where(eq(schema.halaqat.id, `h-${circleId}`)).all())[0];
    expect(h.name).toBe("بصيرة العشاء");
    await archiveCircle({ id: circleId });
    h = (await db.select().from(schema.halaqat).where(eq(schema.halaqat.id, `h-${circleId}`)).all())[0];
    expect(h.status).toBe("archived");
  });

  it("الحلقة المؤرشفة لا تدخل في تذكيرات الكرون (سجلّ اليوم/الإشراف)", async () => {
    const { archiveCircle } = await import("@/server/circles.server");
    const { overdueCirclesForReminders } = await import("@/server/supervision.server");
    setUser(amir);
    const c = await createCircle({ mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة مؤقّتة", teacherPersonId: "p-t" });
    const circleId = (c as { id: string }).id;
    expect((await overdueCirclesForReminders()).map((i) => i.id)).toContain(`tc-${circleId}`);
    await archiveCircle({ id: circleId });
    expect((await overdueCirclesForReminders()).map((i) => i.id)).not.toContain(`tc-${circleId}`);
  });
});
