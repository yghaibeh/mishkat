-- دروس/محاضرات المسجد (الوثيقة ٢٦ §د — مستوحاة من «مجلس»): جدولةٌ بكشف تعارضٍ + حضور.
CREATE TABLE mosque_lessons (
  id TEXT PRIMARY KEY,
  mosque_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  place TEXT,                              -- القاعة/الموضع داخل المسجد
  starts_at INTEGER NOT NULL,              -- طابع زمنيّ
  duration_min INTEGER NOT NULL DEFAULT 45,
  material_id TEXT,                        -- مادّةٌ مرتبطةٌ من المكتبة (اختياري)
  status TEXT NOT NULL DEFAULT 'scheduled',-- scheduled | confirmed | delivered | cancelled
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_mlessons_mosque ON mosque_lessons(mosque_id);
CREATE INDEX idx_mlessons_starts ON mosque_lessons(starts_at);

CREATE TABLE mosque_lesson_attendance (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  person_id TEXT,                          -- إن كان معروف الهوية
  name TEXT NOT NULL,                      -- الاسم المعروض (حرّ أو من كشف الحلقات)
  present INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(lesson_id, name)
);
CREATE INDEX idx_mlatt_lesson ON mosque_lesson_attendance(lesson_id);
