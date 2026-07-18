-- ٠٠٧٣ — «الصندوق» الهرمي (ق-د٢، الوثيقة ٣٩): سلسلة العهدة المالية على شجرة الوحدات.
-- (١) بُعدُ الوحدة على أسطر القيود: رصيدُ صندوق كلّ وحدةٍ يُشتقّ من الدفتر الواحد نفسه — لا دفتر موازٍ.
ALTER TABLE journal_lines ADD COLUMN unit_id TEXT;
CREATE INDEX IF NOT EXISTS idx_jl_unit ON journal_lines(unit_id);

-- (٢) التسليمات: عمليةُ عهدةٍ بطرفين (دفعٌ من الأعلى = قبضٌ آلي عند الأدنى) بإقرار استلام.
-- أسطرُ العملات JSON: [{"currency":"USD","amount":5000},{"currency":"SYP","amount":200000}] — القبضُ قد يتعدّد العملات (ق-د٢).
CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY,
  from_unit_id TEXT NOT NULL,
  to_unit_id TEXT NOT NULL,
  purpose TEXT NOT NULL,              -- salaries | operations | transfer | other
  batch_id TEXT,                      -- دفعة الرواتب الأمّ إن كانت السلسلة رواتب
  lines TEXT NOT NULL,                -- أسطر العملات JSON (المبالغ بالوحدة الصغرى)
  note TEXT,
  status TEXT NOT NULL DEFAULT 'delivered',   -- delivered | acknowledged
  delivered_by TEXT NOT NULL,         -- userId المُسلِّم
  delivered_at INTEGER NOT NULL,
  acknowledged_by TEXT,               -- userId المستلم (إقرار الاستلام — بصمة الطرف الثاني)
  acknowledged_at INTEGER,
  entry_id TEXT,                      -- قيد الدفتر المتولد
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ho_from ON handovers(from_unit_id, status);
CREATE INDEX IF NOT EXISTS idx_ho_to ON handovers(to_unit_id, status);
CREATE INDEX IF NOT EXISTS idx_ho_batch ON handovers(batch_id);

-- (٣) قاموسُ فئات الصرف المغلق (ق-د٢: محروقات/نقليات/رواتب…) — كقاموس المكتبة، يُدار من «الإدارة».
CREATE TABLE IF NOT EXISTS expense_categories (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO expense_categories (key, label, sort) VALUES
  ('fuel', 'محروقات', 1),
  ('transport', 'نقليات', 2),
  ('salaries', 'رواتب', 3),
  ('maintenance', 'صيانة', 4),
  ('hospitality', 'ضيافة وإكرام', 5),
  ('stationery', 'قرطاسية ومطبوعات', 6),
  ('utilities', 'كهرباء وماء واتصالات', 7),
  ('relief', 'إغاثة وإعانات', 8),
  ('assets', 'شراء أصول (تُرسمَل)', 9),
  ('other', 'أخرى', 99);
