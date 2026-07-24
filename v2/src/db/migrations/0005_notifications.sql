-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — الإشعاراتُ والقنواتُ والإعلانات: **طابورٌ يُحدَّث ولا يُمحى، وحالةٌ صريحةٌ لا حذفٌ من طابور**
--
-- **هذا ملفٌّ لا يُعدَّل بعد الدمج** (المادة ٧/١): التصحيحُ بهجرةٍ جديدة لا بتحريرِ هذه.
-- وحدةُ `notifications` في الموجة الأولى (الهجرة `0005`) — على نمط `0003_custody` حرفياً:
-- مفتاحُ التوجيه على كلِّ جدولٍ بلا استثناء (ع-٥ · `db/README.md` الحسم ٢)، ولهجةُ القاسم
-- المشترك (ع-٣: لا JSONB · لا فهرسٌ جزئيّ · لا AUTOINCREMENT · التاريخُ INTEGER · المنطقُ ٠/١).
--
-- ### الثابتُ الذي يفرضه هذا المخطط قبل أيّ سطر منطق — **فخُّ ق-٨٠ في ثوبٍ جديد**
-- > **«أُرسل / قُرئ / سُلِّم» حالةٌ صريحةٌ على الصفّ نفسِه — لا حذفٌ من طابور.**
-- «الطابور» إغراءٌ لفظيّ: الطوابيرُ تُفرَّغ، والصفوفُ هنا **لا تُفرَّغ**. الإشعارُ يولد
-- `queued` ثم يصير `read` **تحديثاً على صفّه** (لا صفٌّ جديد ولا محو)، وسطرُ التسليم يصير
-- `delivered`/`failed` كذلك. فالثلاثةُ الحاملةُ لحالةٍ صريحةٍ **ملحقةٌ فقط** (المادة ٧/٤):
-- اختفاءُ صفٍّ منها **عطبٌ يُرمى** ولا يُترجم `DELETE`. ونمذجةُ الانتقال حذفاً وإدراجاً
-- تُسقط ت-٨ (المفتاح الطبيعيّ) وق-٧٥ (الحالةُ تولد `queued`) معاً.
--
-- ### والجداولُ السبعةُ ومفاتيحُ توجيهها — **قرارٌ لكلِّ جدولٍ لا حكمٌ للوحدة**
-- · `notification_units`      إسقاطُ الوحدة  ⟵ مساره **مسارُ الوحدة** (نظيرُ `custody_units`) · **ليس ملحقاً** (مرآةُ قراءة).
-- · `notification_kinds`      كتالوجٌ مرجعيّ ⟵ **جذرُ الشبكة `/`** (بياناتٌ شبكيةٌ لا نطاقُها وحدة) · **ملحقٌ**: الإيقافُ بيانٌ لا حذف (ق-٢٢).
-- · `notification_queue`      الطابورُ      ⟵ **`/`**: الإشعارُ صندوقُ شخصٍ، والشخصُ يخدم قسمين فحسابُه للشبكة (README الحسم ٢، نظيرُ الحساب الشخصيّ) · **ملحقٌ**.
-- · `notification_deliveries` سطورُ التسليم ⟵ **`/`** تِبعاً لإشعارها · **ملحقٌ**: الفشلُ يُعلَن ولا يُبتلع (ت-٨).
-- · `notification_link_tokens`رموزُ الربط   ⟵ **`/`** (شخصيّ) · **ملحقٌ**: الاستهلاكُ ختمٌ لا حذف (ع-١٦).
-- · `notification_channels`   القنواتُ      ⟵ **`/`** (شخصيّ) · **ملحقٌ**: خ-٣ «لا قطعَ ولا استيلاء».
-- · `notification_announcements` الإعلاناتُ ⟵ **`scope_path` وهو `unit_path`**: الإعلانُ كيانٌ منطاقٌ حقّاً (ح-٥) · **ملحقٌ**: منشورٌ لا يُسترجَع.
--
-- ومسارُ توجيه `/` صادقٌ لا حشو: صندوقُ الشخص وقنواتُه ورموزُه **نطاقُها الشبكةُ كلُّها** فعلاً.
-- وهو مستقرٌّ (لا يتحرّك بعد الكتابة) فيأمنُ فخُّ «مفتاحُ توجيهٍ متحرّكٌ على جدولٍ ملحق».
-- ═══════════════════════════════════════════════════════════════════════════

