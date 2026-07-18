-- إعلانات المنصّة (الوثيقة ٢٦ §ذ — من «مجلس»): خبرٌ/إعلانٌ من الإدارة يصل جرسَ كلّ
-- مَن في النطاق (+تيليغرام/Push لمن ربط). السجلّ هنا للتوثيق والتدقيق.
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scope_path TEXT NOT NULL DEFAULT '/',  -- '/' = الجميع؛ أو مسار قسم/منطقة/مربع/مسجد
  audience TEXT NOT NULL DEFAULT 'all',  -- all | leaders (مسؤولون فقط) | students
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_by_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_announcements_created ON announcements(created_at);
