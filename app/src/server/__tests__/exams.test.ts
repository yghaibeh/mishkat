import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { createExamData, publishExamData, myExamsData, examQuestionsData, submitExamData, myCreatedExamsData } from "@/server/exams.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const teacher = { userId: "u-t", personId: "p-t", fullName: "الشيخ", assignments: [{ role: "teacher", orgUnitId: "m1", orgPath: "/men/a/m1/", portfolio: null }] } as FakeUser;
const student = { userId: "u-s", personId: "p-s", fullName: "الطالب أحمد", assignments: [{ role: "student", orgUnitId: "m1", orgPath: "/men/a/m1/", portfolio: null }] } as FakeUser;

const QS = [
  { kind: "mcq" as const, text: "كم عدد أركان الإسلام؟", options: ["ثلاثة", "خمسة", "سبعة"], correct: "1", points: 2 },
  { kind: "tf" as const, text: "الصلاة عماد الدين.", correct: "true", points: 1 },
];

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/a/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 }).run();
  await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "الفجر", teacherPersonId: "p-t", capacity: null, notes: null, status: "active", createdAt: 0 }).run();
  await db.insert(schema.circleStudents).values({ id: "cs1", circleId: "c1", name: "الطالب أحمد", personId: "p-s", notes: null, status: "active", createdAt: 0 }).run();
});

describe("خ — الاختبارات والواجبات", () => {
  it("مسودّةٌ لا يراها الطالب؛ والنشر يُظهرها ويُشعره", async () => {
    setUser(teacher);
    const c = await createExamData({ scopeKind: "circle", scopeId: "c1", kind: "exam", title: "اختبار الأركان", questions: QS });
    expect("ok" in c && c.ok).toBe(true);
    setUser(student);
    expect((await myExamsData()).items.length).toBe(0); // مسودّة
    setUser(teacher);
    const pub = await publishExamData((c as { id: string }).id);
    expect("ok" in pub && pub.ok).toBe(true);
    setUser(student);
    expect((await myExamsData()).items.length).toBe(1);
    const notifs = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "exam_published");
    expect(notifs.map((n) => n.personId)).toEqual(["p-s"]);
  });

  it("أسئلة الطالب بلا إجاباتٍ صحيحة، والتصحيح آليٌّ والتسليم مرّةً واحدة", async () => {
    setUser(teacher);
    const c = await createExamData({ scopeKind: "circle", scopeId: "c1", kind: "exam", title: "اختبار", questions: QS });
    const id = (c as { id: string }).id;
    await publishExamData(id);
    setUser(student);
    const qd = await examQuestionsData(id);
    if ("error" in qd) throw new Error(qd.error);
    expect(qd.questions.length).toBe(2);
    expect(JSON.stringify(qd.questions)).not.toContain("correct");
    // إجابةٌ صحيحةٌ وأخرى خاطئة ⇒ ٢ من ٣
    const sub = await submitExamData({ examId: id, answers: { [qd.questions[0].id]: "1", [qd.questions[1].id]: "false" } });
    expect("ok" in sub && sub.ok).toBe(true);
    expect((sub as { score: number }).score).toBe(2);
    expect((sub as { maxScore: number }).maxScore).toBe(3);
    const again = await submitExamData({ examId: id, answers: {} });
    expect("error" in again && again.error).toContain("سلّمتَ");
    // المنشئ يرى الدرجة
    setUser(teacher);
    const mine = await myCreatedExamsData();
    expect(mine.items[0].submissions[0].score).toBe(2);
  });

  it("انتهاء وقت التسليم يقفل التسليم", async () => {
    setUser(teacher);
    const c = await createExamData({ scopeKind: "circle", scopeId: "c1", kind: "homework", title: "واجبٌ قديم", dueAt: Date.now() - 1000, questions: QS });
    const id = (c as { id: string }).id;
    await publishExamData(id);
    setUser(student);
    const sub = await submitExamData({ examId: id, answers: {} });
    expect("error" in sub && sub.error).toBe("انتهى وقت التسليم");
  });
});
