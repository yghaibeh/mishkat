/**
 * جداولُ **المكتبة التدريبية** (`features/library`) — الهجرة `0007` من موجة T26-ب-٢.
 *
 * > **والفخُّ المتوقَّع كان «عدّاداً مخزَّناً» لا G23**: «الخَتَماتُ الثلاث» (استُلم/فُتح/أُنجز)
 * > أعدادٌ تُغري بحقلٍ يحفظها. **ولا حقلَ كذلك هنا** (README §٤): الحالةُ اشتقاقٌ من الخَتمات
 * > عند القراءة (`stateOf`)، والعددُ استعلامٌ على المصدر — فلا شيء يتباعد ولا مطابقةَ تُبنى.
 * > **صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس** — كحال العُهد حرفاً بحرف (custodyRepository الفرق ٣).
 *
 * ### مفاتيحُ التوجيه — لكلِّ جدولٍ سطرُه (ع-٥ · README الحسم ٢)
 *  · **المادةُ وخطُّ زمنها** بياناتُ عملٍ لها موطنٌ تنظيميّ ⟵ `unit_path` مسارُ الوحدة.
 *    وخطُّ الزمن **يرث موطنَ مادته** (نظيرُ حركةِ العُهد من أصلها) — لا يُخترع ولا يُوجَّه
 *    إلى الجذر صامتاً.
 *  · **الوحداتُ** إسقاطٌ لاشتقاق النطاق (نظيرُ `ledger_units`) ⟵ `unit_path` مسارُها نفسُه.
 *  · **الفئةُ والجمهورُ والصيغةُ** بياناتٌ مرجعيةٌ **نطاقُها الشبكةُ كلُّها** (قب-٢٢/ق-٨٩) ⟵
 *    `unit_path = '/'` **صادقٌ لا حشو**: معجمٌ واحدٌ للشبكة لا يخصّ شظيةَ وحدة.
 *
 * ### أيُّها ملحقٌ فقط (`appendOnly`) — سؤالٌ لكلِّ جدولٍ لا حكمٌ للوحدة (README §٤-٣)
 *  · **المادة**: بياناتُ عملٍ حسّاسة — الأرشفةُ **وسمٌ لا محو** (المادة ٧/٤)، فاختفاءُ صفٍّ
 *    يُرمى ولا يُترجم `DELETE`.  ⟵ **ملحقٌ فقط**.
 *  · **خطُّ الزمن**: سجلُّ إنجازِ مكلَّفٍ (ق-٩٦) لا يُمحى؛ وانتقالُ الحالة **تحديثٌ على الصفّ
 *    نفسِه** (مفتاحُه `(مادة، شخص)`) لا حذفٌ وإدراج — كبصمةِ إقرار العُهد.  ⟵ **ملحقٌ فقط**.
 *  · **الوحداتُ والمعاجمُ الثلاثة**: نسخُ قراءةٍ/بياناتٌ مرجعية يجوز أن يزول صفُّها (نظيرُ
 *    `ledger_units`/`ledger_accounts`/`funds`).  ⟵ **ليست ملحقاً**.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const LIBRARY_TABLES: readonly TableSpec[] = [
  // ── T26-ب-٢: المكتبة التدريبية (الهجرة `0007`) ────────────────────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق واسمِها — نسخةُ قراءةٍ لا مصدرُ حقيقة (نظيرُ `ledger_units`). */
    name: "library_units",
    columns: [...routing(), text("id"), text("ar")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** فئةُ المادة (ق-٨٩/ق-١١٧) — بياناتٌ مرجعيةٌ نطاقُها الشبكةُ كلُّها، بلا مفتاح تفعيل (قب-٤٠). */
    name: "library_categories",
    columns: [...routing(), text("id"), text("ar")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** جمهورُ المادة (ق-٩٦) — **قدرةٌ لا اسمُ دور** (§٢/G6): الانتماءُ سؤالٌ للمحرّك لا قائمةٌ مُصلَّبة. */
    name: "library_audiences",
    columns: [...routing(), text("id"), text("ar"), text("capability_id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** صيغةُ رفعٍ مقبولة (المادة ٨/٤) — بياناتٌ مرجعية؛ و**الإيقافُ بيانٌ (`active`) لا حذف**. */
    name: "library_formats",
    columns: [...routing(), text("id"), text("content_type"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **المادة** — كيانٌ ذو موطنٍ تنظيميّ (§٣، موتُ ح-٦): `unit_path` منه يُشتقّ نطاقُ كلِّ فعل.
     * **ملحقٌ فقط**: الأرشفةُ وسمٌ لا محو (`archived_at`/`archived_by`)، ونقلُها إلى وحدةٍ أخرى
     * **إنشاءٌ جديد** لا تعديلٌ صامت (services/materials) ⟵ **`unit_path` مستقرٌّ لا يُعاد كتابتُه**.
     * ومفتاحُ التخزين `storage_key` **من المستودع لا من المدخل** (المادة ٨/٤)، فارغٌ للروابط.
     */
    name: "library_materials",
    columns: [
      ...routing(),
      text("id"),
      text("title_ar"),
      text("category_id"),
      text("audience_id"),
      text("kind"),
      text("unit_id"),
      int("mandatory"),
      text("storage_key", true),
      text("content_type", true),
      int("size_bytes", true),
      text("external_url", true),
      text("created_by"),
      int("created_at"),
      int("archived_at", true),
      text("archived_by", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **خطُّ زمنِ الشخص على المادة** (ق-٩٦) — سجلٌّ واحدٌ لكلِّ `(مادة، شخص)` كـ`UNIQUE` في v1،
     * فمفتاحُه الطبيعيُّ `(الشبكة، المادة، الشخص)`. **ملحقٌ فقط**: لا يُنشأ إلا بالاستلام،
     * وما بعده خَتماتٌ صريحةٌ **تُحدَّث على الصفّ نفسِه** (`opened_at`/`completed_at`) — لا حالةَ
     * تُنمذَج حذفاً وإدراجاً. ونطاقُه **يرث موطنَ مادته** فلا يُخترع (libraryRepository).
     */
    name: "library_progress",
    columns: [
      ...routing(),
      text("material_id"),
      text("person_id"),
      int("delivered_at"),
      int("opened_at", true),
      int("completed_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "material_id", "person_id"],
    appendOnly: true,
    infrastructure: false,
  },
]
