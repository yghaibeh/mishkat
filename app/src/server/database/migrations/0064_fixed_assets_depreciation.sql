-- المرحلة ٥ — الأصولُ الثابتةُ والإهلاك: رسملةٌ ثمّ إهلاكٌ شهريٌّ بالقسط الثابت.
-- الرسملة: Dr 1210 (أصلٌ ثابت) / Cr 1110 (نقد). الإهلاك: Dr 5400 (مصروفُ إهلاك) / Cr 1190 (مجمّعُ الإهلاك، أصلٌ مقابِل).
-- القيمةُ الدفتريّة = 1210 − 1190. برهانُ التوازن يصمد (المقابِلُ يخصم من الأصول، والمصروفُ يخصم من صافي الأصول).

INSERT OR IGNORE INTO accounts (id, name, type, parent_id, normal_balance, active) VALUES
  ('1210', 'الأصولُ الثابتة (معدّاتٌ ومركبات)', 'asset',   '1000', 'debit',  1),
  ('1190', 'مجمّعُ إهلاك الأصول',              'asset',   '1000', 'credit', 1),
  ('5400', 'إهلاكُ الأصول',                    'expense', '5000', 'debit',  1);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost REAL NOT NULL,                    -- تكلفةُ الاقتناء
  salvage_value REAL NOT NULL DEFAULT 0, -- القيمةُ المتبقّية آخرَ العمر
  useful_life_months INTEGER NOT NULL,   -- العمرُ الإنتاجيّ بالأشهر
  start_period TEXT NOT NULL,            -- شهرُ بدء الإهلاك '1447-01'
  fund_id TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active', -- active | disposed
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS depreciation_runs (
  id TEXT PRIMARY KEY,
  fixed_asset_id TEXT NOT NULL,
  period TEXT NOT NULL,                  -- شهرٌ هجريّ '1447-01'
  amount REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dep_asset_period ON depreciation_runs (fixed_asset_id, period);
