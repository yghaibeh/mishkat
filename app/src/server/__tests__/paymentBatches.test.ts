// المرحلة ٣ (متخصّص) — دفعاتُ الصرف المجمّعة: تجميعُ مستحقّي الصرف في دفعةٍ واحدةٍ تُصرَف بقيدٍ واحدٍ متوازن. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { createBatch, addBatchItem, removeBatchItem, payBatch, batchDetail, listBatches } from "@/server/services/paymentBatches";
import { postDonation } from "@/server/services/ledgerPost";
import { trialBalance, fundBalances } from "@/server/services/ledger";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; await postDonation(db as never, { id: "d1", amount: 2000 }); });

describe("دفعاتُ الصرف المجمّعة (TDD)", () => {
  it("إنشاءُ دفعةٍ وإضافةُ بنودٍ يجمع الإجماليّ", async () => {
    const { id } = await createBatch(db as never, { title: "رواتب رجب" });
    await addBatchItem(db as never, { batchId: id, personName: "أمير الفاروق", amount: 50 });
    await addBatchItem(db as never, { batchId: id, personName: "معلّم الحلقة", amount: 30 });
    const d = await batchDetail(db as never, id);
    expect(d.items.length).toBe(2);
    expect(d.total).toBe(80);
    expect(d.status).toBe("open");
  });

  it("صرفُ الدفعة يُرحّل قيدًا واحدًا متوازنًا (Dr 5100 / Cr 1110) بالإجماليّ", async () => {
    const { id } = await createBatch(db as never, { title: "دفعة" });
    await addBatchItem(db as never, { batchId: id, personName: "أ", amount: 50 });
    await addBatchItem(db as never, { batchId: id, personName: "ب", amount: 30 });
    const r = await payBatch(db as never, { batchId: id });
    expect(r.total).toBe(80);
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "5100")?.debit).toBe(8000);
    expect(tb.find((x) => x.accountId === "1110")?.balance).toBe(192000); // ٢٠٠٠ − ٨٠ = ١٩٢٠$
    expect(fundBalances(db as never).then((f) => f.find((x) => x.fundId === "general")?.balance)).resolves.toBe(192000);
    expect((await batchDetail(db as never, id)).status).toBe("paid");
  });

  it("لا تُصرَف دفعةٌ فارغة، ولا تُصرَف مرّتين، ولا يُضاف بندٌ لمصروفة", async () => {
    const { id } = await createBatch(db as never, { title: "د" });
    await expect(payBatch(db as never, { batchId: id })).rejects.toThrow(); // فارغة
    await addBatchItem(db as never, { batchId: id, personName: "أ", amount: 10 });
    await payBatch(db as never, { batchId: id });
    await expect(payBatch(db as never, { batchId: id })).rejects.toThrow();                       // مرّتين
    await expect(addBatchItem(db as never, { batchId: id, personName: "ب", amount: 5 })).rejects.toThrow(); // إضافةٌ لمصروفة
  });

  it("حذفُ بندٍ من دفعةٍ مفتوحةٍ يُنقص الإجماليّ", async () => {
    const { id } = await createBatch(db as never, { title: "د" });
    const it1 = await addBatchItem(db as never, { batchId: id, personName: "أ", amount: 50 });
    await addBatchItem(db as never, { batchId: id, personName: "ب", amount: 30 });
    await removeBatchItem(db as never, { itemId: it1.id });
    expect((await batchDetail(db as never, id)).total).toBe(30);
  });

  it("القائمةُ تعرض الدفعاتِ بإجماليّها وحالتها", async () => {
    const { id } = await createBatch(db as never, { title: "رجب" });
    await addBatchItem(db as never, { batchId: id, personName: "أ", amount: 40 });
    const batches = await listBatches(db as never);
    expect(batches.length).toBe(1);
    expect(batches[0].total).toBe(40);
    expect(batches[0].count).toBe(1);
    expect(batches[0].status).toBe("open");
  });
});
