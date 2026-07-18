CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  mosque_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'main',
  head_person_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comm_mosque ON committees(mosque_id);
CREATE TABLE IF NOT EXISTS committee_plans (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL,
  title TEXT NOT NULL,
  period TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_comm ON committee_plans(committee_id);
