// المرحلة ٦ (مُقدَّمة) — القوائم الماليّة من الدفتر. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { statementOfActivities, statementOfPosition } from "@/server/services/statements";
import { postDonation, postExpense } from "@/server/services/ledgerPost";
import { hijriMonthKey } from "@/server/utils/week";

let db: TestDb;
let year: string;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; year = hijriMonthKey(new Date()).slice(0, 4); });

describe("قائمةُ النشاط (TDD)", () => {
  it("لكلّ صندوقٍ: إيرادٌ − مصروفٌ = صافي التغيّر", async () => {
    await postDonation(db as never, { id: "d1", amount: 500, fundId: "zakat" });
    await postExpense(db as never, { id: "e1", amount: 200, fundId: "zakat", category: "مساعدات" });
    await postDonation(db as never, { id: "d2", amount: 300, fundId: "general" });
    const soa = await statementOfActivities(db as never, year);
    const zakat = soa.funds.find((f) => f.fundId === "zakat")!;
    expect(zakat.income).toBe(500);
    expect(zakat.expense).toBe(200);
    expect(zakat.net).toBe(300);
    expect(soa.totals.income).toBe(800);
    expect(soa.totals.expense).toBe(200);
    expect(soa.totals.net).toBe(600);
  });

  it("تُطابق الفترةَ: قيدٌ خارج السنة لا يُحسب", async () => {
    // قيدٌ بتاريخٍ هجريٍّ صريحٍ لسنةٍ أخرى
    await postDonation(db as never, { id: "old", amount: 999, fundId: "general", dateHijri: "1400-01-01" });
    await postDonation(db as never, { id: "now", amount: 100, fundId: "general" });
    const soa = await statementOfActivities(db as never, year);
    expect(soa.totals.income).toBe(100); // الـ999 خارج السنة
  });
});

describe("المركزُ الماليّ (TDD)", () => {
  it("الأصولُ = الخصوم + صافي الأصول (المعادلة المحاسبيّة متوازنة)", async () => {
    await postDonation(db as never, { id: "d1", amount: 1000, fundId: "waqf" });
    await postExpense(db as never, { id: "e1", amount: 400, fundId: "waqf", category: "بناء" });
    await postDonation(db as never, { id: "d2", amount: 250, fundId: "general" });
    const pos = await statementOfPosition(db as never);
    // النقد = ١٠٠٠−٤٠٠+٢٥٠ = ٨٥٠
    expect(pos.assetsTotal).toBe(850);
    // صافي الأصول: وقف ٦٠٠ + عامّ ٢٥٠ = ٨٥٠
    expect(pos.netAssetsTotal).toBe(850);
    expect(pos.liabilitiesTotal).toBe(0);
    expect(pos.balanced).toBe(true); // ٨٥٠ = ٠ + ٨٥٠
    const waqf = pos.netAssetsByFund.find((f) => f.fundId === "waqf")!;
    expect(waqf.balance).toBe(600);
  });

  it("دفترٌ فارغٌ ⇒ الكلُّ صفرٌ ومتوازن", async () => {
    const pos = await statementOfPosition(db as never);
    expect(pos.assetsTotal).toBe(0);
    expect(pos.balanced).toBe(true);
  });
});
