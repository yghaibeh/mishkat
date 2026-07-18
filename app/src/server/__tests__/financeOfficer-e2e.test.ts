// د٥ (الوثيقة ٢٨): E2E موسّع — دورةُ حياةٍ كاملةٌ للمسؤول الماليّ عبر دوالّ الخادم الحقيقيّة:
// يقترح كلَّ شيء ⇒ يُرفَض بعضُه بسببٍ ⇒ يُعدِّل ويعيد ⇒ المديرُ يعتمد ⇒ استيرادٌ بالقالب ⇒ تصديرٌ شامل.
// البرهانُ المحاسبيّ بعد كلّ مرحلة: Σمدين = Σدائن بالسنت، والمركزُ الماليّ متوازن.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as ledger from "@/server/ledger.server";
import * as mosqueFin from "@/server/mosqueFinance.server";
import * as schema from "../database/schema";
import { trialBalance, toCents } from "../services/ledger";
import { statementOfPosition } from "../services/statements";
import { collectFinanceWorkbook } from "../services/financeWorkbook";

let db: TestDb;
// مسؤولٌ ماليٌّ مُكلَّفٌ أيضًا أميرًا للنور (ليصل نماذجَ المسجد) — السياسةُ بالدور تعترضه حيثما دخل (أثبتها اختبارُ الوصل)
const officer: FakeUser = { userId: "u-off", personId: "p-off", fullName: "مسؤولٌ ماليّ", assignments: [
  { role: "finance_officer", orgUnitId: "root", orgPath: "/", portfolio: null },
  { role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", portfolio: null },
] };
const adminU: FakeUser = { userId: "u-adm", personId: "p-adm", fullName: "المدير", assignments: [{ role: "admin", orgUnitId: "root", orgPath: "/", portfolio: null }] };
const asOfficer = () => { state.user = officer; };
const asAdmin = () => { state.user = adminU; };

// البرهانُ المحاسبيّ الجوهريّ: توازنٌ بالسنت في الميزان والمركز.
async function assertBalancedToTheCent() {
  const tb = await trialBalance(db as never);
  const d = tb.reduce((s, r) => s + r.debit, 0), c = tb.reduce((s, r) => s + r.credit, 0);
  expect(d).toBe(c); // سنتاتٌ صحيحة — تطابقٌ تامّ
  const pos = await statementOfPosition(db as never);
  expect(pos.balanced).toBe(true);
}

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "النور", status: "active", createdAt: 0 } as never).run();
  await db.insert(schema.persons).values({ id: "p-w", fullName: "عاملُ الخدمات", gender: "male", createdAt: 0 } as never).run();
});

