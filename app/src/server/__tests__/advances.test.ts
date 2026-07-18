// المرحلة ٤ (تكملة) — سُلَفُ الموظّفين: سُلفةٌ تُصرَف (ذمّةٌ مدينة) ثمّ تُستردُّ كخصمٍ شهريٍّ من الراتب. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { grantAdvance, recordRepayment, scheduledRecovery, outstandingAdvances } from "@/server/services/advances";
import { computeNetPay } from "@/server/services/payroll";
import { trialBalance } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.persons).values({ id: "p1", fullName: "الموظّف الأمين", gender: "male", status: "active", createdAt: 0 }).run();
  await db.insert(schema.monthlyEntitlements).values({ id: "ent1", personId: "p1", month: "1447-12", grossAmount: 300, currency: "USD", status: "approved", createdAt: 0 } as never).run();
});

describe("سُلَفُ الموظّفين (TDD)", () => {
  it("منحُ سلفةٍ يُنشئ ذمّةً مدينةً ويُخرج النقد (Dr 1200 / Cr 1110)", async () => {
    await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 25 });
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "1200")?.debit).toBe(10000);  // ذمّةٌ مدينةٌ ١٠٠$
    expect(tb.find((r) => r.accountId === "1110")?.credit).toBe(10000); // نقدٌ خرج ١٠٠$
  });

  it("قسطُ الاستردادِ المجدولُ = القسط الشهريّ (ما لم يتجاوز الرصيد)", async () => {
    await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 25 });
    expect(await scheduledRecovery(db as never, "p1")).toBe(25);
  });

  it("الراتبُ يُخصم منه قسطُ السلفة تلقائيًّا", async () => {
    await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 25 });
    const np = await computeNetPay(db as never, "p1", "1447-12");
    expect(np.advanceRecovery).toBe(25);
    expect(np.net).toBe(275); // ٣٠٠ − ٢٥
  });

  it("الاستردادُ يُنقص الرصيدَ ويُعيد النقد (Dr 1110 / Cr 1200) ويُقفل عند الصفر", async () => {
    const { id } = await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 25 });
    let r = await recordRepayment(db as never, { advanceId: id, amount: 25, month: "1447-12" });
    expect(r.balance).toBe(75); expect(r.settled).toBe(false);
    r = await recordRepayment(db as never, { advanceId: id, amount: 500, month: "1447-13" }); // تسديدُ الباقي دفعةً
    expect(r.balance).toBe(0); expect(r.settled).toBe(true);
    expect(await scheduledRecovery(db as never, "p1")).toBe(0); // لا قسطَ بعد السداد
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "1200")?.balance).toBe(0); // الذمّةُ سُدِّدت: مدين=دائن، الرصيدُ صفر
  });

  it("آخرُ قسطٍ = الرصيدُ المتبقّي فقط (لا يتجاوزه)", async () => {
    await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 40 });
    const adv = (await outstandingAdvances(db as never))[0];
    await recordRepayment(db as never, { advanceId: adv.id, amount: 80, month: "m" });
    expect(await scheduledRecovery(db as never, "p1")).toBe(20); // رصيدٌ ٢٠ والقسطُ ٤٠ ⇒ المجدولُ ٢٠
  });

  it("رفضُ سلفةٍ قسطُها أكبرُ من أصلها أو بمبلغٍ غير موجب", async () => {
    await expect(grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 150 })).rejects.toThrow();
    await expect(grantAdvance(db as never, { personId: "p1", principal: 0, monthlyDeduction: 10 })).rejects.toThrow();
  });
});
