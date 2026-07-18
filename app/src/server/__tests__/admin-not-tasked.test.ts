// ثابتُ «المدير لا يُكلَّف» (ق1-د + قاعدة المالك الواحد ٣٤) — حارسٌ بنيويّ دائم:
// كلُّ قناةِ تكليفٍ («بانتظارك/تحتاج منك») يجب أن تعود فارغةً للمدير العام في هيكليةٍ
// مكتملة الطبقات؛ نصيبُه الوحيد كسرُ الزجاج عند الشغور. أيُّ قناة تكليفٍ جديدةٍ
// مستقبلاً تُضاف هنا (بروتوكول ٣٧ §٥) — وخرقُها يُفشل البناء.
// القاعدة الحرجة: معرّفات fixtures = مقاطع المسار (NESSA يعتمد عليها).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  // هيكلية مكتملة الطبقات: منطقة ← مربع ← مسجد، وكلٌّ له مكلَّفه (لا شاغر ⇒ لا كسر زجاج)
  await db.insert(schema.orgUnits).values([
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة", status: "active", createdAt: 0 },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", section: "men", genderTrack: "male", name: "مربع", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([
    { id: "p-r", fullName: "مسؤول المنطقة", gender: "male", createdAt: 0 },
    { id: "p-s", fullName: "مسؤول المربع", gender: "male", createdAt: 0 },
    { id: "p-a", fullName: "الأمير", gender: "male", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-r", personId: "p-r", role: "rabita", orgUnitId: "r1", orgPath: "/men/r1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-s", personId: "p-s", role: "square", orgUnitId: "sq1", orgPath: "/men/r1/sq1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-a", personId: "p-a", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  // عملٌ معلّقٌ من كل نوع — لو تسرّبت قناةٌ للمدير لالتقطته
  await db.insert(schema.weeklyRecords).values({
    id: "w1", mosqueId: "m1", mosquePath: "/men/r1/sq1/m1/", unitId: "m1", unitPath: "/men/r1/sq1/m1/",
    weekStart: "2026-07-11", hijriMonth: "1448-01", schemeId: "s1", totalPoints: 40, status: "amir_approved", locked: false, lastEntryAt: 1, createdAt: 0,
  }).run();
  await db.insert(schema.supervisionVisits).values({
    id: "v1", circleKind: "tahfeez", circleRefId: "tc1", circleName: "حلقة", mosqueId: "m1",
    visitedBy: "u-s", submitterPath: "/men/r1/sq1/", status: "submitted", createdAt: 0, updatedAt: 0,
  } as never).run();
  setUser(admin);
});

describe("ثابت: المدير العام لا تصله أي قناة تكليف روتينية", () => {
  it("لا تقارير بانتظار اعتماده (NESSA للطبقة الأقرب)", async () => {
    const { pendingApprovalsData } = await import("@/server/data.server");
    expect((await pendingApprovalsData()).items).toEqual([]);
  });

  it("لا زيارات بانتظار اعتماده", async () => {
    const { supervisionVisitsData } = await import("@/server/supervision.server");
    expect((await supervisionVisitsData()).pending).toEqual([]);
  });

  it("لا بطاقات تكليف زيارات/اعتمادات في «مهامّي»", async () => {
    const { myTasksSummaryData } = await import("@/server/myTasks.server");
    const keys = (await myTasksSummaryData()).cards.map((c) => c.key);
    for (const k of ["supervision", "visit-approvals", "report-approvals"]) expect(keys).not.toContain(k);
  });

  it("لا زر «تقديم للاعتماد» له على أي وحدة", async () => {
    const { layerReportStatusData } = await import("@/server/data.server");
    expect((await layerReportStatusData("r1")).applicable).toBe(false);
  });

  it("طلبات الانضمام: لا يرى ما له مالكٌ أقرب", async () => {
    await db.insert(schema.registrationRequests).values({
      id: "rq1", kind: "student", fullName: "طالب", gender: "male", login: "st1", passwordHash: "x",
      targetUnitId: "m1", targetPath: "/men/r1/sq1/m1/", status: "pending", createdAt: 0,
    } as never).run();
    const { pendingRegistrationsData } = await import("@/server/registration.server");
    expect((await pendingRegistrationsData()).items).toEqual([]);
  });

  it("لا «زياراتي» للمدير حتى لو عَلِقت به زيارات بيانات قديمة", async () => {
    await db.insert(schema.supervisionVisits).values({
      id: "v-old", circleKind: "tahfeez", circleRefId: "tc9", circleName: "حلقة", mosqueId: "m1",
      visitedBy: "u-admin", status: "approved", createdAt: 0, updatedAt: 0,
    } as never).run();
    const { supervisionVisitsData } = await import("@/server/supervision.server");
    expect((await supervisionVisitsData()).mine).toEqual([]);
  });
});
