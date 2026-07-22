-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — العُهد والأصول: **سلسلةُ حيازةٍ لا تُمحى، وصفرُ حائزٍ مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- **أوّلُ هجرةِ وحدةٍ في T26-ب** — على نمط `0001` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ
-- بلا استثناء (ع-٥ · `db/README.md` الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣).
--
-- ### الثابتُ الذي يفرضه هذا المخطط قبل أيّ سطر منطق
-- > **لا عمودَ حائزٍ ولا عمودَ حالةٍ في أيّ جدولٍ هنا.**
-- في v1 كان الحائزُ حقلاً يُكتب (`0076_asset_custody`)، فوقعت العهدةُ على رقاب الناس بلا
-- علمهم، وتناقض «بعهدة فلان» مع «في الوحدة» في السطر نفسه (ق-٧٨/ق-٨٠). وفي v2 الحائزُ
-- والحالةُ **اشتقاقان** من `custody_moves` — فلا يوجد ما يُحرَّر، ولا بابَ ثانياً يوجد.
-- ويحرس ذلك `tests/migrations/custody.test.ts` **على المخطط المطبَّق** لا على النيّة.
--
-- ### وجدولان **ملحقان فقط** (`appendOnly` في `schema.ts` · المادة ٧/٤)
-- `custody_assets` و`custody_moves`: اختفاءُ صفٍّ منهما **عطبٌ برمجيٌّ يُرمى** ولا يُترجم
-- `DELETE`. وانتقالُ الحالة **تحديثٌ على الصفّ نفسِه** (بصمةُ الإقرار ق-٧٩) لا حذفٌ وإدراج
-- — فنمذجتُه حذفاً وإدراجاً كانت **تُسقط ق-٧٨ وق-٨٠ معاً** بضربةٍ واحدة.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS custody_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_custody_units_routing ON custody_units (tenant_id, unit_path);

-- ── الأصل: **سجلٌّ وصفيٌّ في وحدةٍ تنظيمية** — موطنُه لا يتحرّك بالحيازة (ق-٨٠) ──────
-- ولذلك مفتاحُ توجيهه **مستقرٌّ**: صفوفُ سلسلته الملحقةُ فقط ترث مساره ولا تُعاد كتابتُها.
CREATE TABLE IF NOT EXISTS custody_assets (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  label_ar      TEXT    NOT NULL,
  serial_ar     TEXT,
  note_ar       TEXT,
  registered_by TEXT    NOT NULL,
  registered_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_custody_assets_routing ON custody_assets (tenant_id, unit_path);

-- ── سلسلةُ الحيازة: **إلحاقٌ لا استبدال** (ق-٧٨) ──────────────────────────────────
-- الحقلان الوحيدان اللذان يُكتبان بعد الإلحاق هما بصمةُ الإقرار (ق-٧٩)، ولها كاتبٌ واحدٌ
-- ضيّقٌ في المستودع. و`kind` **مشتقٌّ عند الكتابة** (الأولى تسليمٌ وما بعدها نقل) فلا
-- يستطيع أحدٌ أن يسمّي نقلاً تسليماً أوّلَ فيطمس سابقَه.
CREATE TABLE IF NOT EXISTS custody_moves (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  asset_id        TEXT    NOT NULL,
  seq             INTEGER NOT NULL,
  kind            TEXT    NOT NULL,
  from_person_id  TEXT,
  to_person_id    TEXT,
  condition_ar    TEXT    NOT NULL,
  note_ar         TEXT,
  at              INTEGER NOT NULL,
  by_person_id    TEXT    NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_custody_moves_routing ON custody_moves (tenant_id, unit_path);

-- **وفهرسان لا ثالثَ لهما** — و«كلُّ فهرسٍ إضافيٍّ على جدول عمليات قرارٌ سعويّ لا تحسينٌ
-- مجاني» (ADR-001 §١-٢: الفهارسُ تكلّف قدر الجدول تقريباً). فلكلٍّ منهما قارئٌ حيّ:
--   · **السلسلة**: «تاريخُ هذا الأصل بترتيبه» — أشيعُ قراءةٍ في الوحدة، وأساسُ اشتقاق
--     الحائز والحالة (ق-٧٨/ق-٨٠). بلا هذا الفهرس يصير كلُّ عرضِ حالةٍ مسحاً كاملاً.
CREATE INDEX IF NOT EXISTS idx_custody_moves_chain ON custody_moves (tenant_id, asset_id, seq);
--   · **ما بيد فلان**: مدخلُ «عُهدتي» (ق-٧٩) و**شرطُ طيّ صفحة الكادر** (ق-٨٢) — وهذا
--     الأخيرُ يُستدعى من دورة حياة الحساب، فبطؤه يمنع فعلاً إدارياً لا عرضَ شاشة.
CREATE INDEX IF NOT EXISTS idx_custody_moves_holder ON custody_moves (tenant_id, to_person_id);
