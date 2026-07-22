/**
 * وصفُ المخطط في الكود — **مصدرُ حقيقةٍ واحدٌ لبناء العبارات** (المادة ١/٢).
 *
 * والملفُّ `.sql` هو ما يُطبَّق فعلاً؛ فلئلا يصير مصدرَ حقيقةٍ ثانياً يتباعد،
 * **يُقارن هذا الوصفُ بالمخطط المطبَّق نفسِه** في `tests/migrations/schema.test.ts`
 * (عبر `PRAGMA`) — فأيُّ انحرافٍ يُفشل الطقم. القياسُ على المطبَّق لا على النصّ.
 *
 * **مفتاحُ التوجيه (ع-٥) على كلِّ جدولٍ يحمل بيانات شبكة بلا استثناء** — لأن الاستثناء
 * يحتاج تصنيفاً، والتصنيفُ قائمةٌ تُسرد، والقائمةُ تتخلّف (CR-011/قب-٣٦). التفصيلُ
 * ومسوّغُه في `README.md` الحسم ٢.
 */

export type ColumnType = "text" | "int"

export type ColumnSpec = {
  readonly name: string
  readonly type: ColumnType
  readonly nullable: boolean
}

export type TableSpec = {
  readonly name: string
  readonly columns: readonly ColumnSpec[]
  readonly primaryKey: readonly string[]
  /**
   * جدولٌ **لا يُمحى منه صفّ** (المادة ٧/٤): اختفاءُ صفٍّ من الإسقاط عطبٌ برمجيّ
   * يُرمى ولا يُترجم إلى `DELETE`.
   */
  readonly appendOnly: boolean
  /** بنيةٌ تحتية: بلا شبكةٍ وبلا مفتاح توجيه (دفترُ الهجرات وحده اليوم). */
  readonly infrastructure: boolean
}

export const TENANT_COLUMN = "tenant_id"
export const ROUTING_COLUMN = "unit_path"
/** نطاقُ ما ليس نطاقُه وحدةً: الشبكةُ كلُّها (وهو **صادقٌ** لا حشو — README الحسم ٢). */
export const TENANT_ROOT_PATH = "/"

const text = (name: string, nullable = false): ColumnSpec => ({ name, type: "text", nullable })
const int = (name: string, nullable = false): ColumnSpec => ({ name, type: "int", nullable })
/** العمودان الأولان في كلِّ جدولِ بياناتٍ — الترتيبُ مقصود: المفتاحُ يُقرأ أولاً. */
const routing = (): readonly ColumnSpec[] => [text(TENANT_COLUMN), text(ROUTING_COLUMN)]

export const TABLES: readonly TableSpec[] = [
  {
    name: "_migrations",
    columns: [text("name"), int("applied_at")],
    primaryKey: ["name"],
    appendOnly: true,
    infrastructure: true,
  },
  // ── وحدةُ الريادة الأولى: الشجرة (تُثبت مفتاحَ التوجيه في أصعب صوره) ──────────
  {
    name: "org_units",
    columns: [
      ...routing(),
      text("id"),
      text("type"),
      text("label_ar"),
      text("parent_id", true),
      text("section", true),
      int("archived"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_accounts",
    columns: [...routing(), text("person_id"), text("username"), text("status"), int("session_epoch")],
    primaryKey: [TENANT_COLUMN, "person_id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_assignments",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("role_id"),
      text("unit_id"),
      int("start_date"),
      int("end_date", true),
      text("approval_status"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_requests",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("username"),
      text("requested_role_id"),
      text("requested_unit_id"),
      text("status"),
      text("origin"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  // ── وحدةُ الريادة الثانية: المال (تُثبت الذرّية والتوازن) ─────────────────────
  {
    name: "ledger_accounts",
    columns: [...routing(), text("id"), text("ar"), text("kind")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "funds",
    columns: [...routing(), text("id"), text("ar"), int("restricted")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "ledger_units",
    columns: [...routing(), text("id")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "journal_entries",
    columns: [
      ...routing(),
      text("id"),
      text("voucher_no"),
      int("voucher_seq"),
      int("at"),
      text("memo_ar"),
      text("source_type"),
      text("source_id"),
      text("posting_key", true),
      text("reversal_of", true),
      text("reversed_by", true),
      text("reason_ar", true),
      text("posted_by"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    name: "journal_lines",
    columns: [
      ...routing(),
      text("id"),
      text("entry_id"),
      text("account_id"),
      text("fund_id", true),
      text("currency"),
      int("debit"),
      int("credit"),
      text("kind"),
      text("deduction_kind", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * مفتاحُ الترحيل **النشط** — الفرضُ الحقيقيّ لـidempotency ق-٥٠ **في القاعدة**
     * فلا يفلت السباق. وهو **مفتاحٌ فريدٌ كامل** لا فهرسٌ جزئيّ (ع-٣ يمنع الجزئيّ):
     * العكسُ **يحذف الصفّ** فيتحرّر المفتاح — وهذا جدولُ فهرسةٍ لا بياناتِ عمل.
     */
    name: "active_posting_keys",
    columns: [...routing(), text("posting_key"), text("entry_id")],
    primaryKey: [TENANT_COLUMN, "posting_key"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **الرولّ-أب** (ADR-001 ع-٦، CR-026 أ) — رصيدُ صندوقٍ بعملةٍ في وحدة، **تجميعاً مسبقاً**.
     * مفتاحُه (الشبكة × مفتاح التوجيه × الصندوق × العملة)، ومسوّغُ كلِّ ضلعٍ في `README.md`.
     *
     * **ملحقٌ فقط** (`appendOnly`) رغم أنه مشتقّ: أسطرُ القيد لا تُمحى، فصفٌّ ظهر مرّةً لا
     * يختفي أبداً. واختفاؤه من الإسقاط **عطبٌ برمجيّ يُرمى** لا `DELETE` يُكتب صامتاً —
     * وهو نظيرُ «الاختلافُ يُرمى ولا يُصلَح» على وجهه الآخر.
     */
    name: "fund_balances",
    columns: [...routing(), text("fund_id"), text("currency"), int("balance")],
    primaryKey: [TENANT_COLUMN, ROUTING_COLUMN, "fund_id", "currency"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    name: "finance_actions",
    columns: [
      ...routing(),
      text("id"),
      text("kind"),
      // حمولةٌ مجمَّدة **نصّاً** — لا `JSONB` ولا مزيةَ محرّك (ع-٣).
      text("payload"),
      text("requested_by"),
      int("requested_at"),
      text("status"),
      text("decided_by", true),
      int("decided_at", true),
      text("reason_ar", true),
      text("result_entry_id", true),
      text("failure_code", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
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

const BY_NAME = new Map(TABLES.map((t) => [t.name, t]))

export function tableSpec(name: string): TableSpec {
  const spec = BY_NAME.get(name)
  if (spec === undefined) throw new Error(`جدولٌ بلا مخطط: ${name} — لا يُقذف ما لا مخططَ له`)
  return spec
}

export function hasTable(name: string): boolean {
  return BY_NAME.has(name)
}
