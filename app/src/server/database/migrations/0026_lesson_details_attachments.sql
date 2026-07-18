-- توسيع جلسة الدرس: حضور + تقييم ذاتي + نشاطات مصاحبة + سبب رفض (الموافقة عبر status)
ALTER TABLE lesson_sessions ADD COLUMN attendance_count INTEGER;
ALTER TABLE lesson_sessions ADD COLUMN self_eval INTEGER;
ALTER TABLE lesson_sessions ADD COLUMN companion_activities TEXT;
ALTER TABLE lesson_sessions ADD COLUMN rejection_reason TEXT;

-- مرفقات الدرس (صور توثيقية في R2)
CREATE TABLE IF NOT EXISTS lesson_attachments (
  id TEXT PRIMARY KEY,
  lesson_session_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  caption TEXT,
  content_type TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lesson_att_lesson ON lesson_attachments(lesson_session_id);
