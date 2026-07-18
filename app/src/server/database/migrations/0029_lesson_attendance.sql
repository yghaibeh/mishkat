-- سجل الحلقة النسائية الغنيّ: حضور الطالبة (حاضر/غائب/مستأذن) + مَن اعتمد الدرس.
CREATE TABLE IF NOT EXISTS lesson_attendance (
  id TEXT PRIMARY KEY,
  lesson_session_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  state TEXT NOT NULL,            -- present | absent | excused
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_lesson ON lesson_attendance(lesson_session_id);
CREATE INDEX IF NOT EXISTS idx_att_enroll ON lesson_attendance(enrollment_id);

ALTER TABLE lesson_sessions ADD COLUMN approved_by TEXT;
