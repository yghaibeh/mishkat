-- المرحلة ٣ (متخصّص) — الصندوقُ النثريّ بنظام السلفة المستديمة (imprest):
-- سقفٌ ثابتٌ يُحوَّل من النقد الرئيس (Dr 1130 / Cr 1110)، يُصرَف منه (Dr مصروف / Cr 1130)، ويُزوَّد دوريًّا للسقف.

-- حسابُ النثريّة في دليل الحسابات (أصلٌ، ابنُ «النقد والصناديق» 1100).
INSERT OR IGNORE INTO accounts (id, name, type, parent_id, normal_balance, active)
VALUES ('1130', 'الصندوقُ النثريّ', 'asset', '1100', 'debit', 1);

CREATE TABLE IF NOT EXISTS petty_cash_boxes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custodian_person_id TEXT,
  custodian_name TEXT,
  float_amount REAL NOT NULL,          -- السقفُ الثابت
  balance REAL NOT NULL,               -- الرصيدُ الحاليّ (نقصانه = ما صُرِف)
  fund_id TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active', -- active | closed
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS petty_cash_txns (
  id TEXT PRIMARY KEY,
  box_id TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- open | expense | replenish
  amount REAL NOT NULL,
  category TEXT,
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_petty_txn_box ON petty_cash_txns (box_id);
