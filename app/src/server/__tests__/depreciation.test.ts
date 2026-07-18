// المرحلة ٥ — الأصولُ الثابتةُ والإهلاك: رسملةٌ (capitalize) ثمّ إهلاكٌ شهريٌّ بالقسط الثابت. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { capitalizeAsset, runDepreciationForAsset, runDepreciation, assetBook, listFixedAssets, disposeAsset } from "@/server/services/depreciation";
import { postDonation } from "@/server/services/ledgerPost";
import { trialBalance } from "@/server/services/ledger";
import { statementOfPosition as posStatement } from "@/server/services/statements";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("الأصولُ الثابتةُ والإهلاك (القسط الثابت) — TDD", () => {
  it("الرسملةُ تُحوّل النقدَ إلى أصلٍ ثابت (Dr 1210 / Cr 1110)", async () => {
    await capitalizeAsset(db as never, { name: "حاسوب", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "1210")?.debit).toBe(120000); // ١٢٠٠$
    expect(tb.find((r) => r.accountId === "1110")?.credit).toBe(120000);
  });

  it("الإهلاكُ الشهريّ = (التكلفة − القيمةُ المتبقّية) ÷ العمر، ويُرحّل (Dr 5400 / Cr 1190)", async () => {
    const { id } = await capitalizeAsset(db as never, { name: "حاسوب", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" });
    const bk = await assetBook(db as never, id);
    expect(bk.monthly).toBe(100);              // ١٢٠٠ ÷ ١٢
    expect(bk.accumulated).toBe(100);
    expect(bk.netBookValue).toBe(1100);
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "5400")?.debit).toBe(10000);
    expect(tb.find((r) => r.accountId === "1190")?.credit).toBe(10000);
  });

  it("الإهلاكُ idempotent لكلّ فترة: تكرارُ الفترة لا يُضاعف", async () => {
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" });
    const r2 = await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" });
    expect(r2.skipped).toBe(true);
    expect((await assetBook(db as never, id)).accumulated).toBe(100);
  });

  it("القيمةُ الدفتريّةُ لا تنزل تحت القيمة المتبقّية (آخرُ قسطٍ يُقصّ)", async () => {
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1000, salvageValue: 100, usefulLifeMonths: 3, startPeriod: "1447-01" });
    // القسط = (١٠٠٠−١٠٠)/٣ = ٣٠٠. بعد ٣ أشهرٍ المجمّع = ٩٠٠، القيمة الدفتريّة = ١٠٠ (المتبقّية)
    for (const p of ["1447-01", "1447-02", "1447-03", "1447-04"]) await runDepreciationForAsset(db as never, { fixedAssetId: id, period: p });
    const bk = await assetBook(db as never, id);
    expect(bk.accumulated).toBe(900);
    expect(bk.netBookValue).toBe(100); // لا ينزل تحت المتبقّية
  });

  it("تشغيلُ إهلاكِ فترةٍ يشمل كلَّ الأصول النشطة", async () => {
    await capitalizeAsset(db as never, { name: "أ", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await capitalizeAsset(db as never, { name: "ب", cost: 600, usefulLifeMonths: 6, startPeriod: "1447-01" });
    const res = await runDepreciation(db as never, { period: "1447-01" });
    expect(res.count).toBe(2);
    expect(res.total).toBe(200); // ١٠٠ + ١٠٠
  });

  it("برهانُ التوازن يصمد بعد الرسملة والإهلاك", async () => {
    await postDonation(db as never, { id: "d1", amount: 2000 }); // نقدٌ افتتاحيّ
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" });
    const pos = await posStatement(db as never);
    expect(pos.balanced).toBe(true);
    // الأصولُ = نقد ٨٠٠ (٢٠٠٠−١٢٠٠) + ثابت ١٢٠٠ − مجمّع الإهلاك ١٠٠ = ١٩٠٠
    expect(pos.assetsTotal).toBe(1900);
  });

  it("القائمةُ تعرض التكلفةَ والمجمّعَ والقيمةَ الدفتريّة", async () => {
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" });
    const list = await listFixedAssets(db as never);
    expect(list.length).toBe(1);
    expect(list[0].cost).toBe(1200);
    expect(list[0].accumulated).toBe(100);
    expect(list[0].netBookValue).toBe(1100);
  });

  it("الاستبعادُ بخسارةٍ (متحصّلٌ < القيمة الدفتريّة): يشطب التكلفةَ والمجمّعَ ويثبت الخسارة", async () => {
    await postDonation(db as never, { id: "d1", amount: 2000 });
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" }); // مجمّع ١٠٠، دفتريّة ١١٠٠
    const r = await disposeAsset(db as never, { fixedAssetId: id, proceeds: 900 });
    expect(r.netBookValue).toBe(1100);
    expect(r.loss).toBe(200); // ١١٠٠ − ٩٠٠
    expect(r.gain).toBe(0);
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "1210")?.balance).toBe(0);   // التكلفةُ شُطِبت
    expect(tb.find((x) => x.accountId === "1190")?.balance).toBe(0);   // المجمّعُ شُطِب
    expect(tb.find((x) => x.accountId === "5900")?.debit).toBe(20000); // خسارةُ ٢٠٠$
    const pos = await posStatement(db as never);
    expect(pos.balanced).toBe(true);
    expect(listFixedAssets(db as never).then((l) => l.find((a) => a.id === id)?.status)).resolves.toBe("disposed");
  });

  it("الاستبعادُ بربحٍ (متحصّلٌ > القيمة الدفتريّة): يثبت المكسب", async () => {
    await postDonation(db as never, { id: "d1", amount: 2000 });
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 1000, usefulLifeMonths: 10, startPeriod: "1447-01" });
    await runDepreciationForAsset(db as never, { fixedAssetId: id, period: "1447-01" }); // مجمّع ١٠٠، دفتريّة ٩٠٠
    const r = await disposeAsset(db as never, { fixedAssetId: id, proceeds: 1200 });
    expect(r.gain).toBe(300); // ١٢٠٠ − ٩٠٠
    expect(r.loss).toBe(0);
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "4900")?.credit).toBe(30000); // مكسبُ ٣٠٠$
    expect((await posStatement(db as never)).balanced).toBe(true);
  });

  it("الاستبعادُ خُردةً (بلا متحصّل): الخسارةُ = كامل القيمة الدفتريّة", async () => {
    await postDonation(db as never, { id: "d1", amount: 2000 });
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 600, usefulLifeMonths: 6, startPeriod: "1447-01" });
    const r = await disposeAsset(db as never, { fixedAssetId: id }); // بلا إهلاك: دفتريّة = التكلفة
    expect(r.loss).toBe(600);
    expect((await posStatement(db as never)).balanced).toBe(true);
  });

  it("لا يُستبعَد أصلٌ مستبعَدٌ مرّتين", async () => {
    const { id } = await capitalizeAsset(db as never, { name: "ح", cost: 600, usefulLifeMonths: 6, startPeriod: "1447-01" });
    await disposeAsset(db as never, { fixedAssetId: id });
    await expect(disposeAsset(db as never, { fixedAssetId: id })).rejects.toThrow();
  });
});
