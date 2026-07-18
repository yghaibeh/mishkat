// E2E ضخم: «الصندوق» الهرمي كاملاً (ق-د٢ + ٣٩ §٦-٩) — من قبض المركز متعدد العملات،
// عبر توزيع الرواتب وسلسلة العهدة (منطقة ← مربع ← مسجد) بإقرارات الاستلام،
// حتى صرف الأمير لراتب معلم مسجده مربوطاً باستحقاقه، ثم الإقفال الشهري المرفوع واعتماده،
// مع توازن الدفتر قرشاً بعد كل ذلك وثوابت الحراسة (لا قفز، لا تكرار، لا غريب يقرّ).
// القاعدة الحرجة: معرّفات fixtures = مقاطع المسار (NESSA يعتمد عليها).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import * as schema from "@/server/database/schema";
import {
  receiveToBox, spendFromBox, handoverDown, acknowledgeHandover, boxBalances,
  subtreeBoxSummary, distributionMap, salariesPlan, distributeSalaries,
  submitBoxClosing, approveBoxClosing, pendingClosingsFor,
} from "@/server/services/unitBox";

let db: TestDb;
const NOW = 1_800_000_000_000;
const MONTH = "1448-02";

const bal = async (unit: string, cur: string) => (await boxBalances(db, unit)).find((x) => x.currency === cur)?.amount ?? 0;

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  // الهيكل: منطقة حلب ← مربع المدينة ← مسجد النور (وأمينُ كلٍّ مكلَّفٌ عليها)
  await db.insert(schema.orgUnits).values([
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: 0 },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", section: "men", genderTrack: "male", name: "مربع المدينة", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([
    { id: "p-r1", fullName: "أمين المنطقة", gender: "male", createdAt: 0 },
    { id: "p-sq1", fullName: "أمين المربع", gender: "male", createdAt: 0 },
    { id: "p-m1", fullName: "أمير النور", gender: "male", createdAt: 0 },
    { id: "p-t", fullName: "معلم على بصيرة", gender: "male", homeOrgUnitId: "m1", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-r1", personId: "p-r1", role: "rabita", orgUnitId: "r1", orgPath: "/men/r1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-sq1", personId: "p-sq1", role: "square", orgUnitId: "sq1", orgPath: "/men/r1/sq1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-m1", personId: "p-m1", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  await db.insert(schema.users).values([
    { id: "u-r1", personId: "p-r1", login: "r1c", passwordHash: "x", createdAt: 0 },
    { id: "u-sq1", personId: "p-sq1", login: "sq1c", passwordHash: "x", createdAt: 0 },
    { id: "u-m1", personId: "p-m1", login: "m1c", passwordHash: "x", createdAt: 0 },
  ]).run();
  await db.insert(schema.currencies).values([
    { code: "USD", name: "دولار", symbol: "$", isBase: true, cashAccount: "1110", active: true, sortOrder: 0 },
    { code: "SYP", name: "ليرة سورية", symbol: "ل.س", isBase: false, cashAccount: "1115", active: true, sortOrder: 1 },
    { code: "TRY", name: "ليرة تركية", symbol: "₺", isBase: false, cashAccount: "1116", active: true, sortOrder: 2 },
  ]).onConflictDoNothing().run();
  await db.insert(schema.fxRates).values([
    { id: "fx-syp", currency: "SYP", rateToBase: 0.0001, effectiveAt: NOW, createdBy: null, createdAt: NOW },
    { id: "fx-try", currency: "TRY", rateToBase: 0.03, effectiveAt: NOW, createdBy: null, createdAt: NOW },
  ]).onConflictDoNothing().run();
  await db.insert(schema.expenseCategories).values([
    { key: "salaries", label: "رواتب", active: true, sort: 1 },
    { key: "fuel", label: "محروقات", active: true, sort: 2 },
  ]).onConflictDoNothing().run();
  // استحقاق المعلم المعتمد (56$ = 28 ساعة × 2$) — بيتُه مسجد النور
  await db.insert(schema.monthlyEntitlements).values([
    { id: "ent-t", personId: "p-t", month: MONTH, grossAmount: 56, currency: "USD", status: "approved", createdAt: 0 },
  ]).run();
});

