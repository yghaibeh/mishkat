-- هجرة أولية — منصة المسجد المؤثر (S1)
CREATE TABLE IF NOT EXISTS org_units (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  gender_track TEXT NOT NULL DEFAULT 'male',
  name TEXT NOT NULL,
  city TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_units_path ON org_units(path);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON org_units(parent_id);

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_year_hijri INTEGER,
  home_org_unit_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS person_contacts (
  person_id TEXT PRIMARY KEY,
  phone TEXT,
  telegram TEXT,
  guardian_phone TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  login TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  last_login INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login);

CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL,
  org_unit_id TEXT NOT NULL,
  org_path TEXT NOT NULL,
  portfolio TEXT,
  start_date INTEGER,
  end_date INTEGER,
  term_number INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  approved_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ra_person ON role_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_ra_org_path ON role_assignments(org_path);
CREATE INDEX IF NOT EXISTS idx_ra_org_unit ON role_assignments(org_unit_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  at INTEGER NOT NULL
);
