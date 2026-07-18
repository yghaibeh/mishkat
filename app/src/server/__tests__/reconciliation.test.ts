// المطابقةُ البنكيّة/النقديّة: وسمُ قيودِ النقد + تقريرُ المُطابَق مقابل الدفتر. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { reconcilableEntries, setReconciled, reconciliationSummary } from "@/server/services/reconciliation";
import { postDonation, postExpense } from "@/server/services/ledgerPost";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await postDonation(db as never, { id: "d1", amount: 1000 });                       // نقد +١٠٠٠
  await postExpense(db as never, { id: "e1", amount: 300, category: "كهرباء" });     // نقد −٣٠٠
  await postDonation(db as never, { id: "d2", amount: 200 });                        // نقد +٢٠٠
});

describe("المطابقةُ البنكيّة (TDD)", () => {
  it("قيودُ النقد تظهر جميعُها غيرَ مطابَقةٍ ابتداءً", async () => {
    const rows = await reconcilableEntries(db as never, "1110");
    expect(rows.length).toBe(3);
    expect(rows.every((r) => !r.reconciled)).toBe(true);
    const sum = await reconciliationSummary(db as never, "1110");
    expect(sum.bookBalance).toBe(900);  // ١٠٠٠−٣٠٠+٢٠٠
    expect(sum.cleared).toBe(0);
    expect(sum.uncleared).toBe(900);
    expect(sum.unclearedCount).toBe(3);
  });

  it("وسمُ قيدين يُحدّث المُطابَقَ وغيرَ المُطابَق", async () => {
    const rows = await reconcilableEntries(db as never, "1110");
    const donation = rows.find((r) => r.amount === 1000)!;
    const expense = rows.find((r) => r.amount === -300)!;
    await setReconciled(db as never, { entryId: donation.entryId, accountId: "1110", reconciled: true });
    await setReconciled(db as never, { entryId: expense.entryId, accountId: "1110", reconciled: true });
    const sum = await reconciliationSummary(db as never, "1110");
    expect(sum.cleared).toBe(700);       // ١٠٠٠ − ٣٠٠
    expect(sum.uncleared).toBe(200);     // يتبقّى تبرّعُ ٢٠٠ غيرَ مطابَق
    expect(sum.unclearedCount).toBe(1);
  });

  it("إلغاءُ الوسم يعيد القيدَ غيرَ مطابَق (idempotent)", async () => {
    const rows = await reconcilableEntries(db as never, "1110");
    const id = rows[0].entryId;
    await setReconciled(db as never, { entryId: id, accountId: "1110", reconciled: true });
    await setReconciled(db as never, { entryId: id, accountId: "1110", reconciled: true }); // تكرارٌ لا يزدوج
    await setReconciled(db as never, { entryId: id, accountId: "1110", reconciled: false });
    const sum = await reconciliationSummary(db as never, "1110");
    expect(sum.cleared).toBe(0);
    expect(sum.unclearedCount).toBe(3);
  });
});
