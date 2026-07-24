-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — الرواتبُ والمستحقات: **وقائعُ مالية التُزمت، وصفرُ مستحقٍّ مخزَّن**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- ثانيةُ السلسلة المالية في T31، ولهجةُ القاسم المشترك (ع-٣): لا `JSONB` · لا فهرسٌ جزئيّ ·
-- لا `AUTOINCREMENT` · التاريخُ `INTEGER` · المنطقُ ٠/١.
--
-- ### الثابتُ الأول الذي يفرضه هذا المخطط: **لا سطرَ مستحقٍّ ولا حقلَ «مدفوع»**
-- > المستحقُّ **اشتقاقٌ لحظةَ السؤال**، والمختومُ يعيش في **حمولة المحرّك المُجمَّدة** لا هنا
-- > (عقدُ الوحدة §٢-١). فليس في هذه الجداول عمودُ `gross` ولا `net` ولا `paid`: ما يسكنها
-- > **وقائعُ مالية التُزمت ومعها قيدُها** — سلفةٌ خرج نقدُها، وقسطٌ استُرد، وصرفٌ وقع.
-- > ولو خُزِّن المستحقُّ صفّاً لصار **مصدرَ حقيقةٍ ثانياً** يتباعد عن الاشتقاق والمختوم معاً.
--
-- ### والثابتُ الثاني — **«لا صرفَ مرتين» تفرُّدُه في القاعدة لا في الذاكرة** (ق-٦٥)
-- كان الحارسُ في الذاكرة وحدَها (`paidPersonIdsIn`)، وهو **يكفي ما دام كلُّ شيءٍ محمَّلاً**.
-- ويوم يصير النطاقُ جزئياً **ينكسر بلا صوت**: جلسةٌ بنطاق وحدةٍ لا تُحمّل صرفَ وحدةٍ أخرى،
-- فيمرّ الشخصُ من الحارس **ويُصرف له مرّتين في فترةٍ واحدة**. ولذلك:
--   · صفوفُ «مَن صُرف له» جدولٌ مستقلٌّ `payroll_payout_persons`،
--   · وعليه **فهرسٌ فريدٌ `(tenant_id, period_id, person_id)`** — فالازدواجُ **يرمي في القاعدة**
--     ولو غفلت الذاكرةُ عنه. والدفعةُ معاملةٌ ⟵ **كلٌّ أو لا شيء**، فلا نصفَ صرفٍ يبقى.
-- **وهذا هو معنى «دفاعٍ في العمق»**: حارسُ الذاكرة يعطي رسالةً مفهومةً في المسار السعيد،
-- وحارسُ القاعدة يمنع ما لا تراه الذاكرةُ أصلاً. **ولا يُغني أحدُهما عن الآخر.**
--
-- ### ومفاتيحُ التوجيه — خمسةُ جداولَ كلُّها من النمط (أ): تشغيليٌّ بالوحدة
--  · **السلفة**: وحدةُ خروج النقد (`unitPath` عند المنح) — **ولا تتحرّك**: الإقفالُ يكتب
--    `closed_at` وحدَه، فمفتاحُ توجيه صفٍّ ملحقٍ فقط **مستقرٌّ** (وصفة فخّ ٤).
--  · **القسط**: **يرث مسارَ سلفته** — لا موطنَ تنظيميَّ له سواه (نظيرُ حركة العُهد من أصلها)،
--    وسلفةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً.
--  · **الصرف**: وحدةُ الصرف (`paying_unit_path`) — **أمينُها هو الصارف** (ق-٦٥).
--  · **مَن صُرف له**: يرث مسارَ صرفه (نظيرُ القسط).
--  · **التوزيع**: وحدةُ الوجهة (`to_unit_path`) — نازلٌ حصراً (ق-٦٦، نظيرُ ق-٦١).
--  · **الحافز**: وحدةُ الممنوح فيها (ق-٧٧).
-- ولا عمودَ يكرّر `unit_path`: المسارُ الواحدُ عمودٌ واحد (عمودان لقيمةٍ واحدة مصدرا حقيقة).
--
-- ### وخمستُها **ملحقةٌ فقط** (المادة ٧/٤) — سؤالٌ لكلِّ جدولٍ لا حكمٌ للوحدة
-- كلُّ صفٍّ هنا **واقعةٌ مالية التُزمت ومعها قيدُها**: خروجُ نقدٍ، أو استردادُ قسطٍ، أو صرفٌ
-- وقع، أو دفعةُ منطقةٍ سُلِّمت، أو حافزٌ مُنح. واختفاءُ أيٍّ منها **يترك قيداً في الدفتر بلا
-- سجلِّه** — وهو نصفُ الثابت الحاكم. والانتقالاتُ الوحيدةُ **تحديثٌ على الصفّ نفسِه**:
-- إقفالُ السلفة `closed_at` (لا حذف — ق-٦٩ نصّاً: «الإقفالُ حالةٌ»).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── السلفة: **ذمّةٌ مدينة** أصلُها نقدٌ خرج بقيدٍ مرحَّل (ق-٦٩) ─────────────────────
-- ولا عمودَ «متبقٍّ»: المتبقي **اشتقاقٌ من أقساطها** (`outstandingOf`) لا حقلٌ يُنقَص.
CREATE TABLE IF NOT EXISTS payroll_advances (
  tenant_id         TEXT    NOT NULL,
  unit_path         TEXT    NOT NULL,
  id                TEXT    NOT NULL,
  person_id         TEXT    NOT NULL,
  entry_id          TEXT    NOT NULL,
  principal_cents   INTEGER NOT NULL,
  instalment_cents  INTEGER NOT NULL,
  granted_at        INTEGER NOT NULL,
  closed_at         INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_advances_routing ON payroll_advances (tenant_id, unit_path);

-- ── القسط: **الخصمُ الوحيدُ في النظام** (ب-٣١/ق-٣٤) — تسويةٌ مشتقّةٌ من عقد السلفة ────
CREATE TABLE IF NOT EXISTS payroll_instalments (
  tenant_id    TEXT    NOT NULL,
  unit_path    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  advance_id   TEXT    NOT NULL,
  period_id    TEXT    NOT NULL,
  entry_id     TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_instalments_routing ON payroll_instalments (tenant_id, unit_path);

-- ── الصرف: **توثيقُ الواقعة ومرجعُها بلا مبلغ** (ق-٦٥/ق-٧١) ──────────────────────
-- المبلغُ في القيد (`entry_id`) وفي السطر المختوم، **فلا نسخةَ ثالثة تنحرف** (ق-٦٠ روحاً).
CREATE TABLE IF NOT EXISTS payroll_payouts (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  entry_id   TEXT    NOT NULL,
  period_id  TEXT    NOT NULL,
  paid_by    TEXT    NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_payouts_routing ON payroll_payouts (tenant_id, unit_path);

-- ── مَن صُرف له: **حاملُ ثابتِ «لا صرفَ مرتين» في القاعدة** (ق-٦٥) ───────────────────
-- وهو صفٌّ لكلِّ شخصٍ في كلِّ صرف — لا قائمةٌ مسلسلةٌ في عمودٍ نصّيّ: القائمةُ في عمودٍ
-- **لا يُفهرَس ولا يُقيَّد**، فيصير الثابتُ الماليُّ الأخطرُ رهينَ ترشيحٍ في الذاكرة.
CREATE TABLE IF NOT EXISTS payroll_payout_persons (
  tenant_id  TEXT NOT NULL,
  unit_path  TEXT NOT NULL,
  payout_id  TEXT NOT NULL,
  person_id  TEXT NOT NULL,
  period_id  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, payout_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_payout_persons_routing ON payroll_payout_persons (tenant_id, unit_path);
-- **والفهرسُ الفريدُ هو الحارس** — القارئُ الحيُّ له **محرّكُ القاعدة نفسُه** لا استعلامٌ:
-- ق-٦٥ «لا يُدفع استحقاقٌ مرتين» يصير **مستحيلاً بالبناء** لا مرصوداً بالانضباط. وهذا هو
-- الفهرسُ الزائدُ الوحيدُ في هذه الهجرة، و«كلُّ فهرسٍ زائدٍ قرارٌ سعويّ» (ADR-001 §١-٢) —
-- وثمنُه هنا مدفوعٌ عن **ثابتٍ ماليٍّ لا عن سرعةِ شاشة**.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_paid_once ON payroll_payout_persons (tenant_id, period_id, person_id);

-- ── توزيعُ المناطق: **(فترة × منطقة) لا يتكرر** (ق-٦٦) ────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_distributions (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  period_id TEXT    NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_distributions_routing ON payroll_distributions (tenant_id, unit_path);
-- **ونصُّ ق-٦٦ «لا تتكرر» يصير قيداً في القاعدة** كنظيره في الصرف: حارسُ الذاكرة
-- (`hasDistribution`) يعمي عمّا لم يُحمَّل، وهذا لا يعمى.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_region_once ON payroll_distributions (tenant_id, period_id, unit_path);

-- ── الحافز: **خارج أجر المعلّم بالبناء** (ق-٧٧) — كيانٌ آخرُ وقيدٌ آخر ────────────
CREATE TABLE IF NOT EXISTS payroll_incentives (
  tenant_id  TEXT    NOT NULL,
  unit_path  TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  person_id  TEXT    NOT NULL,
  entry_id   TEXT    NOT NULL,
  granted_by TEXT    NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_incentives_routing ON payroll_incentives (tenant_id, unit_path);
