-- العُهدة والأصول (الوثيقة ٢٦ §ع — من «مجلس» + طلب العميل): عُهدٌ شخصيّة (لابتوب…)،
-- ومركباتٌ وآليّاتٌ عامّةٌ للمؤسّسة بمصروفها الشهريّ للمحروقات — «ليكون عندنا تقييمٌ لكلّ شيء».
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- personal_custody | vehicle | equipment
  name TEXT NOT NULL,
  details TEXT,                        -- رقم تسلسلي/لوحة/مواصفات
  org_unit_id TEXT,                    -- الوحدة المالكة (مسجد/مربع/منطقة/المركز)
  org_path TEXT,                       -- مسارها (عزل النطاق)
  holder_person_id TEXT,               -- بحوزة مَن (للعُهد الشخصية)
  holder_name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | returned | retired
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_assets_kind ON assets(kind);
CREATE INDEX idx_assets_org ON assets(org_path);
CREATE INDEX idx_assets_holder ON assets(holder_person_id);

CREATE TABLE asset_expenses (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  month TEXT NOT NULL,                 -- 'YYYY-MM'
  fuel_amount REAL NOT NULL DEFAULT 0, -- مصروف المحروقات
  other_amount REAL NOT NULL DEFAULT 0,-- صيانة وغيرها
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(asset_id, month)
);
CREATE INDEX idx_assetexp_asset ON asset_expenses(asset_id);
CREATE INDEX idx_assetexp_month ON asset_expenses(month);
