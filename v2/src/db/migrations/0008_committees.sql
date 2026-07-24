-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — اللجان والاجتماعات: **اللجنةُ عقدةٌ في الشجرة، والمحضرُ حدثٌ في المسجد**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- على نمط `0003_custody` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥ ·
-- `db/README.md` الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣: لا JSONB · تاريخٌ INTEGER · منطقٌ ٠/١).
--
-- ### مفتاحُ التوجيه — حيثُ توقّعت الوصفةُ المفاجأة
-- > اللجنةُ **تُوجَّه بمسارها هي** (`unit_path` = مسارُ اللجنة المبنيّ تحت مسجدها، ت-٢)، لا
-- > بمسار مسجدها؛ لأنها عقدةٌ حقيقيةٌ في شجرة النطاق تمشي عليها سلسلةُ ق-١٣، وكلُّ قراءات
-- > نطاقها تُرشّح بـ`contains(scope, committee.path)`. و`mosque_path` عمودٌ صريحٌ **لا يُشتقّ
-- > عكسياً** من المسار. والعضوُ والنشاطُ يرثان مفتاحَ **لجنتهما**، والمحضرُ مفتاحَ **مسجده**.
--
-- ### أربعةُ جداولٍ **ملحقةٌ فقط** (`appendOnly` في `schema.ts` · المادة ٧/٤)
-- `committees` (الإيقافُ حالةٌ في عمود `active` لا حذف) و`committee_members` و
-- `committee_activities` و`committee_meetings`: اختفاءُ صفٍّ من أيٍّ منها **عطبٌ يُرمى** ولا
-- يُترجم `DELETE`. و`committee_units` وحدَه نسخةُ قراءةٍ (نظيرُ `ledger_units`) فليس ملحقاً.
--
-- ### ولا عمودَ نصابٍ ولا صوتٍ ولا حضور (ب-٢ مدفونٌ بقرار المالك)
-- المحضرُ **سطورُ محضرٍ وقراراتٌ** لا غير — والدفنُ يُقاس على المخطط المطبَّق لا يُوعَد به.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS committee_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_committee_units_routing ON committee_units (tenant_id, unit_path);

-- ── اللجنة: **عقدةٌ تحت المسجد** — مفتاحُ توجيهها مسارُها هي (يُبنى تحت مسجدها، ت-٢) ──
-- و`mosque_path` صريحٌ لا يُشتقّ عكسياً؛ و`active` حالةُ الإيقاف (لا حذف، المادة ٧/٤).
CREATE TABLE IF NOT EXISTS committees (
  tenant_id      TEXT    NOT NULL,
  unit_path      TEXT    NOT NULL,
  id             TEXT    NOT NULL,
  mosque_unit_id TEXT    NOT NULL,
  mosque_path    TEXT    NOT NULL,
  label_ar       TEXT    NOT NULL,
  head_person_id TEXT,
  head_name_ar   TEXT    NOT NULL,
  active         INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_committees_routing ON committees (tenant_id, unit_path);

-- ── عضوُ اللجنة: **اسمٌ حرٌّ بلا معرّفِ شخص** (ق-٣١) — ملحقٌ فقط، مفتاحُه مسارُ لجنته ──
CREATE TABLE IF NOT EXISTS committee_members (
  tenant_id    TEXT NOT NULL,
  unit_path    TEXT NOT NULL,
  id           TEXT NOT NULL,
  committee_id TEXT NOT NULL,
  name_ar      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_committee_members_routing ON committee_members (tenant_id, unit_path);

-- ── نشاطُ اللجنة: عددٌ وأسماءٌ حرّةٌ (JSON نصّ) وتاريخُ إنجاز (ب-٤٣) — ملحقٌ فقط ──────
-- والمساهمةُ في سجل المسجد **اشتقاقٌ لحظتَه** لا عمودُ مجموعٍ مخزَّن (نظيرُ ق-٦٠).
CREATE TABLE IF NOT EXISTS committee_activities (
  tenant_id            TEXT    NOT NULL,
  unit_path            TEXT    NOT NULL,
  id                   TEXT    NOT NULL,
  committee_id         TEXT    NOT NULL,
  period_id            TEXT    NOT NULL,
  title_ar             TEXT    NOT NULL,
  participant_count    INTEGER NOT NULL,
  participant_names_ar TEXT    NOT NULL,
  completed_at         INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_committee_activities_routing ON committee_activities (tenant_id, unit_path);

-- ── الاجتماع/المحضر: محضرٌ وقراراتٌ (JSON نصّ) لا غير (ب-١٨/ب-٢ مدفون) — ملحقٌ فقط ──────
-- مفتاحُ توجيهه مسارُ مسجده، وقراءتُه `contains(scope, mosquePath)`.
CREATE TABLE IF NOT EXISTS committee_meetings (
  tenant_id      TEXT    NOT NULL,
  unit_path      TEXT    NOT NULL,
  id             TEXT    NOT NULL,
  mosque_unit_id TEXT    NOT NULL,
  held_at        INTEGER NOT NULL,
  minutes_ar     TEXT    NOT NULL,
  decisions_ar   TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_routing ON committee_meetings (tenant_id, unit_path);

-- **وصفرُ فهرسٍ زائدٍ** — قرارٌ سعويٌّ لا تحسينٌ مجاني (ADR §١-٢: الفهرسُ يكلّف قدر الجدول):
-- كلُّ قراءات هذه الوحدة **في الذاكرة بعد التحميل بالنطاق** (`membersOf`/`committeesLedBy`/
-- `activitiesOf` مُرشِّحاتٌ على المحمَّل)، فالاستعلامُ الوحيدُ على القاعدة هو مسحُ النطاق
-- المفهرَسُ أصلاً. فلا قارئَ حيٌّ يُسمّى لفهرسٍ إضافيّ — وفهرسٌ بلا قارئٍ ضررُه ضررُ الغائب.
