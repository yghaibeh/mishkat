/**
 * مستودعُ الإشعارات على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `NotificationStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في الخدمات ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ### ثلاثةُ فروقٍ عن نموذج العُهد تستحقّ أن تُقال — **فخُّ هذه الوحدة معلنٌ لا مدفون**
 * ١. **الطابورُ ملحقٌ فقط، والحالةُ تحديثٌ لا حذف** (فخُّ ق-٨٠ في ثوبٍ جديد): «أُرسل/قُرئ/
 *    سُلِّم» لا يُنمذَج **حذفاً من طابور**؛ الصفُّ يبقى وتتحرّك حالتُه بمفتاحه الطبيعيّ. سبعةُ
 *    جداولَ، ستةٌ منها **ملحقة** (`appendOnly`) وواحدٌ مرآةُ قراءة (`notification_units`).
 * ٢. **مفتاحُ التوجيه `/` صادقٌ لا حشو**: صندوقُ الشخص وقنواتُه ورموزُه **نطاقُها الشبكةُ
 *    كلُّها** (شخصٌ يخدم قسمين ⟵ صندوقُه لا يخصّ شظيةَ وحدة — نظيرُ الحساب الشخصيّ، README
 *    الحسم ٢). و**الإعلانُ وحدَه منطاقٌ حقّاً**: مساره `scopePath` المخزَّن. وكلُّها مستقرّةٌ
 *    بعد الكتابة، فيأمنُ فخُّ «مفتاحُ توجيهٍ متحرّكٌ على جدولٍ ملحق».
 * ٣. **لا عدّادَ مشتقٌّ يُتحقَّق منه**: عددُ غير المقروء اشتقاقٌ **عند القراءة** لا رولّ-أب
 *    مخزَّن (inbox.ts) — فلا رقمَ يُزوَّر، ولا مطابقةَ تُبنى. **صفرُ حالةٍ مخزَّنة أرخصُ من
 *    رولّ-أبٍ محروس.** والتحميلُ **حشوٌ لا إعادةُ تشغيل**: الكياناتُ تصل بمعرّفها فيكفي
 *    استئنافُ العدّاد بالأعلى بين المشتقّ والمحفوظ (نظيرُ العُهد).
 *
 * > **وسجلُّ تدقيقٍ لا يُنقل هنا**: مستودعُ الإشعارات **لا يحمل `AuditJournal`** (بخلاف
 * > العُهد) — لا سجلَّ محلياً يُلغى ولا قيدَ تدقيقٍ يُكتب في طبقة البيانات. والوسمُ `audit:`
 * > في `server/endpoints.ts` اسمُ فعلٍ لإطار `defineServerFn` يُعالَج في طبقة الخادم، لا هنا.
 * > فوحدةُ العمل تُدرِج **مستودعَ الإشعارات وحدَه** (بند ناقل الوحدة ٢ غيرُ ذي موضوعٍ لغياب سجلٍّ محليّ).
 */

import {
  encodeDate,
  encodeNullable,
  readDate,
  readDateOrNull,
  readInt,
  readIntOrNull,
  readText,
  readTextOrNull,
} from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { NotificationStore } from "../../features/notifications/data/store.js"
import type {
  AnnouncementAudience,
  ChannelId,
  DeliveryStatus,
  NotificationStatus,
  NotificationTrigger,
} from "../../features/notifications/types.js"
import { sequenceRow, suffixOf } from "./shared.js"
import { TENANT_ROOT_PATH } from "../schema.js"

