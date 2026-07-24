/**
 * جداولُ **منهاج «على بصيرة»** (`features/education`) — الهجرة `0012` من موجة T31.
 *
 * > **والغيابُ هو الدليل** (CR-016): **لا جدولَ للدرس هنا** — «الدرس/الجلسة اليومية» كيانٌ
 * > موطنُه `circleLog`، وهذه الوحدةُ **طبقةُ قواعدَ فوقه**. ولو وُجد جدولٌ هنا لعاد انشطارُ v1.
 * > **ولا عمودَ يحفظ تقدّماً** (ق-٩٢): المصفوفةُ تُبنى لحظةَ السؤال، والتصحيحُ **بصمةٌ فوقها**.
 * > **ولا مفتاحَ تفعيلٍ** في الصفوف الأربعة (قب-٢٢/ع-٨) — يُضاف منهاجٌ صفوفاً فيعمل بلا سطر.
 *
 * ### مفاتيحُ التوجيه (ع-٥ · README الحسم ٢)
 *  · **الصفوفُ الأربعة** بياناتٌ مرجعيةٌ شبكية ⟵ `unit_path = '/'` **صادقٌ لا حشو**: منهاجُ
 *    نوعِ حلقةٍ **معجمٌ واحدٌ للشبكة** لا يخصّ شظيةَ وحدة (كحال كتالوج الأنواع في `circles`).
 *  · **بصمةُ التصحيح** تشغيليةٌ ⟵ **تُشتقّ من حلقتها** (لا نسخةَ حقلٍ في الكيان — ب-٢٨).
 *
 * ### `appendOnly` — سؤالٌ لكلِّ جدول (README §٤-٣)
 *  · **بصمةُ التصحيح**: سجلٌّ يُلحق ولا يُمحى (قب-٩)، و«الأحدثُ يغلب» **اشتقاقٌ عند القراءة**
 *    لا استبدالٌ للصفّ.  ⟵ **ملحقٌ فقط**.
 *  · **الصفوفُ المرجعية**: يجوز أن يزول صفُّها.  ⟵ **ليست ملحقاً**.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const EDUCATION_TABLES: readonly TableSpec[] = [
  // ── T31: منهاجُ «على بصيرة» (الهجرة `0012`) ───────────────────────────────
  {
    /** **المنهاج** مربوطٌ **بنوع الحلقة** لا باسمٍ مُصلَّبٍ في الكود (ب-٢٨). */
    name: "education_curricula",
    columns: [...routing(), text("id"), text("ar"), text("circle_type_id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** المستوى — ترتيبُه `ordinal` بيانٌ يُضبط لا ترتيبُ إدخالٍ يتقلّب. */
    name: "education_levels",
    columns: [...routing(), text("id"), text("curriculum_id"), text("ar"), int("ordinal")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** الكتاب — ابنُ المستوى. */
    name: "education_books",
    columns: [...routing(), text("id"), text("level_id"), text("ar"), int("ordinal")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** **المجلس** — ابنُ الكتاب و**وحدةُ التقدّم** التي يقيس عليها ق-٩٢. */
    name: "education_sessions",
    columns: [...routing(), text("id"), text("book_id"), text("ar"), int("ordinal")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **بصمةُ التصحيح اليدويّ** (ق-٩٢ ذيلاً · قب-٩) — **ملحقةٌ فقط**: مَن/ماذا/متى/**لماذا**
     * ظاهرةٌ في سجلٍّ يُلحق ولا يُمحى، وحذفُ البصمات يُعيد الاشتقاقَ الخام كما هو.
     */
    name: "education_progress_corrections",
    columns: [
      ...routing(),
      text("id"),
      text("circle_id"),
      text("enrollment_id"),
      text("session_id"),
      int("completed"),
      int("at"),
      text("by_person_id"),
      text("reason_ar"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
