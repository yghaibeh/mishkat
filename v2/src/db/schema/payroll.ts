/**
 * جداولُ **الرواتب والمستحقات** (`features/payroll`) — السلسلةُ المالية (الهجرة `0014`).
 *
 * > **والثابتُ المفروضُ في المخطط**: **لا سطرَ مستحقٍّ ولا حقلَ «مدفوع»** (عقدُ الوحدة §٢-١).
 * > ما يسكن هذه الجداول **وقائعُ مالية التُزمت ومعها قيدُها**، والمستحقُّ **اشتقاقٌ لحظةَ
 * > السؤال** والمختومُ في **حمولة المحرّك المُجمَّدة**. ويحرس ذلك `tests/migrations/payroll.test.ts`
 * > على المخطط المطبَّق، فوقَ الحارس المحتوائيّ القائم (`entitlement-is-derived.test.ts`).
 *
 * > **وخمستُها من النمط (أ)** — تشغيليٌّ بالوحدة (وصفة §٤-٠): **لا كتالوجَ شبكيّاً في هذه
 * > الوحدة**، فلا موجبَ لفصل مصنعَين. والسؤالُ سُئل ولم يُفترض جوابُه.
 *
 * > **و«لا صرفَ مرتين» (ق-٦٥) يسكن القاعدة لا الذاكرة**: `payroll_payout_persons` صفٌّ
 * > لكلِّ شخصٍ في كلِّ صرف، وعليه فهرسٌ فريدٌ `(tenant_id, period_id, person_id)` في الهجرة.
 * > والفهارسُ الفريدةُ **موطنُها `.sql`** — وصفُ المخطط هنا يصف الأعمدةَ والمفتاح، والحارسُ
 * > يقارنهما بـ`PRAGMA`؛ أمّا القيدُ الفريدُ فيُقاس **بسلوكه** (رميةٌ على الازدواج) لا بوصفه.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const PAYROLL_TABLES: readonly TableSpec[] = [
  {
    /**
     * **السلفة** (ق-٦٩) — ذمّةٌ مدينة، أصلُها نقدٌ خرج بقيدٍ مرحَّل. **ملحقةٌ فقط**:
     * الإقفالُ **حالةٌ** (`closed_at`) لا حذف، فالسلفةُ تبقى في السجل مختومةً بتاريخها.
     * ولا عمودَ «متبقٍّ»: المتبقي اشتقاقٌ من أقساطها لا حقلٌ يُنقَص.
     */
    name: "payroll_advances",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("entry_id"),
      int("principal_cents"),
      int("instalment_cents"),
      int("granted_at"),
      int("closed_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **القسط** — الخصمُ الوحيدُ في النظام (ب-٣١/ق-٣٤)، واقعةٌ التُزمت ومعها قيدُها.
     * توجيهُه **يرث مسارَ سلفته** مشتقّاً لا مُخترعاً (نظيرُ حركة العُهد من أصلها).
     */
    name: "payroll_instalments",
    columns: [
      ...routing(),
      text("id"),
      text("advance_id"),
      text("period_id"),
      text("entry_id"),
      int("amount_cents"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **الصرف** (ق-٦٥/ق-٧١) — توثيقُ الواقعة ومرجعُها **بلا مبلغ**: المبلغُ في القيد وفي
     * السطر المختوم. وتوجيهُه **وحدةُ الصرف** التي أمينُها هو الصارف.
     */
    name: "payroll_payouts",
    columns: [
      ...routing(),
      text("id"),
      text("entry_id"),
      text("period_id"),
      text("paid_by"),
      int("at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **مَن صُرف له** — صفٌّ لكلِّ شخصٍ في كلِّ صرف، لا قائمةٌ مسلسلةٌ في عمودٍ نصّيّ.
     * وعليه **الفهرسُ الفريد** `(tenant_id, period_id, person_id)` في الهجرة: به يصير
     * «لا يُدفع استحقاقٌ مرتين» (ق-٦٥) **مستحيلاً في القاعدة** لا مرصوداً في الذاكرة.
     * ومفتاحُه `(tenant_id, payout_id, person_id)` **لا** الفترةُ والشخص: لو كان المفتاحُ
     * هو الفريدَ نفسَه لصار الصرفُ الثاني **تحديثاً صامتاً** يبتلع «أيُّ صرفٍ دفع له».
     */
    name: "payroll_payout_persons",
    columns: [...routing(), text("payout_id"), text("person_id"), text("period_id")],
    primaryKey: [TENANT_COLUMN, "payout_id", "person_id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **توزيعُ المناطق** (ق-٦٦) — نازلٌ حصراً، وتوجيهُه **وحدةُ الوجهة**. و«(فترة × منطقة)
     * لا يتكرر» له **فهرسٌ فريدٌ في الهجرة** كنظيره في الصرف: حارسُ الذاكرة يعمى عمّا لم
     * يُحمَّل، وهذا لا يعمى.
     */
    name: "payroll_distributions",
    columns: [...routing(), text("id"), text("period_id"), int("at")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /** **الحافز** (ق-٧٧) — خارج أجر المعلّم بالبناء: كيانٌ آخرُ وقيدٌ آخر. */
    name: "payroll_incentives",
    columns: [...routing(), text("id"), text("person_id"), text("entry_id"), text("granted_by"), int("at")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
