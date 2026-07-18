-- تتبّع تقدّم الطالبة في منهج «على بصيرة» (٦ أقسام/~٢٠ مجلسًا) لكل طالبة.
CREATE TABLE IF NOT EXISTS curriculum_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  manhaj_key TEXT NOT NULL,        -- المجلس (يوازي lesson_sessions.majlis)
  status TEXT NOT NULL DEFAULT 'completed', -- not_started | in_progress | completed
  rating INTEGER,
  source TEXT NOT NULL DEFAULT 'auto',      -- auto (من الحضور) | manual
  date_hijri TEXT,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_enroll_majlis ON curriculum_progress(enrollment_id, manhaj_key);
CREATE INDEX IF NOT EXISTS idx_cp_enroll ON curriculum_progress(enrollment_id);
