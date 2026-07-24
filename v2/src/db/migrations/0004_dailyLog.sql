-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — سجلُّ اليوم والكتالوج: **النقطةُ مالٌ فلا تُمحى، والكتالوجُ شبكيٌّ فيُقرأ من كل وحدة**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- **رابعُ هجرةِ وحدةٍ في T26-ب** — على نمط `0003` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ
-- بلا استثناء (ع-٥ · `db/README.md` الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣: لا JSONB · لا
-- فهرسٌ جزئيّ · لا AUTOINCREMENT · التاريخُ INTEGER · المنطقُ ٠/١ · القوائمُ نصُّ JSON).
--
-- ### قراران في مفتاح التوجيه — كلاهما مُصرَّحٌ به لأنهما يفارقان نمطَ العُهد
-- > **الكتالوجُ (المخطّطاتُ والأنشطةُ) نطاقُه الشبكةُ كلُّها ⟵ `unit_path = '/'`.**
-- المخطّطُ يُختار بـ«أعمقُ نطاقٍ يحتوي الوحدة» (ق-٤٢)، فمسجدٌ في `/men/homs/sq2/khalid/`
-- يحتاج مخطّطاً نطاقُه `/men/` — وهو **سلفٌ لا خلَف**. ولو وُجِّه المخطّطُ إلى نطاقه لَمَا
-- حمّلته جلسةُ المسجد (التحميلُ يجلب الأحفادَ والجذرَ لا الأسلافَ)، فتعذّر الاحتساب.
-- فالكتالوجُ يسكن الجذرَ **صراحةً** (نظيرُ `org_accounts` وشجرةِ الحسابات — README الحسم ٢)،
-- و**نطاقُ سريانه يُحفظ عموداً بياناً** (`scope_path`) لا مفتاحَ توجيه. والعزلُ يبقى بالشبكة.
-- > **والقيدُ اليوميّ وعددُ الأسرة نطاقُهما وحدةٌ ⟵ مسارُ الوحدة**، فجلسةُ مسجدٍ لا تحمّل
-- قيودَ جاره ولا عددَ أسرته.
--
-- ### وجدولٌ **ملحقٌ فقط** حيث النقطةُ مالٌ (ق-٣٣) والنسخةُ تاريخ (ق-٣٦ · المادة ٧/٤)
-- `daily_entries` · `daily_activities` · `daily_schemes`: اختفاءُ صفٍّ منها **عطبٌ برمجيٌّ
-- يُرمى** ولا يُترجم `DELETE`. القيدُ يُحدَّث في مكانه (upsert بمفتاحٍ طبيعيّ — ق-٤٥) ولا
-- يُحذف؛ والنشاطُ يُعطَّل بنسخةٍ لا يُمحى؛ والمخطّطُ يُوقَف حالةً لا حذفاً. أمّا `daily_units`
-- (نسخةُ قراءةٍ لاشتقاق النطاق) و`daily_rosters` (قيمةٌ راهنةٌ تُكتب فوقها) فليسا ملحقَين.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS daily_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_daily_units_routing ON daily_units (tenant_id, unit_path);

