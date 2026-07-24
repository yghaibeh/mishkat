/**
 * جداولُ **سجل اليوم والكتالوج** (`features/dailyLog`) — الهجرة `0004` (رابعُ المنقولات في T26-ب).
 *
 * > **مفتاحان مختلفان في التوجيه، وكلاهما مُصرَّحٌ به** (يفارقان نمطَ العُهد):
 * >  · **الكتالوج** (`daily_schemes`/`daily_activities`) نطاقُه الشبكةُ فيُوجَّه إلى **الجذر**،
 * >    ونطاقُ سريانه `scope_path`/الاشتقاقُ **عمودُ بيانات** — لأنّ المخطّطَ سلفٌ للوحدة لا
 * >    خلَفٌ لها، فجلسةُ المسجد لا تحمّل أسلافَها (ق-٤٢ · نظيرُ `org_accounts` — README الحسم ٢).
 * >  · **القيدُ والعددُ** (`daily_entries`/`daily_rosters`) نطاقُهما **وحدةٌ** فيُوجَّهان بمسارها.
 * >
 * > و**ثلاثةٌ ملحقةٌ فقط**: `daily_entries` (النقطةُ مالٌ ق-٣٣، تُحدَّث في مكانها ولا تُحذف
 * > ق-٤٥) · `daily_activities` (النسخُ مؤرَّخةٌ ق-٣٦) · `daily_schemes` (الإيقافُ حالةٌ لا حذف).
 * > ويحرس ذلك `tests/migrations/dailyLog.test.ts` **على المخطط المطبَّق** لا على النيّة.
 */

import { int, routing, text, TENANT_COLUMN, ROUTING_COLUMN, type TableSpec } from "./columns.js"

export const DAILY_LOG_TABLES: readonly TableSpec[] = [
  // ── T26-ب: سجلُّ اليوم والكتالوج (الهجرة `0004`) ─────────────────────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق — نظيرُ `ledger_units`/`custody_units`: نسخةُ قراءة. */
    name: "daily_units",
    columns: [...routing(), text("id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **مخطّطُ الأنشطة** (ق-٤٢) — كيانُ بياناتٍ بشاشة. `scope_path` نطاقُ سريانه (بيانٌ)،
     * و`unit_path` هو الجذرُ (توجيهٌ شبكيّ). ملحقٌ فقط: الإيقافُ حالةٌ في `active` لا حذف.
     */
    name: "daily_schemes",
    columns: [...routing(), text("id"), text("ar"), text("scope_path"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **نسخةُ نشاطٍ في الكتالوج** (ق-٣٦: بأثرٍ قادمٍ فقط) — شبكيةٌ فتُوجَّه إلى الجذر.
     * ملحقٌ فقط: نسخةٌ جديدةٌ تُضاف ولا تُكتب فوق القديم، فيبقى الماضي كما حُسم يوم إدخاله.
     */
    name: "daily_activities",
    columns: [
      ...routing(),
      text("id"),
      text("scheme_id"),
      text("activity_id"),
      text("ar"),
      int("weight"),
      int("max_per_day", true),
      int("requires_participation"),
      int("active"),
      int("valid_from"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **عددُ طلاب الأسرة** (ب-٣٢) — قيمةٌ راهنةٌ لكل وحدة تُكتب فوقها، فمفتاحُها الطبيعيّ
     * `(tenant_id, unit_path)`: النطاقُ هو الهويّة. و`null` في العدد حالةٌ ذاتُ أثرٍ (fail-closed)
     * لا فراغٌ صامت. ليس ملحقاً: الضبطُ الجديد يكتب فوق القديم.
     */
    name: "daily_rosters",
    columns: [...routing(), int("student_count", true), text("set_by"), int("set_at")],
    primaryKey: [TENANT_COLUMN, ROUTING_COLUMN],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **القيدُ اليوميّ** (ق-٤٥) — أضخمُ الجداول والنقطةُ فيه مالٌ (ق-٣٣). ملحقٌ فقط: يُحدَّث
     * في مكانه upsert ولا يُحذف (اختفاؤه ضياعُ مال). والنقاطُ **مخزَّنةٌ** (ق-٤١) لا تُشتقّ
     * عند الجمع، والقوائمُ (`student_ids`/`credited_student_ids`) نصُّ JSON (ع-٣).
     */
    name: "daily_entries",
    columns: [
      ...routing(),
      text("id"),
      text("client_uuid"),
      text("activity_id", true),
      text("free_text_ar", true),
      text("day_key"),
      text("period_key"),
      int("count"),
      int("credited_count"),
      int("points"),
      text("student_ids"),
      text("credited_student_ids"),
      text("block"),
      text("by_person_id"),
      int("at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
