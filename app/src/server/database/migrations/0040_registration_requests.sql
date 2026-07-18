-- التسجيل الذاتيّ الهرميّ (الوثيقة ٢٦ §١): طلبٌ مكتفٍ بذاته — لا حساب قبل الاعتماد.
-- الاعتمادُ ينشئ الهيكليّة كاملةً ذرّيًّا (المسجد الجديد إن لُزم + الشخص + الحساب + التكليف).
CREATE TABLE registration_requests (
  id TEXT PRIMARY KEY,                 -- uuid = رمز المتابعة العامّ
  kind TEXT NOT NULL,                  -- student | teacher | amir | square | rabita
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'male',
  login TEXT NOT NULL,
  password_hash TEXT NOT NULL,         -- pbkdf2 فورًا، لا نصّ صريح أبدًا
  phone TEXT,
  target_unit_id TEXT,                 -- الوحدة القائمة (مسجد/مربع/منطقة)
  target_path TEXT,                    -- مسارها المنسوخ للاستعلام
  proposed_unit_name TEXT,             -- «مسجدي غير مدرج»: اسم المسجد المقترح
  proposed_parent_id TEXT,             -- الأب الذي يُنشأ تحته (مربع/منطقة)
  circle_id TEXT,                      -- للطالب: الحلقة (اختياري)
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  decided_by TEXT,
  decided_by_name TEXT,
  decided_at INTEGER,
  reject_reason TEXT,
  created_unit_id TEXT,                -- ما أنشأه الاعتماد (تدقيق)
  created_person_id TEXT,
  created_user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_regreq_status ON registration_requests(status);
CREATE INDEX idx_regreq_login ON registration_requests(login);
CREATE INDEX idx_regreq_target ON registration_requests(target_path);

-- ربط هوية الطالب المعتمَد بسجلّ الحلقة (كان اسمًا حرًّا فقط)
ALTER TABLE circle_students ADD COLUMN person_id TEXT;
