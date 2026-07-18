// اختبارات «الرئيسية» (home.server) — المواصفتان product/ui/home-admin.md وhome-amir.md
// القاعدة الحرِجة: معرّفات fixtures = مقاطع المسار (NESSA يعتمد عليها).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { adminHomeData, amirHomeData, supervisorHomeData, homeData } from "@/server/home.server";
import { weekStartSaturday } from "@/server/utils/week";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin" });
const NOW = new Date("2026-07-15T10:00:00Z");
const THIS_WEEK = weekStartSaturday(NOW);
const PREV_WEEK = weekStartSaturday(new Date(NOW.getTime() - 7 * 86_400_000));

const rec = (id: string, mosqueId: string, path: string, weekStart: string, points: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, mosqueId, mosquePath: path, unitId: mosqueId, unitPath: path, weekStart,
  hijriMonth: "1448-01", schemeId: "s1", totalPoints: points, status, locked: false, lastEntryAt: 1, createdAt: 0, ...extra,
});

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: 0 },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", section: "men", genderTrack: "male", name: "مربع المدينة", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 },
    { id: "m2", parentId: "sq1", path: "/men/r1/sq1/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد الهدى", status: "active", createdAt: 0 },
    { id: "r2", parentId: null, path: "/men/r2/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة إدلب", status: "active", createdAt: 0 },
    { id: "m3", parentId: "r2", path: "/men/r2/m3/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد إدلب", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([
    { id: "p-r1", fullName: "قائد حلب", gender: "male", createdAt: 0 },
    { id: "p-amir", fullName: "أمير النور", gender: "male", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-r1", personId: "p-r1", role: "rabita", orgUnitId: "r1", orgPath: "/men/r1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-sq1", personId: "p-sq1", role: "square", orgUnitId: "sq1", orgPath: "/men/r1/sq1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-am", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: NOW.getTime() },
  ]).run();
  await db.insert(schema.pointsSchemes).values([{ id: "s1", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true }]).run();
});

describe("adminHomeData — صحة الشبكة والاستثناءات والقرارات", () => {
  it("يحسب الإدخال الحقيقي هذا الأسبوع مقابل الماضي والسلاسل المتعطلة", async () => {
    setUser(admin);
    await db.insert(schema.weeklyRecords).values([
      rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 40, "draft"),
      rec("w2", "m3", "/men/r2/m3/", PREV_WEEK, 30, "layer_approved"),
      // مُقدَّمٌ متعطّلٌ منذ ٨ أيام (تصعيد)
      rec("w3", "m2", "/men/r1/sq1/m2/", PREV_WEEK, 50, "amir_approved", { amirApprovedAt: NOW.getTime() - 8 * 86_400_000 }),
    ]).run();
    const d = await adminHomeData(NOW);
    expect(d).not.toBeNull();
    expect(d!.health.mosquesTotal).toBe(3);
    expect(d!.health.entered).toBe(1);       // m1 فقط هذا الأسبوع
    expect(d!.health.enteredPrev).toBe(2);   // m3 وm2 الأسبوع الماضي
    expect(d!.health.chainsPending).toBe(1); // w3
    expect(d!.health.chainsStuck).toBe(1);   // تجاوز ٧ أيام
    expect(d!.decisions.financeProposals).toBe(0);
  });

  it("الاستثناءات: المناطق غير المكتملة مرتبةً من الأسوأ ومعها اسم القائد", async () => {
    setUser(admin);
    await db.insert(schema.weeklyRecords).values([rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 40, "draft")]).run();
    const d = await adminHomeData(NOW);
    // r2: 0/1 أسوأ من r1: 1/2
    expect(d!.exceptions.map((e) => e.unitId)).toEqual(["r2", "r1"]);
    expect(d!.exceptions[1]).toMatchObject({ name: "منطقة حلب", mosques: 2, entered: 1, leaderName: "قائد حلب" });
  });

  it("يعدّ مقترحات المسؤول المالي المعلقة ضمن «ينتظر قراري»", async () => {
    setUser(admin);
    await db.insert(schema.financeActions).values([
      { id: "fa1", kind: "expense", payload: "{}", summary: "مصروف", amountUsd: 10, status: "pending", proposedBy: "u-f", proposedAt: 0, createdAt: 0, clientUuid: "cu1" },
      { id: "fa2", kind: "expense", payload: "{}", summary: "منفذ", amountUsd: 10, status: "executed", proposedBy: "u-f", proposedAt: 0, createdAt: 0, clientUuid: "cu2" },
    ]).run();
    const d = await adminHomeData(NOW);
    expect(d!.decisions.financeProposals).toBe(1);
  });

  it("غير المدير لا يصل", async () => {
    setUser(makeUser("rabita", "r1", "/men/r1/"));
    expect(await adminHomeData(NOW)).toBeNull();
  });
});

