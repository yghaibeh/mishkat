-- هجرة إكمال المرحلة 5 + منصة (مالية داخلية، اجتماعات، خطط، تحفيظ، حلقات أسبوعية، إشعارات، مصادقة)

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY, mosque_id TEXT NOT NULL, donor_name TEXT, amount REAL NOT NULL,
  collected_by TEXT, approved_by_amir INTEGER NOT NULL DEFAULT 1, note TEXT, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_don_mosque ON donations(mosque_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, mosque_id TEXT NOT NULL, category TEXT, amount REAL NOT NULL,
  spent_by TEXT, note TEXT, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exp_mosque ON expenses(mosque_id);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY, mosque_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'periodic',
  called_by TEXT, scheduled_at INTEGER NOT NULL, member_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meet_mosque ON meetings(mosque_id);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, person_id TEXT NOT NULL, present INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_att_meet ON meeting_attendance(meeting_id);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'binding',
  votes_for INTEGER NOT NULL DEFAULT 0, votes_against INTEGER NOT NULL DEFAULT 0, total_voters INTEGER NOT NULL DEFAULT 0,
  amir_vote_for INTEGER, result TEXT, note TEXT
);
CREATE INDEX IF NOT EXISTS idx_dec_meet ON decisions(meeting_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, mosque_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'outgoing',
  title TEXT NOT NULL, ref_url TEXT, created_by TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS annual_plans (
  id TEXT PRIMARY KEY, org_unit_id TEXT NOT NULL, committee TEXT NOT NULL, year_hijri TEXT NOT NULL,
  title TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned',
  due_at INTEGER, done_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pi_plan ON plan_items(plan_id);

CREATE TABLE IF NOT EXISTS tahfeez_circles (
  id TEXT PRIMARY KEY, mosque_id TEXT NOT NULL, name TEXT NOT NULL, teacher_person_id TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tahfeez_students (
  id TEXT PRIMARY KEY, circle_id TEXT NOT NULL, person_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ts_circle ON tahfeez_students(circle_id);

CREATE TABLE IF NOT EXISTS tahfeez_progress (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL, scope TEXT, from_ayah INTEGER, to_ayah INTEGER,
  rating INTEGER, date_hijri TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tp_student ON tahfeez_progress(student_id);

CREATE TABLE IF NOT EXISTS halaqa_group_activities (
  id TEXT PRIMARY KEY, halaqa_id TEXT NOT NULL, week_start TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL, date_hijri TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hga_halaqa ON halaqa_group_activities(halaqa_id);

CREATE TABLE IF NOT EXISTS weekly_halaqa_records (
  id TEXT PRIMARY KEY, halaqa_id TEXT NOT NULL, week_start TEXT NOT NULL,
  supervisor_notes TEXT, admin_notes TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, person_id TEXT NOT NULL, channel TEXT NOT NULL, kind TEXT NOT NULL,
  payload TEXT, status TEXT NOT NULL DEFAULT 'queued', created_at INTEGER NOT NULL, sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notif_person ON notifications(person_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rt_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL
);
