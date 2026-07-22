-- عيّنةُ بيانات v1 — **مطابقةٌ لمخطط v1 حرفياً** (`app/src/server/database/schema.ts`)
-- ولا تُقرأ من قاعدة إنتاج ولا من حالةٍ محلية (قب-٢٣: البوابة تعمل في CI بلا حالة جهاز).
--
-- وفيها **عمداً** ثلاثةُ أنماطٍ تكسر النقلَ الساذج:
--   ١. قيدٌ سطرُه بلا `unit_id` ⟵ لا مفتاحَ توجيهٍ يُشتقّ (يجب أن يُرفض لا أن يُوجَّه للجذر).
--   ٢. قيدٌ مختلٌّ (مدينٌ ≠ دائن) ⟵ يجب أن يُرفض لا أن يُنقل فيفسد الدفتر.
--   ٣. عملةٌ `NULL` = الأساس (اصطلاحُ v1، سجل ٠٠٦٦) ⟵ يجب أن تُترجم لا أن تُنقل فارغة.

CREATE TABLE org_units (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'men',
  gender_track TEXT NOT NULL DEFAULT 'male',
  name TEXT NOT NULL,
  city TEXT,
  governorate TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  family_students INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  entry_date INTEGER NOT NULL,
  date_hijri TEXT,
  memo TEXT,
  source TEXT,
  source_ref TEXT,
  reversal_of TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  fund_id TEXT NOT NULL,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT,
  amount_orig INTEGER,
  unit_id TEXT
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  at INTEGER NOT NULL
);

INSERT INTO org_units (id, parent_id, path, type, section, name, status, created_at) VALUES
  ('men',  NULL,  '/men/',          'section', 'men', 'قسم الرجال',      'active',   1750000000000),
  ('r1',   'men', '/men/r1/',       'region',  'men', 'المنطقة الأولى',  'active',   1750000000000),
  ('m1',   'r1',  '/men/r1/m1/',    'mosque',  'men', 'مسجد الفاروق',    'active',   1750000000000),
  ('m2',   'r1',  '/men/r1/m2/',    'mosque',  'men', 'مسجد النور',      'archived', 1750000000000);

INSERT INTO journal_entries (id, entry_date, memo, source, source_ref, created_by, created_at) VALUES
  ('je_a', 1752000000000, 'تبرعٌ نقديّ',        'donation', 'd-100', 'u-finance', 1752000000000),
  ('je_b', 1752003600000, 'صرفٌ عام',           'expense',  'x-200', 'u-finance', 1752003600000),
  ('je_c', 1752007200000, 'قيدٌ بلا وحدة',      'donation', 'd-300', 'u-finance', 1752007200000),
  ('je_d', 1752010800000, 'قيدٌ مختلّ',          'donation', 'd-400', 'u-finance', 1752010800000);
-- (٤) مصادرُ v1 المفتوحة تُترجَم إلى الكتالوج المغلق في v2 (§٣.٢): وقودٌ ⟵ مصروف،
--     وبلا مصدرٍ ⟵ قيدٌ يدويّ. وما لا يُترجم كان سيدخل بنوعٍ خارج الكتالوج.
INSERT INTO journal_entries (id, entry_date, memo, source, source_ref, created_by, created_at) VALUES
  ('je_e', 1752014400000, 'محروقات',   'fuel', 'f-500', 'u-finance', 1752014400000),
  ('je_f', 1752018000000, 'قيدٌ يدويّ', NULL,   NULL,    'u-finance', 1752018000000),
  ('je_g', 1752021600000, 'صرفُ رواتب', 'payout', 'p-600', 'u-finance', 1752021600000),
  -- (٥) سطرٌ بطرفين (مدينٌ ودائنٌ معاً) — عطبٌ يرفضه الدفتر بغير الاختلال.
  ('je_h', 1752025200000, 'سطرٌ بطرفين', 'donation', 'd-700', 'u-finance', 1752025200000);

INSERT INTO journal_lines (id, entry_id, account_id, fund_id, debit_cents, credit_cents, currency, unit_id) VALUES
  ('jl_a1', 'je_a', 'cash',              'general', 10000, 0,     NULL,  'm1'),
  ('jl_a2', 'je_a', 'revenue.donations', 'general', 0,     10000, NULL,  'm1'),
  ('jl_b1', 'je_b', 'expense.general',   'general', 2500,  0,     'SYP', 'm2'),
  ('jl_b2', 'je_b', 'cash',              'general', 0,     2500,  'SYP', 'm2'),
  -- (١) سطرٌ بلا وحدة: لا مفتاحَ توجيه.
  ('jl_c1', 'je_c', 'cash',              'general', 4000,  0,     NULL,  NULL),
  ('jl_c2', 'je_c', 'revenue.donations', 'general', 0,     4000,  NULL,  'm1'),
  -- (٢) قيدٌ مختلّ: ٧٠٠٠ مديناً مقابل ٦٠٠٠ دائناً.
  ('jl_d1', 'je_d', 'cash',              'general', 7000,  0,     NULL,  'm1'),
  ('jl_d2', 'je_d', 'revenue.donations', 'general', 0,     6000,  NULL,  'm1'),
  ('jl_e1', 'je_e', 'expense.general',   'general', 1500,  0,     NULL,  'm1'),
  ('jl_e2', 'je_e', 'cash',              'general', 0,     1500,  NULL,  'm1'),
  ('jl_f1', 'je_f', 'expense.general',   'general', 800,   0,     NULL,  'm2'),
  ('jl_f2', 'je_f', 'cash',              'general', 0,     800,   NULL,  'm2'),
  ('jl_g1', 'je_g', 'expense.general',   'general', 3000,  0,     NULL,  'm1'),
  ('jl_g2', 'je_g', 'cash',              'general', 0,     3000,  NULL,  'm1'),
  ('jl_h1', 'je_h', 'cash',              'general', 500,   500,   NULL,  'm1'),
  ('jl_h2', 'je_h', 'revenue.donations', 'general', 0,     500,   NULL,  'm1');

INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, before, after, at) VALUES
  ('au_1', 'u-admin', 'orgUnit.update', 'org_unit', 'm2', '{"status":"active"}', '{"status":"archived"}', 1752000000000),
  ('au_2', 'u-finance', 'journal.post',  'journal_entry', 'je_a', NULL, '{"memo":"تبرعٌ نقديّ"}', 1752000000000);
