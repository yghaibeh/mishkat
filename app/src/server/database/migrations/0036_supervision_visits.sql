-- المرحلة أ — السجل الإشرافيّ على الحلقات (زيارة المشرف، ترفع للإدارة)
CREATE TABLE IF NOT EXISTS supervision_visits (
  id TEXT PRIMARY KEY,
  circle_kind TEXT NOT NULL,              -- tahfeez | baseera
  circle_ref_id TEXT NOT NULL,
  circle_name TEXT NOT NULL,
  mosque_id TEXT,
  unit_path TEXT,                         -- مسار الحلقة (عرض/عزل)
  submitter_path TEXT,                    -- مسار المشرف (توجيه الاعتماد للأعلى)
  visited_by TEXT NOT NULL,               -- معرّف المستخدم الزائر
  visited_by_name TEXT,
  visit_date_hijri TEXT,
  monthly_visit_no INTEGER,
  student_count INTEGER,
  final_score INTEGER,                    -- التقييم النهائيّ المئويّ
  notes TEXT,                             -- ملاحظات المشرف واقتراحاته
  details TEXT,                           -- JSON بالحقول الخاصّة بالنوع
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | submitted | approved
  approved_by TEXT,
  approved_by_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sv_visited_by ON supervision_visits (visited_by);
CREATE INDEX IF NOT EXISTS idx_sv_status ON supervision_visits (status);
CREATE INDEX IF NOT EXISTS idx_sv_submitter ON supervision_visits (submitter_path);
