/**
 * جداولُ **الزيارات الإشرافية** (`features/supervision`) — الموجةُ الأولى (الهجرة `0009`).
 *
 * > **مفتاحُ توجيه الزيارة مسارُ هدفها لا مسارُ زائرها**: `unit_path` هو مسارُ **الهدف**
 * > المَزور (القراءةُ كلُّها بالاحتواء عليه)، و`supervisor_path` مرساةُ الزائر (ق-١٦) —
 * > **عمودُ بياناتٍ** لا مفتاحُ توجيه. وثباتُه مضمونٌ بالبناء: الزيارةُ ملحقٌ فقط ولا حالةَ
 * > تنتقل عليها، فمسارُ الهدف يُجمَّد لحظةَ الكتابة ولا يُعاد (فخّ ٤ · الوصفة).
 *
 * > والوحدةُ والهدفُ **إسقاطان قرائيّان** (نظيرُ `custody_units`): موطنُ الوحدة `org`،
 * > وكيانُ الهدف الحلقةُ (ب-٢٨)؛ فكلاهما `appendOnly: false` والإيقافُ حالةٌ (`active`) لا حذف.
 * > ويحرس التطابقَ مع المخطط المطبَّق `tests/migrations/supervision.test.ts` عبر `PRAGMA`.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const SUPERVISION_TABLES: readonly TableSpec[] = [
  // ── T26-ب-٢: الزيارات الإشرافية (الموجةُ الأولى — الهجرة `0009`) ──────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق — نظيرُ `ledger_units`: نسخةُ قراءةٍ لا مصدرُ حقيقة. */
    name: "supervision_units",
    columns: [...routing(), text("id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **هدفُ الزيارة** — إسقاطٌ قرائيٌّ للحلقة (ب-٢٨): مسارٌ ونوعُ منهاجٍ وحالةُ تفعيل.
     * `appendOnly: false` — نسخةُ قراءةٍ يجوز أن يزول صفُّها؛ و**الإيقافُ حالةٌ (`active`
     * ٠/١) لا حذف** (المادة ٧/٤): إيقافُ هدفٍ **تحديثٌ على الصفّ نفسِه** لا محوٌ.
     */
    name: "supervision_targets",
    columns: [...routing(), text("id"), text("curriculum"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **الزيارة** — سجلٌّ ميدانيٌّ **ملحقٌ فقط** (ق-٩٩: شهادةُ حضورٍ لا تُمحى). ولا حالةَ
     * تنتقل عليها بعد الكتابة (لا إقرارَ ولا ختم) ⟵ مفتاحُ توجيهها (مسارُ الهدف) **مستقرٌّ
     * بالبناء**. `details` نصُّ JSON بحقول النوع (ق-١٠٠ · ع-٣: التسلسلُ في الكود لا JSONB).
     */
    name: "supervision_visits",
    columns: [
      ...routing(),
      text("id"),
      text("target_id"),
      text("supervisor_path"),
      text("curriculum"),
      text("day_key"),
      int("visited_at"),
      int("attendees"),
      int("rating_pct"),
      text("note_ar"),
      text("details"),
      text("by_person_id"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
