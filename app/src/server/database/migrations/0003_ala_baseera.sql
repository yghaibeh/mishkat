-- هجرة وحدة «على بصيرة» (المرحلة 3)
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  org_unit_id TEXT,
  gender_track TEXT NOT NULL DEFAULT 'male',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  qualification TEXT,
  hourly_rate_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS halaqat (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  gender_track TEXT NOT NULL DEFAULT 'male',
  capacity INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_halaqa_teacher ON halaqat(teacher_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  halaqa_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enroll_halaqa ON enrollments(halaqa_id);

CREATE TABLE IF NOT EXISTS lesson_sessions (
  id TEXT PRIMARY KEY,
  halaqa_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  date_hijri TEXT,
  hijri_month TEXT,
  lesson_title TEXT,
  majlis TEXT,
  duration_hours REAL NOT NULL DEFAULT 0,
  materials TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ls_teacher_month ON lesson_sessions(teacher_id, hijri_month);

CREATE TABLE IF NOT EXISTS student_evaluations (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  lesson_session_id TEXT NOT NULL,
  score INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);

-- سعر الساعة الافتراضي لمعلّم «على بصيرة» (ق8) — مثال 2$/ساعة، قابل للتغيير
INSERT OR IGNORE INTO rate_schemes (id, kind, amount, per_unit, currency, valid_from, active) VALUES
  ('rate-hour-current', 'hourly_rate', 2, 1, 'USD', 0, 1);
