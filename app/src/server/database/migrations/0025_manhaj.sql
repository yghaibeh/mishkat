-- منهاج «على بصيرة» (محتوى ثابت) — وحدات + دروس (المحتوى blocks كـJSON يُجلب عند الطلب)
CREATE TABLE IF NOT EXISTS manhaj_units (
  id TEXT PRIMARY KEY,
  ord INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manhaj_lessons (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  subject TEXT,
  duration_min INTEGER,
  hadith_count INTEGER NOT NULL DEFAULT 0,
  quran_count INTEGER NOT NULL DEFAULT 0,
  blocks TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manhaj_lessons_unit ON manhaj_lessons(unit_id);
