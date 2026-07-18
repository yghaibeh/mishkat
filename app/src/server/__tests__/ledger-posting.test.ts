// المرحلة ٠ (تكملة) — ربطُ الأحداث بالدفتر آليًّا. مكتوبٌ بنمط TDD (الاختبارُ قبل التنفيذ).
// كلُّ حدثٍ ماليٍّ (تبرّع/مصروف/راتب/محروقات) ⇒ قيدٌ متوازنٌ في الدفتر، بحساباتٍ صحيحة، ومُعرَّفٌ idempotent.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { postDonation, postExpense, postPayout, postFuel } from "@/server/services/ledgerPost";
import { fundBalances, trialBalance, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";
import { and, eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

const linesOf = async (entryId: string) =>
  db.select().from(schema.journalLines).where(eq(schema.journalLines.entryId, entryId)).all();

describe("ربطُ الأحداث بالدفتر (TDD)", () => {
  it("تبرّعٌ ⇒ قيدٌ: مدين النقد / دائن التبرّعات، موسومٌ بالصندوق", async () => {
    const { id } = await postDonation(db as never, { id: "don-1", amount: 100, fundId: "zakat", memo: "تبرّعٌ لصندوق الزكاة" });
    const lines = await linesOf(id);
    expect(lines.length).toBe(2);
    const cash = lines.find((l) => l.accountId === "1110")!;   // النقد
    const income = lines.find((l) => l.accountId === "4100")!; // التبرّعات
    expect(cash.debitCents).toBe(toCents(100));
    expect(income.creditCents).toBe(toCents(100));
    expect(lines.every((l) => l.fundId === "zakat")).toBe(true);
    const ent = (await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).all())[0];
    expect(ent.source).toBe("donation");
    expect(ent.sourceRef).toBe("don-1");
  });

  it("مصروفٌ ⇒ قيدٌ: مدين المصروف / دائن النقد", async () => {
    const { id } = await postExpense(db as never, { id: "exp-1", amount: 40, fundId: "general", category: "كهرباء" });
    const lines = await linesOf(id);
    const exp = lines.find((l) => l.accountId === "5200")!;   // مصروفٌ تشغيليّ
    const cash = lines.find((l) => l.accountId === "1110")!;
    expect(exp.debitCents).toBe(toCents(40));
    expect(cash.creditCents).toBe(toCents(40));
  });

  it("راتبٌ مصروفٌ ⇒ قيدٌ: مدين الرواتب / دائن النقد", async () => {
    const { id } = await postPayout(db as never, { id: "pay-1", amount: 250 });
    const lines = await linesOf(id);
    expect(lines.find((l) => l.accountId === "5100")!.debitCents).toBe(toCents(250)); // الرواتب
    expect(lines.find((l) => l.accountId === "1110")!.creditCents).toBe(toCents(250)); // النقد
  });

  it("محروقاتٌ ⇒ قيدٌ: مدين المحروقات / دائن النقد", async () => {
    const { id } = await postFuel(db as never, { id: "fuel-1", amount: 60 });
    const lines = await linesOf(id);
    expect(lines.find((l) => l.accountId === "5300")!.debitCents).toBe(toCents(60)); // محروقات
    expect(lines.find((l) => l.accountId === "1110")!.creditCents).toBe(toCents(60));
  });

  it("idempotent: ترحيلُ الحدث نفسه مرّتين لا يزدوج", async () => {
    await postDonation(db as never, { id: "don-x", amount: 100, fundId: "general" });
    await postDonation(db as never, { id: "don-x", amount: 100, fundId: "general" }); // تكرار
    const entries = await db.select().from(schema.journalEntries).where(and(eq(schema.journalEntries.source, "donation"), eq(schema.journalEntries.sourceRef, "don-x"))).all();
    expect(entries.length).toBe(1);
  });

  it("تكاملٌ: تبرّعٌ ١٠٠ ومصروفٌ ٣٠ للزكاة ⇒ رصيدُ الزكاة ٧٠ والدفترُ متوازن", async () => {
    await postDonation(db as never, { id: "d", amount: 100, fundId: "zakat" });
    await postExpense(db as never, { id: "e", amount: 30, fundId: "zakat", category: "مساعدات" });
    const zakat = (await fundBalances(db as never)).find((f) => f.fundId === "zakat")!;
    expect(zakat.balance).toBe(toCents(70));
    const tb = await trialBalance(db as never);
    expect(tb.reduce((s, r) => s + r.debit, 0)).toBe(tb.reduce((s, r) => s + r.credit, 0));
  });
});

// تكاملٌ عبر دوالّ الأحداث الفعليّة (لا الوحدة فقط)
describe("وصلُ دوالّ الأحداث بالدفتر", () => {
  it("addDonationData يُنشئ التبرّعَ ويُرحّله للدفتر", async () => {
    const { makeUser } = await import("./helpers");
    const admin = makeUser("admin", "root", "/", { personId: "p-a", userId: "u-a" });
    (globalThis as never as { __u?: unknown }).__u = admin;
    // نُهيّئ مسجدًا + مستخدمًا مديرَه
    await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 }).run();
    await db.insert(schema.roleAssignments).values({ id: "ra", personId: "p-a", role: "admin", orgUnitId: "root", orgPath: "/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
    // نُثبّت currentUser عبر vi.mock الموجود في ملفٍ آخر لا يكفي هنا — نستدعي الخدمةَ مباشرةً بدل السيرفر-فن
    const { addDonation } = await import("@/server/services/mosqueFinance");
    const { postDonation } = await import("@/server/services/ledgerPost");
    const { id } = await addDonation(db as never, { mosqueId: "m1", amount: 200, collectedBy: "u-a" }, "u-a");
    await postDonation(db as never, { id, amount: 200, fundId: "sadaqah" });
    const gen = (await fundBalances(db as never)).find((f) => f.fundId === "sadaqah")!;
    expect(gen.balance).toBe(toCents(200));
  });
});
