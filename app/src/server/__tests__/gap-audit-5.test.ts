// الجولة الخامسة (ط٢) — سلامة البيانات: إعادة تمسير النقل، اشتقاق الجنس، شلال الأرشفة، ذرّيّة المال.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "@/server/database/schema";
import { and, eq } from "drizzle-orm";

let db: TestDb;
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  state.user = admin;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "الذكور", status: "active", createdAt: 0 },
    { id: "sqA", parentId: "men", path: "/men/sqA/", type: "square", section: "men", genderTrack: "male", name: "مربع أ", status: "active", createdAt: 0 },
    { id: "sqB", parentId: "men", path: "/men/sqB/", type: "square", section: "men", genderTrack: "male", name: "مربع ب", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sqA", path: "/men/sqA/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد ١", status: "active", createdAt: 0 },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "الإناث", status: "active", createdAt: 0 },
    { id: "hw", parentId: "women", path: "/women/hw/", type: "halaqa", section: "women", genderTrack: "female", name: "حلقة نساء", status: "active", createdAt: 0 },
  ]).run();
});

describe("ط٢: نقل الوحدة يُعيد تمسير كلّ الأعمدة المنسوخة", () => {
  it("نقل مسجدٍ من مربعٍ لآخر يمسّر assets.org_path وweekly_records.unit_path", async () => {
    await db.insert(schema.assets).values({ id: "as1", kind: "vehicle", name: "سيارة", orgUnitId: "m1", orgPath: "/men/sqA/m1/", holderPersonId: null, holderName: null, status: "active", createdBy: "u-admin", createdAt: 0, updatedAt: 0 } as never).run();
    await db.insert(schema.weeklyRecords).values({ id: "wr1", mosqueId: "m1", mosquePath: "/men/sqA/m1/", unitPath: "/men/sqA/m1/", weekStart: "2026-06-20", schemeId: "s", totalPoints: 0, status: "draft", locked: false, createdAt: 0 } as never).run();
    const { adminMoveOrgUnit } = await import("@/server/admin.server");
    const r = await adminMoveOrgUnit({ id: "m1", newParentId: "sqB" });
    expect("ok" in r && r.ok).toBe(true);
    const as1 = (await db.select().from(schema.assets).where(eq(schema.assets.id, "as1")).all())[0];
    expect(as1.orgPath).toBe("/men/sqB/m1/"); // كان يبقى على مسار sqA (تسريب/اختفاء النطاق)
    const wr1 = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.id, "wr1")).all())[0];
    expect(wr1.unitPath).toBe("/men/sqB/m1/");
    expect(wr1.mosquePath).toBe("/men/sqB/m1/");
  });
});

describe("ط٢: تعديل الوحدة يشتقّ الجنس من القسم (لا يعيد الانفصال)", () => {
  it("محاولةُ ضبط genderTrack=male على حلقة نساء تُبقيه female", async () => {
    const { adminUpdateOrgUnit } = await import("@/server/admin.server");
    await adminUpdateOrgUnit({ id: "hw", name: "حلقة نساء المنار", genderTrack: "male" });
    const hw = (await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, "hw")).all())[0];
    expect(hw.genderTrack).toBe("female"); // مشتقٌّ من section=women رغم تمرير male
    expect(hw.name).toBe("حلقة نساء المنار");
  });
});

describe("ط٢: الأرشفة/الحذف تُنهي التكاليف", () => {
  it("أرشفةُ مسجدٍ تُنهي تكليفَ أميره؛ وحذفُ شخصٍ يُنهي تكاليفه", async () => {
    await db.insert(schema.roleAssignments).values([
      { id: "ra-amir", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/sqA/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
      { id: "ra-x", personId: "p-x", role: "teacher", orgUnitId: "m1", orgPath: "/men/sqA/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    ]).run();
    await db.insert(schema.persons).values({ id: "p-x", fullName: "س", gender: "male", status: "active", createdAt: 0 }).run();
    await db.insert(schema.users).values({ id: "u-x", personId: "p-x", login: "px", passwordHash: "h", sessionEpoch: 0, createdAt: 0 } as never).run();
    const { adminArchiveOrgUnit, adminSetUserStatus } = await import("@/server/admin.server");
    await adminArchiveOrgUnit({ id: "m1" });
    const amir = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.id, "ra-amir")).all())[0];
    expect(amir.endDate).not.toBeNull(); // لم يعد أميرًا لمسجدٍ مؤرشف
    await adminSetUserStatus({ personId: "p-x", status: "deleted", reason: "مغادرة" });
    const rx = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.id, "ra-x")).all())[0];
    expect(rx.endDate).not.toBeNull();
  });
});

describe("ط٢: إعادةُ حساب المستحقّ ذرّيّةٌ (db.batch) وتنتج ترشيحًا سليمًا", () => {
  it("computeMonthlyEntitlement يُنشئ المستحقّ ومساراته في دفعةٍ واحدة", async () => {
    const { computeMonthlyEntitlement } = await import("@/server/services/finance");
    // مستحقٌّ proposed قديمٌ يُعاد بناؤه
    await db.insert(schema.monthlyEntitlements).values({ id: "old", personId: "p-admin", month: "1447-12", grossAmount: 50, currency: "USD", status: "proposed", createdAt: 0 } as never).run();
    await db.insert(schema.entitlementTracks).values({ id: "ot", entitlementId: "old", kind: "fixed", basis: "إدارة", rate: 50, amount: 50, sourceRef: null } as never).run();
    const res = await computeMonthlyEntitlement(db as never, "p-admin", "1447-12", "u-admin");
    // الإدارة العليا لها مسارٌ ثابتٌ (قد يكون صفرًا إن لا معدّل) — المهمّ: صفٌّ واحدٌ جديدٌ لا ازدواج، والقديم أُزيل
    const ents = await db.select().from(schema.monthlyEntitlements).where(and(eq(schema.monthlyEntitlements.personId, "p-admin"), eq(schema.monthlyEntitlements.month, "1447-12"))).all();
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe((res as { id: string }).id);
    expect((res as { status: string }).status).toBe("proposed");
    // لا مساراتٌ يتيمةٌ للقديم
    const orphan = await db.select().from(schema.entitlementTracks).where(eq(schema.entitlementTracks.entitlementId, "old")).all();
    expect(orphan.length).toBe(0);
  });
});
