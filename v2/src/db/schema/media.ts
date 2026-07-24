/**
 * جداولُ **الإعلام والتغطيات** (`features/media`) — وحدةُ الموجة الأولى (الهجرة `0006`).
 *
 * > **والثابتُ المفروضُ في المخطط**: «سحبُ المنشور» **حالةٌ لا حذف** (ق-١٠٥/المادة ٧/٤).
 * > التغطيةُ والصورةُ **ملحقان فقط**: اختفاءُ صفٍّ يُرمى ولا يُترجَم `DELETE`، والحذفُ
 * > تحديثٌ على الصفّ نفسِه (`deletedAt`/`deletedBy`). ويحرس ذلك `tests/migrations/media.test.ts`
 * > و`tests/db/media.test.ts` **على المخطط المطبَّق** لا على النيّة.
 *
 * > **ومفتاحُ التوجيه**: التغطيةُ توجيهُها **مسارُ وحدتها** (لا جذرُ الشبكة — المرآةُ الشبكية
 * > خارجُ النطاق، ز-٤/ق-١٠٧)، والصورةُ ترثه من تغطيتها، والمعجمان (`media_kinds`/`media_formats`)
 * > بجذر الشبكة `/` بوصفهما بياناتٍ مرجعيةً نطاقُها الشبكةُ كلُّها (README الحسم ٢).
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const MEDIA_TABLES: readonly TableSpec[] = [
  // ── الموجةُ الأولى: الإعلام والتغطيات (الهجرة `0006`) ─────────────────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق والاسم — نظيرُ `custody_units`: نسخةُ قراءةٍ لا مصدرُ حقيقة. */
    name: "media_units",
    columns: [...routing(), text("id"), text("ar")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **معجمُ أنواع التغطية** (ق-١٠٣ «نوعٌ من معجم») — بياناتٌ مرجعيةٌ بجذر الشبكة.
     * **ملحقٌ فقط**: الإيقافُ بيانٌ (`active`) لا حذف (المادة ٧/٤) — فلا يختفي نوعٌ مرجعيّ.
     */
    name: "media_kinds",
    columns: [...routing(), text("id"), text("ar"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **قاموسُ صيغ الرفع** (المادة ٨/٤) — بياناتٌ مرجعيةٌ بجذر الشبكة كذلك.
     * **ملحقٌ فقط**: المُعطَّلُ يبقى صفّاً (`active = 0`) ليُفرَّق «أُوقف» عن «لم يُسجَّل» (§٧).
     */
    name: "media_formats",
    columns: [...routing(), text("id"), text("content_type"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **التغطيةُ سجلُّ حدث** (ق-١٠٣) — أربعةُ أجوبةٍ شرطُ وجوده. **ملحقٌ فقط** (ق-١٠٥):
     * «سحبُ المنشور» تحديثٌ على الصفّ نفسِه (`deleted_at`/`deleted_by`) لا حذفٌ وإدراج،
     * فنمذجتُه حذفاً تُسقط «مَن حذف ومتى». و`occurred_on` **تاريخُ الوقوع** ≠ `created_at`.
     */
    name: "media_coverages",
    columns: [
      ...routing(),
      text("id"),
      text("title_ar"),
      text("kind_id"),
      text("unit_id"),
      int("occurred_on"),
      text("publisher_person_id"),
      int("created_at"),
      int("deleted_at", true),
      text("deleted_by", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **ألبومُ التغطية** (ق-١٠٣) — لا صورةَ بلا تغطيتها؛ توجيهُها **مسارُ تغطيتها مشتقٌّ لا
     * مُخترع** (نظيرُ حركةِ العُهد من أصلها). **ملحقٌ فقط**: الصورةُ لا تُمحى — حذفُ التغطية
     * يُخفي الألبومَ بالحالة لا بزوال صفوفه (`المادة ٧/٤`).
     */
    name: "media_photos",
    columns: [
      ...routing(),
      text("id"),
      text("coverage_id"),
      text("storage_key"),
      text("content_type"),
      int("size_bytes"),
      text("uploaded_by"),
      int("uploaded_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
