import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { createSupervisionVisitData, submitSupervisionVisitData, approveSupervisionVisitData, supervisionVisitsData, supervisionDashboardData } from "@/server/supervision.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin", fullName: "المدير" });
const square = makeUser("square", "sq", "/men/aleppo/sq/", { personId: "p-sq", userId: "u-sq", fullName: "مشرف المربع" });
const rabita = makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-ra", userId: "u-ra", fullName: "مسؤول المنطقة" });
const otherSquare = makeUser("square", "sq2", "/men/idlib/sq2/", { personId: "p-sq2", userId: "u-sq2", fullName: "مشرف آخر" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  const now = 0;
  await db.insert(schema.orgUnits).values([
    { id: "aleppo", parentId: null, path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: now },
    { id: "sq", parentId: "aleppo", path: "/men/aleppo/sq/", type: "square", section: "men", genderTrack: "male", name: "مربع المدينة", status: "active", createdAt: now },
    { id: "m1", parentId: "sq", path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: now },
  ]).run();
  // ق1-د: تكليفاتٌ فعليّة — المربعُ يزور حلقةَ مسجده (الأقرب)، والمنطقةُ تعتمد زيارتَه (الأقرب فوقه).
  await db.insert(schema.roleAssignments).values([
    { id: "ra-sq", personId: "p-sq", role: "square", orgUnitId: "sq", orgPath: "/men/aleppo/sq/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-ra", personId: "p-ra", role: "rabita", orgUnitId: "aleppo", orgPath: "/men/aleppo/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  await db.insert(schema.tahfeezCircles).values({ id: "tc1", mosqueId: "m1", name: "حلقة التحفيظ الأولى", teacherPersonId: null, createdAt: now }).run();
});

const mkVisit = () => createSupervisionVisitData({
  circleKind: "tahfeez", circleRefId: "tc1", visitDateHijri: "1447-12-05", monthlyVisitNo: 1,
  studentCount: 15, finalScore: 88, notes: "التزامٌ جيّد",
  details: { quranPlan: 5, teacherMemorization: 4, tajweedPlan: 4, recordsFilling: 5, studentsMorals: 5, attendance: 4, logistics: "يلزم سبورة" },
});

describe("أ — السجل الإشرافيّ على حلقة التحفيظ", () => {
  it("مشرف المربع ينشئ زيارةً (مسودة) بحقولها", async () => {
    setUser(square);
    const r = await mkVisit();
    expect("ok" in r && r.ok).toBe(true);
    const data = await supervisionVisitsData();
    expect(data.mine.length).toBe(1);
    expect(data.mine[0].status).toBe("draft");
    expect(data.mine[0].finalScore).toBe(88);
    expect((data.mine[0].details as { quranPlan: number }).quranPlan).toBe(5);
  });

  it("مشرفٌ خارج نطاق الحلقة لا ينشئ زيارة", async () => {
    setUser(otherSquare);
    const r = await mkVisit();
    expect("error" in r && r.error).toContain("المغطّي");
  });

  it("رفعُ زيارة المربع ⇒ تظهر عند المنطقة (الأقرب فوقه) لا المدير", async () => {
    setUser(square); const c = await mkVisit();
    const id = (c as { id?: string }).id ?? "";
    await submitSupervisionVisitData(id);
    setUser(rabita);
    expect((await supervisionVisitsData()).pending.map((v) => v.id)).toContain(id);
    setUser(admin); // الإدارةُ لا ترى الزيارةَ في الصندوق الروتينيّ (اطّلاعٌ فقط)
    expect((await supervisionVisitsData()).pending.map((v) => v.id)).not.toContain(id);
  });

  it("المشرف لا يعتمد زيارته بنفسه؛ المنطقةُ (الأقرب فوقه) تعتمدها", async () => {
    setUser(square); const c = await mkVisit();
    const id = (c as { id?: string }).id ?? "";
    await submitSupervisionVisitData(id);
    setUser(square);
    const self = await approveSupervisionVisitData(id);
    expect("error" in self && self.error).toBeTruthy();
    setUser(rabita);
    const ok = await approveSupervisionVisitData(id);
    expect("ok" in ok && ok.ok).toBe(true);
    setUser(square);
    expect((await supervisionVisitsData()).mine[0].status).toBe("approved");
  });
});

describe("لوحة الإشراف الميدانيّ — حالة الزيارات", () => {
  it("تصنّف الحلقات: لم تُزَر / متأخّرة / حديثة، وترتّبها بالحاجة", async () => {
    const now = Date.now();
    const DAY = 86_400_000;
    // tc1 موجودةٌ من beforeEach (بلا زيارة) — نُضيف tc2 وtc3
    await db.insert(schema.tahfeezCircles).values([
      { id: "tc2", mosqueId: "m1", name: "حلقة ٢", teacherPersonId: null, createdAt: 0 },
      { id: "tc3", mosqueId: "m1", name: "حلقة ٣", teacherPersonId: null, createdAt: 0 },
    ]).run();
    // زيارةٌ حديثةٌ لـtc1 (قبل ٣ أيّام) ومتأخّرةٌ لـtc2 (قبل ٤٥ يومًا)، وtc3 بلا زيارة
    await db.insert(schema.supervisionVisits).values([
      { id: "vr", circleKind: "tahfeez", circleRefId: "tc1", circleName: "حلقة التحفيظ الأولى", mosqueId: "m1", visitedBy: "u-admin", finalScore: 90, status: "approved", createdAt: now - 3 * DAY, updatedAt: now },
      { id: "vo", circleKind: "tahfeez", circleRefId: "tc2", circleName: "حلقة ٢", mosqueId: "m1", visitedBy: "u-admin", finalScore: 70, status: "approved", createdAt: now - 45 * DAY, updatedAt: now },
    ]).run();
    setUser(admin);
    const d = await supervisionDashboardData();
    const byId = new Map(d.circles.map((c) => [c.id, c]));
    expect(byId.get("tc1")!.status).toBe("recent");
    expect(byId.get("tc1")!.lastScore).toBe(90);
    expect(byId.get("tc2")!.status).toBe("overdue");
    expect(byId.get("tc3")!.status).toBe("never");
    expect(d.summary!.never).toBe(1);
    expect(d.summary!.overdue).toBe(1);
    // الترتيب: never أولًا ثمّ overdue ثمّ recent
    expect(d.circles.map((c) => c.id)).toEqual(["tc3", "tc2", "tc1"]);
  });

  it("تصمد أمام >١٠٠ حلقة (حدّ متغيّرات SQLite في D1)", async () => {
    // regression: قائمة معرّفاتٍ ضخمةٌ في IN كانت تُطلق D1_ERROR: too many SQL variables
    const many = Array.from({ length: 130 }, (_, i) => ({ id: `bulk-${i}`, mosqueId: "m1", name: `حلقة ${i}`, teacherPersonId: null, createdAt: 0 }));
    await db.insert(schema.tahfeezCircles).values(many).run();
    setUser(admin);
    const d = await supervisionDashboardData(); // يجب ألّا يرمي
    expect(d.circles.length).toBeGreaterThanOrEqual(131); // tc1 + 130
    expect(d.circles.every((c) => c.status === "never")).toBe(true);
  });
});
