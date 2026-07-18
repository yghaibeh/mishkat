// د٤ (الوثيقة ٢٨): محرّكُ الاستيراد — تحقّقٌ «الكلُّ أو لا شيء» بالسطر، بصمةُ محتوًى تمنع التكرار،
// تنفيذٌ مستأنَفٌ لا يزدوج، ودمجٌ كاملٌ بمحرّك الاعتماد (المسؤولُ يُعترَض والمديرُ ينفّذ). TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { validateImportRows, createImportBatch, executeImportBatch, contentHash, IMPORT_LIMITS } from "../services/financeImport";
import { trialBalance, toCents } from "../services/ledger";
import * as ledger from "@/server/ledger.server";

let db: TestDb;
const officer: FakeUser = { userId: "u-off", personId: "p-off", fullName: "المسؤول", assignments: [{ role: "finance_officer", orgUnitId: "root", orgPath: "/", portfolio: null }] };
const adminU: FakeUser = { userId: "u-adm", personId: "p-adm", fullName: "المدير", assignments: [{ role: "admin", orgUnitId: "root", orgPath: "/", portfolio: null }] };
const ctx = { proposedBy: "u-off", approvedBy: "u-adm" };

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "الفاروق", status: "active", createdAt: 0 } as never).run();
});

describe("التحقّق «الكلُّ أو لا شيء»", () => {
  it("تبرّعاتٌ صالحة تمرّ بطبيعٍ كامل، وصفٌّ فاسدٌ واحدٌ يُسقط الملفَّ بخطأ مُرقَّم بالسطر", async () => {
    const good = [
      { donor: "محسن", fund: "general", amount: 100, mosque: "الفاروق" },
      { donor: "آخر", fund: "zakat", amount: 50, mosque: "m1", date_hijri: "1447-02" },
    ];
    const ok = await validateImportRows(db as never, "donations", good);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.payloads[0].mosqueId).toBe("m1"); // حُلَّ الاسمُ إلى الرمز
      expect(ok.payloads[1].dateHijri).toBe("1447-02");
      expect(ok.totalUsd).toBe(150);
    }
    const bad = await validateImportRows(db as never, "donations", [
      ...good,
      { donor: "فاسد", fund: "لا-صندوق", amount: 10, mosque: "الفاروق" },
      { donor: "سالب", fund: "general", amount: -5, mosque: "الفاروق" },
    ]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.length).toBe(2);
      expect(bad.errors[0].row).toBe(4); // +2: رأسٌ وفهرسةٌ بشريّة
      expect(bad.errors[0].error).toContain("صندوقٌ مجهول");
      expect(bad.errors[1].error).toContain("موجب");
    }
  });

  it("كشفُ التكرار داخل الملفّ + عملةٌ بلا سعرٍ تُرفَض في المصروفات + حدُّ الصفوف", async () => {
    const dup = await validateImportRows(db as never, "donations", [
      { donor: "م", fund: "general", amount: 10, mosque: "m1" },
      { donor: "م", fund: "general", amount: 10, mosque: "m1" },
    ]);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.errors[0].error).toContain("مكرّر");
    const fx = await validateImportRows(db as never, "expenses", [{ category: "ك", fund: "general", amount: 5, currency: "SYP", mosque: "m1" }]);
    expect(fx.ok).toBe(false); // لا سعرَ للّيرة بعد
    const over = await validateImportRows(db as never, "budgets", Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, () => ({ period: "1447", fund: "general", amount: 1 })));
    expect(over.ok).toBe(false);
  });

  it("قوالبُ الأنواع الأخرى: أرصدةٌ افتتاحيّة (حسابٌ صالح + منعُ المكرَّر) وتعديلاتُ رواتب (شخصٌ موجود)", async () => {
    const badAcc = await validateImportRows(db as never, "opening_balances", [{ account: "9999", fund: "general", amount: 10 }]);
    expect(badAcc.ok).toBe(false);
    await db.insert(schema.persons).values({ id: "p9", fullName: "عاملٌ معروف", gender: "male", createdAt: 0 } as never).run();
    const okAdj = await validateImportRows(db as never, "payroll_adjustments", [{ person: "عاملٌ معروف", month: "1447-01", kind: "allowance", amount: 20 }]);
    expect(okAdj.ok).toBe(true);
    const badAdj = await validateImportRows(db as never, "payroll_adjustments", [{ person: "مجهول", month: "1447-01", kind: "allowance", amount: 20 }]);
    expect(badAdj.ok).toBe(false);
  });
});

