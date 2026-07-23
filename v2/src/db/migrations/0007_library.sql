-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — المكتبةُ التدريبية: **خطُّ زمنٍ لا يُمحى، وصفرُ عدّادٍ مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- على نمط `0003` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥ · README الحسم ٢)،
-- ولهجةُ القاسم المشترك (ع-٣: لا JSONB · لا فهرسٌ جزئيّ · لا AUTOINCREMENT · التاريخُ
-- INTEGER · المنطقُ ٠/١).
--
-- ### الثابتُ الذي يفرضه هذا المخطط قبل أيّ سطر منطق — **صفرُ حقلٍ يحفظ عدداً**
-- > «الخَتَماتُ الثلاث» (استُلم/فُتح/أُنجز) تُغري بحقلٍ يحفظ عددَ المنجِزين. **ولا حقلَ كذلك.**
-- الحالةُ اشتقاقٌ من الخَتمات عند القراءة، والعددُ استعلامٌ على `library_progress` — فلا رقمَ
-- يتباعد ولا مطابقةَ تُبنى (ADR ع-٦ / README §٤: «صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس»).
--
-- ### وجدولان **ملحقان فقط** (`appendOnly` في `schema/library.ts` · المادة ٧/٤)
-- `library_materials` و`library_progress`: اختفاءُ صفٍّ منهما **عطبٌ برمجيٌّ يُرمى** ولا يُترجم
-- `DELETE`. الأرشفةُ **وسمٌ** (`archived_at`/`archived_by`) لا محو، وانتقالُ خط الزمن
-- (فُتح ⟵ أُنجز) **تحديثٌ على الصفّ نفسِه** لا حذفٌ وإدراج — كبصمةِ إقرار العُهد.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق واسمِها، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS library_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_library_units_routing ON library_units (tenant_id, unit_path);

-- ── الفئة: بياناتٌ مرجعيةٌ **نطاقُها الشبكةُ كلُّها** (`unit_path = '/'`)، بلا مفتاح تفعيل ──
CREATE TABLE IF NOT EXISTS library_categories (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_library_categories_routing ON library_categories (tenant_id, unit_path);

-- ── الجمهور: **قدرةٌ لا اسمُ دور** (ق-٩٦/§٢) — الانتماءُ سؤالٌ للمحرّك لا قائمةٌ مُصلَّبة ──
CREATE TABLE IF NOT EXISTS library_audiences (
  tenant_id     TEXT NOT NULL,
  unit_path     TEXT NOT NULL,
  id            TEXT NOT NULL,
  ar            TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_library_audiences_routing ON library_audiences (tenant_id, unit_path);

-- ── الصيغة: بياناتٌ مرجعية، و**الإيقافُ بيانٌ (`active` ٠/١) لا حذف** (المادة ٨/٤) ──
CREATE TABLE IF NOT EXISTS library_formats (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  content_type TEXT    NOT NULL,
  active       INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_library_formats_routing ON library_formats (tenant_id, unit_path);

-- ── المادة: **كيانٌ ذو موطنٍ تنظيميّ** (§٣، موتُ ح-٦) — موطنُه لا يتحرّك بالتعديل ──────
-- نقلُها إلى وحدةٍ أخرى **إنشاءٌ جديد** لا تعديلٌ صامت، فمفتاحُ توجيهها **مستقرٌّ**: صفوفُ
-- خطِّ زمنها الملحقةُ فقط ترث مساره ولا تُعاد كتابتُها. والأرشفةُ **وسمٌ** لا محو (المادة ٧/٤).
CREATE TABLE IF NOT EXISTS library_materials (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  title_ar     TEXT    NOT NULL,
  category_id  TEXT    NOT NULL,
  audience_id  TEXT    NOT NULL,
  kind         TEXT    NOT NULL,
  unit_id      TEXT    NOT NULL,
  mandatory    INTEGER NOT NULL,
  storage_key  TEXT,
  content_type TEXT,
  size_bytes   INTEGER,
  external_url TEXT,
  created_by   TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  archived_at  INTEGER,
  archived_by  TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_library_materials_routing ON library_materials (tenant_id, unit_path);

-- ── خطُّ الزمن: **إلحاقٌ لا استبدال** (ق-٩٦) — سجلٌّ واحدٌ لكلِّ (مادة، شخص) كـ`UNIQUE` v1 ──
-- الخَتماتُ الثلاث حقولٌ **تُحدَّث على الصفّ نفسِه** (استُلم ثابتٌ، ثم فُتح ثم أُنجز)، فانتقالُ
-- الحالة تحديثٌ لا حذفٌ وإدراج. ومفتاحُه الطبيعيُّ يحمل الشبكةَ فالمادةَ فالشخص.
CREATE TABLE IF NOT EXISTS library_progress (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  material_id  TEXT    NOT NULL,
  person_id    TEXT    NOT NULL,
  delivered_at INTEGER NOT NULL,
  opened_at    INTEGER,
  completed_at INTEGER,
  PRIMARY KEY (tenant_id, material_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_library_progress_routing ON library_progress (tenant_id, unit_path);

-- **وصفرُ فهرسٍ زائدٍ لا ثالثَ له** — و«كلُّ فهرسٍ إضافيٍّ على جدول عمليات قرارٌ سعويّ لا
-- تحسينٌ مجاني» (ADR-001 §١-٢). وخلافاً للعُهد (فهرسا السلسلة و«ما بيد فلان»)، **قراءةُ
-- المكتبة كلُّها في الذاكرة بعد التحميل بالنطاق**: `materialsInScope`/`trackingMatrix`
-- يعملان على اللقطة المحمَّلة، والتحميلُ نفسُه يمسح `(tenant_id, unit_path)` — وهو الفهرسُ
-- القائم. فلا قارئٌ حيٌّ **مباشرٌ على القاعدة** يبرّر فهرساً رابعاً؛ وإضافةُ فهرسٍ بلا قارئٍ
-- مسمّىً كلفةٌ بلا مقابل. (يُراجَع إن ظهر قارئٌ عابرٌ للنطاق كدورة حياة الحساب في العُهد.)
