// اختبارُ E2E ماليٌّ شامل: دورةٌ محاسبيّةٌ كاملةٌ عبر كلّ الوحدات (تعدّد عملات/تصريف/رواتب/سُلَف/أصول/نثريّة/دفعات)
// مع التحقّق من الأرقام بدقّةٍ ومن **الثوابت الكبرى**: توازنُ القيد المزدوج، وتوازنُ المركز الماليّ.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { postDonation, postExpense } from "@/server/services/ledgerPost";
import { setRate, recordExchange, currencyBalances, convertToBase } from "@/server/services/currencies";
import { addAdjustment, computeNetPay } from "@/server/services/payroll";
import { grantAdvance, recordRepayment } from "@/server/services/advances";
import { capitalizeAsset, runDepreciationForAsset, disposeAsset, assetBook } from "@/server/services/depreciation";
import { openBox, recordPettyExpense, replenishBox } from "@/server/services/pettyCash";
import { createBatch, addBatchItem, payBatch } from "@/server/services/paymentBatches";
import { trialBalance, fundBalances, toCents, fromCents } from "@/server/services/ledger";
import { statementOfPosition, cashFlowStatement } from "@/server/services/statements";
import { reconciliationSummary, setReconciled, reconcilableEntries } from "@/server/services/reconciliation";
import * as schema from "@/server/database/schema";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.persons).values({ id: "p1", fullName: "الموظّف", gender: "male", status: "active", createdAt: 0 }).run();
  await db.insert(schema.monthlyEntitlements).values({ id: "ent1", personId: "p1", month: "1447-01", grossAmount: 300, currency: "USD", status: "approved", createdAt: 0 } as never).run();
});

// الثابتُ الأكبر: مجموعُ المدين = مجموعُ الدائن في كامل الدفتر (تُطبَّق بعد كلّ عمليّة).
async function assertLedgerBalanced() {
  const tb = await trialBalance(db as never);
  const debit = tb.reduce((s, r) => s + r.debit, 0);
  const credit = tb.reduce((s, r) => s + r.credit, 0);
  expect(debit).toBe(credit);
  const pos = await statementOfPosition(db as never);
  expect(pos.balanced).toBe(true);
}

