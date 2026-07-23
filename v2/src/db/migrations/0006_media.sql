-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — الإعلام والتغطيات: **سحبُ المنشور حالةٌ لا حذف، وصفرُ صورةٍ يتيمة**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- وحدةُ الموجة الأولى رقمُها `0006` — على نمط `0003_custody` حرفياً: مفتاحُ التوجيه على
-- كلِّ جدولٍ بلا استثناء (ع-٥ · `db/README.md` الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣).
--
-- ### الثابتُ الذي يفرضه هذا المخطط قبل أيّ سطر منطق — **الحذفُ بيانٌ لا محو**
-- > **التغطيةُ والصورةُ لا تُمحيان: «سحبُ المنشور» حالةٌ** (`deleted_at`/`deleted_by`).
-- ق-١٠٥: «الحذفُ لناشرها وحده **ويأخذ صورَها**» — و«يأخذها» إخفاءٌ من العرض لا محوٌ من
-- القاعدة: صفُّ الصورة يبقى، وألبومُ المحذوفة يُقرأ فارغاً من الحالة لا من زوال الصفّ.
-- ولذلك `media_coverages` و`media_photos` **ملحقان فقط** (`appendOnly` في `schema.ts`):
-- اختفاءُ صفٍّ منهما **عطبٌ برمجيٌّ يُرمى** ولا يُترجَم `DELETE` (المادة ٧/٤)، ونمذجةُ
-- «سحب المنشور» حذفاً وإدراجاً بمعرّفٍ جديد تُسقط ق-١٠٥ (مَن حذف ومتى يبقيان في الصفّ نفسِه).
--
-- ### ومفتاحُ التوجيه — **ليس جذرَ الشبكة كما تُوقِّع**
-- توقّع تقريرُ T26-ب-١ أن جمهورَ المادة قد يكون «أوسعَ من وحدة (مرآةٌ شبكية) ⟵ قد تحتاج
-- جذرَ الشبكة». لكنّ **المرآةَ الشبكية (عُهدتي) خارجُ النطاق نصّاً** (ز-٤/ق-١٠٧): كلُّ تغطيةٍ
-- لها **وحدةٌ بعينها** (`unit_id`/`unit_path`)، فتوجيهُها **مسارُ وحدتها** لا الجذر. والصورةُ
-- ترث توجيهَها من تغطيتها (نظيرُ حركةِ العُهد من أصلها). والجذرُ `/` **للمعجمَين وحدهما**
-- (نوعُ التغطية وصيغةُ الرفع) — بياناتٌ مرجعيةٌ نطاقُها الشبكةُ كلُّها **صدقاً لا حشواً**.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق والاسم، لا مصدرُ حقيقة (نظيرُ `custody_units`) ──
CREATE TABLE IF NOT EXISTS media_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_media_units_routing ON media_units (tenant_id, unit_path);

-- ── معجمُ أنواع التغطية: **بياناتٌ مرجعية** نطاقُها الشبكة (`unit_path = '/'`) ──────────
-- ق-١٠٣ «نوعٌ من معجم» · قب-٦/G14: إضافةُ نوعٍ لا تُغيّر سطرَ كود. **ملحقٌ فقط**: الإيقافُ
-- بيانٌ (`active = 0`) لا حذف (المادة ٧/٤) — فلا يختفي نوعٌ رآه العرضُ يوماً.
CREATE TABLE IF NOT EXISTS media_kinds (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  ar        TEXT    NOT NULL,
  active    INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_media_kinds_routing ON media_kinds (tenant_id, unit_path);

-- ── قاموسُ صيغ الرفع المقبولة: **بياناتٌ مرجعية** كذلك، بجذر الشبكة (المادة ٨/٤) ────────
-- والمُعطَّلُ يبقى صفّاً (`active = 0`) ليُفرَّق «أُوقف» عن «لم يُسجَّل» عند الرفض (§٧).
CREATE TABLE IF NOT EXISTS media_formats (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  content_type TEXT    NOT NULL,
  active       INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_media_formats_routing ON media_formats (tenant_id, unit_path);

-- ── التغطية: **سجلُّ حدثٍ في وحدةٍ بعينها** (ق-١٠٣) — أربعةُ أجوبةٍ شرطُ الوجود ──────────
-- **ملحقٌ فقط**: «سحبُ المنشور» تحديثٌ على الصفّ نفسِه (`deleted_at`/`deleted_by`) لا حذفٌ
-- وإدراج. و`occurred_on` تاريخُ الوقوع غيرُ `created_at` تاريخِ الرفع — فصلٌ متعمَّد.
CREATE TABLE IF NOT EXISTS media_coverages (
  tenant_id           TEXT    NOT NULL,
  unit_path           TEXT    NOT NULL,
  id                  TEXT    NOT NULL,
  title_ar            TEXT    NOT NULL,
  kind_id             TEXT    NOT NULL,
  unit_id             TEXT    NOT NULL,
  occurred_on         INTEGER NOT NULL,
  publisher_person_id TEXT    NOT NULL,
  created_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  deleted_by          TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_media_coverages_routing ON media_coverages (tenant_id, unit_path);

-- ── ألبومُ التغطية: **لا صورةَ بلا تغطيتها** (ق-١٠٣) — توجيهُها مسارُ تغطيتها لا يُخترع ──
-- **ملحقٌ فقط**: الصورةُ لا تُمحى؛ حذفُ التغطية يُخفي ألبومَها بالحالة لا بزوال صفوفه.
CREATE TABLE IF NOT EXISTS media_photos (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  coverage_id  TEXT    NOT NULL,
  storage_key  TEXT    NOT NULL,
  content_type TEXT    NOT NULL,
  size_bytes   INTEGER NOT NULL,
  uploaded_by  TEXT    NOT NULL,
  uploaded_at  INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_media_photos_routing ON media_photos (tenant_id, unit_path);

-- **وفهرسان لا ثالثَ لهما** — و«كلُّ فهرسٍ إضافيٍّ قرارٌ سعويّ لا تحسينٌ مجاني» (ADR-001
-- §١-٢: الفهارسُ تكلّف قدر الجدول تقريباً). فلكلٍّ قارئٌ حيٌّ يُسمّى:
--   · **ألبومُ التغطية**: `photosOf(coverageId)` — أشيعُ قراءةٍ في الوحدة (عددُ الصور،
--     «تغطياتي»، المعرض)، وأساسُ «تغطيةٌ بلا صورةٍ لا تُعرض» (ق-١٠٣). بلا هذا الفهرس يصير
--     كلُّ عدِّ ألبومٍ مسحاً كاملاً على أكبر جدولَي الوحدة.
CREATE INDEX IF NOT EXISTS idx_media_photos_album ON media_photos (tenant_id, coverage_id);
--   · **«تغطياتي»**: `media.coverages.mine` (§٦) — تغطياتُ الناشر نفسِه، مدخلُ شاشة النشر.
CREATE INDEX IF NOT EXISTS idx_media_coverages_publisher ON media_coverages (tenant_id, publisher_person_id);
