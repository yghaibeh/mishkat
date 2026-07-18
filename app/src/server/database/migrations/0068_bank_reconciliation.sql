-- المطابقةُ البنكيّة/النقديّة: وسمُ قيودِ حسابِ نقدٍ بأنّها «طُوبِقت» (ظهرت في كشف البنك/الجرد).
-- وجودُ الصفّ = القيدُ مُطابَق. التقريرُ يقابل رصيدَ الدفتر بالمُطابَق وغيرِ المُطابَق.
CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  reconciled_by TEXT,
  reconciled_at INTEGER NOT NULL,
  note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recon_entry_acc ON reconciliations (entry_id, account_id);
CREATE INDEX IF NOT EXISTS idx_recon_acc ON reconciliations (account_id);