describe("E2E: من قبض المركز حتى يد المعلم — بثلاث عملات وكل الضمانات", () => {
  it("السلسلة الكاملة: قبض ← توزيع رواتب ← عهدة نازلة بإقرارات ← صرف مربوط ← إقفال معتمد ← دفتر متوازن", async () => {
    // ═══ ١) المركز يقبض تبرعاً بثلاث عملات في عملية واحدة (ق-د٢) ═══
    await receiveToBox(db, { unitId: "root", fundId: "general", lines: [
      { currency: "USD", amount: 1000 }, { currency: "SYP", amount: 5_000_000 }, { currency: "TRY", amount: 3000 },
    ], donorName: "محسن كبير", createdBy: "u-c" });
    expect(await bal("root", "USD")).toBe(1000);
    expect(await bal("root", "SYP")).toBe(5_000_000);
    expect(await bal("root", "TRY")).toBe(3000);

    // ═══ ٢) خطة الرواتب تجمع استحقاق المعلم لمنطقته، والتوزيع ينشئ التسليم ═══
    const plan = await salariesPlan(db, MONTH);
    expect(plan.regions).toEqual([{ unitId: "r1", name: "منطقة حلب", usd: 56, count: 1 }]);
    const dist = await distributeSalaries(db, MONTH, "u-c");
    expect(dist.created).toBe(1);
    expect(await bal("root", "USD")).toBe(944);
    expect(await bal("r1", "USD")).toBe(56);
    await expect(distributeSalaries(db, MONTH, "u-c")).rejects.toThrow(); // لا توزيع مرتين

    // خريطة الدفعة: تسليم واحد بانتظار الإقرار
    let map = await distributionMap(db, dist.batchId);
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ from: "المركز", to: "منطقة حلب", status: "delivered" });

    // ═══ ٣) إقرارات الاستلام: الغريبُ يُرفض، وأمين المنطقة يُقرّ — فالخريطة تتحدث ═══
    await expect(acknowledgeHandover(db, map[0].id, "u-sq1")).rejects.toThrow(); // ليس أمين r1
    await acknowledgeHandover(db, map[0].id, "u-r1");
    map = await distributionMap(db, dist.batchId);
    expect(map[0].status).toBe("acknowledged");

    // ═══ ٤) العهدة تنزل السلسلة: منطقة ← مربع ← مسجد (مع رفض القفز فوق السلسلة) ═══
    await expect(handoverDown(db, { fromUnitId: "sq1", toUnitId: "r1", purpose: "salaries", lines: [{ currency: "USD", amount: 1 }], deliveredBy: "u-sq1" })).rejects.toThrow(); // لا صعود
    const h2 = await handoverDown(db, { fromUnitId: "r1", toUnitId: "sq1", purpose: "salaries", batchId: dist.batchId, lines: [{ currency: "USD", amount: 56 }], deliveredBy: "u-r1" });
    await acknowledgeHandover(db, h2.id, "u-sq1");
    const h3 = await handoverDown(db, { fromUnitId: "sq1", toUnitId: "m1", purpose: "salaries", batchId: dist.batchId, lines: [{ currency: "USD", amount: 56 }], deliveredBy: "u-sq1" });
    await acknowledgeHandover(db, h3.id, "u-m1");
    expect(await bal("r1", "USD")).toBe(0);
    expect(await bal("sq1", "USD")).toBe(0);
    expect(await bal("m1", "USD")).toBe(56);
    // تجميع الشجرة من عين المركز: كل المتبقي عند فرع المنطقة (في مسجدها)
    const sub = await subtreeBoxSummary(db, "/");
    expect(sub.find((x) => x.unitId === "men" || x.unitId === "r1")?.usd ?? sub[0]?.usd).toBeGreaterThanOrEqual(56);

    // ═══ ٥) الأمير يصرف راتب معلمه مربوطاً بالاستحقاق — يُوسم مدفوعاً ولا يُدفع مرتين ═══
    await spendFromBox(db, { unitId: "m1", fundId: "general", category: "salaries", lines: [{ currency: "USD", amount: 56 }], payeeName: "معلم على بصيرة", entitlementId: "ent-t", createdBy: "u-m1" });
    expect(await bal("m1", "USD")).toBe(0);
    expect((await db.select().from(schema.monthlyEntitlements).all())[0].status).toBe("paid");
    await expect(spendFromBox(db, { unitId: "m1", fundId: "general", category: "salaries", lines: [{ currency: "USD", amount: 56 }], entitlementId: "ent-t", createdBy: "u-m1" })).rejects.toThrow();
    // والخطة بعد الدفع لا تعرض المدفوع (approved فقط)
    expect((await salariesPlan(db, MONTH)).regions).toHaveLength(0);

    // ═══ ٦) صرف تشغيلي بعملة أجنبية من المركز (محروقات بالليرة) ═══
    await spendFromBox(db, { unitId: "root", fundId: "general", category: "fuel", lines: [{ currency: "SYP", amount: 1_000_000 }], createdBy: "u-c" });
    expect(await bal("root", "SYP")).toBe(4_000_000);

    // ═══ ٧) الإقفال الشهري: المسجد يقفل ويرفع، مربعُه (الطبقة الأقرب) يعتمد — والغريب لا ═══
    const closing = await submitBoxClosing(db, { unitId: "m1", month: MONTH, submittedBy: "u-m1" });
    expect(closing.summary.received).toEqual([{ currency: "USD", amount: 56 }]);
    expect(closing.summary.spent).toEqual([{ currency: "USD", amount: 56 }]);
    expect(closing.summary.remaining).toEqual([]); // صفر — سلّم كل ما استلم
    await expect(submitBoxClosing(db, { unitId: "m1", month: MONTH, submittedBy: "u-m1" })).rejects.toThrow(); // لا إقفال مرتين
    // يظهر في «إقفالات تنتظر اعتمادي» لأمين المربع (الأقرب) لا لأمين المنطقة
    expect((await pendingClosingsFor(db, "p-sq1")).map((c) => c.unitId)).toContain("m1");
    expect((await pendingClosingsFor(db, "p-r1")).map((c) => c.unitId)).not.toContain("m1");
    await expect(approveBoxClosing(db, closing.id, "u-r1")).rejects.toThrow(); // المنطقة ليست الأقرب
    await approveBoxClosing(db, closing.id, "u-sq1");
    expect((await db.select().from(schema.boxClosings).all())[0].status).toBe("approved");

    // ═══ ٨) نزاهة الدفتر بعد كل شيء: مجموع المدين = مجموع الدائن (قرشاً بقرش) ═══
    const lines = await db.select().from(schema.journalLines).all();
    const debit = lines.reduce((s, l) => s + (l.debitCents ?? 0), 0);
    const credit = lines.reduce((s, l) => s + (l.creditCents ?? 0), 0);
    expect(debit).toBe(credit);
    expect(debit).toBeGreaterThan(0);
    // وكل أسطر النقد موسومة بوحدتها (البُعد النطاقي لا يسقط)
    const cashRows = lines.filter((l) => ["1110", "1115", "1116"].includes(l.accountId));
    expect(cashRows.every((l) => !!l.unitId)).toBe(true);
  });
});

