// محرّكُ الاعتماد الثنائيّ: السياسة، الاعتراض، القرار، التنفيذ، الفشل، الثوابت، وتطابقُ المعاينة مع الترحيل. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import {
  guardFinanceAction, decideFinanceAction, executeAction, cancelFinanceAction,
  listFinanceActions, previewFinanceAction, requiresApproval,
} from "@/server/services/financeActions";
import { setRate } from "@/server/services/currencies";
import { trialBalance, toCents } from "@/server/services/ledger";
import { postDonation } from "@/server/services/ledgerPost";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const officer = { userId: "u-officer", assignments: [{ role: "finance_officer" }] };
const adminU = { userId: "u-admin", assignments: [{ role: "admin" }] };

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
});

describe("محرّكُ الاعتماد الثنائيّ (TDD)", () => {
  it("السياسة: المسؤولُ الماليُّ يلزمه اعتمادٌ لكلّ فعل، والإدارةُ لا (لا سياسةَ لدورها)", async () => {
    expect(await requiresApproval(db as never, ["finance_officer"], "exchange", 5)).toBe(true);
    expect(await requiresApproval(db as never, ["finance_officer"], "fx_rate_set", 0)).toBe(true); // عتبة ٠ = كل شيء
    expect(await requiresApproval(db as never, ["admin"], "exchange", 1000)).toBe(false);
    expect(await requiresApproval(db as never, ["amir"], "expense_add", 50)).toBe(false); // الأمراء مباشرون (قرار ٢)
  });

  it("الاعتراض: فعلُ المسؤول يدخل الطابورَ معلّقًا ولا يمسّ الدفترَ إطلاقًا", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    const g = await guardFinanceAction(db as never, officer, {
      kind: "exchange", payload: { fromCurrency: "USD", fromAmount: 100, toCurrency: "SYP", toAmount: 1_000_000 },
      summary: "تصريف ١٠٠$ إلى ليرة", amountUsd: 100,
    });
    expect(g.queued).toBe(true);
    expect((await trialBalance(db as never)).length).toBe(0); // الدفترُ فارغ
    const a = (await listFinanceActions(db as never, { status: "pending" }))[0];
    expect(a.kind).toBe("exchange");
    expect(a.status).toBe("pending");
  });

  it("نفسُ clientUuid لا يزدوج (idempotency)", async () => {
    const input = { kind: "fx_rate_set", payload: { currency: "SYP", rateToBase: 0.0001 }, summary: "سعر", amountUsd: 0, clientUuid: "cu-1" };
    const g1 = await guardFinanceAction(db as never, officer, input);
    const g2 = await guardFinanceAction(db as never, officer, input);
    expect(g1.id).toBe(g2.id);
    expect((await listFinanceActions(db as never, {})).length).toBe(1);
  });

  it("لا يعتمد أحدٌ فعلَ نفسه + الرفضُ بلا سببٍ مرفوض", async () => {
    const g = await guardFinanceAction(db as never, officer, { kind: "fx_rate_set", payload: { currency: "SYP", rateToBase: 0.0002 }, summary: "سعر", amountUsd: 0 });
    await expect(decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-officer" })).rejects.toThrow(/نفسه/);
    await expect(decideFinanceAction(db as never, { actionId: g.id!, approve: false, decidedBy: "u-admin" })).rejects.toThrow(/إلزاميّ/);
  });

  it("الاعتماد يُنفِّذ عبر الخدمة القائمة والرقمُ يصل الدفترَ صحيحًا", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    await postDonation(db as never, { id: "d1", amount: 500 }); // نقدٌ للبيع منه
    const g = await guardFinanceAction(db as never, officer, {
      kind: "exchange", payload: { fromCurrency: "USD", fromAmount: 100, toCurrency: "SYP", toAmount: 1_000_000 },
      summary: "تصريف", amountUsd: 100,
    });
    const r = await decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-admin" });
    expect(r.status).toBe("executed");
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "1115")?.debit).toBe(toCents(100)); // دخل نقدُ الليرة بقيمة ١٠٠$
    const a = (await listFinanceActions(db as never, { status: "executed" }))[0];
    expect(a.decidedByName).toBeTruthy();
  });

  it("الرفضُ بسببٍ يصل المقترِحَ ولا يُنفَّذ شيء", async () => {
    const g = await guardFinanceAction(db as never, officer, { kind: "budget_set", payload: { period: "1447", fundId: "general", amount: 1000 }, summary: "موازنة", amountUsd: 1000 });
    const r = await decideFinanceAction(db as never, { actionId: g.id!, approve: false, reason: "المبلغ مبالغ فيه", decidedBy: "u-admin" });
    expect(r.status).toBe("rejected");
    const a = (await listFinanceActions(db as never, { status: "rejected" }))[0];
    expect(a.rejectReason).toBe("المبلغ مبالغ فيه");
    expect((await db.select().from(schema.budgets).all()).length).toBe(0);
  });

  it("فشلُ التنفيذ بعد الاعتماد يُسجَّل بسببه ويُعاد بنجاحٍ بعد إصلاح السبب", async () => {
    // تصريفٌ بعملةٍ بلا سعرٍ ⇒ التنفيذ يفشل
    const g = await guardFinanceAction(db as never, officer, {
      kind: "exchange", payload: { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 100 },
      summary: "تصريف بلا سعر", amountUsd: 100,
    });
    const r = await decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-admin" });
    expect(r.status).toBe("failed");
    expect(r.error).toContain("سعرَ");
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 }); // إصلاحُ السبب
    const retry = await executeAction(db as never, g.id!, "u-admin");
    expect(retry.status).toBe("executed");
  });

  it("الإلغاء: لصاحب الاقتراح وللمعلّق فقط", async () => {
    const g = await guardFinanceAction(db as never, officer, { kind: "fx_rate_set", payload: { currency: "TRY", rateToBase: 0.03 }, summary: "سعر", amountUsd: 0 });
    await expect(cancelFinanceAction(db as never, g.id!, "u-admin")).rejects.toThrow(/لصاحب/);
    await cancelFinanceAction(db as never, g.id!, "u-officer");
    expect((await listFinanceActions(db as never, { status: "cancelled" })).length).toBe(1);
    await expect(decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-admin" })).rejects.toThrow(/مبتوت/);
  });

  it("المعاينةُ تطابق الترحيلَ الفعليَّ حرفيًّا (تصريفٌ بمكسب)", async () => {
    await setRate(db as never, { currency: "SYP", rateToBase: 0.0001 });
    const payload = { fromCurrency: "SYP", fromAmount: 1_000_000, toCurrency: "USD", toAmount: 105 };
    const preview = await previewFinanceAction(db as never, "exchange", JSON.stringify(payload));
    // تنفيذٌ فعليّ ثم مقارنةُ سطور الدفتر بالمعاينة
    const g = await guardFinanceAction(db as never, officer, { kind: "exchange", payload, summary: "تصريف", amountUsd: 105 });
    await decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-admin" });
    const lines = await db.select().from(schema.journalLines).all();
    const norm = (arr: Array<{ accountId: string; debit: number; credit: number }>) =>
      arr.map((l) => `${l.accountId}:${l.debit}:${l.credit}`).sort();
    expect(norm(preview.map((l) => ({ accountId: l.accountId, debit: toCents(l.debit), credit: toCents(l.credit) }))))
      .toEqual(norm(lines.map((l) => ({ accountId: l.accountId, debit: l.debitCents, credit: l.creditCents }))));
    expect(preview.find((l) => l.accountId === "4910")?.credit).toBe(5); // مكسبُ ٥$ ظاهرٌ للمدير قبل القرار
  });

  it("معاينةُ الرصيد الافتتاحيّ وقيدُه اليدويّ متوازنان وينفَّذان", async () => {
    const g = await guardFinanceAction(db as never, officer, {
      kind: "opening_balance", payload: { accountId: "1110", fundId: "general", amount: 1500 },
      summary: "رصيد افتتاحي ١٥٠٠$", amountUsd: 1500,
    });
    const pv = await previewFinanceAction(db as never, "opening_balance", JSON.stringify({ accountId: "1110", fundId: "general", amount: 1500 }));
    expect(pv.find((l) => l.accountId === "3100")?.credit).toBe(1500);
    await decideFinanceAction(db as never, { actionId: g.id!, approve: true, decidedBy: "u-admin" });
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "1110")?.balance).toBe(toCents(1500));
    // إعادةُ اقتراح نفس الرصيد ⇒ التنفيذ يرفض (idempotent عبر hasActivePosting)
    const g2 = await guardFinanceAction(db as never, officer, { kind: "opening_balance", payload: { accountId: "1110", fundId: "general", amount: 999 }, summary: "تكرار", amountUsd: 999 });
    const r2 = await decideFinanceAction(db as never, { actionId: g2.id!, approve: true, decidedBy: "u-admin" });
    expect(r2.status).toBe("failed");
  });
});
