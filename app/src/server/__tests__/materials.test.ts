import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { myLibraryData, markMaterialOpenedData, markMaterialCompletedData, createMaterialData, materialTrackingData } from "@/server/materials.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin", fullName: "المدير" });
const amir = makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir", userId: "u-amir", fullName: "أمير النور" });
const amir2 = makeUser("amir", "m2", "/men/idlib/sq2/m2/", { personId: "p-amir2", userId: "u-amir2", fullName: "أمير إدلب" });
const rabita = makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-rab", userId: "u-rab", fullName: "مسؤول حلب" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "m1", parentId: null, path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 },
    { id: "m2", parentId: null, path: "/men/idlib/sq2/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد إدلب", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([
    { id: "p-amir", fullName: "أمير النور", gender: "male", status: "active", createdAt: 0 },
    { id: "p-amir2", fullName: "أمير إدلب", gender: "male", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra1", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra2", personId: "p-amir2", role: "amir", orgUnitId: "m2", orgPath: "/men/idlib/sq2/m2/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
});

describe("ت — المكتبة التدريبيّة وتتبّع الإنجاز", () => {
  it("الإدارة تنشئ مادّةً؛ وغيرُ الإدارة لا ينشئ", async () => {
    setUser(amir);
    const denied = await createMaterialData({ title: "كتاب التوحيد", category: "aqeedah", kind: "pdf", r2Key: "materials/x.pdf", audience: "amir", mandatory: true });
    expect("error" in denied && denied.error).toBeTruthy();
    setUser(admin);
    const ok = await createMaterialData({ title: "كتاب التوحيد", category: "aqeedah", kind: "pdf", r2Key: "materials/x.pdf", audience: "amir", mandatory: true });
    expect("ok" in ok && ok.ok).toBe(true);
  });

  it("مكتبتي: تُختم «الاستلام» أوّلَ عرض، ولا تظهر مادّةُ جمهورٍ آخر", async () => {
    setUser(admin);
    await createMaterialData({ title: "للأمراء", category: "admin_training", kind: "pdf", r2Key: "materials/a.pdf", audience: "amir", mandatory: true });
    await createMaterialData({ title: "للمعلّمين", category: "tarbiya", kind: "pdf", r2Key: "materials/t.pdf", audience: "teacher", mandatory: false });
    setUser(amir);
    const lib = await myLibraryData();
    if ("error" in lib) throw new Error(lib.error);
    expect(lib.items.map((i) => i.title)).toEqual(["للأمراء"]);
    expect(lib.items[0].deliveredAt).toBeTruthy(); // اسْتُلمت آليًّا
    expect(lib.items[0].url).toBe("/media/materials/a.pdf");
  });

  it("خطّ الزمن: فتحٌ ثم إقرارُ إنجاز (والإنجاز يختم الفتح إن غاب)", async () => {
    setUser(admin);
    const c = await createMaterialData({ title: "الفقه الميسّر", category: "fiqh", kind: "pdf", r2Key: "materials/f.pdf", audience: "amir", mandatory: true });
    const id = (c as { id: string }).id;
    setUser(amir);
    await markMaterialOpenedData(id);
    await markMaterialCompletedData(id);
    const p = (await db.select().from(schema.materialProgress).where(eq(schema.materialProgress.personId, "p-amir")).all())[0];
    expect(p.openedAt).toBeTruthy();
    expect(p.completedAt).toBeTruthy();
    // إقرارٌ مباشرٌ بلا فتحٍ مسبق يختم الاثنين
    setUser(admin);
    const c2 = await createMaterialData({ title: "السيرة", category: "seerah", kind: "pdf", r2Key: "materials/s.pdf", audience: "amir", mandatory: true });
    setUser(amir);
    await markMaterialCompletedData((c2 as { id: string }).id);
    const p2 = (await db.select().from(schema.materialProgress).where(eq(schema.materialProgress.personId, "p-amir")).all())
      .find((x) => x.materialId === (c2 as { id: string }).id)!;
    expect(p2.openedAt).toBeTruthy();
    expect(p2.completedAt).toBeTruthy();
  });

  it("مصفوفة المتابعة: عزل النطاق — مسؤول حلب يرى أمير حلب دون أمير إدلب", async () => {
    setUser(admin);
    const c = await createMaterialData({ title: "دليل الأمير", category: "admin_training", kind: "pdf", r2Key: "materials/d.pdf", audience: "amir", mandatory: true });
    const id = (c as { id: string }).id;
    setUser(amir); // يستلم ويُنجز
    await myLibraryData();
    await markMaterialCompletedData(id);
    setUser(rabita);
    const t = await materialTrackingData();
    if ("error" in t) throw new Error(t.error);
    expect(t.rows.map((r) => r.personId)).toEqual(["p-amir"]);
    expect(t.rows[0].perMaterial[0].state).toBe("completed");
    setUser(admin);
    const tAll = await materialTrackingData();
    if ("error" in tAll) throw new Error(tAll.error);
    expect(tAll.rows.map((r) => r.personId).sort()).toEqual(["p-amir", "p-amir2"]);
    // أمير إدلب لم يستلم بعد ⇒ none
    expect(tAll.rows.find((r) => r.personId === "p-amir2")!.perMaterial[0].state).toBe("none");
  });
});
