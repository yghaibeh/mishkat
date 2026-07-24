-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — نموذجُ الحلقات الموحّد: **كيانٌ واحدٌ ونوعُه صفة، وصفرُ عدّادٍ مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- على نمط `0003`/`0007` حرفياً: مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥ · README
-- الحسم ٢)، ولهجةُ القاسم المشترك (ع-٣: لا JSONB · لا فهرسٌ جزئيّ · لا AUTOINCREMENT ·
-- التاريخُ INTEGER · المنطقُ ٠/١).
--
-- ### الثابتُ الذي يفرضه هذا المخطط قبل أيّ سطر منطق — **ب-٢٨ في القاعدة لا في الانضباط**
-- > **جدولُ حلقةٍ واحد** لا `tahfeez_circles` و`halaqat` — و«ثلاثةُ الأنظمة» (ع-٢/ع-١٩/ع-٢٩)
-- > تستحيل **بغياب الجدول الثاني** لا بالامتناع عن كتابته. والنوعُ **عمودٌ** (`type_id`)
-- > يشير إلى كتالوجٍ مرجعيّ، **وليس في الكتالوج عمودُ تفعيل** (`active`/`enabled`) — فبابُ
-- > المنع الثاني الذي أنتج ع-٨ («قسمها غير مفعّل») **غيرُ موجودٍ ليُنسى إغلاقُه**.
--
-- **وصفرُ عمودٍ يحفظ عدداً**: لا `student_count` ولا `circles_count` — العددُ استعلامٌ على
-- المصدر (README §٤ · ع-١٩/ع-٢٩: «أضفتُ لسامح ٣ حلقات فالعدد في صفحته ٠»).
--
-- ### وجدولان **ملحقان فقط** (`appendOnly` في `schema/circles.ts` · المادة ٧/٤)
-- `circles_circles` و`circles_enrollments`: الأرشفةُ **وسمٌ** (`archived_at`) والخروجُ **وسمٌ**
-- (`left_at`) — كلاهما **تحديثٌ على الصفّ نفسِه** لا حذفٌ وإدراج، فاختفاءُ صفٍّ من الإسقاط
-- **عطبٌ برمجيٌّ يُرمى** ولا يُترجم `DELETE`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ────────
CREATE TABLE IF NOT EXISTS circles_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circles_units_routing ON circles_units (tenant_id, unit_path);

-- ── نوعُ الحلقة: بياناتٌ مرجعيةٌ **نطاقُها الشبكةُ كلُّها** (`unit_path = '/'`) ──────────
-- ثلاثةُ أعمدةٍ لا رابعَ لها (قب-٢٢/قب-٤٠): **ولا عمودَ تفعيلٍ عمداً** — يُضاف نوعٌ صفّاً
-- فيعمل بلا سطر كود، ولا يوجد حقلٌ يُسأل عنه «أمفعَّل؟» (ع-٨ ميتٌ بالبناء).
CREATE TABLE IF NOT EXISTS circles_types (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circles_types_routing ON circles_types (tenant_id, unit_path);

-- ── الحلقة: **كيانٌ واحدٌ ابنٌ لوحدته، ونوعُه صفةٌ عليه** (ب-٢٨ · IA ك-١) ───────────────
-- `unit_path` موطنُها التنظيميّ، **ومنه يُشتقّ النطاق في كل دالة خادم**. وهو **مستقرٌّ بنيوياً
-- لا بالسياسة**: `UpdateCircleInput` ثلاثةُ حقولٍ (اسمٌ · نوعٌ · سعة) **وليس فيها وحدة** —
-- فلا يوجد مقبضٌ ينقل حلقةً بين وحدتين أصلاً، ولذلك لا يُعاد كتابةُ صفٍّ ملحقٍ بمفتاحٍ جديد.
-- والأرشفةُ **وسمٌ** (`archived_at`) لا محو (المادة ٧/٤) فلا يضيع تاريخُ الحلقة.
CREATE TABLE IF NOT EXISTS circles_circles (
  tenant_id         TEXT    NOT NULL,
  unit_path         TEXT    NOT NULL,
  id                TEXT    NOT NULL,
  type_id           TEXT    NOT NULL,
  name_ar           TEXT    NOT NULL,
  capacity          INTEGER NOT NULL,
  teacher_person_id TEXT,
  archived_at       INTEGER,
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circles_circles_routing ON circles_circles (tenant_id, unit_path);

-- ── التسجيل/الطالب: **سجلٌّ واحدٌ ابنُ الحلقة باسمٍ حرٍّ بلا هوية** (ق-٣١ · IA ك-٢) ──────
-- **ولا سجلَّ طلابٍ ثانٍ** — وهو بعينه ما كسر v1 («أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب»).
-- ونطاقُه **يرث موطنَ حلقته** (نظيرُ حركةِ العُهد من أصلها ومادةِ المكتبة): يُشتقّ ولا يُخترع،
-- وحلقةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً. والخروجُ **وسمٌ** (`left_at`) لا محو.
CREATE TABLE IF NOT EXISTS circles_enrollments (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  circle_id TEXT    NOT NULL,
  name_ar   TEXT    NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at   INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_circles_enrollments_routing ON circles_enrollments (tenant_id, unit_path);

-- **وصفرُ فهرسٍ زائدٍ** — «كلُّ فهرسٍ إضافيٍّ على جدول عمليات قرارٌ سعويّ لا تحسينٌ مجاني»
-- (ADR-001 §١-٢: الفهارسُ تكلّف قدر الجدول تقريباً). وكحال المكتبة: **قراءاتُ الوحدة كلُّها
-- على اللقطة المحمَّلة** (`circlesInScope`/`enrollmentsOf`/`circlesOfTeacher` تعمل في الذاكرة
-- بعد التحميل بالنطاق)، والتحميلُ نفسُه يمسح `(tenant_id, unit_path)` — وهو الفهرسُ القائم.
-- فلا قارئٌ حيٌّ **مباشرٌ على القاعدة** يبرّر فهرساً على `circle_id` ولا على `teacher_person_id`؛
-- وإضافةُ فهرسٍ بلا قارئٍ مسمّىً كلفةٌ بلا مقابل. (يُراجَع إن ظهر قارئٌ عابرٌ للنطاق.)
