// المرحلة ٤ — الرواتب: بدلاتٌ/خصوماتٌ فيصير الصافي ≠ الإجماليّ + كشفُ راتب. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { addAdjustment, computeNetPay, payslip } from "@/server/services/payroll";
import * as schema from "@/server/database/schema";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.persons).values({ id: "p1", fullName: "الموظّف الأمين", gender: "male", status: "active", createdAt: 0 }).run();
  // مستحقٌّ إجماليٌّ ٣٠٠ لشهرٍ
  await db.insert(schema.monthlyEntitlements).values({ id: "ent1", personId: "p1", month: "1447-12", grossAmount: 300, currency: "USD", status: "approved", createdAt: 0 } as never).run();
});

describe("تعديلاتُ الراتب (TDD)", () => {
  it("الصافي = الإجماليّ + البدلات − الخصومات", async () => {
    await addAdjustment(db as never, { personId: "p1", month: "1447-12", kind: "allowance", amount: 50, note: "بدل مواصلات" });
    await addAdjustment(db as never, { personId: "p1", month: "1447-12", kind: "deduction", amount: 20, note: "خصم غياب" });
    const np = await computeNetPay(db as never, "p1", "1447-12");
    expect(np.gross).toBe(300);
    expect(np.allowances).toBe(50);
    expect(np.deductions).toBe(20);
    expect(np.net).toBe(330); // ٣٠٠+٥٠−٢٠
  });

  it("الصافي لا ينزل تحت الصفر", async () => {
    await addAdjustment(db as never, { personId: "p1", month: "1447-12", kind: "deduction", amount: 500 });
    const np = await computeNetPay(db as never, "p1", "1447-12");
    expect(np.net).toBe(0);
  });

  it("بلا تعديلاتٍ: الصافي = الإجماليّ (توافقٌ خلفيّ)", async () => {
    const np = await computeNetPay(db as never, "p1", "1447-12");
    expect(np.net).toBe(300);
    expect(np.allowances).toBe(0);
    expect(np.deductions).toBe(0);
  });

  it("كشفُ الراتب يضمّ الاسمَ والبنودَ والصافي", async () => {
    await addAdjustment(db as never, { personId: "p1", month: "1447-12", kind: "allowance", amount: 40, note: "بدل سكن" });
    const ps = await payslip(db as never, "p1", "1447-12");
    expect(ps.personName).toBe("الموظّف الأمين");
    expect(ps.month).toBe("1447-12");
    expect(ps.gross).toBe(300);
    expect(ps.net).toBe(340);
    expect(ps.items.some((i) => i.kind === "allowance" && i.amount === 40)).toBe(true);
  });
});
