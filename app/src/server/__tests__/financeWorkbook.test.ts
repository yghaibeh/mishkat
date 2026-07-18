// د٣ (الوثيقة ٢٨): المصنّفُ الشامل — أرقامُ الأوراق تطابق خدماتِ الشاشة بالسنت،
// والمعقِّمُ يُبطل حقنَ الصيغ، وقراءةُ الملفّ المولَّد تعيد نفسَ القيم. TDD.
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "./helpers";
import * as schema from "../database/schema";
import { collectFinanceWorkbook } from "../services/financeWorkbook";
import { recordDonation } from "../services/donorsFinance";
import { enterExpense } from "../services/financeEntry";
import { postJournal, toCents, trialBalance, fromCents } from "../services/ledger";
import { sanitizeCell, sanitizeRow } from "@/lib/excel/sanitize";
import { fillWorkbook } from "@/lib/excel/financeWorkbook";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "الفاروق", status: "active", createdAt: 0 } as never).run();
});

describe("معقِّمُ حقن الصيغ (Excel Injection)", () => {
  it("يُسبق =,+,-,@ بفاصلةٍ عليا ويترك النصوصَ والأرقامَ السليمة", () => {
    expect(sanitizeCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(sanitizeCell("+1234")).toBe("'+1234");
    expect(sanitizeCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeCell("@import")).toBe("'@import");
    expect(sanitizeCell("  =خبيث")).toBe("'  =خبيث"); // فراغاتٌ قائدة لا تُعمي المعقِّم
    expect(sanitizeCell("تبرّعٌ عاديّ")).toBe("تبرّعٌ عاديّ");
    expect(sanitizeCell(150.5)).toBe(150.5);
    expect(sanitizeCell(null)).toBe(null);
    expect(sanitizeRow(["=x", 5, "سليم"])).toEqual(["'=x", 5, "سليم"]);
  });
});

describe("collectFinanceWorkbook — تطابقُ الأرقام مع الخدمات", () => {
  it("التبرّعُ والمصروفُ يظهران في أوراقهما وميزانُ المراجعة يطابق trialBalance بالسنت", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 500, fund: "general", donorName: "محسن", collectedBy: "u1" });
    await enterExpense(db as never, { mosqueId: "m1", category: "كهرباء", amount: 120, fund: "general" }, "u1");
    const w = await collectFinanceWorkbook(db as never);

    expect(w.donations.length).toBe(1);
    expect(w.donations[0].amountUsd).toBe(500);
    expect(w.donations[0].receiptNo).toBeTruthy();
    expect(w.expenses.length).toBe(1);
    expect(w.expenses[0].amountUsd).toBe(120);

    // ميزانُ المراجعة في المصنّف = ميزانُ الخدمة (تحويلُ سنتاتٍ متطابق)
    const tb = await trialBalance(db as never);
    for (const t of tb) {
      const row = w.trialBalance.find((r) => r.accountId === t.accountId)!;
      expect(row.debit).toBe(Math.round(fromCents(t.debit) * 100) / 100);
      expect(row.credit).toBe(Math.round(fromCents(t.credit) * 100) / 100);
    }
    // برهانُ التوازن: Σمدين = Σدائن في ورقة اليوميّة
    const dSum = w.journal.reduce((s, j) => s + j.debit, 0);
    const cSum = w.journal.reduce((s, j) => s + j.credit, 0);
    expect(Math.round(dSum * 100)).toBe(Math.round(cSum * 100));
    // الملخّص: رصيدُ الصندوق العامّ = 380
    expect(w.summary.fundBalances.find((f) => f.fundId === "general")?.balance).toBe(380);
    // المركزُ الماليّ متوازن
    expect(w.position.balanced).toBe(true);
  });

  it("مرشّحُ الفترة يستبعد قيودَ فترةٍ أخرى ويحصر اليوميّةَ والقوائم", async () => {
    await postJournal(db as never, { source: "manual", sourceRef: "t1", memo: "قديم", dateHijri: "1446-01-15" }, [
      { accountId: "1110", fundId: "general", debit: toCents(100) },
      { accountId: "4100", fundId: "general", credit: toCents(100) },
    ]);
    await postJournal(db as never, { source: "manual", sourceRef: "t2", memo: "جديد", dateHijri: "1447-03-10" }, [
      { accountId: "1110", fundId: "general", debit: toCents(70) },
      { accountId: "4100", fundId: "general", credit: toCents(70) },
    ]);
    const w47 = await collectFinanceWorkbook(db as never, "1447");
    expect(w47.journal.length).toBe(2); // قيدٌ واحدٌ بسطرين
    expect(w47.journal.every((j) => j.memo === "جديد")).toBe(true);
    expect(w47.activities.totals.income).toBe(70);
    const wAll = await collectFinanceWorkbook(db as never);
    expect(wAll.journal.length).toBe(4);
    expect(wAll.meta.period).toBe("الكلّ");
  });

  it("سجلُّ الاعتمادات (١٩) يعرض أفعالَ المحرّك بأسماء أصحابها وحالاتها", async () => {
    await db.insert(schema.persons).values({ id: "p1", fullName: "المسؤول الماليّ", gender: "male", createdAt: 0 } as never).run();
    await db.insert(schema.users).values({ id: "u-off", personId: "p1", login: "off", passwordHash: "x", createdAt: 0 } as never).run();
    await db.insert(schema.financeActions).values({
      id: "fa1", kind: "expense_add", payload: "{}", summary: "مصروفُ تجربة $50", amountUsd: 50,
      status: "rejected", proposedBy: "u-off", proposedAt: 1000, decidedBy: "u-off", decidedAt: 2000,
      rejectReason: "بلا موازنة", clientUuid: "cu1", createdAt: 1000,
    } as never).run();
    const w = await collectFinanceWorkbook(db as never);
    expect(w.approvals.length).toBe(1);
    expect(w.approvals[0].proposedBy).toBe("المسؤول الماليّ");
    expect(w.approvals[0].status).toBe("rejected");
    expect(w.approvals[0].rejectReason).toBe("بلا موازنة");
  });
});

