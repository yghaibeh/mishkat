/**
 * جداولُ **السجلّ اليوميّ للحلقة** (`features/circleLog`) — الهجرة `0011` من موجة T31.
 *
 * > **والمفتاحُ الطبيعيُّ يتجمّد هنا** — ولذلك نُفِّذ **CR-020 قبل هذه الهجرة**: الجلسةُ
 * > مفتاحُها **(حلقة × يوم × فترة)** بقرار المالك (قب-٤٥)، والفترةُ **صفوفٌ مرجعية** لا أسماءٌ
 * > في الكود. **والكيانُ واحدٌ اتّسع مفتاحُه ولم ينشطر** (CR-016): `shape_kind` مميِّزٌ على
 * > الجلسة، لا جدولٌ لجلسة تحفيظٍ وآخرُ لجلسة منهاج.
 *
 * ### مفاتيحُ التوجيه — لكلِّ جدولٍ سطرُه (ع-٥ · README الحسم ٢)
 *  · **الجلسةُ وأسطرُها وصورُها والملاحظةُ والرابط** بياناتُ عملٍ موطنُها **وحدةُ حلقتها**
 *    ⟵ `unit_path` **يُشتقّ من المنفذ المعلن** (`CircleModelPort`) عند الإسقاط، **ولا يُنسخ
 *    إلى الكيان**: ب-٢٨ يمنع نسخَ حقلٍ من كيان الحلقة، ويحرسه `single-source.test.ts` نصّاً.
 *  · **السورُ والمصاحفُ والفترات** بياناتٌ مرجعيةٌ **نطاقُها الشبكةُ كلُّها** (ق-٨٩/قب-٢٢) ⟵
 *    `unit_path = '/'` **صادقٌ لا حشو**.
 *
 * ### أيُّها ملحقٌ فقط (`appendOnly`) — سؤالٌ لكلِّ جدولٍ لا حكمٌ للوحدة (README §٤-٣)
 *  · **الجلسةُ والملاحظةُ والرابط**: لا تُمحى — الملاحظةُ سجلٌّ يُلحق (ق-٨٧)، وإلغاءُ الرابط
 *    **وسمٌ** (ق-٩٣).  ⟵ **ملحقةٌ فقط**.
 *  · **أسطرُ الجلسة وصورُها**: **ليست ملحقةً وهذا جوابُ سؤالٍ لا سهو** — ق-٩٠ ينصّ أنّ إعادةَ
 *    الإرسال **تستبدل أسطرَ اليوم**، فسطرُ طالبٍ حُذف من الكشف **حذفٌ مشروعٌ معلَن**؛ وعلمٌ
 *    زائدٌ هنا كان **يُرمى في وجهنا عند أوّل إعادةِ إرسالٍ صحيحة**.
 *  · **الكتالوجاتُ الثلاثة**: بياناتٌ مرجعية يجوز أن يزول صفُّها.  ⟵ **ليست ملحقاً**.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const CIRCLE_LOG_TABLES: readonly TableSpec[] = [
  // ── T31: السجلُّ اليوميُّ للحلقة (الهجرة `0011`) ───────────────────────────
  {
    /** كتالوجُ السور (ق-٨٩) — و`ayah_count` **بيانٌ** لا رقمٌ صلبٌ في الكود (G14). */
    name: "circlelog_surahs",
    columns: [...routing(), text("id"), text("ar"), int("ayah_count")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** كتالوجُ المصاحف — وحدُّ الصفحات بيانٌ يُبذَر لا ثابتٌ يُنشَر. */
    name: "circlelog_mushafs",
    columns: [...routing(), text("id"), text("ar"), int("page_count")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **فتراتُ اليوم** (CR-020 · قرارُ المالك قب-٤٥) — قائمةٌ محصورةٌ من صفوف؛ وشبكةٌ لم تُعلن
     * صفّاً **يومُها غيرُ مقسَّم**. و`ordinal` **ترتيبُ عرضٍ لا دلالةُ عمل**.
     */
    name: "circlelog_periods",
    columns: [...routing(), text("id"), text("ar"), int("ordinal")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **الجلسةُ اليومية** — مفتاحُها الطبيعيُّ `(الشبكة، الحلقة، اليوم، الفترة)`، فإعادةُ
     * الإرسال **تتقارب ولا تزدوج** (ع-٤) بالبنية. و`id` عمودٌ مستقرٌّ تشير إليه أسطرُها.
     * **ملحقةٌ فقط**: لا مسارَ يمحو جلسةً — والاستبدالُ يقع على أسطرها لا عليها.
     */
    name: "circlelog_sessions",
    columns: [
      ...routing(),
      text("circle_id"),
      text("day_key"),
      text("period_id"),
      text("id"),
      text("shape_kind"),
      text("curriculum_session_id", true),
      int("duration_minutes", true),
      text("venue_ar", true),
      int("held_at"),
      text("recorded_by_person_id"),
      int("recorded_at"),
    ],
    primaryKey: [TENANT_COLUMN, "circle_id", "day_key", "period_id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **سطرُ الطالب** — `enrollment_id` **مرجعٌ** إلى سجلّ العضوية الواحد، **ولا اسمَ هنا**.
     * ونطاقُ الحفظ/المراجعة **شكلٌ واحدٌ بمميِّز**: `mode` ثم `ref` ثم `from`/`to`.
     * **وليس ملحقاً**: ق-٩٠ يجعل إعادةَ الإرسال **استبدالاً لأسطر اليوم** (انظر رأسَ الملف).
     */
    name: "circlelog_session_rows",
    columns: [
      ...routing(),
      text("session_id"),
      text("enrollment_id"),
      text("attendance"),
      text("memo_mode", true),
      text("memo_ref", true),
      int("memo_from", true),
      int("memo_to", true),
      int("memo_grade", true),
      text("review_mode", true),
      text("review_ref", true),
      int("review_from", true),
      int("review_to", true),
      int("review_grade", true),
      int("tajweed_grade", true),
      text("enrichment_type_id", true),
      int("enrichment_grade", true),
    ],
    primaryKey: [TENANT_COLUMN, "session_id", "enrollment_id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** صورُ المنهج المصاحب — **مراجعُ وسائط** مرتَّبةٌ بترتيب إرسالها؛ وتُستبدل مع اليوم. */
    name: "circlelog_session_photos",
    columns: [...routing(), text("session_id"), int("ordinal"), text("photo_key")],
    primaryKey: [TENANT_COLUMN, "session_id", "ordinal"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /** **ملاحظةُ الإشراف** (ق-٨٧) — سجلٌّ يُلحق ولا يُحرَّر: فالمعلّمُ لا يجد ما يحرّره أصلاً. */
    name: "circlelog_notes",
    columns: [
      ...routing(),
      text("id"),
      text("circle_id"),
      text("body_ar"),
      text("author_person_id"),
      int("written_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **رابطُ وليّ الأمر** (ق-٩٣) — **الإلغاءُ وسمٌ** لا محو، والموتُ بالأرشفة **بنيويٌّ**
     * يُسأل عنه نموذجُ الحلقة لحظةَ الحلّ ⟵ **لا عمودَ حالةٍ يُنسى تحديثُه**.
     */
    name: "circlelog_links",
    columns: [
      ...routing(),
      text("id"),
      text("token"),
      text("enrollment_id"),
      text("circle_id"),
      int("issued_at"),
      int("expires_at"),
      int("revoked_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
