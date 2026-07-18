-- محرّكُ الاعتماد الثنائيّ (Dual-Control): أفعالُ المسؤول الماليّ تُقترَح ولا تُنفَّذ إلا باعتماد المدير.
-- الدفترُ لا يحوي إلا حقائقَ معتمَدة — الطابورُ يعمل قبل postJournal لا بعده (الوثيقة ٢٨).

CREATE TABLE IF NOT EXISTS finance_actions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                    -- معرّفُ الفعل من سجلّ المنفّذين (exchange | fx_rate_set | ...)
  payload TEXT NOT NULL,                 -- مدخلاتُ الدالّة JSON — تُجمَّد عند الإرسال
  summary TEXT NOT NULL,                 -- سطرٌ بشريّ للمدير
  amount_usd REAL NOT NULL DEFAULT 0,    -- للفرز والعتبات (٠ لغير النقديّ)
  currency TEXT,
  orig_amount REAL,
  status TEXT NOT NULL DEFAULT 'pending',-- pending | approved | rejected | cancelled | executed | failed
  proposed_by TEXT NOT NULL,
  proposed_at INTEGER NOT NULL,
  decided_by TEXT,
  decided_at INTEGER,
  reject_reason TEXT,
  executed_at INTEGER,
  result_ref TEXT,                       -- معرّفُ الكيان/القيد الناتج
  error TEXT,                            -- خطأُ التنفيذ إن فشل
  resubmit_of TEXT,                      -- سلسلةُ إعادة الإرسال (محجوزٌ للاحق)
  client_uuid TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_client ON finance_actions (client_uuid);
CREATE INDEX IF NOT EXISTS idx_fa_status ON finance_actions (status);
CREATE INDEX IF NOT EXISTS idx_fa_proposer ON finance_actions (proposed_by, status);
CREATE INDEX IF NOT EXISTS idx_fa_kind ON finance_actions (kind);

-- سياساتُ الاعتماد: مَن يلزمه اعتمادٌ ولأيّ فعلٍ وفوق أيّ مبلغ. kind='*' = كلُّ الأفعال.
CREATE TABLE IF NOT EXISTS approval_policies (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '*',
  mode TEXT NOT NULL DEFAULT 'approve',  -- approve (يلزم اعتماد) | none (مباشر)
  threshold_usd REAL NOT NULL DEFAULT 0  -- ما دونها يمرّ مباشرة (٠ = كلُّ شيءٍ يُعتمَد)
);
CREATE INDEX IF NOT EXISTS idx_pol_role ON approval_policies (role);

-- البذرة: كلُّ أفعال المسؤول الماليّ تُعتمَد («كل خطوة» — قرار المالك)
INSERT OR IGNORE INTO approval_policies (id, role, kind, mode, threshold_usd)
VALUES ('pol-fo-all', 'finance_officer', '*', 'approve', 0);