describe("amirHomeData — نقاط الأسبوع الحقيقية وسلسلة الاعتماد", () => {
  const amir = makeUser("amir", "m1", "/men/r1/sq1/m1/", { personId: "p-amir" });

  it("نقاط الأسبوع من السجل الفعلي (لا ثابت وهمي) والهدف من المخطط", async () => {
    setUser(amir);
    await db.insert(schema.weeklyRecords).values([
      rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 41, "draft"),
      rec("w0", "m1", "/men/r1/sq1/m1/", PREV_WEEK, 60, "layer_approved"),
    ]).run();
    const d = await amirHomeData(NOW);
    expect(d).toMatchObject({ role: "amir", mosqueName: "مسجد النور" });
    expect(d!.week).toMatchObject({ points: 41, target: 70, weekStart: THIS_WEEK });
    expect(d!.month.points).toBe(101); // مجموع الشهر الهجري الحقيقي
    expect(d!.chain.state).toBe("draft");
  });

  it("سلسلة الاعتماد: المُقدَّم يعرف معتمِده الأقرب (NESSA = المربع)", async () => {
    setUser(amir);
    await db.insert(schema.weeklyRecords).values([rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 55, "amir_approved")]).run();
    const d = await amirHomeData(NOW);
    expect(d!.chain).toMatchObject({ state: "submitted", approverName: "مربع المدينة" });
  });

  it("الأسبوع المرفوض يحمل سببه؛ ولا سجل = none", async () => {
    setUser(amir);
    const d0 = await amirHomeData(NOW);
    expect(d0!.chain.state).toBe("none");
    await db.insert(schema.weeklyRecords).values([
      rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 10, "draft", { rejectionReason: "نقص التوثيق" }),
    ]).run();
    const d = await amirHomeData(NOW);
    expect(d!.chain).toMatchObject({ state: "rejected", reason: "نقص التوثيق" });
  });

  it("الاستحقاق يظهر فقط إذا وُجد سطره الشهري (لا تقديرات)", async () => {
    setUser(amir);
    await db.insert(schema.weeklyRecords).values([rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 41, "draft")]).run();
    expect((await amirHomeData(NOW))!.month.entitlement).toBeNull();
    await db.insert(schema.monthlyEntitlements).values([
      { id: "e1", personId: "p-amir", month: "1448-01", grossAmount: 50, currency: "USD", status: "approved", createdAt: 0 },
    ]).run();
    expect((await amirHomeData(NOW))!.month.entitlement).toMatchObject({ amount: 50, status: "approved" });
  });
});

describe("supervisorHomeData — قائمة عمل المشرف (ع٢–ع٤)", () => {
  const sq = makeUser("square", "sq1", "/men/r1/sq1/", { personId: "p-sq1" });

  it("حالة الوحدات المباشرة هذا الأسبوع: لم يُدخل/مسودة/قُدّم/مرفوض", async () => {
    setUser(sq);
    await db.insert(schema.weeklyRecords).values([
      rec("w1", "m1", "/men/r1/sq1/m1/", THIS_WEEK, 40, "amir_approved"),
      rec("w2", "m2", "/men/r1/sq1/m2/", THIS_WEEK, 5, "draft", { rejectionReason: "نقص" }),
    ]).run();
    const d = await supervisorHomeData(NOW);
    expect(d).toMatchObject({ role: "supervisor", supervisorRole: "square", unitName: "مربع المدينة" });
    expect(d!.children.total).toBe(2);
    expect(d!.children.entered).toBe(2);
    const st = Object.fromEntries(d!.children.items.map((i) => [i.id, i.state]));
    expect(st).toEqual({ m1: "submitted", m2: "rejected" });
    // بانتظار اعتمادي: m1 قُدِّم وأنا الأقرب (NESSA)
    expect(d!.pendingApprovals.map((p) => p.unitId)).toEqual(["m1"]);
  });

  it("لا إدخال إطلاقاً: كل الوحدات none والتقرير بلا زر تقديم (points=0)", async () => {
    setUser(sq);
    const d = await supervisorHomeData(NOW);
    expect(d!.children.entered).toBe(0);
    expect(d!.children.items.every((i) => i.state === "none")).toBe(true);
    if (d!.layerReport) expect(d!.layerReport.points).toBe(0);
  });
});

describe("homeData — الموزّع", () => {
  it("يوجّه المدير والأمير لعدستيهما والبقية لبطاقات مهامّي", async () => {
    setUser(admin);
    expect((await homeData())!.role).toBe("admin");
    setUser(makeUser("amir", "m1", "/men/r1/sq1/m1/", { personId: "p-amir" }));
    expect((await homeData())!.role).toBe("amir");
    setUser(makeUser("rabita", "r1", "/men/r1/"));
    expect((await homeData())!.role).toBe("supervisor");
    setUser(makeUser("teacher", "m1", "/men/r1/sq1/m1/"));
    expect(await homeData()).toMatchObject({ role: "redirect", to: "/my-circles" });
    setUser(makeUser("student", "m1", "/men/r1/sq1/m1/"));
    expect((await homeData())!.role).toBe("student"); // عدسة الطالب (ع١٠) — كانت غائبة
  });
});

describe("قاعدة المالك الواحد (ق1-د المعمّمة) — الإدارة اطّلاع لا تشغيل", () => {
  it("المدير لا يُكلَّف بتقديم تقرير وحدةٍ ولا تُدفع له بطاقة زيارات", async () => {
    setUser(admin);
    const { layerReportStatusData } = await import("@/server/data.server");
    expect((await layerReportStatusData("r1")).applicable).toBe(false); // كان يظهر له زر «تقديم للاعتماد»
    const { myTasksSummaryData } = await import("@/server/myTasks.server");
    const cards = (await myTasksSummaryData()).cards;
    expect(cards.find((c) => c.key === "supervision")).toBeUndefined(); // «تحتاج زيارتك» ليست للمدير
  });

  it("صاحب التكليف على الوحدة يبقى قادرًا على تقريرها", async () => {
    setUser(makeUser("rabita", "r1", "/men/r1/", { personId: "p-r1" }));
    const { layerReportStatusData } = await import("@/server/data.server");
    expect((await layerReportStatusData("r1")).applicable).toBe(true);
  });
});
