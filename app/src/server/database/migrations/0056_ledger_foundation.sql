-- المرحلة ٠ — الأساس المحاسبيّ الخفيّ (دفترُ أستاذٍ مزدوجُ القيد). المال بالسنتات الصحيحة (integer).
-- المستخدمون غير محاسبين: هذه الجداولُ محرّكٌ خفيٌّ يُنتج تقاريرَ تُقرأ، لا شاشاتٌ يملؤها المستخدم.

-- دليلُ الحسابات (هرميّ). النوع يحدّد الرصيد الطبيعيّ (asset/expense مدين؛ liability/net_assets/income دائن).
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,                       -- = الرمز المحاسبيّ (مثل 1110)
  name TEXT NOT NULL,
  type TEXT NOT NULL,                        -- asset | liability | net_assets | income | expense
  parent_id TEXT,
  normal_balance TEXT NOT NULL,             -- debit | credit
  active INTEGER NOT NULL DEFAULT 1
);

-- الصناديق (أموالٌ مقيّدةٌ وغير مقيّدة) — كلُّ سطر قيدٍ موسومٌ بصندوق.
CREATE TABLE IF NOT EXISTS funds (
  id TEXT PRIMARY KEY,                       -- zakat | sadaqah | waqf | general | projects
  name TEXT NOT NULL,
  restricted INTEGER NOT NULL DEFAULT 0,    -- 1 = مقيّد (زكاة/وقف/مشاريع) لا يُصرف في غير غرضه
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- الفتراتُ الماليّة — تُقفَل فيُمنع القيدُ فيها (نزاهةُ الإقفال).
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',       -- open | closed
  created_at INTEGER NOT NULL
);

-- قيدُ اليوميّة — رأسُ القيد (كلّ قيدٍ متوازنٌ: Σمدين=Σدائن عبر سطوره).
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date INTEGER NOT NULL,               -- زمن الحدث (ms)
  date_hijri TEXT,                           -- التاريخ الهجريّ للعرض
  memo TEXT,                                 -- وصفٌ بشريّ
  source TEXT,                               -- نوع الحدث (donation|expense|payroll|payout|fuel|manual|reversal)
  source_ref TEXT,                           -- معرّف الحدث الأصليّ (للربط ومنع الازدواج)
  reversal_of TEXT,                          -- إن كان قيدًا عكسيًّا: معرّف القيد المُلغى
  created_by TEXT,
  created_at INTEGER NOT NULL
);

-- سطورُ القيد — لكلّ سطرٍ حسابٌ وصندوقٌ ومبلغٌ مدينٌ أو دائنٌ بالسنتات (أحدهما صفر).
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  fund_id TEXT NOT NULL,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_jl_fund ON journal_lines (fund_id);
CREATE INDEX IF NOT EXISTS idx_je_ref ON journal_entries (source, source_ref);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries (entry_date);

-- بذرُ الصناديق الخمسة (قرار اللجنة).
INSERT OR IGNORE INTO funds (id, name, restricted, active, sort_order) VALUES
  ('general',  'الصندوق العامّ',      0, 1, 1),
  ('zakat',    'الزكاة',              1, 1, 2),
  ('sadaqah',  'الصدقة',              0, 1, 3),
  ('waqf',     'الوقف',               1, 1, 4),
  ('projects', 'المشاريع',            1, 1, 5);

-- بذرُ دليل حساباتٍ افتراضيٍّ للمساجد (هرميّ، جاهزٌ فلا يبنيه المستخدم).
INSERT OR IGNORE INTO accounts (id, name, type, parent_id, normal_balance, active) VALUES
  ('1000', 'الأصول',                 'asset',      NULL,   'debit',  1),
  ('1100', 'النقد والصناديق',        'asset',      '1000', 'debit',  1),
  ('1110', 'الصندوق النقديّ',        'asset',      '1100', 'debit',  1),
  ('1120', 'الحساب البنكيّ',         'asset',      '1100', 'debit',  1),
  ('1200', 'ذممٌ مدينة (مستحقّةٌ لنا)','asset',     '1000', 'debit',  1),
  ('2000', 'الخصوم',                 'liability',  NULL,   'credit', 1),
  ('2100', 'ذممٌ دائنة (مستحقّةٌ علينا)','liability','2000', 'credit', 1),
  ('2110', 'رواتبُ مستحقّةُ الدفع',   'liability',  '2100', 'credit', 1),
  ('3000', 'صافي الأصول',            'net_assets', NULL,   'credit', 1),
  ('3100', 'الرصيدُ المُرحَّل',       'net_assets', '3000', 'credit', 1),
  ('4000', 'الإيرادات',              'income',     NULL,   'credit', 1),
  ('4100', 'التبرّعات',              'income',     '4000', 'credit', 1),
  ('4900', 'إيراداتٌ أخرى',          'income',     '4000', 'credit', 1),
  ('5000', 'المصروفات',              'expense',    NULL,   'debit',  1),
  ('5100', 'الرواتب والمكافآت',       'expense',    '5000', 'debit',  1),
  ('5200', 'مصروفاتٌ تشغيليّة',       'expense',    '5000', 'debit',  1),
  ('5300', 'محروقاتٌ وصيانة',        'expense',    '5000', 'debit',  1),
  ('5900', 'مصروفاتٌ أخرى',          'expense',    '5000', 'debit',  1);
