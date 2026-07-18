// حمايةُ حقن الصيغ (Excel/CSV Injection): خليّةٌ نصّيّةٌ تبدأ بـ = + - @ (أو بمحارفِ تحكّمٍ تسبقها)
// تُسبَق بفاصلةٍ عليا «'» فيقرؤها Excel نصًّا صِرفًا لا صيغةً تنفيذيّة. تُطبَّق تصديرًا واستيرادًا.
const DANGEROUS = /^[\t\r\n ]*[=+\-@]/;

export function sanitizeCell(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return DANGEROUS.test(v) ? `'${v}` : v;
}

// صفٌّ كامل: يُعقَّم كلُّ نصٍّ فيه (الأرقامُ والتواريخُ تمرّ كما هي).
export function sanitizeRow(row: unknown[]): unknown[] {
  return row.map(sanitizeCell);
}