describe("أمانة الصندوق لأدوار العهدة حصراً (تكامل الأدوار)", () => {
  it("المعلم صاحب تكليف على المسجد ليس أميناً؛ والأمير أمين؛ والمدير للمركز فقط", async () => {
    const { boxReceiveData } = await import("@/server/boxes.server");
    const { vi: _ } = await import("vitest");
    // مستخدم معلم بتكليف teacher على m1 — يجب ألا يقبض لصندوق المسجد
    const mk = (role: string, unit: string, path: string, userId: string) => ({
      userId, personId: `p-${userId}`, fullName: "x", caps: [],
      assignments: [{ role, orgUnitId: unit, orgPath: path, portfolio: null }],
    });
    const authMod = await import("@/server/auth.server");
    const spy = vi.spyOn(authMod, "currentUser");
    spy.mockResolvedValue(mk("teacher", "m1", "/men/r1/sq1/m1/", "u-t") as never);
    expect(await boxReceiveData({ unitId: "m1", lines: [{ currency: "USD", amount: 5 }] })).toMatchObject({ error: expect.stringContaining("أمين") });
    spy.mockResolvedValue(mk("amir", "m1", "/men/r1/sq1/m1/", "u-m1") as never);
    expect(await boxReceiveData({ unitId: "m1", lines: [{ currency: "USD", amount: 5 }] })).toMatchObject({ ok: true });
    spy.mockResolvedValue(mk("finance_officer", "root", "/", "u-f") as never);
    expect(await boxReceiveData({ unitId: "root", lines: [{ currency: "USD", amount: 5 }] })).toMatchObject({ error: expect.stringContaining("أمين") });
    spy.mockRestore();
  });
});
