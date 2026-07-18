-- تعميم سجل النقاط من «مسجد» إلى «وحدة» (تشمل المسجد وحلقة النساء) — لسجلّ أنشطة النساء.
-- mosque_id/mosque_path يبقيان للتوافق التاريخيّ؛ unit_id/unit_path هما المصدر الموحّد للجديد.
ALTER TABLE weekly_records ADD COLUMN unit_id TEXT;
ALTER TABLE weekly_records ADD COLUMN unit_path TEXT;
UPDATE weekly_records SET unit_id = mosque_id, unit_path = mosque_path WHERE unit_id IS NULL;
ALTER TABLE daily_entries ADD COLUMN unit_id TEXT;
UPDATE daily_entries SET unit_id = mosque_id WHERE unit_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_wr_unit_week ON weekly_records(unit_id, week_start);