const SOURCE = "notifications"
const SEQUENCE = "notifications.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مُسنَدٌ إلى مرساةٍ مقيسة، وبضعفٍ مُصرَّحٍ به**.
 *
 * نطاقُ هذه الوحدة **شبكيٌّ بالبناء**: صندوقُ الشخص وقنواتُه ورموزُه ومعظمُ جداولها تسكن
 * جذرَ الشبكة `/` (الفرق ٢ أعلاه)، ومُرشِّحُ النطاق **يضمّ صفوفَ الجذر في كل جلسة** — فقراءةُ
 * «إشعاراتي» تُحمِّل طابورَ الشبكة كلَّه لا طابورَ وحدة. فالسقفُ **سقفُ الشبكة لا سقفُ وحدة**.
 *
 * والاشتقاقُ بترتيب وصفة §٤-١:
 *  · **الوحدات**: ADR §١-٥ يقيس **~٨٦٠** وحدةً للشبكة اليوم. و**الأنواعُ** كتالوجٌ صغير (~١٠٠).
 *  · **الطابورُ وسطورُ تسليمه غيرُ مقيسة اسماً** في ADR — لكنّها **عملياتيةٌ لا مرجعية**، فلا
 *    أطبّق عليها متوسّطَ «باقي الـ٩٥ جدولاً» (~٢٬٠٠٠/سنة) لأنه **يُخفي** أنها من أكبر مستهلكي
 *    ذلك السطل. فأسندُها إلى **أقربِ مرساةٍ مقيسة**: `weekly_records` (ملحق أ) = ٤٠٠ مسجد ×
 *    ٥٢ = **~٢٠٬٨٠٠ تقديمٍ/سنة**. ولكلِّ تقديمٍ تنبثق ~٣ إشعارات (اعتمادٌ للأقرب ق-١١ ·
 *    نتيجةٌ لمقدِّمه · تذكيرٌ منوفَذٌ ق-٢٥) ⟵ **~٦٢٬٤٠٠ إشعارٍ/سنة**، وبالاحتفاظ سنتين (قب-٦)
 *    ⟵ **~١٢٥٬٠٠٠**. وسطورُ التسليم ~١٫٥× (الجرسُ دائماً + ربطٌ جزئيّ لتيليغرام/المتصفح) ⟵
 *    **~١٨٧٬٠٠٠**. والإعلاناتُ ~١٠٬٠٠٠، والقنواتُ والرموزُ ~٢٠٬٠٠٠.
 *
 * المجموعُ **~٣٤٣٬٠٠٠**، والسقفُ **٥٠٠٬٠٠٠** يسعه بهامشٍ ~١٫٤٥× (كهامش العُهد).
 *
 * > **والضعفُ يُقال لا يُجمَّل** (كحمولة `audit_log` التي وصفها ADR بـ«أضعفِ رقمٍ في الوثيقة»):
 * > مصدرُ الرقم مرساةٌ مقيسة **بمعامل انبثاقٍ مُقدَّرٍ لا مقيس**، وأنواعُ الإشعار غيرُ مقيسة.
 * > فإن قِيس حجمُ الطابور يوماً **يُراجَع هذا السقف**. **وأخطرُ ما فيه أنّ نطاقه `/` لا يُضيَّق
 * > بالمسار**: صندوقُ الشخص شبكيٌّ بالبناء — وهو **النمطُ (ج)** في الوصفة §٤-٠.
 *
 * > ### 🔫 وتصحيحٌ لِما كُتب هنا أوّلَ مرّة (T26-ج البند ٣ · `db/README.md` الحسم الرابع)
 * > كان هذا الموضعُ يقول إن أوّلَ تجاوزٍ هنا **هو زنادُ CR-026 بعينه**. **والصياغةُ كانت أضيقَ
 * > من نصّ الزناد**: نصُّه (قب-٤٨) *«إخفاقٌ **يتعذّر إصلاحُه بتضييق النطاق**»* — **لا «بتضييقه
 * > بالمسار»**. و**محورُ الشخص تضييقٌ للنطاق** وإن لم يكن بالمسار، وهو تغييرٌ في `unitOfWork`
 * > **لا قلبٌ للعقود** — فهو **أرخصُ وأصحُّ** من التحويل إلى `async`.
 * >
 * > **فترتيبُ العلاج عند أوّل تجاوزٍ هنا**: ~~المسار~~ (لا أثرَ — النمط ج) ⟵ ~~فصلُ المستودع~~
 * > (لا أثرَ — البياناتُ نفسُها شبكية) ⟵ **محورُ الشخص** ⟵ **ثم** الزناد إن لم يُجدِ.
 * > **والمحورُ غيرُ مبنيٍّ اليوم عمداً**: قِيس في T26-ج فلم يُحتَج (`box`/`payroll`/`approval`
 * > **صفرُ جدولٍ نطاقُه شخص** — محروسٌ في `tests/db/scope-axis.test.ts`)، و**محورٌ لا يُستعمل
 * > كبوابةٍ لا تحرس** (المادة ٠). **ولا يُرفع السقفُ صامتاً بحال.**
 */
