-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — الزياراتُ الإشرافية: **سجلٌّ ميدانيٌّ لا يُمحى، ومرساةٌ غيرُ الهدف**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- وحدةٌ من الموجة الأولى (T26-ب-٢)، على نمط `0003_custody` حرفياً: مفتاحُ التوجيه على
-- كلِّ جدولٍ بلا استثناء (ع-٥ · `db/README.md` الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣:
-- لا JSONB · التاريخُ INTEGER · المنطقُ ٠/١ · البنيةُ نصُّ JSON).
--
-- ### مفتاحُ توجيه الزيارة **مسارُ هدفها لا مسارُ زائرها** — والمفاجأةُ هنا
-- > **الزيارةُ تحمل مسارَين**: `unit_path` (مسارُ **الهدف** المَزور — مفتاحُ التوجيه) و
-- > `supervisor_path` (مرساةُ الزائر التي تصعد منها سلسلةُ NESSA — ق-١٦، **عمودُ بياناتٍ**
-- > لا مفتاحُ توجيه). والقراءةُ كلُّها بالاحتواء على مسار الهدف (`views.ts`/`cadence.ts`
-- > تُرشِّح `contains(scope, targetPath)`) ⟵ فالتحميلُ بالنطاق يجب أن يكون على مسار الهدف.
-- > وخلطُهما في v1 هو ما جعل زيارةَ المربع تُعرض على المدير (ق-١٦ · `visits.ts` رأسُه).
--
-- ### والزيارةُ **ملحقٌ فقط** (`appendOnly` في `schema.ts` · المادة ٧/٤)
-- `supervision_visits`: شهادةُ حضورٍ ميدانية لا تُمحى (`data/store.ts` الثابت ٢). واختفاءُ
-- صفٍّ منها **عطبٌ برمجيٌّ يُرمى** ولا يُترجم `DELETE`. **ولا حالةَ تنتقل على الزيارة**
-- (لا إقرارَ ولا ختم كالعُهد): الزيارةُ تُكتب مرةً ولا تُعاد كتابتُها — ولذلك مفتاحُ
-- توجيهها **مستقرٌّ بالبناء**: مسارُ الهدف يُجمَّد لحظةَ الكتابة على الصفّ نفسه، فلو نُقلت
-- الحلقةُ لاحقاً في الشجرة **لا يُعاد كتابةُ صفٍّ ملحقٍ فقط** بمفتاحٍ جديد (فخّ ٤ · الوصفة).
--
-- ### والهدفُ والوحدةُ **إسقاطان قرائيّان لا مصدرا حقيقة** (نظيرُ `custody_units`)
-- `supervision_units` موطنُه `org`، و`supervision_targets` كيانُه الحلقة (ب-٢٨ — موطنُها
-- وحدةُ الحلقات المتسلسلة، وهنا مسارٌ ونوعُ منهاجٍ وحالةُ تفعيل لا أكثر). فكلاهما
-- **يجوز أن يزول صفُّه** (نسخةُ قراءة)، والإيقافُ على الهدف **حالةٌ (`active`) لا حذف**.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS supervision_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_supervision_units_routing ON supervision_units (tenant_id, unit_path);

-- ── هدفُ الزيارة: **إسقاطٌ قرائيّ** للحلقة (ب-٢٨) — مسارٌ ونوعُ منهاجٍ وحالةُ تفعيل ──
-- الإيقافُ **حالةٌ (`active` ٠/١) لا حذف** (المادة ٧/٤): هدفٌ موقوفٌ لا يُزار (ق-٩٩) ولا
-- يُمحى صفُّه. ومفتاحُ توجيهه **مسارُه هو** (موطنُ الحلقة التنظيميّ).
CREATE TABLE IF NOT EXISTS supervision_targets (
  tenant_id  TEXT NOT NULL,
  unit_path  TEXT NOT NULL,
  id         TEXT NOT NULL,
  curriculum TEXT NOT NULL,
  active     INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_supervision_targets_routing ON supervision_targets (tenant_id, unit_path);

-- ── الزيارة: **سجلٌّ ميدانيٌّ ملحقٌ فقط** (ق-٩٩/ق-١٠٠) ──────────────────────────────
-- `unit_path` = مسارُ **الهدف** المَزور (مفتاحُ التوجيه والعزل والقراءة بالاحتواء).
-- `supervisor_path` = مرساةُ الزائر (ق-١٦) — عمودُ بياناتٍ تصعد منه سلسلةُ الاعتماد في
-- محرّك NESSA، لا مفتاحُ توجيه. `details` نصُّ JSON بحقول النوع (ق-١٠٠ · ع-٣: لا JSONB).
CREATE TABLE IF NOT EXISTS supervision_visits (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  target_id       TEXT    NOT NULL,
  supervisor_path TEXT    NOT NULL,
  curriculum      TEXT    NOT NULL,
  day_key         TEXT    NOT NULL,
  visited_at      INTEGER NOT NULL,
  attendees       INTEGER NOT NULL,
  rating_pct      INTEGER NOT NULL,
  note_ar         TEXT    NOT NULL,
  details         TEXT    NOT NULL,
  by_person_id    TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_supervision_visits_routing ON supervision_visits (tenant_id, unit_path);

-- **وفهرسُ توجيهٍ واحدٌ لكلِّ جدولٍ، لا ثانيَ له** — و«كلُّ فهرسٍ إضافيٍّ قرارٌ سعويٌّ لا
-- تحسينٌ مجاني» (ADR-001 §١-٢: الفهارسُ تكلّف قدر الجدول تقريباً). ولا قارئَ حيًّا للزيارات
-- على القاعدة بغير النطاق: التحميلُ بالنطاق ثم كلُّ اشتقاقٍ (`visitsOfTarget` · التصنيف ·
-- التجميع) **في الذاكرة** بعد الحشو — فلا فهرسَ على `target_id` ولا على `supervisor_path`.