describe("الدفعةُ والتنفيذُ المستأنَف", () => {
  it("بصمةُ المحتوى تمنع رفعَ الملفّ نفسِه مرّتين لنفس النوع", async () => {
    const rows = [{ donor: "م", fund: "general", amount: 10, mosque: "m1" }];
    const v = await validateImportRows(db as never, "donations", rows);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const c1 = await createImportBatch(db as never, { kind: "donations", rows, payloads: v.payloads, totalUsd: v.totalUsd, createdBy: "u1" });
    expect("batchId" in c1).toBe(true);
    const c2 = await createImportBatch(db as never, { kind: "donations", rows, payloads: v.payloads, totalUsd: v.totalUsd, createdBy: "u1" });
    expect("error" in c2 && c2.error).toContain("رُفع سلفًا");
    expect((await contentHash("donations", rows)).length).toBe(64);
  });

  it("تنفيذُ دفعةِ تبرّعاتٍ يُرحِّل الدفترَ صفًّا صفًّا، وإعادةُ التنفيذ لا تزدوج (idempotent)", async () => {
    const rows = [
      { donor: "أ", fund: "general", amount: 100, mosque: "m1" },
      { donor: "ب", fund: "general", amount: 40, mosque: "m1" },
    ];
    const v = await validateImportRows(db as never, "donations", rows);
    if (!v.ok) throw new Error("unexpected");
    const c = await createImportBatch(db as never, { kind: "donations", rows, payloads: v.payloads, totalUsd: v.totalUsd, createdBy: "u1" });
    const batchId = (c as { batchId: string }).batchId;
    const r1 = await executeImportBatch(db as never, batchId, ctx);
    expect(r1).toEqual({ executed: 2, total: 2 });
    const tb1 = await trialBalance(db as never);
    expect(tb1.find((x) => x.accountId === "1110")?.debit).toBe(toCents(140));
    // إعادةُ التنفيذ: لا صفوفَ معلّقة ⇒ لا ازدواج
    const r2 = await executeImportBatch(db as never, batchId, ctx);
    expect(r2.executed).toBe(2);
    expect((await trialBalance(db as never)).find((x) => x.accountId === "1110")?.debit).toBe(toCents(140));
    expect((await db.select().from(schema.donations).all()).length).toBe(2);
  });

  it("فشلُ صفٍّ يوقف الدفعةَ ويحفظ المؤشّر، وبعد إصلاح السبب يُستأنَف من حيث توقّف", async () => {
    // مصروفٌ من صندوقٍ مقيَّدٍ رصيدُه لا يكفي للصفّ الثاني ⇒ يفشل الصفُّ الثاني وقتَ التنفيذ
    const { recordDonation } = await import("../services/donorsFinance");
    await recordDonation(db as never, { mosqueId: "m1", amount: 30, fund: "zakat", collectedBy: "u1" });
    const rows = [
      { category: "إفطار", fund: "zakat", amount: 20, mosque: "m1" },
      { category: "كسوة", fund: "zakat", amount: 25, mosque: "m1" }, // 20+25 > 30
      { category: "سلال", fund: "zakat", amount: 5, mosque: "m1" },
    ];
    const v = await validateImportRows(db as never, "expenses", rows);
    if (!v.ok) throw new Error("unexpected: " + JSON.stringify(v));
    const c = await createImportBatch(db as never, { kind: "expenses", rows, payloads: v.payloads, totalUsd: v.totalUsd, createdBy: "u1" });
    const batchId = (c as { batchId: string }).batchId;
    await expect(executeImportBatch(db as never, batchId, ctx)).rejects.toThrow(/الصفّ 2/);
    const b1 = (await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId)).all())[0];
    expect(b1.status).toBe("failed");
    expect(b1.executedRows).toBe(1); // الصفُّ الأوّل أُنجز وثبت
    // إصلاحُ السبب: تبرّعٌ إضافيٌّ للزكاة ⇒ إعادةُ الصفوف الفاشلة ثمّ الاستئناف
    await recordDonation(db as never, { mosqueId: "m1", amount: 100, fund: "zakat", collectedBy: "u1" });
    const { resetFailedRows } = await import("../services/financeImport");
    expect(await resetFailedRows(db as never, batchId)).toBe(1);
    const r = await executeImportBatch(db as never, batchId, ctx);
    expect(r).toEqual({ executed: 3, total: 3 });
    expect((await db.select().from(schema.expenses).all()).length).toBe(3); // لا ازدواجَ للصفّ الأوّل
    const b2 = (await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId)).all())[0];
    expect(b2.status).toBe("done");
  });
});

describe("الدمجُ بمحرّك الاعتماد (server-fns)", () => {
  it("استيرادُ المسؤول الماليّ يُعترَض (bulk_import معلّق ولا أثرَ في الدفتر) ثمّ اعتمادُ المدير ينفّذه", async () => {
    state.user = officer;
    const rows = [{ donor: "واسع", fund: "general", amount: 200, mosque: "الفاروق" }];
    const pre = await ledger.validateImportData({ kind: "donations", rows });
    expect(pre.ok).toBe(true);
    const sub = await ledger.submitImportData({ kind: "donations", rows, filename: "don.xlsx" }) as { queued?: boolean; actionId?: string; batchId?: string };
    expect(sub.queued).toBe(true);
    expect((await trialBalance(db as never)).length).toBe(0);
    // المديرُ يعتمد ⇒ تُنفَّذ الدفعة
    state.user = adminU;
    const d = await ledger.decideFinanceActionData({ actionId: sub.actionId!, approve: true }) as { status?: string };
    expect(d.status).toBe("executed");
    expect((await trialBalance(db as never)).find((x) => x.accountId === "1110")?.debit).toBe(toCents(200));
    const b = (await db.select().from(schema.importBatches).all())[0];
    expect(b.status).toBe("done");
  });

  it("استيرادُ المدير مباشرٌ بعد المعاينة، والملفُّ الفاسد يعيد أخطاءً لا دفعة", async () => {
    state.user = adminU;
    const bad = await ledger.submitImportData({ kind: "donations", rows: [{ donor: "x", fund: "غلط", amount: 10, mosque: "m1" }] }) as { error?: string; errors?: unknown[] };
    expect(bad.error).toBeTruthy();
    expect((await db.select().from(schema.importBatches).all()).length).toBe(0);
    const good = await ledger.submitImportData({ kind: "fx_rates", rows: [{ currency: "SYP", rate: 0.0001 }] }) as { ok?: boolean };
    expect(good.ok).toBe(true);
    expect((await db.select().from(schema.fxRates).all()).length).toBe(1);
    expect((await db.select().from(schema.financeActions).all()).length).toBe(0); // لا طابورَ على المدير
  });
});
