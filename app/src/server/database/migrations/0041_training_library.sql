-- المكتبة التدريبيّة المصنّفة (الوثيقة ٢٦ §ت): موادّ PDF/صوت/رابط بجمهورٍ مستهدف،
-- وتتبّعٌ فرديّ: استلم (أوّل عرض) → فتح (أوّل تنزيل) → أنجز (إقرارٌ صريح).
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,              -- aqeedah|fiqh|seerah|tarbiya|admin_training|other
  kind TEXT NOT NULL,                  -- pdf | audio | link
  r2_key TEXT,
  external_url TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'amir',   -- amir | teacher | supervisor | all
  mandatory INTEGER NOT NULL DEFAULT 0,    -- إلزاميّ ⇒ متابعةٌ وتذكير
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- active | archived
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_materials_status ON materials(status);
CREATE INDEX idx_materials_audience ON materials(audience);

CREATE TABLE material_progress (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  delivered_at INTEGER,
  opened_at INTEGER,
  completed_at INTEGER,
  UNIQUE(material_id, person_id)
);
CREATE INDEX idx_matprog_material ON material_progress(material_id);
CREATE INDEX idx_matprog_person ON material_progress(person_id);
