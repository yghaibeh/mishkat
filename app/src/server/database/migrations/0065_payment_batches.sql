-- المرحلة ٣ (متخصّص) — دفعاتُ الصرف المجمّعة: تجميعُ مستحقّي الصرف (أمراء/معلّمون) في دفعةٍ واحدة،
-- تُصرَف بقيدٍ واحدٍ متوازن (Dr 5100 الرواتب / Cr 1110 النقد) بإجماليّها، مع كشفِ صرفٍ قابلٍ للطباعة.
CREATE TABLE IF NOT EXISTS payment_batches (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT,                          -- شهرٌ هجريٌّ اختياريّ '1447-01'
  fund_id TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',  -- open | paid
  created_by TEXT,
  created_at INTEGER NOT NULL,
  paid_by TEXT,
  paid_at INTEGER
);

CREATE TABLE IF NOT EXISTS payment_batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  person_name TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batch_item ON payment_batch_items (batch_id);
