// «الصندوق» الهرمي (ق-د٢ + الوثيقة ٣٩ §٦-٩) — خدمة العملية الموحدة بأسطر عملات.
// القاعدة الحرجة: معرّفات fixtures = مقاطع المسار (NESSA يعتمد عليها).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import * as schema from "@/server/database/schema";
import { receiveToBox, spendFromBox, handoverDown, acknowledgeHandover, boxBalances } from "@/server/services/unitBox";

let db: TestDb;
const NOW = 1_800_000_000_000;

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة", status: "active", createdAt: 0 },
    { id: "m1", parentId: "r1", path: "/men/r1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 },
    { id: "r2", parentId: null, path: "/men/r2/", type: "rabita", section: "men", genderTrack: "male", name: "أخرى", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([{ id: "p-r1", fullName: "أمين حلب", gender: "male", createdAt: 0 }]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-r1", personId: "p-r1", role: "rabita", orgUnitId: "r1", orgPath: "/men/r1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  await db.insert(schema.users).values([{ id: "u-r1", personId: "p-r1", login: "r1", passwordHash: "x", createdAt: 0 }]).run();
  // عملة أجنبية بسعرها (الليرة السورية: حساب نقدها 1115، السعر 0.0001$)
  await db.insert(schema.currencies).values([
    { code: "USD", name: "دولار", symbol: "$", isBase: true, cashAccount: "1110", active: true, sortOrder: 0 },
    { code: "SYP", name: "ليرة سورية", symbol: "ل.س", isBase: false, cashAccount: "1115", active: true, sortOrder: 1 },
  ]).onConflictDoNothing().run();
  await db.insert(schema.fxRates).values([{ id: "fx1", currency: "SYP", rateToBase: 0.0001, effectiveAt: NOW, createdBy: null, createdAt: NOW }]).onConflictDoNothing().run();
});

describe("قبض متعدد العملات إلى صندوق وحدة", () => {
  it("تبرع بعملتين في عملية واحدة يرفع رصيد الصندوق بكل عملة", async () => {
    const r = await receiveToBox(db, { unitId: "m1", fundId: "general", lines: [
      { currency: "USD", amount: 50 }, { currency: "SYP", amount: 200_000 },
    ], memo: "تبرع جمعة", createdBy: "u-r1" });
    expect(r.entryId).toBeTruthy();
    const b = await boxBalances(db, "m1");
    expect(b.find((x) => x.currency === "USD")?.amount).toBe(50);
    expect(b.find((x) => x.currency === "SYP")?.amount).toBe(200_000);
    // صندوق آخر لا يتأثر (البُعد النطاقي)
    expect((await boxBalances(db, "r1")).length).toBe(0);
  });
});

describe("التسليم بطرفين + إقرار الاستلام", () => {
  it("تسليم المركز لمنطقة: ينقص الأول ويزيد الثاني بقيد واحد، ويُقرّ أمين المستلمة وحده", async () => {
    await receiveToBox(db, { unitId: "root", fundId: "general", lines: [{ currency: "USD", amount: 1000 }], createdBy: "u-c" });
    const h = await handoverDown(db, { fromUnitId: "root", toUnitId: "r1", purpose: "salaries", lines: [{ currency: "USD", amount: 400 }], deliveredBy: "u-c" });
    expect((await boxBalances(db, "root")).find((x) => x.currency === "USD")?.amount).toBe(600);
    expect((await boxBalances(db, "r1")).find((x) => x.currency === "USD")?.amount).toBe(400);
    // غير أمين الوحدة لا يُقرّ
    await expect(acknowledgeHandover(db, h.id, "u-x")).rejects.toThrow();
    const ok = await acknowledgeHandover(db, h.id, "u-r1");
    expect(ok.status).toBe("acknowledged");
  });

  it("لا تسليم لغير وحدة تحت المُسلِّم (سلسلة العهدة تتبع الشجرة)", async () => {
    await expect(handoverDown(db, { fromUnitId: "r1", toUnitId: "r2", purpose: "operations", lines: [{ currency: "USD", amount: 10 }], deliveredBy: "u-r1" })).rejects.toThrow();
  });
});

describe("الصرف بفئة مغلقة + ربط الاستحقاق (لا دفع مرتين)", () => {
  it("صرف راتب مربوط بمعرف الاستحقاق يوسمه مدفوعاً ويمنع تكراره، والفئة المجهولة تُرفض", async () => {
    await db.insert(schema.expenseCategories).values([{ key: "salaries", label: "رواتب", active: true, sort: 1 }]).onConflictDoNothing().run();
    await db.insert(schema.monthlyEntitlements).values([{ id: "ent1", personId: "p-t", month: "1448-02", grossAmount: 56, currency: "USD", status: "approved", createdAt: 0 }]).run();
    await receiveToBox(db, { unitId: "m1", fundId: "general", lines: [{ currency: "USD", amount: 100 }], createdBy: "u-r1" });

    await expect(spendFromBox(db, { unitId: "m1", fundId: "general", category: "unknown_cat", lines: [{ currency: "USD", amount: 5 }], createdBy: "u-r1" })).rejects.toThrow();

    await spendFromBox(db, { unitId: "m1", fundId: "general", category: "salaries", lines: [{ currency: "USD", amount: 56 }], entitlementId: "ent1", createdBy: "u-r1" });
    const ent = (await db.select().from(schema.monthlyEntitlements).all())[0];
    expect(ent.status).toBe("paid");
    expect((await boxBalances(db, "m1")).find((x) => x.currency === "USD")?.amount).toBe(44);
    // لا دفع مرتين
    await expect(spendFromBox(db, { unitId: "m1", fundId: "general", category: "salaries", lines: [{ currency: "USD", amount: 56 }], entitlementId: "ent1", createdBy: "u-r1" })).rejects.toThrow();
  });
});

describe("الرواتب تسليمات هرمية (٣٩ §٩)", () => {
  it("خطة الشهر تجمع المستحقات بالمناطق، والتوزيع ينشئ تسليماً لكل منطقة ولا يتكرر", async () => {
    const { salariesPlan, distributeSalaries } = await import("@/server/services/unitBox");
    await db.insert(schema.persons).values([{ id: "p-t1", fullName: "معلم", gender: "male", homeOrgUnitId: "m1", createdAt: 0 }]).run();
    await db.insert(schema.monthlyEntitlements).values([
      { id: "e1", personId: "p-t1", month: "1448-02", grossAmount: 56, currency: "USD", status: "approved", createdAt: 0 },
      { id: "e2", personId: "p-r1", month: "1448-02", grossAmount: 100, currency: "USD", status: "approved", createdAt: 0 },
    ]).run();
    const plan = await salariesPlan(db, "1448-02");
    const r1 = plan.regions.find((r) => r.unitId === "r1");
    expect(r1?.usd).toBe(56); // p-t1 بيته m1 تحت r1؛ وp-r1 بلا home ⇒ «بلا وحدة»
    await receiveToBox(db, { unitId: "root", fundId: "general", lines: [{ currency: "USD", amount: 500 }], createdBy: "u-c" });
    const d = await distributeSalaries(db, "1448-02", "u-c");
    expect(d.created).toBe(1);
    expect((await boxBalances(db, "r1")).find((x) => x.currency === "USD")?.amount).toBe(56);
    await expect(distributeSalaries(db, "1448-02", "u-c")).rejects.toThrow(); // لا توزيع مرتين
  });
});
