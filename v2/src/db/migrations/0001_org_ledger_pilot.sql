-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — المخططُ الأول: وحدتا الريادة (الشجرة والمال)
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- ونقطةُ اللاعودة التي يُثبّتها (ADR-001 §٦-١): **مفتاحُ التوجيه وموضعُ سجلّ التدقيق**.
--
--   · مفتاحُ التوجيه = (`tenant_id`, `unit_path`) على **كلِّ جدولٍ يحمل بيانات شبكة**،
--     والمسارُ **نسبيٌّ للشبكة** بشرطةٍ ختامية (قب-١٨ · ت-٢ · README الحسم ٢).
--   · سجلُّ التدقيق **جدولٌ واحدٌ مركزيّ**، تدرّجُه بالعمر لا بالعمود (README الحسم ٣).
--
-- **لهجةُ القاسم المشترك** (ADR-001 ع-٣): لا `JSONB` · لا فهرسٌ جزئيّ · لا `AUTOINCREMENT`
-- · لا نوعَ منطقيّ (٠/١) · لا نوعَ تاريخ (عددٌ صحيح بالمللي ثانية) — تعمل على SQLite/D1
-- وPostgres سواءً، فلا يُعاد كتابةُ المخطط يوم يُنفَّذ الجزءُ الثاني من ADR-001.
--
-- **الوحدتان فقط** — والثلاث عشرة الباقية تُبنى في T26 على هذا النمط حرفياً.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── بنيةٌ تحتية: دفترُ الهجرات (بلا شبكةٍ وبلا مفتاح توجيه — ليس بيانات) ─────
CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT    NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (name)
);

