-- إكمال إدخال البيانات: طلاب الحلقة + محضر الاجتماع + بنود خطة اللجنة (تاريخ/مستمر)

CREATE TABLE IF NOT EXISTS circle_students (
  id text PRIMARY KEY,
  circle_id text NOT NULL,
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cstudent_circle ON circle_students(circle_id);

ALTER TABLE meetings ADD COLUMN minutes TEXT;

ALTER TABLE committee_plans ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE committee_plans ADD COLUMN month_hijri TEXT;
