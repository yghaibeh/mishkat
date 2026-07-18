-- هجرة دورة الإدارة / الحوكمة (المرحلة 5)
CREATE TABLE IF NOT EXISTS resignations (
  id TEXT PRIMARY KEY,
  role_assignment_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  reason TEXT,
  requested_at INTEGER NOT NULL,
  decision_deadline INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_resig_ra ON resignations(role_assignment_id);