-- ── مخطّطُ الأنشطة: **كيانُ بياناتٍ بشاشة** (ق-٤٢) نطاقُه الشبكةُ فيسكن الجذر ──────────
-- `scope_path` هو نطاقُ سريانه (بيانٌ يُقرأ بـ`contains`)، و`unit_path='/'` هو مفتاحُ توجيهه
-- (يُحمَّل في كل جلسة). الإيقافُ حالةٌ في `active` لا حذفٌ (المادة ٧/٤).
CREATE TABLE IF NOT EXISTS daily_schemes (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  ar         TEXT    NOT NULL,
  scope_path TEXT    NOT NULL,
  active     INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_daily_schemes_routing ON daily_schemes (tenant_id, unit_path);

-- ── كتالوجُ الأنشطة بنسخه المؤرَّخة (ق-٣٦ بأثرٍ قادمٍ فقط) — شبكيٌّ كذلك فيسكن الجذر ──
-- معرّفُ النسخة `مخطّط:نشاط:يومُ السريان` (يحمل حتميّةَ التعادل)، و`valid_from` تاريخُ
-- سريانها. **ملحقٌ فقط**: نسخةٌ جديدةٌ تُضاف ولا تُكتب فوق القديم، فيبقى الماضي كما حُسم.
CREATE TABLE IF NOT EXISTS daily_activities (
  tenant_id             TEXT    NOT NULL,
  unit_path             TEXT    NOT NULL,
  id                    TEXT    NOT NULL,
  scheme_id             TEXT    NOT NULL,
  activity_id           TEXT    NOT NULL,
  ar                    TEXT    NOT NULL,
  weight                INTEGER NOT NULL,
  max_per_day           INTEGER,
  requires_participation INTEGER NOT NULL,
  active                INTEGER NOT NULL,
  valid_from            INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_daily_activities_routing ON daily_activities (tenant_id, unit_path);

-- ── عددُ طلاب الأسرة (ب-٣٢): **قيمةٌ راهنةٌ لكل وحدة** تُكتب فوقها ──────────────────────
-- مفتاحُها الطبيعيّ `(tenant_id, unit_path)` — لأنّ لكل وحدةٍ عدداً واحداً يُضبط، فالنطاقُ
-- هو الهويّة. و`null` في `student_count` حالةٌ ذاتُ أثرٍ (غيرُ مضبوطٍ ⟵ تُمنع النقاطُ
-- المشروطة fail-closed) لا فراغٌ صامت. وليس ملحقاً: الضبطُ الجديد **يكتب فوق القديم**.
CREATE TABLE IF NOT EXISTS daily_rosters (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  student_count INTEGER,
  set_by        TEXT    NOT NULL,
  set_at        INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, unit_path)
);
-- مفتاحُ `(tenant_id, unit_path)` يُنشئ فهرسَه الآليّ على العمودين نفسِهما، لكنّ **G10 يشترط
-- فهرسَ توجيهٍ مُعلَناً على كل جدولِ بيانات** (يقرأ نصَّ الهجرة لا خريطةَ الفهارس المطبَّقة).
-- فيُعلَن هنا صراحةً — اتّساقاً مع الحارس ولو طابق المفتاحَ — لا استثناءَ يُسرد له.
CREATE INDEX IF NOT EXISTS idx_daily_rosters_routing ON daily_rosters (tenant_id, unit_path);

-- ── القيدُ اليوميّ: **أضخمُ جدولٍ (~٤١٦ ألف صفٍّ/سنة شبكياً) والنقطةُ فيه مالٌ (ق-٣٣)** ──
-- **ملحقٌ فقط**: القيدُ يُحدَّث في مكانه upsert (ق-٤٥ فهرسان فريدان: البصمةُ والمفتاحُ
-- الطبيعيّ) ولا يُحذف أبداً؛ واختفاءُ صفٍّ = ضياعُ نقطةٍ = ضياعُ مال ⟵ يُرمى (المادة ٧/٤).
-- والنقاطُ **مخزَّنةٌ** (ق-٤١): تُحسب بأهليّتها ووزنها يومَ الإدخال ولا تُشتقّ عند الجمع،
-- فتغييرُ وزنٍ اليوم لا يمسّ أسبوعاً مضى. والقوائمُ (الطلابُ والمحتسَبون) نصُّ JSON (ع-٣).
CREATE TABLE IF NOT EXISTS daily_entries (
  tenant_id            TEXT    NOT NULL,
  unit_path            TEXT    NOT NULL,
  id                   TEXT    NOT NULL,
  client_uuid          TEXT    NOT NULL,
  activity_id          TEXT,
  free_text_ar         TEXT,
  day_key              TEXT    NOT NULL,
  period_key           TEXT    NOT NULL,
  count                INTEGER NOT NULL,
  credited_count       INTEGER NOT NULL,
  points               INTEGER NOT NULL,
  student_ids          TEXT    NOT NULL,
  credited_student_ids TEXT    NOT NULL,
  block                TEXT    NOT NULL,
  by_person_id         TEXT    NOT NULL,
  at                   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_daily_entries_routing ON daily_entries (tenant_id, unit_path);
-- **ولا فهرسَ زائدٌ ثالث** — و«كلُّ فهرسٍ إضافيٍّ على جدول عمليات قرارٌ سعويّ لا تحسينٌ
-- مجاني» (ADR §١-٢: الفهارسُ تكلّف قدر الجدول تقريباً). القراءةُ الوحيدةُ على القاعدة اليوم
-- تحميلُ نطاقٍ يخدمه فهرسُ التوجيه؛ وفهارسُ البصمة والمفتاح الطبيعيّ (ق-٤٥) **في الذاكرة**
-- على النطاق المحمَّل لا على القاعدة. والتقاريرُ العابرةُ للوحدات (ق-٧٢) خارجُ النطاق اليوم،
-- فتأتي بفهارسها يومَ تُبنى — لا فهرسٌ بلا قارئٍ حيٍّ يُسمّى.
