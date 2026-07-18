-- الاختبارات والواجبات (الوثيقة ٢٦ §خ — من «مجلس»): أسئلة اختيارٍ من متعدّد وصح/خطأ،
-- نشرٌ ووقت تسليمٍ ودرجاتٌ بتصحيحٍ آليّ.
CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL,            -- circle | mosque
  scope_id TEXT NOT NULL,
  mosque_id TEXT,
  kind TEXT NOT NULL DEFAULT 'exam',   -- exam | homework
  title TEXT NOT NULL,
  description TEXT,
  publish_at INTEGER,                  -- قبلَه لا يراه الطالب (null = فورًا عند publish)
  due_at INTEGER,                      -- «انتهى وقت التسليم» بعده
  status TEXT NOT NULL DEFAULT 'draft',-- draft | published | closed
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_exams_scope ON exams(scope_kind, scope_id);
CREATE INDEX idx_exams_status ON exams(status);

CREATE TABLE exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,                  -- mcq | tf
  text TEXT NOT NULL,
  options TEXT,                        -- JSON: ["أ","ب","ج","د"] للاختيار من متعدّد
  correct TEXT NOT NULL,               -- الفهرس (mcq) أو "true"/"false" (tf)
  points INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_examq_exam ON exam_questions(exam_id);

CREATE TABLE exam_submissions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  person_name TEXT,
  answers TEXT NOT NULL,               -- JSON: {questionId: answer}
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  submitted_at INTEGER NOT NULL,
  UNIQUE(exam_id, person_id)
);
CREATE INDEX idx_examsub_exam ON exam_submissions(exam_id);
CREATE INDEX idx_examsub_person ON exam_submissions(person_id);
