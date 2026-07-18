-- النشاطات والمتابعة (الوثيقة ٢٦ §ن — جوهر «مجلس»): الشيخ/الأمير يُنشئ نشاطًا مطلوبًا،
-- والطالب يراه في «المطلوب منّي» ويردّ عليه، والمنشئ يتابع الردود ويقبلها.
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL,            -- circle | mosque
  scope_id TEXT NOT NULL,              -- معرّف الحلقة أو المسجد
  mosque_id TEXT,                      -- مسجد النطاق (للاستعلام والعزل)
  title TEXT NOT NULL,
  details TEXT,
  due_at INTEGER,                      -- الاستحقاق (اختياري)
  required INTEGER NOT NULL DEFAULT 1, -- مطلوبٌ من الطلاب
  status TEXT NOT NULL DEFAULT 'active',  -- active | closed
  created_by TEXT NOT NULL,            -- person_id للمنشئ
  created_by_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_activities_scope ON activities(scope_kind, scope_id);
CREATE INDEX idx_activities_mosque ON activities(mosque_id);

CREATE TABLE activity_responses (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  person_name TEXT,
  body TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending', -- pending | seen | accepted
  reviewed_by TEXT,
  UNIQUE(activity_id, person_id)
);
CREATE INDEX idx_actresp_activity ON activity_responses(activity_id);
CREATE INDEX idx_actresp_person ON activity_responses(person_id);