describe("E2E ماليٌّ شامل — دورةٌ محاسبيّةٌ كاملةٌ بالأرقام", () => {
  it("يمرّ عبر كلّ الوحدات ويبقى متوازنًا والأرقامُ صحيحة", async () => {
    // (١) سعرُ صرفٍ: ١ ل.س = ٠.٠٠٠٢$ (أي ١$ = ٥٠٠٠ ل.س)
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0002 });
    expect(await convertToBase(db as never, "SYP", 2_500_000)).toBe(500);

    // (٢) تبرّعٌ بالدولار ٥٠٠٠$
    await postDonation(db as never, { id: "d1", amount: 5000 });
    // (٣) تبرّعٌ بالليرة السوريّة ٢٬٥٠٠٬٠٠٠ ل.س (=٥٠٠$)
    await postDonation(db as never, { id: "d2", amount: 500, currency: "SYP", origAmount: 2_500_000 });
    await assertLedgerBalanced();

    // (٤) تصريفٌ: نعطي ١٬٠٠٠٬٠٠٠ ل.س (=٢٠٠$) ونأخذ ٢٠٥$ ⇒ مكسبٌ ٥$
    const x = await recordExchange(db as never, { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 205 });
    expect(x.gain).toBe(5);
    await assertLedgerBalanced();

    // (٥) مصروفٌ تشغيليٌّ ٣٠٠$
    await postExpense(db as never, { id: "e1", amount: 300, category: "كهرباء" });

    // (٦) رواتب: بدلٌ ٥٠ + خصمٌ ٢٠ + سُلفةٌ ١٠٠ (قسط ٢٥) ⇒ الصافي = ٣٠٠+٥٠−٢٠−٢٥ = ٣٠٥
    await addAdjustment(db as never, { personId: "p1", month: "1447-01", kind: "allowance", amount: 50 });
    await addAdjustment(db as never, { personId: "p1", month: "1447-01", kind: "deduction", amount: 20 });
    const adv = await grantAdvance(db as never, { personId: "p1", principal: 100, monthlyDeduction: 25 });
    const np = await computeNetPay(db as never, "p1", "1447-01");
    expect(np).toEqual({ gross: 300, allowances: 50, deductions: 20, advanceRecovery: 25, net: 305 });
    await recordRepayment(db as never, { advanceId: adv.id, amount: 25, month: "1447-01" }); // استردادُ قسط
    await assertLedgerBalanced();

    // (٧) أصلٌ ثابت: رسملةٌ ١٢٠٠$ عمرُ ١٢ شهرًا ⇒ إهلاكٌ شهريٌّ ١٠٠$
    const asset = await capitalizeAsset(db as never, { name: "حاسوب", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: asset.id, period: "1447-01" });
    expect((await assetBook(db as never, asset.id)).netBookValue).toBe(1100);
    await assertLedgerBalanced();

    // (٨) نثريّة: فتحٌ ٢٠٠$ + مصروفٌ ٣٠$ + تزويد
    const box = await openBox(db as never, { name: "نثريّة", floatAmount: 200 });
    await recordPettyExpense(db as never, { boxId: box.id, amount: 30, category: "قرطاسية" });
    await replenishBox(db as never, { boxId: box.id });
    await assertLedgerBalanced();

    // (٩) دفعةُ صرفٍ مجمّعة ٨٠$ (٥٠+٣٠)
    const batch = await createBatch(db as never, { title: "رواتب" });
    await addBatchItem(db as never, { batchId: batch.id, personName: "أ", amount: 50 });
    await addBatchItem(db as never, { batchId: batch.id, personName: "ب", amount: 30 });
    await payBatch(db as never, { batchId: batch.id });
    await assertLedgerBalanced();

    // (١٠) بيعُ الأصل بـ٩٠٠$ (القيمة الدفتريّة ١١٠٠) ⇒ خسارةُ ٢٠٠$
    const disp = await disposeAsset(db as never, { fixedAssetId: asset.id, proceeds: 900 });
    expect(disp.loss).toBe(200);
    await assertLedgerBalanced();

    // ===== التحقّقُ النهائيُّ من الأرصدة بالسنتات =====
    const tb = await trialBalance(db as never);
    const bal = (id: string) => tb.find((r) => r.accountId === id)?.balance ?? 0;

    // النقدُ بالدولار 1110: ٥٠٠٠ −٣٠٠(كهرباء) +٢٠٥(تصريف) −١٠٠(سلفة) +٢٥(استرداد) −١٢٠٠(رسملة) −٢٠٠(نثرية فتح) −٣٠(نثرية تزويد=المصروف) −٨٠(دفعة) +٩٠٠(بيع أصل) = ٤٢٢٠
    expect(bal("1110")).toBe(toCents(4220));
    // نقدُ الليرة 1115 (قيمةٌ دولاريّة): ٥٠٠ −٢٠٠ = ٣٠٠$
    expect(bal("1115")).toBe(toCents(300));
    // النثريّة 1130: ٢٠٠ −٣٠ +٣٠(تزويد) = ٢٠٠
    expect(bal("1130")).toBe(toCents(200));
    // ذممٌ مدينة 1200 (سلفة): ١٠٠ −٢٥ = ٧٥
    expect(bal("1200")).toBe(toCents(75));
    // الأصلُ الثابت 1210 والمجمّع 1190 = صفرٌ بعد البيع
    expect(bal("1210")).toBe(0);
    expect(bal("1190")).toBe(0);

    // العملات: نقدُ الليرة الأصليّ = ٢٬٥٠٠٬٠٠٠ − ١٬٠٠٠٬٠٠٠ = ١٬٥٠٠٬٠٠٠ ل.س بقيمة ٣٠٠$
    const curs = await currencyBalances(db as never);
    const syp = curs.find((c) => c.code === "SYP")!;
    expect(syp.native).toBe(1_500_000);
    expect(syp.usdValue).toBe(300);

    // مجمّعُ النقد بالدولار (1110+1115+1130) = ٤٢٢٠+٣٠٠+٢٠٠ = ٤٧٢٠
    const cf = await cashFlowStatement(db as never);
    expect(cf.cashBalance).toBe(4720);

    // رصيدُ الصندوق العامّ (بالسنتات) = أصولٌ صافيةٌ للصندوق
    // = 1110+1115+1130+1200 (أصول) = ٤٢٢٠+٣٠٠+٢٠٠+٧٥ = ٤٧٩٥
    const fb = await fundBalances(db as never);
    expect(fromCents(fb.find((f) => f.fundId === "general")!.balance)).toBe(4795);

    // (١١) المطابقةُ البنكيّة على النقد الدولاريّ: وسمُ أوّل قيدٍ
    const rec = await reconcilableEntries(db as never, "1110");
    expect(rec.length).toBeGreaterThan(0);
    await setReconciled(db as never, { entryId: rec[0].entryId, accountId: "1110", reconciled: true });
    const rs = await reconciliationSummary(db as never, "1110");
    expect(rs.bookBalance).toBe(4220);            // يطابق رصيدَ الدفتر
    expect(rs.cleared + rs.uncleared).toBe(4220); // المُطابَق + غيرُ المُطابَق = الدفتر

    // الختامُ: الدفترُ متوازنٌ والمركزُ الماليُّ متوازن
    await assertLedgerBalanced();
  });
});