-- ═══ وحدةُ الريادة الأولى: الشجرة (org) ════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_units (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  type      TEXT    NOT NULL,
  label_ar  TEXT    NOT NULL,
  parent_id TEXT,
  section   TEXT,
  archived  INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_org_units_routing ON org_units (tenant_id, unit_path);

-- الحسابُ الشخصيّ نطاقُه الشبكةُ كلُّها (`/`): الشخصُ قد يخدم في قسمين، فحسابُه لا يخصّ
-- شظيةَ قسمٍ بعينه. مفتاحُ التوجيه **صادقٌ** هنا لا حشو (README الحسم ٢).
CREATE TABLE IF NOT EXISTS org_accounts (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  person_id     TEXT    NOT NULL,
  username      TEXT    NOT NULL,
  status        TEXT    NOT NULL,
  session_epoch INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_org_accounts_routing ON org_accounts (tenant_id, unit_path);
CREATE INDEX IF NOT EXISTS idx_org_accounts_username ON org_accounts (tenant_id, username);

CREATE TABLE IF NOT EXISTS org_assignments (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  person_id       TEXT    NOT NULL,
  role_id         TEXT    NOT NULL,
  unit_id         TEXT    NOT NULL,
  start_date      INTEGER NOT NULL,
  end_date        INTEGER,
  approval_status TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_org_assignments_routing ON org_assignments (tenant_id, unit_path);
-- لقطةُ الصلاحية عند الدخول: استعلامٌ واحدٌ مفهرس على الشخص (عقدُ `AssignmentRepository`).
CREATE INDEX IF NOT EXISTS idx_org_assignments_person ON org_assignments (tenant_id, person_id);

CREATE TABLE IF NOT EXISTS org_requests (
  tenant_id         TEXT NOT NULL,
  unit_path         TEXT NOT NULL,
  id                TEXT NOT NULL,
  person_id         TEXT NOT NULL,
  username          TEXT NOT NULL,
  requested_role_id TEXT NOT NULL,
  requested_unit_id TEXT NOT NULL,
  status            TEXT NOT NULL,
  origin            TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_org_requests_routing ON org_requests (tenant_id, unit_path);

-- ═══ وحدةُ الريادة الثانية: المال (ledger) ══════════════════════════════════

CREATE TABLE IF NOT EXISTS ledger_accounts (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  kind      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_routing ON ledger_accounts (tenant_id, unit_path);

CREATE TABLE IF NOT EXISTS funds (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  ar         TEXT    NOT NULL,
  restricted INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_funds_routing ON funds (tenant_id, unit_path);

CREATE TABLE IF NOT EXISTS ledger_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_units_routing ON ledger_units (tenant_id, unit_path);

-- رأسُ القيد. `at` عددٌ صحيحٌ بالمللي ثانية (لا نوعَ تاريخٍ خاصٍّ بمحرّك — ع-٣).
CREATE TABLE IF NOT EXISTS journal_entries (
  tenant_id   TEXT    NOT NULL,
  unit_path   TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  voucher_no  TEXT    NOT NULL,
  voucher_seq INTEGER NOT NULL,
  at          INTEGER NOT NULL,
  memo_ar     TEXT    NOT NULL,
  source_type TEXT    NOT NULL,
  source_id   TEXT    NOT NULL,
  posting_key TEXT,
  reversal_of TEXT,
  reversed_by TEXT,
  reason_ar   TEXT,
  posted_by   TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_routing ON journal_entries (tenant_id, unit_path);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries (tenant_id, source_type, source_id);

-- **بُعدُ الوحدة على السطر** (ق-٦٠): مفتاحُ توجيه السطر مسارُ وحدتِه هو، وقد يخالف مسارَ
-- رأسِه (التسليمُ النازل يمسّ وحدتين بقيدٍ واحد) — ولذلك يحمله السطرُ بنفسه لا يرثه.
CREATE TABLE IF NOT EXISTS journal_lines (
  tenant_id      TEXT    NOT NULL,
  unit_path      TEXT    NOT NULL,
  id             TEXT    NOT NULL,
  entry_id       TEXT    NOT NULL,
  account_id     TEXT    NOT NULL,
  fund_id        TEXT,
  currency       TEXT    NOT NULL,
  debit          INTEGER NOT NULL,
  credit         INTEGER NOT NULL,
  kind           TEXT    NOT NULL,
  deduction_kind TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_routing ON journal_lines (tenant_id, unit_path);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (tenant_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_fund ON journal_lines (tenant_id, fund_id, currency);

-- مفتاحُ الترحيل النشط — فرضُ idempotency ق-٥٠ **في القاعدة** فلا يفلت السباق.
-- مفتاحٌ أوليٌّ كاملٌ لا فهرسٌ جزئيّ (ع-٣): العكسُ يحذف الصفَّ فيتحرّر المفتاح.
CREATE TABLE IF NOT EXISTS active_posting_keys (
  tenant_id   TEXT NOT NULL,
  unit_path   TEXT NOT NULL,
  posting_key TEXT NOT NULL,
  entry_id    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, posting_key)
);
CREATE INDEX IF NOT EXISTS idx_active_posting_keys_routing ON active_posting_keys (tenant_id, unit_path);

CREATE TABLE IF NOT EXISTS finance_actions (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  kind            TEXT    NOT NULL,
  payload         TEXT    NOT NULL,
  requested_by    TEXT    NOT NULL,
  requested_at    INTEGER NOT NULL,
  status          TEXT    NOT NULL,
  decided_by      TEXT,
  decided_at      INTEGER,
  reason_ar       TEXT,
  result_entry_id TEXT,
  failure_code    TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_finance_actions_routing ON finance_actions (tenant_id, unit_path);

-- ═══ سجلُّ التدقيق — واحدٌ مركزيّ (README الحسم ٣) ═══════════════════════════
--
-- **لا مفتاحَ أجنبيّاً يشير إليه** عمداً: حذفُ الصفِّ المؤرشَف إلى R2 لاحقاً لا يكسر شيئاً.
-- و`before`/`after` نصٌّ لا `JSONB` (ع-٣) — وهما أثقلُ ما فيه (ADR §١-٣).
-- والتدرّجُ **بالعمر**: فهرس (شبكة، وقت) يجعل الترحيلَ مسحَ مدىً لا مسحاً كاملاً.
CREATE TABLE IF NOT EXISTS audit_log (
  tenant_id           TEXT    NOT NULL,
  unit_path           TEXT    NOT NULL,
  source              TEXT    NOT NULL,
  seq                 INTEGER NOT NULL,
  at                  INTEGER NOT NULL,
  actor_person_id     TEXT    NOT NULL,
  action              TEXT    NOT NULL,
  capability          TEXT,
  target_type         TEXT,
  target_id           TEXT    NOT NULL,
  reason              TEXT,
  scope_exact         INTEGER NOT NULL,
  actor_roles_at_time TEXT,
  impersonated_by     TEXT,
  decision            TEXT,
  reason_code         TEXT,
  request_id          TEXT,
  before              TEXT,
  after               TEXT,
  PRIMARY KEY (tenant_id, source, seq)
);
CREATE INDEX IF NOT EXISTS idx_audit_log_routing ON audit_log (tenant_id, unit_path);
CREATE INDEX IF NOT EXISTS idx_audit_log_age ON audit_log (tenant_id, at);

-- العدّاداتُ المستمرة — بها تنجو الحتميّة عبور القاعدة (TESTING_POLICY §٥):
-- معرّفاتٌ متتابعةٌ لا عشوائية، ورقمُ سندٍ بلا فجوة (§٦.٢).
CREATE TABLE IF NOT EXISTS sequences (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  name      TEXT    NOT NULL,
  value     INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_sequences_routing ON sequences (tenant_id, unit_path);
