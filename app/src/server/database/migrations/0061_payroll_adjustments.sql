-- المرحلة ٤ — تعديلاتُ الراتب: بدلاتٌ (+) وخصوماتٌ (−) لكلّ شخصٍ في شهرٍ، فيصير الصافي ≠ الإجماليّ.
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  month TEXT NOT NULL,                 -- شهرٌ هجريّ '1447-12'
  kind TEXT NOT NULL,                  -- allowance | deduction
  amount REAL NOT NULL,               -- موجبٌ دومًا؛ النوعُ يحدّد الإشارة
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adj_person_month ON payroll_adjustments (person_id, month);
