/**
 * جداولُ **المال** (`features/ledger`) — وحدةُ الريادة الثانية (T25 · T26-أ).
 *
 * وفيها ما لا نظيرَ له في غيرها: **الرولّ-أب** `fund_balances` (ع-٦ · CR-026 أ) وهو
 * **مدخلُ الحارس الشرعيّ ق-٥٥** لا رقمٌ في تقرير، و**مفتاحُ الترحيل النشط** الذي يفرض
 * idempotency ق-٥٠ **في القاعدة** فلا يفلت السباق.
 */

import { int, routing, text, ROUTING_COLUMN, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const LEDGER_TABLES: readonly TableSpec[] = [
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
]
