// المرحلة ٠ (تكملة) — ردمُ الدفتر من الحركات التاريخيّة. TDD (الاختبارُ قبل التنفيذ).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { backfillLedger } from "@/server/services/ledgerBackfill";
import { fundBalances, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 }).run();
  await db.insert(schema.assets).values({ id: "as1", kind: "vehicle", name: "سيارة", orgUnitId: "m1", orgPath: "/men/m1/", holderPersonId: null, holderName: null, status: "active", createdBy: "u", createdAt: 0, updatedAt: 0 } as never).run();
});

describe("ردمُ الدفتر من التاريخ (TDD)", () => {
  it("يُرحّل التبرّعات والمصروفات والرواتب والمحروقات القائمة", async () => {
    await db.insert(schema.donations).values({ id: "d1", mosqueId: "m1", donorName: "محسن", amount: 300, collectedBy: "u", approvedByAmir: true, note: null, at: 0 }).run();
    await db.insert(schema.expenses).values({ id: "e1", mosqueId: "m1", category: "كهرباء", amount: 50, spentBy: "u", note: null, at: 0 }).run();
    await db.insert(schema.monthlyEntitlements).values({ id: "ent1", personId: "p", month: "1447-12", grossAmount: 200, currency: "USD", status: "paid", createdAt: 0 } as never).run();
    await db.insert(schema.payouts).values({ id: "pay1", entitlementId: "ent1", netAmount: 200, paidAmount: 200, reference: null, recordedBy: "u", paidAt: 0 } as never).run();
    await db.insert(schema.assetExpenses).values({ id: "ax1", assetId: "as1", month: "2026-07", fuelAmount: 40, otherAmount: 10, note: null, createdBy: "u", createdAt: 0 }).run();

    const res = await backfillLedger(db as never, "u-admin");
    expect(res.donations).toBe(1);
    expect(res.expenses).toBe(1);
    expect(res.payouts).toBe(1);
    expect(res.fuel).toBe(1);

    // رصيدُ الصندوق العامّ = تبرّع ٣٠٠ − مصروف ٥٠ − راتب ٢٠٠ − محروقات ٥٠ = ٠
    const general = (await fundBalances(db as never)).find((f) => f.fundId === "general")!;
    expect(general.balance).toBe(toCents(0));
    // إجماليّ القيود = ٤
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(4);
  });

  it("idempotent: إعادةُ الردم لا تُرحّل ما رُحِّل", async () => {
    await db.insert(schema.donations).values({ id: "d1", mosqueId: "m1", donorName: null, amount: 100, collectedBy: "u", approvedByAmir: true, note: null, at: 0 }).run();
    const r1 = await backfillLedger(db as never, "u");
    expect(r1.donations).toBe(1);
    const r2 = await backfillLedger(db as never, "u"); // إعادة
    expect(r2.donations).toBe(0);
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(1);
  });
});
