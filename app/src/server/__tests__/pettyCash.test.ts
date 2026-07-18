// المرحلة ٣ (متخصّص) — الصندوقُ النثريّ بنظام السلفة المستديمة (imprest): سقفٌ ثابتٌ يُصرَف منه ويُزوَّد دوريًّا. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { openBox, recordPettyExpense, replenishBox, boxStatus, listBoxes, boxTxns } from "@/server/services/pettyCash";
import { trialBalance, fundBalances } from "@/server/services/ledger";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("الصندوقُ النثريّ (السلفة المستديمة) — TDD", () => {
  it("فتحُ صندوقٍ يُحوّل النقدَ إلى نثريّة (Dr 1130 / Cr 1110) دون تغيير صافي أصول الصندوق", async () => {
    await openBox(db as never, { name: "نثريّة المكتب", floatAmount: 200 });
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "1130")?.debit).toBe(20000);
    expect(tb.find((r) => r.accountId === "1110")?.credit).toBe(20000);
    const fb = await fundBalances(db as never);
    expect(fb.find((f) => f.fundId === "general")?.balance).toBe(0); // نقدٌ تحوّل لنثريّة: صافي الأصول ثابت
  });

  it("المصروفُ النثريّ يُنقص رصيدَ الصندوق ويُرحّل (Dr مصروف / Cr 1130)", async () => {
    const { id } = await openBox(db as never, { name: "ن", floatAmount: 200 });
    await recordPettyExpense(db as never, { boxId: id, amount: 30, category: "قرطاسية" });
    const st = await boxStatus(db as never, id);
    expect(st.balance).toBe(170);
    expect(st.spent).toBe(30);
    const fb = await fundBalances(db as never);
    expect(fb.find((f) => f.fundId === "general")?.balance).toBe(-3000); // بالسنتات: المصروفُ ينقص صافي الأصول ٣٠$
  });

  it("منعُ الصرف بأكثرَ من رصيد النثريّة", async () => {
    const { id } = await openBox(db as never, { name: "ن", floatAmount: 50 });
    await expect(recordPettyExpense(db as never, { boxId: id, amount: 80, category: "x" })).rejects.toThrow();
  });

  it("التزويدُ يُعيد الرصيدَ إلى السقف بمقدار ما صُرِف (Dr 1130 / Cr 1110)", async () => {
    const { id } = await openBox(db as never, { name: "ن", floatAmount: 200 });
    await recordPettyExpense(db as never, { boxId: id, amount: 30, category: "x" });
    await recordPettyExpense(db as never, { boxId: id, amount: 20, category: "y" });
    const r = await replenishBox(db as never, { boxId: id });
    expect(r.toppedUp).toBe(50);
    expect((await boxStatus(db as never, id)).balance).toBe(200); // عاد للسقف
    const tb = await trialBalance(db as never);
    expect(tb.find((r) => r.accountId === "1130")?.balance).toBe(20000); // رصيدُ النثريّة = السقف (٢٠٠$)
  });

  it("التزويدُ بلا صرفٍ لا يُحرّك شيئًا", async () => {
    const { id } = await openBox(db as never, { name: "ن", floatAmount: 100 });
    const r = await replenishBox(db as never, { boxId: id });
    expect(r.toppedUp).toBe(0);
  });

  it("القائمةُ والحركاتُ تُظهران السقفَ والرصيدَ والسجلّ", async () => {
    const { id } = await openBox(db as never, { name: "ألف", floatAmount: 100 });
    await recordPettyExpense(db as never, { boxId: id, amount: 15, category: "ضيافة" });
    const boxes = await listBoxes(db as never);
    expect(boxes.length).toBe(1);
    expect(boxes[0].floatAmount).toBe(100);
    expect(boxes[0].balance).toBe(85);
    const txns = await boxTxns(db as never, id);
    expect(txns.map((t) => t.kind)).toEqual(["expense", "open"]); // الأحدثُ أولًا
  });
});
