-- المرحلة ٢ — الموازنة: مبلغٌ مخطّطٌ للصرف على صندوقٍ (وحسابٍ اختياريٍّ) في فترةٍ هجريّة.
-- account_id = '' يعني «كلّ مصروفات الصندوق»؛ وإلا حسابُ مصروفٍ بعينه (رواتب/تشغيليّ/محروقات…).
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,                  -- سنةٌ '1447' أو شهرٌ '1447-12'
  fund_id TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',   -- '' = كلّ الصندوق
  amount REAL NOT NULL,                  -- المخطّط (دولار)
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_uniq ON budgets (period, fund_id, account_id);
