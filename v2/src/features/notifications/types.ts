/**
 * أنواعُ الإشعارات والقنوات والإعلانات — عقدُ الوحدة `features/notifications/SPEC.md`.
 *
 * أربعةُ ثوابتٍ تُفرَض **هنا بالنوع** قبل أيّ سطرِ منطق:
 *  ١. **الجمهورُ نطاقٌ أو شخص، لا ثالثَ لهما** (§٢.٢): لا يوجد في النموذج **مكانٌ** لمحورِ
 *     جمهورٍ بالأدوار — فقائمةُ الأدوار مستحيلةٌ بالبنية لا ممنوعةٌ بالانضباط (G6).
 *  ٢. **لا محفّزَ اسمُه «إدخال»** (ق-١١): `NotificationTrigger` اتحادٌ من أربعٍ ليس فيها
 *     إدخالٌ يوميّ — فالإشعارُ «عند كل إدخال» لا نوعَ له أصلاً.
 *  ٣. **الحمولةُ مهيكلةٌ لا نصٌّ خام** (ق-٧٥): خلاصةٌ ومبلغٌ ونتيجةٌ وسببٌ حقولٌ مسمّاة،
 *     والحالةُ تولد `queued` — فلا مسارَ يُنشئ إشعاراً «مُسلَّماً» يتجاوز الطابور.
 *  ٤. **المفتاحُ الطبيعيُّ ركنٌ في الكيان** (ت-٨/ت-٩): يُخزَّن مع الإشعار فيستحيل إشعارٌ بلا
 *     مفتاحٍ يمنع تكراره.
 *
 * **ولا حقلَ مزوّدِ قناةٍ هنا**: القناةُ معرّفٌ ومعرّفٌ خارجيّ، والبروتوكولُ خلف منفذٍ محقون
 * (ت-١٦ — الوحدةُ تعرف **أنّ** التسليم تمّ ولا تعرف **كيف**).
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"

/**
 * قنواتُ الإيصال الثلاث (ق-٧٥/ت-١٦) — **الاتحادُ هنا للأمان النوعيّ، والقائمةُ الحاكمةُ
 * تُشتقّ من سجل الإعدادات** (`notify.channels.enabled.allowed` — CR-011/قب-٣٦)؛ واختبارٌ
 * يطابق الاثنين فلا يتباعدان.
 */
export type ChannelId = "bell" | "telegram" | "push"

/**
 * محفّزُ نوع الإشعار — **أربعةٌ لا خامسَ لها، وليس فيها «إدخال»** (ق-١١):
 * التقديمُ (لا كلُّ إدخال) · التذكيرُ الدوريّ · نتيجةُ فعلٍ لصاحبه · الإعلان.
 */
export type NotificationTrigger = "submission" | "reminder" | "outcome" | "announcement"

/** نوعُ الإشعار — **كيانُ بياناتٍ مرجعيّ** (قب-٢٢): يُدار بياناً لا نشراً. */
export type NotificationKind = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly trigger: NotificationTrigger
  /** الإيقافُ بيانٌ لا حذف (المادة ٧/٤). */
  readonly active: boolean
}

/** إسقاطُ الوحدة في هذه الوحدة: معرّفٌ ومسارٌ واسم — لا شجرةَ تنظيمٍ موازية. */
export type NotificationUnit = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly path: string
}

/** مبلغُ الحمولة (ق-٧٥ إشعاراتُ المال) — بالسنت الصحيح وعملتِه (ق-٤٨). */
export type PayloadAmount = {
  readonly minor: number
  readonly currency: string
}

/** الحمولةُ المهيكلة (ق-٧٥) — ونوعُها على الكيان نفسِه فلا تتكرّر حقيقةٌ (ق-١١١). */
export type NotificationPayload = {
  readonly summaryAr: string
  readonly amount: PayloadAmount | null
  readonly outcomeAr: string | null
  readonly reasonAr: string | null
}

/** مدخلُ الحمولة كما يصل من الوحدة المُصدِّرة — الاختياريُّ فيه يُملأ `null` لا يُحذف. */
export type NotificationPayloadInput = {
  readonly summaryAr: string
  readonly amount?: PayloadAmount | null
  readonly outcomeAr?: string | null
  readonly reasonAr?: string | null
}

/**
 * الجمهور (§٢.٢) — **شكلان لا ثالثَ لهما**:
 *  - `capabilityOnScope`: نطاقٌ وقدرةٌ ⟵ **يُسأل عنهما المحرّك** (ق-١١ الطبقةُ الأقرب،
 *    ق-٢٥ وحدةُ صاحب التكليف). والقدرةُ **تصل بياناً من الحدث** فلا تسمّيها هذه الوحدة.
 *  - `person`: صاحبُ الفعل يُشعَر بنتيجة فعله.
 */
export type NotificationAudience =
  | { readonly mode: "capabilityOnScope"; readonly scopePath: string; readonly capability: CapId }
  | { readonly mode: "person"; readonly personId: string }

