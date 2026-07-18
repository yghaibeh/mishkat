// المرحلة ٦ (تكملة) — بيانُ التدفّق النقديّ: حركةُ النقد ومكافئاته مصنّفةً (تشغيليّ/استثماريّ/تمويليّ). TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { cashFlowStatement } from "@/server/services/statements";
import { postDonation, postExpense } from "@/server/services/ledgerPost";
import { capitalizeAsset, disposeAsset } from "@/server/services/depreciation";
import { openBox } from "@/server/services/pettyCash";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("بيانُ التدفّق النقديّ (TDD)", () => {
  it("يصنّف التبرّعَ والمصروفَ تشغيليًّا، والرسملةَ استثماريًّا", async () => {
    await postDonation(db as never, { id: "d1", amount: 1000 });                                  // تشغيليّ +١٠٠٠
    await postExpense(db as never, { id: "e1", amount: 300, category: "كهرباء" });               // تشغيليّ −٣٠٠
    await capitalizeAsset(db as never, { name: "ح", cost: 500, usefulLifeMonths: 5, startPeriod: "1447-01" }); // استثماريّ −٥٠٠
    const cf = await cashFlowStatement(db as never);
    expect(cf.operating.net).toBe(700);
    expect(cf.investing.net).toBe(-500);
    expect(cf.financing.net).toBe(0);
    expect(cf.netChange).toBe(200);
    expect(cf.cashBalance).toBe(200); // من الصفر: صافي التغيّر = الرصيد
  });

  it("التحويلُ الداخليّ (فتحُ نثريّة) لا يظهر — مكافئُ نقدٍ ↔ نقد", async () => {
    await postDonation(db as never, { id: "d1", amount: 1000 });
    await openBox(db as never, { name: "ن", floatAmount: 200 }); // 1110 → 1130 داخل مجمّع النقد
    const cf = await cashFlowStatement(db as never);
    expect(cf.netChange).toBe(1000); // فتحُ النثريّة صفريُّ الأثر على مجمّع النقد
    expect(cf.cashBalance).toBe(1000);
  });

  it("بيعُ أصلٍ يظهر تدفّقًا استثماريًّا داخلًا", async () => {
    await postDonation(db as never, { id: "d1", amount: 2000 });
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 500, usefulLifeMonths: 5, startPeriod: "1447-01" });
    await disposeAsset(db as never, { fixedAssetId: id, proceeds: 400 });
    const cf = await cashFlowStatement(db as never);
    // استثماريّ = −٥٠٠ (رسملة) + ٤٠٠ (بيع) = −١٠٠
    expect(cf.investing.net).toBe(-100);
    expect(cf.cashBalance).toBe(1900); // ٢٠٠٠ − ٥٠٠ + ٤٠٠
  });

  it("صافي التغيّر = مجموعُ الفئات الثلاث", async () => {
    await postDonation(db as never, { id: "d1", amount: 800 });
    await postExpense(db as never, { id: "e1", amount: 200, category: "ماء" });
    await capitalizeAsset(db as never, { name: "ح", cost: 100, usefulLifeMonths: 5, startPeriod: "1447-01" });
    const cf = await cashFlowStatement(db as never);
    expect(cf.netChange).toBe(cf.operating.net + cf.investing.net + cf.financing.net);
    expect(cf.netChange).toBe(500); // ٨٠٠ − ٢٠٠ − ١٠٠
  });

  it("بلا حركاتٍ: كلُّ شيءٍ صفر", async () => {
    const cf = await cashFlowStatement(db as never);
    expect(cf.netChange).toBe(0);
    expect(cf.cashBalance).toBe(0);
    expect(cf.operating.lines.length).toBe(0);
  });
});
