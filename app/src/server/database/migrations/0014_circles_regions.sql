-- Migration 0014: الموقع الجغرافي للمسجد + حلقات المسجد بأنواعها

-- 1. رمز المحافظة على الوحدة التنظيمية (district موجود سلفاً — يُعاد استخدامه لرمز المنطقة)
ALTER TABLE org_units ADD COLUMN governorate TEXT;
CREATE INDEX IF NOT EXISTS idx_org_units_gov ON org_units(governorate);

-- 2. جدول الحلقات — المسجد الواحد قد يحوي عدة حلقات بأنواع مختلفة
CREATE TABLE IF NOT EXISTS circles (
  id                TEXT PRIMARY KEY,
  mosque_id         TEXT NOT NULL,
  type              TEXT NOT NULL,                       -- tahfeez | rashidi | ala_baseera | influential_mosque
  gender_track      TEXT NOT NULL DEFAULT 'male',        -- male | female
  name              TEXT NOT NULL,
  teacher_person_id TEXT,
  capacity          INTEGER,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'active',       -- active | archived
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_circles_mosque ON circles(mosque_id);
CREATE INDEX IF NOT EXISTS idx_circles_type ON circles(type);
