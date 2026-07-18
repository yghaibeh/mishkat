-- المرحلة ٣ — مطالباتُ الصرف (فصلُ المهامّ: مُدخِلٌ يطلب، معتمِدٌ يُقرّ فيُرحَّل للدفتر).
CREATE TABLE IF NOT EXISTS expense_claims (
  id TEXT PRIMARY KEY,
  mosque_id TEXT,                      -- المسجد/الوحدة (اختياريّ للصرف المركزيّ)
  fund_id TEXT NOT NULL DEFAULT 'general',
  category TEXT,
  amount REAL NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  decided_by TEXT,
  decided_at INTEGER,
  reject_reason TEXT,
  expense_id TEXT                      -- معرّفُ صفّ المصروف بعد الاعتماد (للربط بالدفتر)
);
CREATE INDEX IF NOT EXISTS idx_claim_status ON expense_claims (status);
CREATE INDEX IF NOT EXISTS idx_claim_mosque ON expense_claims (mosque_id);
