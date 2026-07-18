// د٤: قوالبُ الاستيراد وتحليلُ الملفّات — كلُّه في المتصفّح (الخادمُ لا يلمس xlsx).
// القالب: صفُّ عناوينَ عربيّةٍ + صفُّ مفاتيحَ إنجليزيّةٍ مخفيّ + قوائمُ تحقّقٍ منسدلةٌ حيّة + ورقةُ تعليمات.
import { sanitizeCell } from "./sanitize";

export type TemplateColumn = { key: string; label: string; required?: boolean; list?: string };
export type TemplateSpec = { kind: string; label: string; columns: TemplateColumn[] };
export type TemplateLists = Record<string, string[]>;

export const IMPORT_FILE_LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 500 };

// حرفُ عمود Excel (A..Z ثمّ AA..)
function colLetter(i: number): string {
  let n = i + 1, s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export async function buildImportTemplate(spec: TemplateSpec, lists: TemplateLists): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "مِشكاة";

  // ورقةُ القوائم (مخفيّة) — مراجعُ قوائم التحقّق المنسدلة
  const lws = wb.addWorksheet("قوائم", { state: "veryHidden" });
  const listRanges = new Map<string, string>();
  let li = 0;
  for (const [name, values] of Object.entries(lists)) {
    if (!values.length) continue;
    const col = colLetter(li);
    values.forEach((v, r) => { lws.getCell(`${col}${r + 1}`).value = v; });
    listRanges.set(name, `'قوائم'!$${col}$1:$${col}$${values.length}`);
    li += 1;
  }

  // ورقةُ البيانات
  const ws = wb.addWorksheet("بيانات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }] });
  const hr = ws.addRow(spec.columns.map((c) => `${c.label}${c.required ? " *" : ""}`));
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; c.alignment = { horizontal: "center" }; });
  const kr = ws.addRow(spec.columns.map((c) => c.key)); // صفُّ المفاتيح — يقرؤه المحلِّل
  kr.hidden = true;
  ws.columns.forEach((col, i) => { col.width = Math.max(14, spec.columns[i].label.length + 6); });
  // قوائمُ تحقّقٍ منسدلةٌ على 500 صفّ
  spec.columns.forEach((c, i) => {
    if (!c.list || !listRanges.has(c.list)) return;
    const col = colLetter(i);
    for (let r = 3; r <= IMPORT_FILE_LIMITS.maxRows + 2; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [listRanges.get(c.list)!],
        showErrorMessage: true, errorTitle: "قيمةٌ غيرُ مقبولة", error: "اختر من القائمة المنسدلة",
      };
    }
  });

  // ورقةُ التعليمات (بمثالٍ توضيحيّ — لا صفَّ مثالٍ في البيانات كي لا يُستورَد سهوًا)
  const iws = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  const tips = [
    [`قالبُ «${spec.label}» — مِشكاة`],
    [""],
    ["١. املأ ورقةَ «بيانات» من الصفّ الثالث (الصفّان الأوّلان رأسُ الجدول — لا تعدّلهما)."],
    ["٢. الأعمدةُ المعلَّمةُ بـ* إلزاميّة، وذاتُ القوائم المنسدلة تُختار لا تُكتَب."],
    [`٣. الحدُّ ${IMPORT_FILE_LIMITS.maxRows} صفًّا و${Math.round(IMPORT_FILE_LIMITS.maxBytes / 1024 / 1024)}MB لكلّ ملفّ.`],
    ["٤. الملفُّ يُدقَّق كاملًا قبل القبول: أيُّ خطأٍ في أيّ صفٍّ يوقف الاستيرادَ كلَّه (تشدّدٌ محاسبيّ)."],
    ["٥. بعد التأكيد يمرّ الاستيرادُ باعتماد المدير إن كنتَ مسؤولًا ماليًّا."],
    ["٦. التاريخُ الهجريُّ بصيغة 1447-05 (اختياريٌّ حيث يظهر)."],
    [""],
    ["أعمدةُ هذا القالب:"],
    ...spec.columns.map((c) => [`• ${c.label}${c.required ? " (إلزاميّ)" : ""} — المفتاح: ${c.key}`]),
  ];
  for (const t of tips) iws.addRow(t.map((x) => sanitizeCell(x)));
  iws.getColumn(1).width = 80;
  iws.getRow(1).font = { bold: true, size: 14 };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// تحليلُ ملفٍّ مرفوع: يقرأ ورقةَ «بيانات»، يأخذ المفاتيحَ من الصفّ الثاني، والبياناتِ من الثالث فصاعدًا.
export async function parseImportFile(file: File): Promise<{ rows: Array<Record<string, unknown>> } | { error: string }> {
  if (file.size > IMPORT_FILE_LIMITS.maxBytes) return { error: `الملفُّ أكبرُ من ${Math.round(IMPORT_FILE_LIMITS.maxBytes / 1024 / 1024)}MB` };
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return { error: "تعذّرت قراءةُ الملفّ — أهو ملفُّ xlsx صالح؟" }; }
  const ws = wb.getWorksheet("بيانات") ?? wb.worksheets[0];
  if (!ws) return { error: "لا ورقةَ بياناتٍ في الملفّ" };
  const keys: string[] = [];
  ws.getRow(2).eachCell({ includeEmpty: true }, (c, i) => { keys[i - 1] = String(c.value ?? "").trim(); });
  if (!keys.filter(Boolean).length) return { error: "الملفُّ ليس من قوالب مِشكاة (صفُّ المفاتيح مفقود) — نزِّل القالبَ الرسميّ" };
  const rows: Array<Record<string, unknown>> = [];
  ws.eachRow((row, n) => {
    if (n <= 2) return;
    const obj: Record<string, unknown> = {};
    let any = false;
    row.eachCell({ includeEmpty: true }, (c, i) => {
      const k = keys[i - 1];
      if (!k) return;
      let v: unknown = c.value;
      if (v && typeof v === "object" && "result" in (v as object)) v = (v as { result: unknown }).result; // خلايا صيغ
      if (v && typeof v === "object" && "text" in (v as object)) v = (v as { text: unknown }).text;       // نصوصٌ غنيّة
      if (typeof v === "string") { v = v.trim(); if (v && /^'/.test(v as string)) v = (v as string).slice(1); }
      if (v !== null && v !== undefined && v !== "") { obj[k] = v; any = true; }
    });
    if (any) rows.push(obj);
  });
  if (rows.length > IMPORT_FILE_LIMITS.maxRows) return { error: `الحدُّ ${IMPORT_FILE_LIMITS.maxRows} صفًّا — قسِّم الملفّ` };
  return { rows };
}

// ورقةُ الأخطاء القابلةُ للتنزيل: السطر + الخطأ، ليُصلحها المستورِد ويعيد الرفع.
export async function buildErrorSheet(kindLabel: string, errors: Array<{ row: number; error: string }>): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("أخطاء الاستيراد", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const hr = ws.addRow(["الصفّ في ملفّك", "الخطأ", "القالب"]);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } }; });
  for (const e of errors) ws.addRow([e.row, sanitizeCell(e.error), sanitizeCell(kindLabel)]);
  ws.getColumn(1).width = 14; ws.getColumn(2).width = 70; ws.getColumn(3).width = 20;
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
