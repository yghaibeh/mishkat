/**
 * جداولُ **الإشعارات والقنوات والإعلانات** (`features/notifications`) — الهجرة `0005`.
 *
 * > **«أُرسل / قُرئ / سُلِّم» حالةٌ صريحةٌ على الصفّ نفسِه لا حذفٌ من طابور** (فخُّ ق-٨٠ في
 * > ثوبٍ جديد): الطابورُ وسطورُ التسليم ورموزُ الربط والقنوات **ملحقةٌ فقط** (`appendOnly`) —
 * > اختفاءُ صفٍّ عطبٌ يُرمى ولا يُترجم `DELETE`، وانتقالُ الحالة **تحديثٌ** يُبقي الصفَّ نفسَه.
 * > و`notification_units` وحدَه **ليس ملحقاً**: مرآةُ قراءةٍ لشجرة التنظيم يجوز أن يزول صفُّها.
 *
 * ويحرس ذلك `tests/migrations/notifications.test.ts` **على المخطط المطبَّق** لا على النيّة.
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const NOTIFICATIONS_TABLES: readonly TableSpec[] = [
  // ── T26-ب-٢: الإشعارات (وحدةُ الموجة الأولى — الهجرة `0005`) ──────────────────
  {
    /** إسقاطُ الوحدة لاشتقاق النطاق والاسم — نظيرُ `ledger_units`: نسخةُ قراءةٍ لا مصدرُ حقيقة. */
    name: "notification_units",
    columns: [...routing(), text("id"), text("ar")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    /**
     * **كتالوجُ الأنواع** — بياناتٌ مرجعية (قب-٢٢) في جذر الشبكة. **ملحقٌ فقط**: الإيقافُ
     * `active=0` بيانٌ لا حذف (ق-٢٢ · المادة ٧/٤)، فلا يُمحى نوعٌ أُشعِر به يوماً.
     */
    name: "notification_kinds",
    columns: [...routing(), text("id"), text("ar"), text("trigger"), int("active")],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **الطابورُ الموحّد** — بابٌ واحدٌ للإدراج، والحالةُ تولد `queued` (ق-٧٥). **ملحقٌ فقط**:
     * `read` تحديثٌ على الصفّ نفسِه لا حذفٌ من طابور. والحمولةُ مهيكلة — المبلغُ عمودان
     * (`amount_minor`/`amount_currency`) يُفرَّغان معاً إن غاب (ق-٤٨/ق-٧٥)، والمفتاحُ الطبيعيُّ
     * ركنٌ مخزَّنٌ لا محسوبٌ في كل قراءة (ت-٨).
     */
    name: "notification_queue",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("kind_id"),
      text("ref_id"),
      text("window_key"),
      text("natural_key"),
      text("summary_ar"),
      int("amount_minor", true),
      text("amount_currency", true),
      text("outcome_ar", true),
      text("reason_ar", true),
      text("status"),
      int("queued_at"),
      int("read_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **سطورُ التسليم** — حالةٌ لكلِّ قناة (`queued`/`delivered`/`failed`). **ملحقٌ فقط**:
     * الفشلُ يُعلَن بسببه ولا يُبتلع (ت-٨)، وانتقالُ الحالة تحديثٌ لا حذفٌ وإدراج.
     */
    name: "notification_deliveries",
    columns: [
      ...routing(),
      text("id"),
      text("notification_id"),
      text("channel"),
      text("status"),
      int("attempts"),
      text("last_error_ar", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **رموزُ ربط القناة** — عمرٌ معلنٌ من الإعداد (ع-١٦). **ملحقٌ فقط**: الاستهلاكُ
     * `consumed_at` ختمٌ لا حذف، فلا يُعاد إصدارُ رمزٍ استُعمل.
     */
    name: "notification_link_tokens",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("channel"),
      int("issued_at"),
      int("expires_at"),
      int("ttl_minutes"),
      int("consumed_at", true),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **القنواتُ المربوطة** — ملكيةٌ لا يُستولى عليها (خ-٣). **ملحقٌ فقط**: «لا قطعَ ولا
     * تحويل». والمعرّفُ الخارجيُّ مفتاحٌ في المستودع (قيدُ تفرّدٍ في الهجرة) فلا يحمله اثنان.
     */
    name: "notification_channels",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("channel"),
      text("external_id"),
      int("linked_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
  {
    /**
     * **الإعلاناتُ** — كيانٌ منطاقٌ يُقرأ بالنطاق والجمهور (ح-٥ · ك-٣٢). **ملحقٌ فقط**:
     * منشورٌ لا يُسترجَع. ومفتاحُ توجيهه `unit_path` **هو `scopePath`** المشتقُّ من الوحدة
     * المخزَّنة — لا عمودَ نطاقٍ ثانٍ يتباعد.
     */
    name: "notification_announcements",
    columns: [
      ...routing(),
      text("id"),
      text("title_ar"),
      text("body_ar"),
      text("unit_id"),
      text("audience"),
      text("publisher_person_id"),
      int("published_at"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: true,
    infrastructure: false,
  },
]
