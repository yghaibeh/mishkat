-- المرحلة ٤ (تكملة) — سُلَفُ الموظّفين: سُلفةٌ نقديّةٌ تصير ذمّةً مدينةً (1200) ثمّ تُستردُّ أقساطًا من الراتب.
-- النقدُ يخرج عند المنح (Dr 1200 / Cr 1110)، ويعود عند كلّ قسطٍ (Dr 1110 / Cr 1200) حتى يُقفَل الرصيد.
CREATE TABLE IF NOT EXISTS staff_advances (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  principal REAL NOT NULL,             -- أصلُ السلفة (دولار)
  balance REAL NOT NULL,               -- المتبقّي للاسترداد
  monthly_deduction REAL NOT NULL,     -- قسطُ الاسترداد الشهريّ
  fund_id TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active', -- active | settled
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_advance_person ON staff_advances (person_id, status);
