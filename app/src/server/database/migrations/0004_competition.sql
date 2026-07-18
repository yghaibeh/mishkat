-- هجرة المسابقة (المرحلة 4)
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_month TEXT,
  end_month TEXT,
  qualification_month TEXT,
  prize_pool REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_programs (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  month_hijri TEXT NOT NULL,
  track TEXT NOT NULL,
  title TEXT NOT NULL,
  max_points INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mp_comp ON monthly_programs(competition_id);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  mosque_id TEXT NOT NULL,
  age_at_registration INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_part_comp ON participants(competition_id);

CREATE TABLE IF NOT EXISTS participant_scores (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  excuse_status TEXT NOT NULL DEFAULT 'none',
  recorded_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ps_part ON participant_scores(participant_id);

CREATE TABLE IF NOT EXISTS central_exams (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date_hijri TEXT,
  max_score INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_er_exam ON exam_results(exam_id);