/** حالُ الإشعار — يولد `queued` دائماً (ق-٧٥) ولا يُنشأ مقروءاً. */
export type NotificationStatus = "queued" | "read"

export type Notification = {
  readonly tenantId: string
  readonly id: string
  /** المستهدَفُ — **جوابُ المحرّك** لا اختيارُ الوحدة (§٢). */
  readonly personId: string
  readonly kindId: string
  /** الكيانُ المُشعَر عنه — ركنُ المفتاح الطبيعيّ. */
  readonly refId: string
  /** نافذةُ التكرار — الركنُ الرابع (ت-٩): تذكيرٌ مرةً في كل نافذة لا في كل تشغيل. */
  readonly windowKey: string
  /** `شخص|نوع|مرجع|نافذة` — **مخزَّنٌ لا محسوبٌ في كل قراءة** (ت-٨). */
  readonly naturalKey: string
  readonly payload: NotificationPayload
  readonly status: NotificationStatus
  readonly queuedAt: Date
  readonly readAt: Date | null
}

/** حالُ التسليم على قناةٍ بعينها — الفشلُ **يُعلَن ولا يُبتلع** (ت-٨). */
export type DeliveryStatus = "queued" | "delivered" | "failed"

export type ChannelDelivery = {
  readonly tenantId: string
  readonly id: string
  readonly notificationId: string
  readonly channel: ChannelId
  readonly status: DeliveryStatus
  readonly attempts: number
  readonly lastErrorAr: string | null
}

/** رمزُ ربطِ قناةٍ — **عمرُه من الإعداد** (ع-١٦)، ويُستهلك مرةً واحدة. */
export type ChannelLinkToken = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly channel: ChannelId
  readonly issuedAt: Date
  readonly expiresAt: Date
  /** المدةُ المضبوطة لحظةَ الإصدار — **تُحفظ لتَشرحها الرسالة** (ع-١٦). */
  readonly ttlMinutes: number
  readonly consumedAt: Date | null
}

/** قناةٌ مربوطةٌ لشخص — **ملكيةٌ لا يُستولى عليها** (خ-٣). */
export type LinkedChannel = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly channel: ChannelId
  /** معرّفُ القناة عند مزوّدها (`chatId` / اشتراكُ المتصفح) — لا يحمل سرّاً. */
  readonly externalId: string
  readonly linkedAt: Date
}

/**
 * جمهورُ الإعلان (ح-٥) — **شكلُ نطاقٍ لا قائمةُ أدوار**:
 * `subtree` النطاقُ وما تحته · `unit` الوحدةُ بعينها.
 */
export type AnnouncementAudience = "subtree" | "unit"

export type Announcement = {
  readonly tenantId: string
  readonly id: string
  readonly titleAr: string
  readonly bodyAr: string
  readonly unitId: string
  /** نطاقُ الإعلان — **مشتقٌّ من الوحدة المخزَّنة** لا من مدخل العميل. */
  readonly scopePath: string
  readonly audience: AnnouncementAudience
  readonly publisherPersonId: string
  readonly publishedAt: Date
}

/** رمزُ خطأٍ خاصٌّ بهذه الوحدة — §٩ من عقد الوحدة. */
export type NotificationErrorCode =
  | "UNKNOWN_NOTIFICATION_KIND"
  | "KIND_INACTIVE"
  | "EMPTY_SUMMARY"
  | "NO_TARGETS"
  | "NOTIFICATION_NOT_FOUND"
  | "NOT_NOTIFICATION_OWNER"
  | "LINK_TTL_UNSET"
  | "LINK_TOKEN_UNKNOWN"
  | "LINK_TOKEN_EXPIRED"
  | "LINK_TOKEN_CONSUMED"
  | "LINK_TOKEN_NOT_OWNER"
  | "LINK_PROOF_REQUIRED"
  | "CHANNEL_NOT_ENABLED"
  | "CHANNEL_NOT_LINKABLE"
  | "CHANNEL_OWNED_BY_ANOTHER"
  | "UNKNOWN_ANNOUNCEMENT_UNIT"
  | "EMPTY_ANNOUNCEMENT"
  | "ANNOUNCEMENT_NOT_FOUND"
  | "OUT_OF_ANNOUNCEMENT_AUDIENCE"

export type NotificationError = {
  readonly code: NotificationErrorCode
  /** تفصيلٌ **يشرح** لا يُبهم — ومنه مدةُ صلاحية الرمز (ع-١٦). */
  readonly detail?: string
}

export type NotificationOk<T> = { readonly ok: true; readonly value: T }
export type NotificationErr = { readonly ok: false; readonly error: NotificationError }
export type NotificationResult<T> = NotificationOk<T> | NotificationErr

export function notifyOk<T>(value: T): NotificationOk<T> {
  return { ok: true, value }
}

export function notifyErr(code: NotificationErrorCode, detail?: string): NotificationErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