-- ── إسقاطُ الوحدات: قراءةٌ لاشتقاق النطاق والاسم، لا مصدرُ حقيقة (نظيرُ `ledger_units`) ──
CREATE TABLE IF NOT EXISTS notification_units (
  tenant_id TEXT NOT NULL,
  unit_path TEXT NOT NULL,
  id        TEXT NOT NULL,
  ar        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_units_routing ON notification_units (tenant_id, unit_path);

-- ── كتالوجُ الأنواع: **بياناتٌ مرجعية** (قب-٢٢) في جذر الشبكة — الإيقافُ `active=0` لا حذف ──
CREATE TABLE IF NOT EXISTS notification_kinds (
  tenant_id TEXT    NOT NULL,
  unit_path TEXT    NOT NULL,
  id        TEXT    NOT NULL,
  ar        TEXT    NOT NULL,
  trigger   TEXT    NOT NULL,
  active    INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_kinds_routing ON notification_kinds (tenant_id, unit_path);

-- ── الطابورُ الموحّد: **بابٌ واحدٌ للإدراج، والحالةُ تولد `queued`** (ق-٧٥) ──────────────
-- الحمولةُ مهيكلةٌ لا نصٌّ خام (ق-٧٥): خلاصةٌ ومبلغٌ (سنتٌ وعملة) ونتيجةٌ وسبب — والمبلغُ
-- عمودان (`amount_minor`/`amount_currency`) يُفرَّغان معاً إن كان `null` (ق-٤٨: بالسنت الصحيح).
CREATE TABLE IF NOT EXISTS notification_queue (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  person_id       TEXT    NOT NULL,
  kind_id         TEXT    NOT NULL,
  ref_id          TEXT    NOT NULL,
  window_key      TEXT    NOT NULL,
  natural_key     TEXT    NOT NULL,
  summary_ar      TEXT    NOT NULL,
  amount_minor    INTEGER,
  amount_currency TEXT,
  outcome_ar      TEXT,
  reason_ar       TEXT,
  status          TEXT    NOT NULL,
  queued_at       INTEGER NOT NULL,
  read_at         INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_queue_routing ON notification_queue (tenant_id, unit_path);
-- **المفتاحُ الطبيعيُّ مفتاحٌ بنيويّ لا انضباطٌ يُنسى** (ت-٨): في المستودع خريطةٌ من المفتاح
-- إلى المعرّف، وترجمتُها الصادقةُ على D1 قيدُ **تفرّدٍ** — فلا يُنشئ إشعارٌ ثانٍ لحدثٍ واحدٍ
-- **ولو تسابقت جلستان**. بلا هذا القيد يبقى الحارسُ في الذاكرة وحدَها فيتباعد عنها الأثرُ الدائم.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_natural ON notification_queue (tenant_id, natural_key);

-- ── سطورُ التسليم: **حالةٌ لكلِّ قناة** — الفشلُ يُعلَن بسببه ولا يُبتلع (ت-٨/ت-٩) ───────
-- ومعرّفُها `إشعارٌ|قناة` فإعادةُ الإدراج لا تُنشئ سطراً ثانياً، والمُسلَّمُ لا يُعاد تسليمه.
CREATE TABLE IF NOT EXISTS notification_deliveries (
  tenant_id       TEXT    NOT NULL,
  unit_path       TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  notification_id TEXT    NOT NULL,
  channel         TEXT    NOT NULL,
  status          TEXT    NOT NULL,
  attempts        INTEGER NOT NULL,
  last_error_ar   TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_routing ON notification_deliveries (tenant_id, unit_path);

-- ── رموزُ ربط القناة: **عمرٌ معلنٌ من الإعداد، ويُستهلك مرةً** (ع-١٦) — الاستهلاكُ ختمٌ لا حذف ──
CREATE TABLE IF NOT EXISTS notification_link_tokens (
  tenant_id   TEXT    NOT NULL,
  unit_path   TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  person_id   TEXT    NOT NULL,
  channel     TEXT    NOT NULL,
  issued_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ttl_minutes INTEGER NOT NULL,
  consumed_at INTEGER,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_link_tokens_routing ON notification_link_tokens (tenant_id, unit_path);

-- ── القنواتُ المربوطة: **ملكيةٌ لا يُستولى عليها** (خ-٣) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_channels (
  tenant_id   TEXT    NOT NULL,
  unit_path   TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  person_id   TEXT    NOT NULL,
  channel     TEXT    NOT NULL,
  external_id TEXT    NOT NULL,
  linked_at   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_channels_routing ON notification_channels (tenant_id, unit_path);
-- **المعرّفُ الخارجيُّ مفتاحٌ في المستودع فلا يحمله اثنان** (خ-٣، SPEC §٤.٣): في الذاكرة
-- خريطةٌ مفتاحُها `(قناة، معرّفٌ خارجيّ)`، وترجمتُها الصادقةُ على D1 قيدُ **تفرّدٍ** — فلا
-- تُنقل ملكيةُ قناةٍ ولا تُزدوَج **ولو تسابقت جلستان بمعرّفٍ خارجيٍّ واحد**. حارسٌ لا تحسين.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_channels_owner
  ON notification_channels (tenant_id, channel, external_id);

-- ── الإعلانات: **كيانٌ منطاقٌ يُقرأ بالنطاق والجمهور** (ح-٥ · ك-٣٢) ─────────────────────
-- ومفتاحُ توجيهه `unit_path` **هو `scopePath`** المشتقُّ من الوحدة المخزَّنة عند النشر — لا
-- عمودَ نطاقٍ ثانٍ يتباعد. و`audience` من قيمتين (`subtree`/`unit`) لا محورَ أدوارٍ ثالثاً (G6).
CREATE TABLE IF NOT EXISTS notification_announcements (
  tenant_id           TEXT    NOT NULL,
  unit_path           TEXT    NOT NULL,
  id                  TEXT    NOT NULL,
  title_ar            TEXT    NOT NULL,
  body_ar             TEXT    NOT NULL,
  unit_id             TEXT    NOT NULL,
  audience            TEXT    NOT NULL,
  publisher_person_id TEXT    NOT NULL,
  published_at        INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notification_announcements_routing ON notification_announcements (tenant_id, unit_path);

-- **ولا فهرسَ رابعاً على أيّ جدول**: كلُّ قراءةٍ تمرّ بالمستودع المُحمَّل بالنطاق، فلا قارئَ
-- حيًّا يستعلم D1 مباشرةً غيرَ فهرس التوجيه (ADR §١-٢: الفهرسُ يكلّف قدر الجدول تقريباً؛
-- فلا يُضاف إلا لقارئٍ يُسمّى). والقيدان أعلاه **قيدا تفرّدٍ** لا فهرسا سرعة — حارسان بنيويّان.
