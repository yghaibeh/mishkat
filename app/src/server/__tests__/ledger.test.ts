// المرحلة ٠ — محرّكُ الدفتر المزدوج: التوازن، الذرّيّة، الأرصدة، القفل، القيدُ العكسيّ.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { postJournal, reverseJournal, trialBalance, fundBalances, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("محرّكُ الدفتر (المرحلة ٠)", () => {
  it("الصناديقُ الخمسةُ ودليلُ الحسابات مبذورةٌ بالهجرة", async () => {
    const funds = await db.select().from(schema.funds).all();
    expect(funds.map((f) => f.id).sort()).toEqual(["general", "projects", "sadaqah", "waqf", "zakat"]);
    expect((await db.select().from(schema.accounts).all()).length).toBeGreaterThan(10);
  });

  it("قيدٌ متوازنٌ يُرحَّل ذرّيًّا (رأسٌ + سطران)", async () => {
    await postJournal(db as never, { memo: "تبرّعٌ نقديّ لصندوق الزكاة", source: "donation" }, [
      { accountId: "1110", fundId: "zakat", debit: toCents(100) }, // النقد يزيد (مدين)
      { accountId: "4100", fundId: "zakat", credit: toCents(100) }, // إيراد التبرّعات (دائن)
    ]);
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(1);
    expect((await db.select().from(schema.journalLines).all()).length).toBe(2);
  });

  it("قيدٌ غير متوازنٍ يُرفض ولا يكتب شيئًا (ذرّيّة)", async () => {
    await expect(postJournal(db as never, { memo: "مختلّ" }, [
      { accountId: "1110", fundId: "general", debit: toCents(100) },
      { accountId: "4100", fundId: "general", credit: toCents(90) },
    ])).rejects.toThrow(/غير متوازن/);
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(0);
    expect((await db.select().from(schema.journalLines).all()).length).toBe(0);
  });

  it("حسابٌ أو صندوقٌ مجهولٌ يُرفض", async () => {
    await expect(postJournal(db as never, {}, [
      { accountId: "9999", fundId: "general", debit: toCents(10) },
      { accountId: "4100", fundId: "general", credit: toCents(10) },
    ])).rejects.toThrow(/حساب/);
  });

  it("ميزانُ المراجعةُ متوازنٌ وأرصدةُ الصناديق صحيحة", async () => {
    // تبرّعٌ ١٠٠ للزكاة + مصروفٌ ٣٠ من الزكاة
    await postJournal(db as never, { source: "donation" }, [
      { accountId: "1110", fundId: "zakat", debit: toCents(100) },
      { accountId: "4100", fundId: "zakat", credit: toCents(100) },
    ]);
    await postJournal(db as never, { source: "expense" }, [
      { accountId: "5200", fundId: "zakat", debit: toCents(30) }, // مصروف
      { accountId: "1110", fundId: "zakat", credit: toCents(30) }, // النقد ينقص
    ]);
    const tb = await trialBalance(db as never);
    const td = tb.reduce((s, r) => s + r.debit, 0), tc = tb.reduce((s, r) => s + r.credit, 0);
    expect(td).toBe(tc); // متوازن
    const fb = await fundBalances(db as never);
    const zakat = fb.find((f) => f.fundId === "zakat")!;
    expect(zakat.balance).toBe(toCents(70)); // ١٠٠ − ٣٠ = ٧٠ دولارًا (٧٠٠٠ سنت)
    expect(zakat.restricted).toBe(true);
  });

  it("الفترةُ المقفلةُ تمنع القيدَ فيها", async () => {
    const now = Date.now();
    await db.insert(schema.fiscalPeriods).values({ id: "fp1", name: "محرّم", startsAt: now - 86400000, endsAt: now + 86400000, status: "closed", createdAt: 0 }).run();
    await expect(postJournal(db as never, { entryDate: now }, [
      { accountId: "1110", fundId: "general", debit: toCents(10) },
      { accountId: "4100", fundId: "general", credit: toCents(10) },
    ])).rejects.toThrow(/مقفلة/);
  });

  it("القيدُ العكسيُّ يُلغي الأثرَ (بلا حذف)", async () => {
    const { id } = await postJournal(db as never, { source: "donation" }, [
      { accountId: "1110", fundId: "general", debit: toCents(50) },
      { accountId: "4100", fundId: "general", credit: toCents(50) },
    ]);
    await reverseJournal(db as never, id);
    // قيدان في الدفتر (الأصليّ + العكسيّ)، والرصيدُ صفر
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(2);
    const fb = await fundBalances(db as never);
    expect(fb.find((f) => f.fundId === "general")!.balance).toBe(0);
    const rev = (await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.reversalOf, id)).all())[0];
    expect(rev).toBeTruthy();
  });
});
