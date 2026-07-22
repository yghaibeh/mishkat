/**
 * **مرافقُ عابرةٌ للوحدات** — جداولُ الطبقة التي **لا تملكها وحدةُ ميزة**.
 *
 * `audit_log` سجلٌّ **واحدٌ مركزيّ** (README الحسم ٣ · CR-027): تناديه الوحداتُ ولا تملكه
 * واحدة، ومالكُه المُعلَن `repositories/auditRepository.ts` وحدَه. و`sequences` عدّاداتٌ
 * مستمرّةٌ **يقتسمها المالكون بـ`owns`** فتنجو الحتميّةُ عبورَ القاعدة (TESTING_POLICY §٥).
 *
 * **ولذلك موطنُهما هنا لا في ملفّ وحدة**: ملفُّ وحدةٍ يملك جدولاً تكتب فيه خمسَ عشرةَ وحدةً
 * **يزعم ملكيةً لا يملكها** — وهو «مصدرا حقيقةٍ لشيءٍ واحد» في ثوبِ تنظيمِ ملفّات.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const SHARED_TABLES: readonly TableSpec[] = [
  {
    /**
     * **سجلُّ تدقيقٍ واحدٌ مركزيّ** (README الحسم ٣) — أعمدتُه شكلُ `AuditEntry` المعلن في
     * `repositories/contracts.ts`؛ وما لا يزوّده سجلٌّ محليٌّ اليوم يبقى `NULL`
     * (توسيعُ الأضيق قرارُ `CR-DRAFT-persistence-002` لا قرارُ مخطط).
     */
    name: "audit_log",
    columns: [
      ...routing(),
      text("source"),
      int("seq"),
      int("at"),
      text("actor_person_id"),
      text("action"),
      text("capability", true),
      text("target_type", true),
      text("target_id"),
      text("reason", true),
      /** ١ = النطاقُ مشتقٌّ من الكيان المُدقَّق · ٠ = تعذّر فوُجِّه إلى جذر الشبكة **موسوماً**. */
      int("scope_exact"),
      text("actor_roles_at_time", true),
      text("impersonated_by", true),
      text("decision", true),
      text("reason_code", true),
      text("request_id", true),
      text("before", true),
      text("after", true),
    ],
    primaryKey: [TENANT_COLUMN, "source", "seq"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /** العدّاداتُ المستمرة — بها تنجو الحتميّة عبور القاعدة (TESTING_POLICY §٥). */
    name: "sequences",
    columns: [...routing(), text("name"), int("value")],
    primaryKey: [TENANT_COLUMN, "name"],
    appendOnly: false,
    infrastructure: false,
  },
]
