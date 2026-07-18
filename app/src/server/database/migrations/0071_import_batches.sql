-- د٤ (الوثيقة ٢٨ §٣.٣-٣.٤): الاستيرادُ بالقوالب المعتمدة — دفعاتُ استيرادٍ بصفوفها،
-- ببصمة محتوًى تمنع رفعَ الملفّ نفسِه مرّتين، وعدّادِ صفوفٍ منفَّذةٍ يجعل التنفيذَ مستأنَفًا.
CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- donations|expenses|opening_balances|batch_items|payroll_adjustments|fx_rates|budgets|assets|donors
  filename TEXT,
  content_hash TEXT NOT NULL,         -- SHA-256 لصفوف الملفّ — كشفُ تكرار الرفع
  row_count INTEGER NOT NULL DEFAULT 0,
  total_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | executing | done | failed
  executed_rows INTEGER NOT NULL DEFAULT 0,   -- مؤشّرُ الاستئناف: الصفوفُ المنجزةُ فعلًا
  meta TEXT,                          -- JSON إضافيّ (دفعةُ الصرف الهدف…)
  error TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(kind, content_hash)
);
CREATE INDEX idx_imp_batches_status ON import_batches(status);

CREATE TABLE import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_no INTEGER NOT NULL,
  payload TEXT NOT NULL,              -- JSON الصفّ المتحقَّقُ منه
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | failed
  result_ref TEXT,
  error TEXT,
  UNIQUE(batch_id, row_no)
);
CREATE INDEX idx_imp_rows_batch ON import_rows(batch_id, status);