const ROW_BUDGET = 500_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentNotifications(store: NotificationStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** أعلى لاحقةِ معرّفٍ في الكيانات المولَّدة بالعدّاد (`ntf/lnk/chn/ann`) — لا في المبذور. */
  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const n of store.notifications()) max = Math.max(max, suffixOf(n.id))
    for (const t of store.tokens()) max = Math.max(max, suffixOf(t.id))
    for (const c of store.channels()) max = Math.max(max, suffixOf(c.id))
    for (const a of store.announcements()) max = Math.max(max, suffixOf(a.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "notification_units",
      "notification_kinds",
      "notification_queue",
      "notification_deliveries",
      "notification_link_tokens",
      "notification_channels",
      "notification_announcements",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          store.units().map((unit) => ({
            tenant_id: tenantId,
            unit_path: unit.path,
            id: unit.id,
            ar: unit.ar,
          })),
          "notification_units",
        ),
        collect(
          store.kinds().map((kind) => ({
            tenant_id: tenantId,
            // **مرجعٌ شبكيّ**: نطاقُه جذرُ الشبكة لا وحدة (README الحسم ٢).
            unit_path: TENANT_ROOT_PATH,
            id: kind.id,
            ar: kind.ar,
            trigger: kind.trigger,
            active: kind.active ? 1 : 0,
          })),
          "notification_kinds",
        ),
        collect(
          store.notifications().map((n) => ({
            tenant_id: tenantId,
            // **صندوقُ شخصٍ ⟵ جذرُ الشبكة**: الشخصُ يخدم قسمين، فلا يخصّ صندوقُه شظيةَ وحدة.
            unit_path: TENANT_ROOT_PATH,
            id: n.id,
            person_id: n.personId,
            kind_id: n.kindId,
            ref_id: n.refId,
            window_key: n.windowKey,
            natural_key: n.naturalKey,
            summary_ar: n.payload.summaryAr,
            amount_minor: n.payload.amount === null ? null : n.payload.amount.minor,
            amount_currency: n.payload.amount === null ? null : n.payload.amount.currency,
            outcome_ar: n.payload.outcomeAr,
            reason_ar: n.payload.reasonAr,
            status: n.status,
            queued_at: encodeDate(n.queuedAt),
            read_at: encodeNullable(n.readAt, encodeDate),
          })),
          "notification_queue",
        ),
        collect(
          store.deliveries().map((d) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: d.id,
            notification_id: d.notificationId,
            channel: d.channel,
            status: d.status,
            attempts: d.attempts,
            last_error_ar: d.lastErrorAr,
          })),
          "notification_deliveries",
        ),
        collect(
          store.tokens().map((t) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: t.id,
            person_id: t.personId,
            channel: t.channel,
            issued_at: encodeDate(t.issuedAt),
            expires_at: encodeDate(t.expiresAt),
            ttl_minutes: t.ttlMinutes,
            consumed_at: encodeNullable(t.consumedAt, encodeDate),
          })),
          "notification_link_tokens",
        ),
        collect(
          store.channels().map((c) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: c.id,
            person_id: c.personId,
            channel: c.channel,
            external_id: c.externalId,
            linked_at: encodeDate(c.linkedAt),
          })),
          "notification_channels",
        ),
        collect(
          store.announcements().map((a) => ({
            tenant_id: tenantId,
            // **الإعلانُ منطاقٌ حقّاً**: مساره `scopePath` المشتقُّ من الوحدة عند النشر (ح-٥).
            unit_path: a.scopePath,
            id: a.id,
            title_ar: a.titleAr,
            body_ar: a.bodyAr,
            unit_id: a.unitId,
            audience: a.audience,
            publisher_person_id: a.publisherPersonId,
            published_at: encodeDate(a.publishedAt),
          })),
          "notification_announcements",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "notification_units").values()) {
        store.saveUnit({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          path: readText(row, "unit_path"),
        })
      }
      for (const row of table(rows, "notification_kinds").values()) {
        store.saveKind({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          trigger: readText(row, "trigger") as NotificationTrigger,
          active: readInt(row, "active") !== 0,
        })
      }
      // **بترتيب التوليد**: `saveNotification` يعيد بناء فهرس المفتاح الطبيعيّ، وترتيبُ الإدراج
      // صدقٌ لا اعتمادٌ عليه — كلُّ قراءةٍ تفرز بنفسها (inbox `newestFirst`). فرزٌ بمفتاحٍ واحدٍ
      // بلا تعادلٍ ممكن (المعرّفاتُ متتابعةٌ فريدة) فلا فرعَ تعادلٍ يُترك بلا تغطية.
      const queued = [...table(rows, "notification_queue").values()].sort(
        (a, b) => suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of queued) {
        const amountMinor = readIntOrNull(row, "amount_minor")
        store.saveNotification({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          kindId: readText(row, "kind_id"),
          refId: readText(row, "ref_id"),
          windowKey: readText(row, "window_key"),
          naturalKey: readText(row, "natural_key"),
          payload: {
            summaryAr: readText(row, "summary_ar"),
            amount:
              amountMinor === null
                ? null
                : { minor: amountMinor, currency: readText(row, "amount_currency") },
            outcomeAr: readTextOrNull(row, "outcome_ar"),
            reasonAr: readTextOrNull(row, "reason_ar"),
          },
          status: readText(row, "status") as NotificationStatus,
          queuedAt: readDate(row, "queued_at"),
          readAt: readDateOrNull(row, "read_at"),
        })
      }
      for (const row of table(rows, "notification_deliveries").values()) {
        store.saveDelivery({
          tenantId,
          id: readText(row, "id"),
          notificationId: readText(row, "notification_id"),
          channel: readText(row, "channel") as ChannelId,
          status: readText(row, "status") as DeliveryStatus,
          attempts: readInt(row, "attempts"),
          lastErrorAr: readTextOrNull(row, "last_error_ar"),
        })
      }
      for (const row of table(rows, "notification_link_tokens").values()) {
        store.saveToken({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          channel: readText(row, "channel") as ChannelId,
          issuedAt: readDate(row, "issued_at"),
          expiresAt: readDate(row, "expires_at"),
          ttlMinutes: readInt(row, "ttl_minutes"),
          consumedAt: readDateOrNull(row, "consumed_at"),
        })
      }
      for (const row of table(rows, "notification_channels").values()) {
        store.saveChannel({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          channel: readText(row, "channel") as ChannelId,
          externalId: readText(row, "external_id"),
          linkedAt: readDate(row, "linked_at"),
        })
      }
      for (const row of table(rows, "notification_announcements").values()) {
        store.saveAnnouncement({
          tenantId,
          id: readText(row, "id"),
          titleAr: readText(row, "title_ar"),
          bodyAr: readText(row, "body_ar"),
          unitId: readText(row, "unit_id"),
          scopePath: readText(row, "unit_path"),
          audience: readText(row, "audience") as AnnouncementAudience,
          publisherPersonId: readText(row, "publisher_person_id"),
          publishedAt: readDate(row, "published_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
