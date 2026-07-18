// ك٧ (الوثيقة ٢٩، ق1-د): E2E سلسلةِ الاعتماد الكاملة — كلُّ جهةٍ تعتمد عملَ التي تحتها مباشرةً،
// والإدارةُ العليا تُراقب اطّلاعًا بلا زرٍّ روتينيّ. مسجد → مربع → منطقة → رأس قسم.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { pendingApprovalsData, pendingBreakGlassData, approveMonthForMosque } from "@/server/data.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-adm", userId: "u-adm" });
const amir = makeUser("amir", "m1", "/men/r1/sq1/m1/", { personId: "p-amir", userId: "u-amir" });
const square = makeUser("square", "sq1", "/men/r1/sq1/", { personId: "p-sq", userId: "u-sq" });
const rabita = makeUser("rabita", "r1", "/men/r1/", { personId: "p-ra", userId: "u-ra" });
const sec = makeUser("section_head", "men", "/men/", { personId: "p-sec", userId: "u-sec" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم", status: "active", createdAt: 0 },
    { id: "r1", parentId: "men", path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة", status: "active", createdAt: 0 },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", section: "men", genderTrack: "male", name: "مربع", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 },
  ].map((u) => u as never)).run();
  await db.insert(schema.roleAssignments).values([
    { id: "a-amir", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "a-sq", personId: "p-sq", role: "square", orgUnitId: "sq1", orgPath: "/men/r1/sq1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "a-ra", personId: "p-ra", role: "rabita", orgUnitId: "r1", orgPath: "/men/r1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "a-sec", personId: "p-sec", role: "section_head", orgUnitId: "men", orgPath: "/men/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ].map((u) => u as never)).run();
  await db.insert(schema.pointsSchemes).values({ id: "s", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true } as never).run();
  // سجلُّ مسجدٍ أقرّه الأمير (amir_approved) بانتظار اعتماد الطبقة الأقرب
  await db.insert(schema.weeklyRecords).values({ id: "wr", mosqueId: "m1", mosquePath: "/men/r1/sq1/m1/", unitId: "m1", unitPath: "/men/r1/sq1/m1/", weekStart: "2026-06-27", hijriMonth: "1448-01", schemeId: "s", totalPoints: 80, status: "amir_approved", approvedByAmir: "u-amir", locked: false, lastEntryAt: 10, createdAt: 0 } as never).run();
});

const box = async (u: FakeUser) => { setUser(u); return (await pendingApprovalsData()).items.map((x) => x.unitId); };

describe("E2E — سلسلةُ الاعتماد بالطبقة الأقرب (ق1-د)", () => {
  it("سجلُّ المسجد يظهر عند المربع (الأقرب) فقط — لا المنطقة ولا رأس القسم ولا المدير", async () => {
    expect(await box(square)).toEqual(["m1"]);   // الأقرب
    expect(await box(rabita)).toEqual([]);        // أعلى — لا يُغرَق
    expect(await box(sec)).toEqual([]);
    expect(await box(admin)).toEqual([]);         // الإدارة اطّلاعٌ فقط
    expect((await pendingBreakGlassData()).items).toEqual([]); // لا كسرَ زجاجٍ (الطبقاتُ مُكلَّفة)
  });

  it("المربعُ يعتمد سجلَّ مسجده نهائيًّا (بختمِ اسمه)", async () => {
    setUser(square);
    const r = await approveMonthForMosque("m1");
    expect("advanced" in r && r.advanced).toBe(1);
    const rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.id, "wr")).all())[0];
    expect(rec.status).toBe("layer_approved");
    expect(rec.approvedByLayer).toBe("u-sq");
    // بعد الاعتماد لم يعُد في صندوق أحد
    expect(await box(square)).toEqual([]);
  });

  it("تخطّي الشاغر: فُرِّغ تكليفُ المربع ⇒ المنطقةُ تصير الأقربَ فتراه وتعتمده", async () => {
    await db.update(schema.roleAssignments).set({ endDate: 100 } as never).where(eq(schema.roleAssignments.id, "a-sq")).run();
    expect(await box(square)).toEqual([]);        // لم يعُد مُكلَّفًا
    expect(await box(rabita)).toEqual(["m1"]);     // صارت الأقرب
    setUser(rabita);
    expect("advanced" in (await approveMonthForMosque("m1"))).toBe(true);
  });

  it("كسرُ الزجاج: فُرِّغت كلُّ الطبقات ⇒ الإدارةُ ترى صندوقًا متميّزًا وتعتمد بفعلٍ موثَّق", async () => {
    for (const id of ["a-sq", "a-ra", "a-sec"]) await db.update(schema.roleAssignments).set({ endDate: 100 } as never).where(eq(schema.roleAssignments.id, id)).run();
    expect(await box(admin)).toEqual([]);                       // لا صندوقَ روتينيّ
    setUser(admin);
    expect((await pendingBreakGlassData()).items.map((x) => x.unitId)).toEqual(["m1"]); // الصندوقُ المتميّز
    const r = await approveMonthForMosque("m1");
    expect("advanced" in r && r.advanced).toBe(1);
    // فعلُ التدقيق متميّزٌ رقابيًّا
    const audit = (await db.select().from(schema.auditLog).all()).find((a) => a.action === "admin_breakglass_approve");
    expect(audit).toBeTruthy();
  });
});
