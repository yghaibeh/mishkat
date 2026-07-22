/**
 * جداولُ **العُهد والأصول** (`features/custody`) — أوّلُ المنقولات في T26-ب (الهجرة `0003`).
 *
 * > **ولا عمودَ حائزٍ ولا عمودَ حالةٍ هنا** (ق-٧٨/ق-٨٠): كلاهما **اشتقاقٌ** من `custody_moves`
 * > عند القراءة، فلا يوجد ما يُحرَّر ولا بابَ ثانياً يوجد. ويحرس ذلك
 * > `tests/migrations/custody.test.ts` **على المخطط المطبَّق** لا على النيّة.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const CUSTODY_TABLES: readonly TableSpec[] = [
  // ── T26-ب: العُهد والأصول (أولى الوحدات الثلاث عشرة — الهجرة `0003`) ─────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق — نظيرُ `ledger_units`: نسخةُ قراءةٍ لا مصدرُ حقيقة. */
    name: "custody_units",
    columns: [...routing(), text("id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **الأصل** — سجلٌّ وصفيٌّ بلا حائزٍ وبلا حالة (ق-٧٨/ق-٨٠: كلاهما اشتقاق).
     * **ملحقٌ فقط**: «حالاتٌ صريحةٌ لا حذفٌ صامت» — الإخراجُ من الخدمة **حالةٌ** لا محو،
     * فاختفاءُ صفٍّ من الإسقاط عطبٌ برمجيٌّ يُرمى ولا يُترجم `DELETE` (المادة ٧/٤).
     */
    name: "custody_assets",
    columns: [
      ...routing(),
      text("id"),
      text("label_ar"),
      text("serial_ar", true),
      text("note_ar", true),
      text("registered_by"),
      int("registered_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **سلسلةُ الحيازة** (ق-٧٨) — لا تُمحى ولا يُعاد ترتيبُها. والحقلان الوحيدان اللذان
     * يُكتبان بعد الإلحاق بصمةُ الإقرار (ق-٧٩)، فانتقالُ الحالة **تحديثٌ على الصفّ نفسِه**
     * — ونمذجتُه حذفاً وإدراجاً تُسقط ق-٧٨ وق-٨٠ معاً.
     */
    name: "custody_moves",
    columns: [
      ...routing(),
      text("id"),
      text("asset_id"),
      int("seq"),
      text("kind"),
      text("from_person_id", true),
      text("to_person_id", true),
      text("condition_ar"),
      text("note_ar", true),
      int("at"),
      text("by_person_id"),
      text("acknowledged_by", true),
      int("acknowledged_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
