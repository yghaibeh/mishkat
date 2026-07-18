// تعدّدُ العملات: أسعارٌ + تحويلٌ + تصريفٌ بمكاسب/خسائر + أرصدةٌ لكلّ عملة. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { setRate, latestRate, convertToBase, recordExchange, currencyBalances, listCurrencies } from "@/server/services/currencies";
import { postJournal, toCents, trialBalance } from "@/server/services/ledger";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("تعدّدُ العملات (TDD)", () => {
  it("العملاتُ المبذورةُ ثلاثٌ، والأساسُ USD سعرُه 1", async () => {
    const curs = await listCurrencies(db as never);
    expect(curs.map((c) => c.code).sort()).toEqual(["SYP", "TRY", "USD"]);
    expect(curs.find((c) => c.code === "USD")?.rate).toBe(1);
  });

  it("ضبطُ سعرٍ ثمّ التحويلُ للدولار", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 }); // ١ ل.س = ٠.٠٠٠١$ (١$ = ١٠٠٠٠ ل.س)
    expect(await latestRate(db as never, "SYP")).toBe(0.0001);
    expect(await convertToBase(db as never, "SYP", 1_000_000)).toBe(100); // مليونُ ل.س = ١٠٠$
    expect(await convertToBase(db as never, "USD", 50)).toBe(50);
  });

  it("التحويلُ يرمي إن لم يوجد سعرٌ لعملةٍ أجنبيّة", async () => {
    await expect(convertToBase(db as never, "TRY", 100)).rejects.toThrow();
  });

  it("التصريفُ بسعرٍ عادلٍ لا مكسبَ ولا خسارة (قيدٌ متوازن Dr نقد الوجهة / Cr نقد المصدر)", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    const r = await recordExchange(db as never, { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 100 });
    expect(r.usdFrom).toBe(100); expect(r.usdTo).toBe(100); expect(r.gain).toBe(0); expect(r.loss).toBe(0);
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "1110")?.debit).toBe(10000);  // ١٠٠$ دخلت خزنة الدولار
    expect(tb.find((x) => x.accountId === "1115")?.credit).toBe(10000); // ١٠٠$ (قيمةُ الل.س) خرجت
  });

  it("التصريفُ بربحٍ يُثبت مكسبَ فروق العملة (Cr 4910)", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    const r = await recordExchange(db as never, { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 105 });
    expect(r.gain).toBe(5); expect(r.loss).toBe(0); // قوّمنا الل.س بـ١٠٠$ وقبضنا ١٠٥$
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "4910")?.credit).toBe(500); // مكسبُ ٥$
  });

  it("التصريفُ بخسارةٍ يُثبت خسارةَ فروق العملة (Dr 5910)", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    const r = await recordExchange(db as never, { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 92 });
    expect(r.loss).toBe(8); expect(r.gain).toBe(0);
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "5910")?.debit).toBe(800); // خسارةُ ٨$
  });

  it("أرصدةُ العملات: المقدارُ الأصليّ + القيمةُ الدولاريّة", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    // إيداعُ ٢٬٠٠٠٬٠٠٠ ل.س (قيمتها ٢٠٠$): Dr 1115 / Cr 4100
    await postJournal(db as never, { source: "donation" }, [
      { accountId: "1115", fundId: "general", debit: toCents(200), currency: "SYP", amountOrig: toCents(2_000_000) },
      { accountId: "4100", fundId: "general", credit: toCents(200) },
    ]);
    const bals = await currencyBalances(db as never);
    const syp = bals.find((b) => b.code === "SYP");
    expect(syp?.native).toBe(2_000_000);
    expect(syp?.usdValue).toBe(200);
  });
});
