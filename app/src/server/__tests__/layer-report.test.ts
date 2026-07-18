import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { submitLayerReportData, layerReportStatusData, pendingApprovalsData, approveMonthForMosque } from "@/server/data.server";
import { weekStartSaturday } from "@/server/utils/week";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin" });
const WEEK = weekStartSaturday(new Date(Date.now()));

// منطقة حلب ← مسجد النور (بتقريرٍ معتمد 60 نقطة هذا الأسبوع)
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  const now = 0;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور", status: "active", createdAt: now },
    { id: "aleppo", parentId: "men", path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: now },
    { id: "m1", parentId: "aleppo", path: "/men/aleppo/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: now },
  ]).run();
  // ق1-د: رأسُ القسم مُكلَّفٌ فعليًّا ⇒ هو NESSA لحصيلة المنطقة (لا المدير).
  await db.insert(schema.roleAssignments).values({ id: "ra-sec", personId: "p-sec", role: "section_head", orgUnitId: "men", orgPath: "/men/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
  await db.insert(schema.pointsSchemes).values({ id: "s-male", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true }).run();
  await db.insert(schema.weeklyRecords).values({
    id: "wr-m1", mosqueId: "m1", mosquePath: "/men/aleppo/m1/", unitId: "m1", unitPath: "/men/aleppo/m1/",
    weekStart: WEEK, hijriMonth: "1447-12", schemeId: "s-male", totalPoints: 60, status: "layer_approved", locked: true, lastEntryAt: 10, createdAt: 0,
  }).run();
});

const rabita = makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-al" });
const sectionHead = makeUser("section_head", "men", "/men/", { personId: "p-sec", userId: "u-sec" });

describe("ح٢ — تقرير الطبقة: المدير يعتمد تقرير المنطقة", () => {
  it("مسؤول المنطقة يقدّم تقريره بحصيلة نطاقه (٦٠) فيصبح مُقدَّمًا", async () => {
    setUser(rabita);
    const r = await submitLayerReportData("aleppo");
    expect("ok" in r && r.ok).toBe(true);
    expect("rollup" in r && r.rollup).toBe(60);
    const st = await layerReportStatusData("aleppo");
    expect(st.applicable && st.status).toBe("submitted");
    expect(st.applicable && st.rollup).toBe(60);
  });

  it("يظهر في صندوق «بانتظار اعتمادك» عند رأس القسم (الأقرب) لا المدير", async () => {
    setUser(rabita); await submitLayerReportData("aleppo");
    setUser(sectionHead);
    expect((await pendingApprovalsData()).items.map((x) => x.unitId)).toContain("aleppo");
    setUser(admin); // الإدارةُ لا ترى الصندوقَ الروتينيّ ما دام رأسُ القسم مُكلَّفًا
    expect((await pendingApprovalsData()).items.map((x) => x.unitId)).not.toContain("aleppo");
  });

  it("مسؤول المنطقة لا يعتمد تقريره بنفسه (يلزم الأعلى)", async () => {
    setUser(rabita); await submitLayerReportData("aleppo");
    const r = await approveMonthForMosque("aleppo");
    expect("error" in r && r.error).toBeTruthy();
    expect((await layerReportStatusData("aleppo")).status).toBe("submitted");
  });

  it("رأسُ القسم (الأقرب فوق المنطقة) يعتمد تقرير المنطقة نهائيًّا", async () => {
    setUser(rabita); await submitLayerReportData("aleppo");
    setUser(sectionHead);
    const r = await approveMonthForMosque("aleppo");
    expect("advanced" in r && r.advanced).toBeGreaterThan(0);
    // حالةُ سجلّ المنطقة صارت معتمَدةً نهائيًّا (نقرؤها من القاعدة — layerReportStatus مقصورٌ على المالك)
    const rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.unitId, "aleppo")).all())[0];
    expect(rec?.status).toBe("layer_approved");
  });

  it("تقرير الطبقة لا ينطبق على غير المالك أو غير الإشرافيّ", async () => {
    setUser(makeUser("amir", "m1", "/men/aleppo/m1/", { personId: "p-amir" }));
    expect((await layerReportStatusData("aleppo")).applicable).toBe(false); // ليس مالكًا
    setUser(rabita);
    expect((await layerReportStatusData("m1")).applicable).toBe(false);     // المسجد ليس طبقةً إشرافيّة
  });
});
