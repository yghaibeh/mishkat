-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — منهاجُ «على بصيرة»: **صفوفٌ مرجعيةٌ بلا مفتاح تفعيل، وتقدّمٌ مشتقٌّ لا مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- على نمط `0007`/`0010`/`0011` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥)،
-- ولهجةُ القاسم المشترك (ع-٣).
--
-- ### الثابتُ الذي يفرضه هذا المخطط — **صفرُ جدولِ درسٍ وصفرُ عدّادِ تقدّم**
-- > **لا جدولَ للدرس هنا** (CR-016): «الدرس/الجلسة اليومية» كيانٌ **موطنُه `circleLog`**،
-- > وهذه الوحدةُ **طبقةُ قواعدَ فوقه** (ق-٨٥/٨٦/٩٢). **والغيابُ هو الدليل** — لو وُجد جدولٌ
-- > هنا لعاد انشطارُ v1 في طبقة السجل.
-- > **ولا عمودَ يحفظ تقدّماً** (ق-٩٢): مصفوفةُ التقدّم **تُبنى لحظةَ السؤال** من ثلاثة مصادر،
-- > والتصحيحُ اليدويُّ **بصمةٌ تُلحق فوق الاشتقاق** لا رقمٌ يحلّ محلّه (قب-٩).
-- > **ولا `active` ولا `enabled`** في صفوف المنهاج الأربعة (قب-٢٢/ع-٨): بابُ المنع الثاني
-- > **غيرُ موجودٍ ليُنسى إغلاقُه**، ومنهاجٌ ثانٍ **يُضاف صفوفاً فيعمل بلا سطر كود**.
--
-- ### وجدولٌ واحدٌ **ملحقٌ فقط**: `education_progress_corrections`
-- بصمةُ تصحيحٍ **تُلحق ولا تُمحى** (قب-٩: مَن/ماذا/متى/لماذا ظاهرةٌ في سجلٍّ يُلحق)،
-- و«الأحدثُ يغلب» **اشتقاقٌ عند القراءة** لا استبدالٌ للصفّ.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── المنهاجُ ومستوياتُه وكتبُه ومجالسُه: **بياناتٌ مرجعيةٌ نطاقُها الشبكةُ كلُّها** ──────
CREATE TABLE IF NOT EXISTS education_curricula (
  tenant_id      TEXT NOT NULL,
  unit_path      TEXT NOT NULL,
  id             TEXT NOT NULL,
  ar             TEXT NOT NULL,
  circle_type_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_education_curricula_routing ON education_curricula (tenant_id, unit_path);

CREATE TABLE IF NOT EXISTS education_levels (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  curriculum_id TEXT    NOT NULL,
  ar            TEXT    NOT NULL,
  ordinal       INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_education_levels_routing ON education_levels (tenant_id, unit_path);

CREATE TABLE IF NOT EXISTS education_books (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  level_id  TEXT    NOT NULL,
  ar        TEXT    NOT NULL,
  ordinal   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_education_books_routing ON education_books (tenant_id, unit_path);

-- **المجلسُ وحدةُ التقدّم** التي يقيس عليها ق-٩٢ — ولذلك لا يتضاعف بتعدّد فترات اليوم.
CREATE TABLE IF NOT EXISTS education_sessions (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  book_id   TEXT    NOT NULL,
  ar        TEXT    NOT NULL,
  ordinal   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_education_sessions_routing ON education_sessions (tenant_id, unit_path);

-- ── بصمةُ التصحيح اليدويّ (ق-٩٢ ذيلاً · قب-٩): **تُلحق ولا تُمحى** ─────────────────────
-- ونطاقُها **يُشتقّ من حلقتها** عبر قارئِ مسارٍ مُحقَن (لا نسخةَ حقلٍ في الكيان — ب-٢٨)،
-- وحلقةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً.
CREATE TABLE IF NOT EXISTS education_progress_corrections (
  tenant_id     TEXT    NOT NULL,
  unit_path     TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  circle_id     TEXT    NOT NULL,
  enrollment_id TEXT    NOT NULL,
  session_id    TEXT    NOT NULL,
  completed     INTEGER NOT NULL,
  at            INTEGER NOT NULL,
  by_person_id  TEXT    NOT NULL,
  reason_ar     TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_education_progress_corrections_routing ON education_progress_corrections (tenant_id, unit_path);

-- **وصفرُ فهرسٍ زائد**: كلُّ قراءاتِ الوحدة (`curriculumProgress`/`approvedTeachingLoad`)
-- تعمل على **اللقطة المحمَّلة بالنطاق**، والتحميلُ يمسح `(tenant_id, unit_path)` — وهو الفهرسُ
-- القائم. فلا قارئٌ حيٌّ مباشرٌ على القاعدة يبرّر فهرساً رابعاً (ADR-001 §١-٢).
