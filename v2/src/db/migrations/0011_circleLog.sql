-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — السجلُّ اليوميُّ للحلقة: **المفتاحُ (حلقة × يوم × فترة)، وصفرُ عدّادٍ مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- على نمط `0003`/`0007`/`0010` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥)،
-- ولهجةُ القاسم المشترك (ع-٣: لا JSONB · لا فهرسٌ جزئيّ · لا AUTOINCREMENT · التاريخُ
-- INTEGER · المنطقُ ٠/١).
--
-- ### المفتاحُ الطبيعيُّ يتجمّد هنا — **ولذلك نُفِّذ CR-020 قبل هذه الهجرة لا بعدها**
-- > قرارُ المالك (قب-٤٥): «يُسمح بجلستين (صباح/مساء)». فمفتاحُ الجلسة **(حلقة × يوم ×
-- > فترة)** — والفترةُ **قائمةٌ محصورةٌ من صفوف** (`circlelog_periods`). ولو جُمِّد المفتاحُ
-- > ثنائياً ثم نُفِّذ القرارُ لصار تنفيذُه **هجرةَ بياناتٍ على أكبر جدولَي التعليم**.
-- > **والجلسةُ كيانٌ واحدٌ اتّسع مفتاحُه ولم ينشطر** (CR-016): `shape_kind` مميِّزٌ عليها،
-- > لا جدولٌ لجلسة تحفيظٍ وآخرُ لجلسة منهاج.
--
-- ### وصفرُ عمودٍ يحفظ عدداً — الحضورُ والتقدّمُ **استعلامان** (ق-٩٠/٩١/٩٢)
-- ثلاثةُ بلاغاتٍ ميدانية جذرُها رقمٌ مخزَّنٌ تباعد (ع-١٢/ع-١٩/ع-٢٩)؛ فليس في هذا المخطط
-- حقلُ حضورٍ ولا نسبةٍ ولا متوسّط — **ولا يوجد ما يتباعد أصلاً** (README §٤).
--
-- ### وثلاثةُ جداولَ **ملحقةٌ فقط**، وواحدٌ **ليس كذلك عن قصد** (المادة ٧/٤ · README §٤-٣)
-- `circlelog_sessions` و`circlelog_notes` و`circlelog_links` **ملحقةٌ فقط**: الجلسةُ لا تُمحى،
-- والملاحظةُ سجلٌّ يُلحق ولا يُحرَّر (ق-٨٧)، والرابطُ **إلغاؤه وسمٌ** (`revoked_at`) لا حذف.
-- **أمّا `circlelog_session_rows` فليست ملحقةً — وهذا جوابُ سؤالٍ لا سهو**: ق-٩٠ ينصّ أنّ
-- إعادةَ الإرسال **تستبدل أسطرَ اليوم**، فاختفاءُ سطرِ طالبٍ حُذف من الكشف **حذفٌ مشروعٌ
-- معلَن** — وعلمٌ زائدٌ هنا كان **يُرمى في وجهنا عند أوّل إعادةِ إرسالٍ صحيحة**.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── كتالوجُ السور: بياناتٌ مرجعيةٌ **نطاقُها الشبكةُ كلُّها** (ق-٨٩/قب-٢٢) ──────────────
-- عددُ الآيات **بيانٌ لا رقمٌ صلب** في الكود (G14) — يُبذَر صفّاً فيعمل.
CREATE TABLE IF NOT EXISTS circlelog_surahs (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  ar         TEXT    NOT NULL,
  ayah_count INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_surahs_routing ON circlelog_surahs (tenant_id, unit_path);

-- ── كتالوجُ المصاحف: مرجعيٌّ كذلك، وحدُّ الصفحات بيانٌ يُبذَر لا ثابتٌ في الكود ────────
CREATE TABLE IF NOT EXISTS circlelog_mushafs (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  ar         TEXT    NOT NULL,
  page_count INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_mushafs_routing ON circlelog_mushafs (tenant_id, unit_path);

-- ── فتراتُ اليوم (**CR-020**): قائمةٌ محصورةٌ من صفوفٍ مرجعية لا أسماءٌ في الكود ───────
-- شبكةٌ لم تُعلن صفّاً ⇒ يومُها غيرُ مقسَّم (فترةُ «اليوم كلِّه» — التركيبُ الأدنى).
CREATE TABLE IF NOT EXISTS circlelog_periods (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  ar        TEXT    NOT NULL,
  ordinal   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_periods_routing ON circlelog_periods (tenant_id, unit_path);

-- ── الجلسةُ اليومية: **مفتاحُها الطبيعيُّ (شبكة × حلقة × يوم × فترة)** (ق-٩٠ · CR-020) ──
-- فإعادةُ الإرسال `INSERT … ON CONFLICT(المفتاح الطبيعيّ) DO UPDATE` ⟵ **تتقارب ولا تزدوج**
-- (ع-٤) **بالبنية لا بالانضباط**؛ و`id` عمودٌ مستقرٌّ يُشير إليه أسطرُها وصورُها.
-- و`shape_kind` **مميِّزُ الاتحاد** (CR-016): أعمدةُ المنهاج الثلاثةُ فارغةٌ في جلسة التحفيظ
-- **لأنّ حقولها غيرُ موجودةٍ في الكيان**، لا لأنّ أحداً نسي ملأها.
-- ومفتاحُ التوجيه **يُشتقّ من حلقتها عبر المنفذ المعلن** ولا يُنسخ إلى الكيان (ب-٢٨).
CREATE TABLE IF NOT EXISTS circlelog_sessions (
  tenant_id              TEXT    NOT NULL,
  unit_path              TEXT    NOT NULL,
  circle_id              TEXT    NOT NULL,
  day_key                TEXT    NOT NULL,
  period_id              TEXT    NOT NULL,
  id                     TEXT    NOT NULL,
  shape_kind             TEXT    NOT NULL,
  curriculum_session_id  TEXT,
  duration_minutes       INTEGER,
  venue_ar               TEXT,
  held_at                INTEGER NOT NULL,
  recorded_by_person_id  TEXT    NOT NULL,
  recorded_at            INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, circle_id, day_key, period_id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_sessions_routing ON circlelog_sessions (tenant_id, unit_path);

-- ── سطرُ الطالب في الجلسة: **ليس ملحقاً** — الاستبدالُ سلوكٌ معلنٌ في ق-٩٠ (انظر الرأس) ──
-- ونطاقُ الحفظ/المراجعة **شكلٌ واحدٌ بمميِّز** (ق-٨٩): `mode` يقول أسورةٌ أم صفحات، و`ref`
-- معرّفُ السورة أو المصحف، و`from`/`to` آيتان أو صفحتان. **فلا أربعةَ عشرَ عموداً لوجهين**.
CREATE TABLE IF NOT EXISTS circlelog_session_rows (
  tenant_id           TEXT    NOT NULL,
  unit_path           TEXT    NOT NULL,
  session_id          TEXT    NOT NULL,
  enrollment_id       TEXT    NOT NULL,
  attendance          TEXT    NOT NULL,
  memo_mode           TEXT,
  memo_ref            TEXT,
  memo_from           INTEGER,
  memo_to             INTEGER,
  memo_grade          INTEGER,
  review_mode         TEXT,
  review_ref          TEXT,
  review_from         INTEGER,
  review_to           INTEGER,
  review_grade        INTEGER,
  tajweed_grade       INTEGER,
  enrichment_type_id  TEXT,
  enrichment_grade    INTEGER,
  PRIMARY KEY (tenant_id, session_id, enrollment_id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_session_rows_routing ON circlelog_session_rows (tenant_id, unit_path);

-- ── صورُ المنهج المصاحب: **مراجعُ وسائط** لا ملفات (IA ك-٣٤)، ومرتَّبةٌ بترتيبِ إرسالها ──
-- جدولٌ مستقلٌّ لأنّ القائمةَ **قيمةٌ متعدّدة**، و`JSON` في عمودٍ يخالف ع-٣ ويمنع القراءةَ
-- بالسطر. وليس ملحقاً: إعادةُ إرسال اليوم تستبدل صورَه كما تستبدل أسطرَه.
CREATE TABLE IF NOT EXISTS circlelog_session_photos (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  session_id TEXT    NOT NULL,
  ordinal    INTEGER NOT NULL,
  photo_key  TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, session_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_session_photos_routing ON circlelog_session_photos (tenant_id, unit_path);

-- ── ملاحظةُ الإشراف: **سجلٌّ يُلحق ولا يُحرَّر ولا يُمحى** (ق-٨٧/ب-٣٥أ · المادة ٧/٤) ────
CREATE TABLE IF NOT EXISTS circlelog_notes (
  tenant_id        TEXT    NOT NULL,
  unit_path        TEXT    NOT NULL,
  id               TEXT    NOT NULL,
  circle_id        TEXT    NOT NULL,
  body_ar          TEXT    NOT NULL,
  author_person_id TEXT    NOT NULL,
  written_at       INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_notes_routing ON circlelog_notes (tenant_id, unit_path);

-- ── رابطُ وليّ الأمر (ق-٩٣): **الإلغاءُ وسمٌ** (`revoked_at`) لا محو، والموتُ بالأرشفة ────
-- **بنيويٌّ يُسأل عنه نموذجُ الحلقة لحظةَ الحلّ** — فلا عمودَ حالةٍ يُنسى تحديثُه.
CREATE TABLE IF NOT EXISTS circlelog_links (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  token         TEXT    NOT NULL,
  enrollment_id TEXT    NOT NULL,
  circle_id     TEXT    NOT NULL,
  issued_at     INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  revoked_at    INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circlelog_links_routing ON circlelog_links (tenant_id, unit_path);

-- **وفهرسٌ زائدٌ واحدٌ له قارئٌ حيٌّ يُسمّى** (ADR-001 §١-٢: الفهرسُ قرارٌ سعويّ لا تحسينٌ
-- مجاني): `circlelog_links (tenant_id, token)` — لأنّ **حلَّ الرمز** (`linkByToken`) هو مسارُ
-- صفحةِ وليّ الأمر العامّة، وهو **القارئُ الوحيد الذي يبحث بقيمةٍ غيرِ المفتاح**. وما عداه
-- يعمل على اللقطة المحمَّلة بالنطاق، فلا يبرّر فهرساً.
CREATE INDEX IF NOT EXISTS idx_circlelog_links_token ON circlelog_links (tenant_id, token);
