-- المرحلة ب — سجلّ التحفيظ اليوميّ (المعلّم): جلسةٌ يوميّة + سجلّ كلّ طالب (حفظ/مراجعة/تجويد/مصاحب/حضور)
CREATE TABLE IF NOT EXISTS tahfeez_sessions (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL,
  date_hijri TEXT NOT NULL,
  day_no INTEGER,
  mosque_id TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tsess_circle_date ON tahfeez_sessions (circle_id, date_hijri);

CREATE TABLE IF NOT EXISTS tahfeez_daily_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attendance TEXT NOT NULL DEFAULT 'present',   -- present | absent | left | excused
  hifz_scope TEXT, hifz_from INTEGER, hifz_to INTEGER, hifz_grade INTEGER,       -- الحفظ (الإنجاز)
  review_scope TEXT, review_from INTEGER, review_to INTEGER, review_grade INTEGER, -- المراجعة
  tajweed_grade INTEGER,                          -- التجويد
  companion TEXT,                                 -- المنهج المصاحب
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tdr_session_student ON tahfeez_daily_records (session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tdr_student ON tahfeez_daily_records (student_id);
