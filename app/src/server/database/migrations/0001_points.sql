-- هجرة نظام النقاط (S3–S4)
CREATE TABLE IF NOT EXISTS activity_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  gender_track TEXT NOT NULL,
  category TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS points_schemes (
  id TEXT PRIMARY KEY,
  gender_track TEXT NOT NULL,
  weekly_target INTEGER NOT NULL DEFAULT 70,
  valid_from INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS points_scheme_items (
  id TEXT PRIMARY KEY,
  scheme_id TEXT NOT NULL,
  activity_type_id TEXT NOT NULL,
  points INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_psi_scheme ON points_scheme_items(scheme_id);

CREATE TABLE IF NOT EXISTS weekly_records (
  id TEXT PRIMARY KEY,
  mosque_id TEXT NOT NULL,
  mosque_path TEXT NOT NULL,
  week_start TEXT NOT NULL,
  hijri_month TEXT,
  scheme_id TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  locked INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER,
  last_entry_at INTEGER,
  approved_by_amir TEXT,
  approved_by_layer TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wr_mosque_week ON weekly_records(mosque_id, week_start);
CREATE INDEX IF NOT EXISTS idx_wr_week ON weekly_records(week_start);

CREATE TABLE IF NOT EXISTS daily_entries (
  id TEXT PRIMARY KEY,
  client_uuid TEXT NOT NULL,
  weekly_record_id TEXT NOT NULL,
  mosque_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  day TEXT NOT NULL,
  activity_type_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  shura_confirmed INTEGER NOT NULL DEFAULT 0,
  entered_by TEXT,
  entered_by_committee TEXT,
  recorded_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_de_client_uuid ON daily_entries(client_uuid);
CREATE INDEX IF NOT EXISTS idx_de_record ON daily_entries(weekly_record_id);

CREATE TABLE IF NOT EXISTS rate_schemes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  per_unit INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  valid_from INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
