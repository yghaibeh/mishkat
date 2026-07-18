-- المرحلة ١ — المانحون والأموال المقيّدة وسنداتُ القبض. (عملةٌ واحدة: دولار.)

-- سجلُّ المانحين (لكشوفهم وربط تبرّعاتهم)
CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_donors_name ON donors (name);

-- وسمُ التبرّع بصندوقه ومانحه وسندِ قبضه المرقّم
ALTER TABLE donations ADD COLUMN fund_id TEXT NOT NULL DEFAULT 'general';
ALTER TABLE donations ADD COLUMN donor_id TEXT;
ALTER TABLE donations ADD COLUMN receipt_no TEXT;
CREATE INDEX IF NOT EXISTS idx_don_receipt ON donations (receipt_no);

-- وسمُ المصروف بصندوقه (لضبط صرف المقيّد)
ALTER TABLE expenses ADD COLUMN fund_id TEXT NOT NULL DEFAULT 'general';

-- عدّاداتٌ متسلسلةٌ (سندُ القبض المرقّم بلا فجوات)
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO counters (name, value) VALUES ('receipt', 0);