describe("توليدُ المصنّف وقراءتُه (ExcelJS read-back)", () => {
  it("١٩ ورقةً RTL برأسٍ مجمّد، والأرقامُ المقروءةُ تطابق البيانات، والخبيثُ معقَّم", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 300, fund: "general", donorName: "=HYPERLINK(\"http://x\")", collectedBy: "u1" });
    const data = await collectFinanceWorkbook(db as never);
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    fillWorkbook(wb as never, data);
    expect(wb.worksheets.length).toBe(19);
    // كلُّ الأوراق RTL + رأسٌ مجمّد
    for (const ws of wb.worksheets) {
      expect(ws.views[0]?.rightToLeft).toBe(true);
      expect((ws.views[0] as { ySplit?: number }).ySplit).toBe(1);
    }
    // اكتب ثمّ اقرأ (round-trip حقيقيّ عبر البايتات)
    const buf = await wb.xlsx.writeBuffer();
    const rb = new ExcelJS.Workbook();
    await rb.xlsx.load(buf as never);
    const dons = rb.getWorksheet("التبرّعات")!;
    expect(dons).toBeTruthy();
    const row2 = dons.getRow(2);
    // اسمُ المانح الخبيث عُقِّم بفاصلةٍ عليا — لا صيغةَ تنفيذيّة
    expect(String(row2.getCell(3).value)).toBe("'=HYPERLINK(\"http://x\")");
    expect(Number(row2.getCell(5).value)).toBe(300);
    // ميزانُ المراجعة المقروءُ يطابق الخدمة
    const tbSheet = rb.getWorksheet("ميزان المراجعة")!;
    const cash = data.trialBalance.find((t) => t.accountId === "1110")!;
    let found = false;
    tbSheet.eachRow((r, n) => {
      if (n > 1 && String(r.getCell(1).value) === "1110") { found = true; expect(Number(r.getCell(4).value)).toBe(cash.debit); }
    });
    expect(found).toBe(true);
  });
});
