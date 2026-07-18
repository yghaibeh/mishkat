-- المرحلة ١ — التعهّدات (تعهّدُ مانحٍ بمبلغٍ لصندوق، ومتابعةُ الموفَى والمتبقّي).
CREATE TABLE IF NOT EXISTS pledges (
  id TEXT PRIMARY KEY,
  donor_id TEXT NOT NULL,
  fund_id TEXT NOT NULL DEFAULT 'general',
  amount REAL NOT NULL,                 -- المبلغ المتعهَّد به (دولار)
  fulfilled REAL NOT NULL DEFAULT 0,    -- الموفَى حتى الآن
  due_at INTEGER,                       -- تاريخُ الاستحقاق (اختياريّ)
  status TEXT NOT NULL DEFAULT 'open',  -- open | fulfilled | cancelled
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pledge_donor ON pledges (donor_id);
CREATE INDEX IF NOT EXISTS idx_pledge_status ON pledges (status);
