-- تعدّدُ العملات (نموذجُ العملة الوظيفيّة): الدفترُ يبقى بالدولار (السنت) فيظلّ التوازنُ المزدوجُ سليمًا،
-- مع حفظِ العملة الأصليّة ومبلغِها على كلّ سطر، وحسابِ نقدٍ لكلّ عملة، وحساباتِ فروقِ العملة.

-- العملاتُ المدعومة (USD أساسٌ). لكلّ عملةٍ حسابُ نقدٍ خاصٌّ بها.
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,               -- USD | SYP | TRY
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base INTEGER NOT NULL DEFAULT 0,  -- 1 = عملةُ الأساس (الدفتر بها)
  cash_account TEXT NOT NULL,          -- حسابُ النقد لهذه العملة
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO currencies (code, name, symbol, is_base, cash_account, active, sort_order) VALUES
  ('USD', 'الدولار الأمريكيّ', '$',   1, '1110', 1, 0),
  ('SYP', 'الليرة السوريّة',   'ل.س', 0, '1115', 1, 1),
  ('TRY', 'الليرة التركيّة',   '₺',   0, '1116', 1, 2);

-- أسعارُ الصرف: كم دولارًا (أساسًا) يساوي وحدةً واحدةً من العملة، بتاريخِ سريان. يُستعمل أحدثُها.
CREATE TABLE IF NOT EXISTS fx_rates (
  id TEXT PRIMARY KEY,
  currency TEXT NOT NULL,
  rate_to_base REAL NOT NULL,          -- 1 وحدة عملة = rate_to_base دولار
  effective_at INTEGER NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fx_currency ON fx_rates (currency, effective_at);

-- وسمُ العملة الأصليّة على سطر القيد (المبلغُ المدين/الدائن يبقى بالدولار؛ هذان مُذكِّرةٌ بالأصل).
ALTER TABLE journal_lines ADD COLUMN currency TEXT;        -- NULL = الأساس (USD)
ALTER TABLE journal_lines ADD COLUMN amount_orig INTEGER;  -- بالوحدة الصغرى للعملة الأصليّة (مقدارٌ موجب)

-- حساباتُ نقدِ العملات الأجنبيّة + مكاسب/خسائر فروق العملة.
INSERT OR IGNORE INTO accounts (id, name, type, parent_id, normal_balance, active) VALUES
  ('1115', 'صندوقٌ نقديّ (ل.س)',      'asset',   '1100', 'debit',  1),
  ('1116', 'صندوقٌ نقديّ (₺)',        'asset',   '1100', 'debit',  1),
  ('4910', 'مكاسبُ فروق العملة',       'income',  '4000', 'credit', 1),
  ('5910', 'خسائرُ فروق العملة',       'expense', '5000', 'debit',  1);
