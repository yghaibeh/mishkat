-- مرفقات عامّة (صور توثيقية) لأيّ كيان — تُخزَّن في R2.
-- الاستعمال الحالي: scope='daily_record' refId=سجل الأسبوع (توثيق أنشطة اليوم لاطّلاع الإشراف والإعلام).
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  caption TEXT,
  content_type TEXT,
  uploaded_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_scope_ref ON attachments(scope, ref_id);
