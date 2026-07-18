// المرحلة ٢ — الموازنة. TDD. الفعليُّ يُقرأ من مصروفات الدفتر (مطابقةٌ بالفترة الهجريّة).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { setBudget, budgetReport, checkBudget } from "@/server/services/budgets";
import { postExpense, postDonation } from "@/server/services/ledgerPost";
import { hijriMonthKey } from "@/server/utils/week";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
let period: string; // الشهر الهجريّ الحاليّ (لمطابقة قيود الدفتر المؤرَّخة بالآن)
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; period = hijriMonthKey(new Date()); });

describe("الموازنة (TDD)", () => {
  it("ضبطُ موازنةٍ upsert (لا تكرار)", async () => {
    await setBudget(db as never, { period: "1447", fundId: "general", amount: 1000 });
    await setBudget(db as never, { period: "1447", fundId: "general", amount: 1500 }); // تحديث
    const all = await db.select().from(schema.budgets).where(eq(schema.budgets.fundId, "general")).all();
    expect(all.length).toBe(1);
    expect(all[0].amount).toBe(1500);
  });

  it("تقريرُ المخطّط مقابل الفعليّ: الفعليُّ من مصروفات الصندوق في الفترة", async () => {
    await setBudget(db as never, { period, fundId: "general", amount: 500 });
    // مصروفان على العامّ (٢٠٠+١٠٠=٣٠٠) + تبرّعٌ (لا يُحسب في الصرف) + مصروفٌ على الزكاة (لا يخصّ موازنة العامّ)
    await postExpense(db as never, { id: "e1", amount: 200, fundId: "general", category: "كهرباء" });
    await postExpense(db as never, { id: "e2", amount: 100, fundId: "general", category: "صيانة" });
    await postDonation(db as never, { id: "d1", amount: 999, fundId: "general" });
    await postExpense(db as never, { id: "e3", amount: 400, fundId: "zakat", category: "مساعدات" });
    const rep = await budgetReport(db as never, period);
    const gen = rep.find((r) => r.fundId === "general")!;
    expect(gen.planned).toBe(500);
    expect(gen.actual).toBe(300);
    expect(gen.remaining).toBe(200);
    expect(gen.over).toBe(false);
  });

  it("التجاوزُ يظهر (over=true) والمتبقّي سالب", async () => {
    await setBudget(db as never, { period, fundId: "projects", amount: 100 });
    await postExpense(db as never, { id: "e1", amount: 150, fundId: "projects", category: "بناء" });
    const rep = await budgetReport(db as never, period);
    const p = rep.find((r) => r.fundId === "projects")!;
    expect(p.actual).toBe(150);
    expect(p.remaining).toBe(-50);
    expect(p.over).toBe(true);
  });

  it("checkBudget: يتنبّأ بالتجاوز قبل الصرف", async () => {
    await setBudget(db as never, { period, fundId: "general", amount: 300 });
    await postExpense(db as never, { id: "e1", amount: 250, fundId: "general", category: "تشغيل" });
    const ok = await checkBudget(db as never, { period, fundId: "general", addAmount: 40 });
    expect(ok.wouldExceed).toBe(false); // ٢٥٠+٤٠=٢٩٠ < ٣٠٠
    const bad = await checkBudget(db as never, { period, fundId: "general", addAmount: 80 });
    expect(bad.wouldExceed).toBe(true); // ٢٥٠+٨٠=٣٣٠ > ٣٠٠
    expect(bad.remaining).toBe(50);
  });

  it("بلا موازنةٍ ⇒ لا تجاوز (checkBudget يسمح)", async () => {
    const r = await checkBudget(db as never, { period, fundId: "waqf", addAmount: 5000 });
    expect(r.wouldExceed).toBe(false);
    expect(r.planned).toBe(0);
  });
});