describe("E2E: دورةُ المسؤول الماليّ الكاملة (اقتراحٌ ⇒ رفضٌ ⇒ تعديلٌ ⇒ اعتمادٌ ⇒ استيرادٌ ⇒ تصدير)", () => {
  it("تمرّ الدورةُ كلُّها والدفترُ متوازنٌ بالسنت في كلّ مرحلة", async () => {
    // ٠) المدير: رصيدٌ افتتاحيٌّ مباشر
    asAdmin();
    const ob = await ledger.openingBalanceData({ accountId: "1110", fundId: "general", amount: 5000 }) as { ok?: boolean };
    expect(ob.ok).toBe(true);
    await assertBalancedToTheCent();

    // ١) المسؤولُ يقترح سلسلةَ أفعالٍ — كلُّها تُعترَض ولا أثرَ لها
    asOfficer();
    const acts: Record<string, string> = {};
    const propose = async (name: string, r: Promise<unknown>) => {
      const res = await r as { queued?: boolean; actionId?: string; error?: string };
      expect(res.queued, `${name} يجب أن يُعترَض`).toBe(true);
      acts[name] = res.actionId!;
    };
    await propose("rate", ledger.setRateData({ currency: "SYP", rateToBase: 0.0001 }));
    await propose("budget", ledger.setBudgetData({ period: "1447-01", fundId: "general", amount: 1000 }));
    await propose("petty", ledger.openPettyBoxData({ name: "نثريّة الإدارة", floatAmount: 200 }));
    await propose("advance", ledger.grantAdvanceData({ personId: "p-w", principal: 300, monthlyDeduction: 50 }));
    await propose("asset", ledger.capitalizeAssetData({ name: "حاسوبُ المحاسبة", cost: 1200, usefulLifeMonths: 12, startPeriod: "1447-01" }));
    await propose("donation", mosqueFin.addDonationData({ mosqueId: "m1", amount: 250, donorName: "محسنٌ كبير", fund: "general" }));
    await propose("expense", mosqueFin.addExpenseData({ mosqueId: "m1", amount: 4000, category: "تجهيزات", fund: "general" }));
    // لا أثرَ في الدفتر سوى الافتتاحيّ (قيدٌ واحد)
    const tb0 = await trialBalance(db as never);
    expect(tb0.find((x) => x.accountId === "1110")?.debit).toBe(toCents(5000));
    expect((await db.select().from(schema.donations).all()).length).toBe(0);
    expect((await db.select().from(schema.expenses).all()).length).toBe(0);
    await assertBalancedToTheCent();

    // ٢) المسؤولُ لا يقرّر لنفسه؛ والمديرُ يرفض المصروفَ الكبير بسبب
    await expect(ledger.decideFinanceActionData({ actionId: acts.expense, approve: true })).rejects.toThrow();
    asAdmin();
    const rej = await ledger.decideFinanceActionData({ actionId: acts.expense, approve: false, reason: "يتجاوز حاجةَ الشهر — قدِّم مبلغًا أدنى" }) as { status?: string };
    expect(rej.status).toBe("rejected");

    // ٣) المسؤولُ يرى السببَ في «مقترحاتي» ويعدِّل ويعيد التقديم
    asOfficer();
    const mine1 = await ledger.financeActionsData({ mine: true });
    const rejected = mine1.items.find((i) => i.id === acts.expense)!;
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectReason).toContain("يتجاوز");
    await propose("expense2", mosqueFin.addExpenseData({ mosqueId: "m1", amount: 900, category: "تجهيزات", fund: "general" }));

    // ٤) المديرُ يعاين ثمّ يعتمد الكلَّ — كلُّ اعتمادٍ يُنفِّذ فورًا
    asAdmin();
    const pv = await ledger.previewFinanceActionData(acts.donation);
    expect(pv.lines.find((l) => l.accountId === "1110")?.debit).toBe(250);
    for (const name of ["rate", "budget", "petty", "advance", "asset", "donation", "expense2"]) {
      const d = await ledger.decideFinanceActionData({ actionId: acts[name], approve: true }) as { status?: string };
      expect(d.status, `${name} يُنفَّذ باعتماده`).toBe("executed");
      await assertBalancedToTheCent(); // التوازنُ محفوظٌ بعد كلّ تنفيذ
    }
    // آثارُ التنفيذ الحقيقيّة
    const tb1 = await trialBalance(db as never);
    expect(tb1.find((x) => x.accountId === "1130")?.debit).toBe(toCents(200));          // النثريّة
    expect(tb1.find((x) => x.accountId === "1210")?.debit).toBe(toCents(1200));         // الأصلُ الثابت
    expect((await db.select().from(schema.fxRates).all()).length).toBe(1);
    expect((await db.select().from(schema.staffAdvances).all()).length).toBe(1);
    expect((await db.select().from(schema.donations).all()).length).toBe(1);
    expect((await db.select().from(schema.expenses).all()).length).toBe(1);
    expect((await db.select().from(schema.expenses).all())[0].amount).toBe(900);        // المعدَّلُ لا المرفوض

    // ٥) الاستيرادُ بالقالب: المسؤولُ يرفع ثلاثةَ تبرّعاتٍ ⇒ فعلُ bulk_import معلّقٌ ⇒ المديرُ يعتمد
    asOfficer();
    const rows = [
      { donor: "أ", fund: "general", amount: 100, mosque: "النور" },
      { donor: "ب", fund: "zakat", amount: 60, mosque: "m1", date_hijri: "1447-01" },
      { donor: "ج", fund: "general", amount: 40, mosque: "النور" },
    ];
    const v = await ledger.validateImportData({ kind: "donations", rows });
    expect(v.ok).toBe(true);
    const sub = await ledger.submitImportData({ kind: "donations", rows, filename: "تبرعات-يناير.xlsx" }) as { queued?: boolean; actionId?: string };
    expect(sub.queued).toBe(true);
    expect((await db.select().from(schema.donations).all()).length).toBe(1); // لم يدخل شيءٌ بعد
    asAdmin();
    const impDec = await ledger.decideFinanceActionData({ actionId: sub.actionId!, approve: true }) as { status?: string };
    expect(impDec.status).toBe("executed");
    const allDons = await db.select().from(schema.donations).all();
    expect(allDons.length).toBe(4);
    expect(new Set(allDons.map((d) => d.receiptNo)).size).toBe(4); // سنداتٌ متسلسلةٌ لا تتكرّر
    await assertBalancedToTheCent();

    // ٦) التصديرُ الشامل: أرقامُ المصنّف تطابق الدفترَ بالسنت، وسجلُّ الاعتمادات يحكي القصّةَ كاملة
    const w = await collectFinanceWorkbook(db as never);
    const dSum = Math.round(w.journal.reduce((s, j) => s + j.debit, 0) * 100);
    const cSum = Math.round(w.journal.reduce((s, j) => s + j.credit, 0) * 100);
    expect(dSum).toBe(cSum);
    expect(w.position.balanced).toBe(true);
    expect(w.donations.length).toBe(4);
    expect(w.approvals.length).toBe(9); // ٧ اقتراحاتٍ أولى + المصروفُ المعدَّل + الاستيراد
    expect(w.approvals.filter((a) => a.status === "executed").length).toBe(8);
    expect(w.approvals.filter((a) => a.status === "rejected").length).toBe(1);
    expect(w.approvals.every((a) => a.proposedBy === "مسؤولٌ ماليّ" || a.proposedBy === "u-off")).toBe(true);
    const tbFinal = await trialBalance(db as never);
    for (const t of tbFinal) {
      const row = w.trialBalance.find((r) => r.accountId === t.accountId)!;
      expect(Math.round(row.balance * 100)).toBe(t.balance); // تطابقٌ بالسنت
    }

    // ٧) «مقترحاتي» النهائيّة للمسؤول: لا معلّقَ باقٍ
    asOfficer();
    const mine2 = await ledger.financeActionsData({ mine: true });
    expect(mine2.items.filter((i) => i.status === "pending").length).toBe(0);
    expect(mine2.items.length).toBe(9);
  });

  it("الحارسُ الماليّ: الاستيرادُ المرفوضُ لا يُنفَّذ، وإعادةُ اعتماد فعلٍ منفَّذٍ تفشل، والدفعةُ المكرّرةُ تُرفَض", async () => {
    asAdmin();
    await ledger.openingBalanceData({ accountId: "1110", fundId: "general", amount: 100 });
    asOfficer();
    const rows = [{ donor: "س", fund: "general", amount: 10, mosque: "m1" }];
    const sub = await ledger.submitImportData({ kind: "donations", rows }) as { queued?: boolean; actionId: string };
    asAdmin();
    const rej = await ledger.decideFinanceActionData({ actionId: sub.actionId, approve: false, reason: "بياناتٌ غيرُ موثوقة" }) as { status?: string };
    expect(rej.status).toBe("rejected");
    expect((await db.select().from(schema.donations).all()).length).toBe(0);
    const b = (await db.select().from(schema.importBatches).all())[0];
    expect(b.status).toBe("pending"); // الدفعةُ بقيت غيرَ منفَّذة
    // إعادةُ القرار على فعلٍ مبتوتٍ فيه تُرفَض
    const redecide = await ledger.decideFinanceActionData({ actionId: sub.actionId, approve: true }) as { error?: string };
    expect(redecide.error).toContain("مبتوت");
    // نفسُ الملفّ لا يُرفَع ثانيةً (بصمةُ المحتوى) حتى بعد الرفض
    asOfficer();
    const again = await ledger.submitImportData({ kind: "donations", rows }) as { error?: string };
    expect(again.error).toContain("رُفع سلفًا");
    await assertBalancedToTheCent();
  });
});
