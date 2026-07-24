/**
 * جداولُ **اللجان والاجتماعات** (`features/committees`) — الهجرة `0008` (موجةُ T26-ب-٢).
 *
 * خمسةُ جداول، وكلُّها `PRIMARY KEY (tenant_id, id)`. والمفاجأةُ — كما توقّعتها الوصفةُ نصّاً
 * («وإن فاجأتك فالمفاجأةُ في مفتاح التوجيه لا في الذرّية») — **في مفتاح التوجيه**:
 *
 *  · **اللجنة تُوجَّه بمسارها هي** (`committee.path`) لا بمسار مسجدها. فاللجنةُ **عقدةٌ حقيقية
 *    في شجرة النطاق**: مسارُها يُبنى تحت المسجد (ت-٢) فتمشي عليه سلسلةُ ق-١٣ صاعدةً، فأميرُ
 *    المسجد أقربُ سلَفٍ فوقها. وكلُّ قراءات نطاقها (`committeesWithin` · `mosqueRecordContribution`)
 *    تُرشّح بـ`contains(scope, committee.path)` — فمفتاحُ التوجيه لا بدّ أن يكون مسارَها هي
 *    ليطابق `LIKE` الاحتواءَ حرفاً بحرف تحت **أيّ** نطاق (README الحسم ٢).
 *  · **العضوُ والنشاطُ لا موطنَ تنظيميّ لهما**: موطنُهما موطنُ **لجنتهما** ⟵ مفتاحُهما يُشتقّ
 *    من مسار اللجنة في المستودع (نظيرُ حركة العُهد من أصلها)، ولجنةٌ مجهولةٌ **تُرمى** ولا
 *    تُوجَّه إلى الجذر صامتاً.
 *  · **الاجتماعُ حدثٌ في المسجد** لا عقدةٌ تحته: يُوجَّه بمسار مسجده (`mosquePath`)، وقراءتُه
 *    `contains(scope, meeting.mosquePath)`.
 *
 * > **ولا محوَ في أيّ جدولٍ من جداول العمل الأربعة** (المادة ٧/٤ · عقدُ الوحدة §١): إيقافُ
 * > اللجنة **حالةٌ** (عمودُ `active`) لا حذف، والأعضاءُ والأنشطةُ والمحاضرُ لا تُمحى — فهي
 * > **ملحقةٌ فقط**، واختفاءُ صفٍّ منها عطبٌ يُرمى ولا يُترجم `DELETE`. و`committee_units`
 * > وحدَه **نسخةُ قراءةٍ** لاشتقاق النطاق (نظيرُ `ledger_units`) فليس ملحقاً.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const COMMITTEES_TABLES: readonly TableSpec[] = [
  // ── T26-ب-٢: اللجان والاجتماعات (الهجرة `0008`) ──────────────────────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق — نظيرُ `ledger_units`: نسخةُ قراءةٍ لا مصدرُ حقيقة. */
    name: "committee_units",
    columns: [...routing(), text("id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **اللجنة** (ك-٢٣) — كيانٌ تحت المسجد ومفتاحُ توجيهه **مسارُه هو** (`unit_path` = مسارُ
     * اللجنة). و`mosque_path` عمودٌ صريحٌ **لا يُشتقّ عكسياً** من المسار (نظيرُ قاعدة عدم
     * الاشتقاق العكسيّ، README الحسم ٢). **ملحقٌ فقط**: الإيقافُ حالةٌ (`active`) لا حذف.
     */
    name: "committees",
    columns: [
      ...routing(),
      text("id"),
      text("mosque_unit_id"),
      text("mosque_path"),
      text("label_ar"),
      text("head_person_id", true),
      text("head_name_ar"),
      int("active"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **عضوُ اللجنة** (ق-٣١) — اسمٌ حرٌّ **بلا معرّفِ شخص**: لا عمودَ `person_id` هنا، فلا
     * يُربط بحساب. مفتاحُ توجيهه **مشتقٌّ من لجنته** لا مُخترع. **ملحقٌ فقط** (لا محو).
     */
    name: "committee_members",
    columns: [...routing(), text("id"), text("committee_id"), text("name_ar")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **نشاطُ اللجنة** (ب-٤٣) — عددٌ وأسماءٌ حرّةٌ (JSON نصّ) وتاريخُ إنجاز. مفتاحُ توجيهه
     * **مشتقٌّ من لجنته**. **ملحقٌ فقط**. والمساهمةُ في سجل المسجد **اشتقاقٌ** لا عمودٌ هنا.
     */
    name: "committee_activities",
    columns: [
      ...routing(),
      text("id"),
      text("committee_id"),
      text("period_id"),
      text("title_ar"),
      int("participant_count"),
      text("participant_names_ar"),
      int("completed_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **الاجتماع/المحضر** (ك-٢٤، ب-١٨) — محضرٌ وقراراتٌ (JSON نصّ) لا غير (ب-٢ مدفون: لا
     * نصابَ ولا صوتَ ولا حضور). مفتاحُ توجيهه **مسارُ مسجده**. **ملحقٌ فقط** (لا محو).
     */
    name: "committee_meetings",
    columns: [
      ...routing(),
      text("id"),
      text("mosque_unit_id"),
      int("held_at"),
      text("minutes_ar"),
      text("decisions_ar"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
