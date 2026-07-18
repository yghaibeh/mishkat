-- هجرة المالية (المرحلة 2)
CREATE TABLE IF NOT EXISTS monthly_entitlements (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  month TEXT NOT NULL,
  gross_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'proposed',
  approved_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ent_person_month ON monthly_entitlements(person_id, month);

CREATE TABLE IF NOT EXISTS entitlement_tracks (
  id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  basis REAL,
  rate REAL,
  amount REAL NOT NULL,
  source_ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_track_ent ON entitlement_tracks(entitlement_id);

CREATE TABLE IF NOT EXISTS incentives (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  month TEXT NOT NULL,
  reason TEXT,
  amount REAL NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL,
  net_amount REAL NOT NULL,
  paid_amount REAL NOT NULL,
  reference TEXT,
  recorded_by TEXT,
  paid_at INTEGER NOT NULL
);
