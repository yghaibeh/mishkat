// مولّدُ المصنّف الشامل (١٩ ورقة) — يصوغ ملفَّ xlsx في المتصفّح من JSON دالّةِ الخادم المجمِّعة.
// ExcelJS (بديلُ SheetJS CE الموثَّق في الوثيقة ٢٨): يدعم RTL وقوائمَ التحقّق المنسدلة والتجميدَ والتنسيق.
// كلُّ خليّةٍ نصّيّةٍ تمرّ بمعقِّم حقن الصيغ (sanitize.ts).
import { sanitizeCell } from "./sanitize";

type Rows = Array<Record<string, unknown>>;
type WB = import("exceljs").Workbook;
type WS = import("exceljs").Worksheet;

const NUM_FMT = "#,##0.00";

function fmtDate(ms: unknown): string {
  if (typeof ms !== "number" || !ms) return "";
  return new Date(ms).toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ورقةٌ RTL برأسٍ عربيٍّ مجمّدٍ مُنسَّق + صفوفٌ معقَّمة + أعمدةُ أرقامٍ بتنسيق محاسبيّ
function addSheet(wb: WB, name: string, headers: string[], rows: unknown[][], numCols: number[] = []): WS {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const hr = ws.addRow(headers.map((h) => sanitizeCell(h)));
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; c.alignment = { horizontal: "center" }; });
  for (const r of rows) ws.addRow(r.map((v) => sanitizeCell(v)));
  ws.columns.forEach((col, i) => {
    col.width = Math.max(12, headers[i] ? headers[i].length + 6 : 12);
    if (numCols.includes(i)) col.numFmt = NUM_FMT;
  });
  return ws;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildFinanceWorkbook(data: any): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb: WB = new ExcelJS.Workbook();
  wb.creator = "مِشكاة";
  fillWorkbook(wb, data);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// الملءُ منفصلًا ليُختبَر في Node (بلا Blob) — نفسُ المنطق تمامًا.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fillWorkbook(wb: WB, data: any): void {
  // ١ الملخّص
  addSheet(wb, "الملخّص", ["البند", "القيمة", "تفصيل"], [
    ["الفترة", data.meta.period, ""],
    ["عددُ سطور اليوميّة", data.meta.txnCount, ""],
    ["عددُ التبرّعات", data.meta.donCount, ""],
    ["عددُ المصروفات", data.meta.expCount, ""],
    ...data.summary.fundBalances.map((f: { name: string; balance: number; restricted: boolean }) =>
      [`رصيدُ صندوق ${f.name}`, f.balance, f.restricted ? "مقيَّد" : "حرّ"]),
    ...data.summary.currencyBalances.map((c: { name: string; native: number; usdValue: number; code: string }) =>
      [`نقدُ ${c.name}`, c.native, `$${c.usdValue}`]),
  ], [1]);

  // ٢ دفتر اليوميّة
  addSheet(wb, "دفتر اليوميّة",
    ["التاريخ (م)", "التاريخ (هـ)", "البيان", "المصدر", "الحساب", "الصندوق", "مدين $", "دائن $", "العملة", "المبلغ الأصليّ", "المرجع"],
    data.journal.map((j: Record<string, unknown>) => [fmtDate(j.date), j.dateHijri, j.memo, j.source, j.accountName, j.fundName, j.debit, j.credit, j.currency ?? "USD", j.origAmount, j.sourceRef]),
    [6, 7, 9]);

  // ٣ ميزان المراجعة
  addSheet(wb, "ميزان المراجعة",
    ["الرمز", "الحساب", "النوع", "مدين $", "دائن $", "الرصيد $"],
    data.trialBalance.map((t: Record<string, unknown>) => [t.accountId, t.name, t.type, t.debit, t.credit, t.balance]),
    [3, 4, 5]);

  // ٤ قائمة النشاط
  addSheet(wb, "قائمة النشاط",
    ["الصندوق", "الإيراد $", "المصروف $", "الصافي $"],
    [
      ...data.activities.funds.map((f: Record<string, unknown>) => [f.fundName, f.income, f.expense, f.net]),
      ["الإجماليّ", data.activities.totals.income, data.activities.totals.expense, data.activities.totals.net],
    ], [1, 2, 3]);

  // ٥ المركز الماليّ
  addSheet(wb, "المركز الماليّ",
    ["القسم", "البند", "الرصيد $"],
    [
      ...data.position.assets.map((a: Record<string, unknown>) => ["الأصول", a.name, a.balance]),
      ["الأصول", "إجماليُّ الأصول", data.position.assetsTotal],
      ...data.position.liabilities.map((l: Record<string, unknown>) => ["الخصوم", l.name, l.balance]),
      ["الخصوم", "إجماليُّ الخصوم", data.position.liabilitiesTotal],
      ...data.position.netAssetsByFund.map((f: Record<string, unknown>) => ["صافي الأصول", f.fundName, f.balance]),
      ["صافي الأصول", "إجماليُّ صافي الأصول", data.position.netAssetsTotal],
      ["برهانُ التوازن", data.position.balanced ? "متوازنٌ ✓" : "غيرُ متوازن ✗", data.position.assetsTotal],
    ], [2]);

  // ٦ التدفّق النقديّ
  const cf = data.cashflow;
  addSheet(wb, "التدفّق النقديّ",
    ["التصنيف", "البند", "المبلغ $"],
    [
      ...cf.operating.lines.map((l: Record<string, unknown>) => ["تشغيليّ", l.label, l.amount]),
      ["تشغيليّ", "صافي التشغيليّ", cf.operating.net],
      ...cf.investing.lines.map((l: Record<string, unknown>) => ["استثماريّ", l.label, l.amount]),
      ["استثماريّ", "صافي الاستثماريّ", cf.investing.net],
      ...cf.financing.lines.map((l: Record<string, unknown>) => ["تمويليّ", l.label, l.amount]),
      ["تمويليّ", "صافي التمويليّ", cf.financing.net],
      ["", "صافي التغيّر في النقد", cf.netChange],
      ["", "رصيدُ النقد (تراكميّ)", cf.cashBalance],
    ], [2]);

  // ٧ التبرّعات
  addSheet(wb, "التبرّعات",
    ["السند", "التاريخ", "المانح", "الصندوق", "المبلغ $", "العملة", "المبلغ الأصليّ", "المسجد", "ملاحظة"],
    data.donations.map((d: Record<string, unknown>) => [d.receiptNo, fmtDate(d.at), d.donorName, d.fundName, d.amountUsd, d.currency, d.origAmount, d.mosque, d.note]),
    [4, 6]);

  // ٨ المصروفات
  addSheet(wb, "المصروفات",
    ["التاريخ", "البند", "الصندوق", "المبلغ $", "العملة", "المبلغ الأصليّ", "المسجد", "ملاحظة"],
    data.expenses.map((e: Record<string, unknown>) => [fmtDate(e.at), e.category, e.fundName, e.amountUsd, e.currency, e.origAmount, e.mosque, e.note]),
    [3, 5]);

  // ٩ المانحون والتعهّدات
  const donorRows: unknown[][] = [];
  for (const d of data.donors as Array<Record<string, unknown> & { pledges: Rows }>) {
    donorRows.push([d.name, d.phone, d.total, d.count, "", "", "", ""]);
    for (const p of d.pledges) donorRows.push(["", "", "", "", p.fundName, p.amount, p.fulfilled, p.remaining]);
  }
  addSheet(wb, "المانحون والتعهّدات",
    ["المانح", "الهاتف", "إجماليُّ العطاء $", "عددُ التبرّعات", "صندوقُ التعهّد", "التعهّد $", "الموفى $", "المتبقّي $"],
    donorRows, [2, 5, 6, 7]);

  // ١٠ الموازنات
  addSheet(wb, "الموازنات",
    ["الفترة", "الصندوق", "المخطّط $", "الفعليّ $", "المتبقّي $", "٪"],
    data.budgets.map((b: Record<string, unknown>) => [b.period, b.fundName, b.planned, b.actual, b.remaining, b.pct]),
    [2, 3, 4]);

  // ١١ مطالبات الصرف
  addSheet(wb, "مطالبات الصرف",
    ["التاريخ", "البند", "الصندوق", "المبلغ $", "الحالة", "الطالب", "المقرِّر", "سببُ الرفض", "الإيصال"],
    data.claims.map((c: Record<string, unknown>) => [fmtDate(c.at), c.category, c.fundName, c.amount, c.status, c.requestedBy, c.decidedBy, c.rejectReason, c.receiptUrl]),
    [3]);

  // ١٢ الرواتب
  addSheet(wb, `الرواتب${data.payroll.month ? ` ${data.payroll.month}` : ""}`,
    ["الشخص", "الشهر", "الإجماليّ $", "البدلات $", "الخصومات $", "قسطُ السلفة $", "الصافي $", "الحالة"],
    data.payroll.rows.map((p: Record<string, unknown>) => [p.person, p.month, p.gross, p.allowances, p.deductions, p.advanceRecovery, p.net, p.status]),
    [2, 3, 4, 5, 6]);

  // ١٣ السُلَف
  addSheet(wb, "السُلَف",
    ["الشخص", "الأصل $", "القسطُ الشهريّ $", "المتبقّي $", "الحالة"],
    data.advances.map((a: Record<string, unknown>) => [a.personName, a.principal, a.monthlyDeduction, a.balance, a.status]),
    [1, 2, 3]);

  // ١٤ النثريّة (صناديقُ + حركات)
  const pettyRows: unknown[][] = [];
  for (const b of data.petty as Array<Record<string, unknown> & { txns: Rows }>) {
    pettyRows.push([b.name, b.custodianName, b.floatAmount, b.balance, b.spent, b.status, "", "", ""]);
    for (const t of b.txns) pettyRows.push(["", "", "", "", "", "", fmtDate(t.createdAt), t.kind, t.amount]);
  }
  addSheet(wb, "النثريّة",
    ["الصندوق", "الأمين", "السقف $", "الرصيد $", "المنصرف $", "الحالة", "تاريخُ الحركة", "نوعُها", "مبلغُها $"],
    pettyRows, [2, 3, 4, 8]);

  // ١٥ دفعات الصرف
  const batchRows: unknown[][] = [];
  for (const b of data.batches as Array<Record<string, unknown> & { detail: { items: Rows } }>) {
    batchRows.push([b.title, b.period, b.status, b.total, b.count, "", ""]);
    for (const it of b.detail.items) batchRows.push(["", "", "", "", "", it.personName, it.amount]);
  }
  addSheet(wb, "دفعات الصرف",
    ["الدفعة", "الفترة", "الحالة", "الإجماليّ $", "عددُ البنود", "المستفيد", "مبلغُه $"],
    batchRows, [3, 6]);

  // ١٦ الأصول الثابتة
  const assetRows: unknown[][] = [];
  for (const a of data.assets as Array<Record<string, unknown> & { schedule: Rows }>) {
    assetRows.push([a.name, a.cost, a.salvage, a.lifeMonths, a.monthly, a.accumulated, a.netBookValue, a.status, "", ""]);
    for (const s of a.schedule) assetRows.push(["", "", "", "", "", "", "", "", s.period, s.amount]);
  }
  addSheet(wb, "الأصول الثابتة",
    ["الأصل", "التكلفة $", "المتبقّية $", "العمر (شهر)", "القسط $", "المجمّع $", "القيمة الدفتريّة $", "الحالة", "فترةُ إهلاك", "قسطُها $"],
    assetRows, [1, 2, 4, 5, 6, 9]);

  // ١٧ العملات والتصريف
  addSheet(wb, "العملات والتصريف",
    ["العملة", "السعرُ للدولار", "تاريخُ السريان", "عمليّةُ تصريف", "مكسب $", "خسارة $"],
    [
      ...data.currencies.rates.map((r: Record<string, unknown>) => [r.currency, r.rateToBase, fmtDate(r.effectiveAt), "", "", ""]),
      ...data.currencies.exchanges.map((x: Record<string, unknown>) => ["", "", "", `${x.memo ?? "تصريف"} (${fmtDate(x.at)})`, x.gain, x.loss]),
    ], [4, 5]);

  // ١٨ المطابقة البنكيّة
  addSheet(wb, "المطابقة البنكيّة",
    ["الحساب", "رصيدُ الدفتر $", "المُطابَق $", "غيرُ المُطابَق $", "قيودٌ غيرُ مطابَقة"],
    data.reconciliation.map((r: Record<string, unknown>) => [r.accountName, r.bookBalance, r.cleared, r.uncleared, r.unclearedCount]),
    [1, 2, 3]);

  // ١٩ سجلّ الاعتمادات
  addSheet(wb, "سجلّ الاعتمادات",
    ["الفعل", "الملخّص", "المبلغ $", "الحالة", "المقترِح", "زمنُ الاقتراح", "المقرِّر", "زمنُ القرار", "سببُ الرفض", "خطأ"],
    data.approvals.map((a: Record<string, unknown>) => [a.kind, a.summary, a.amountUsd, a.status, a.proposedBy, fmtDate(a.proposedAt), a.decidedBy, fmtDate(a.decidedAt), a.rejectReason, a.error]),
    [2]);
}

// تنزيلُ الملفّ في المتصفّح
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
