/**
 * مستودعُ الإشعارات — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §١ و§٣ و§١٠).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان (ADR-001 §٦-١)، وهذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 دون تغيير سطرٍ في الخدمات.
 *
 * أربعةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **المفتاحُ الطبيعيُّ فهرسٌ لا فحصٌ يُنسى** (ت-٨): خريطةٌ من المفتاح إلى المعرّف، فلا
 *     يُنشأ إشعارٌ ثانٍ لحدثٍ واحد **ولو نسي المستدعي أن يسأل**.
 *  ٣. **لا محو**: ليس في هذا السطح دالةُ حذف؛ والقراءةُ **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٤. **لا أشخاصَ ولا إسنادات هنا**: مَن يُشعَر جوابُ المحرّك (§٢) — فليس في هذا المستودع
 *     مِقبضٌ يُستعلَم به عن الناس، ولا مكانَ لفلترٍ ثانٍ يتباعد عن `can()` (د-٢/د-٣).
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  Announcement,
  ChannelDelivery,
  ChannelId,
  ChannelLinkToken,
  LinkedChannel,
  Notification,
  NotificationKind,
  NotificationUnit,
} from "../types.js"

/** مفتاحُ القناة المملوكة: (قناةٌ · معرّفٌ خارجيّ) — أساسُ حارس خ-٣. */
function channelKey(channel: ChannelId, externalId: string): string {
  return `${channel}|${externalId}`
}

export class NotificationStore {
  private unitMap = new Map<string, NotificationUnit>()
  private kindMap = new Map<string, NotificationKind>()
  private notificationMap = new Map<string, Notification>()
  /** الفهرسُ الذي يجعل idempotency **بنيةً** لا انضباطاً (ت-٨). */
  private byNaturalKey = new Map<string, string>()
  private deliveryList: ChannelDelivery[] = []
  private tokenMap = new Map<string, ChannelLinkToken>()
  private channelMap = new Map<string, LinkedChannel>()
  private announcementMap = new Map<string, Announcement>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── المراجعُ: إسقاطُ الوحدات وكتالوجُ الأنواع ───────────────────────────────
  saveUnit(u: NotificationUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): NotificationUnit | null {
    return this.unitMap.get(id) ?? null
  }
  /** كلُّ الوحدات المسقَطة — **قراءةٌ لطبقة الاستمرار** (الإسقاط إلى D1) لا مسارُ عمل. */
  units(): readonly NotificationUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  saveKind(k: NotificationKind): void {
    this.kindMap.set(k.id, Object.freeze({ ...k, tenantId: this.tenantId }))
  }
  getKind(id: string): NotificationKind | null {
    return this.kindMap.get(id) ?? null
  }
  kinds(): readonly NotificationKind[] {
    return Object.freeze([...this.kindMap.values()])
  }

  // ── الطابورُ الموحّد ────────────────────────────────────────────────────────
  /** يعيد الموجودَ إن كان المفتاحُ الطبيعيُّ مستعملاً — **لا مضاعفة** (ت-٨). */
  findByNaturalKey(naturalKey: string): Notification | null {
    const id = this.byNaturalKey.get(naturalKey)
    return id === undefined ? null : (this.notificationMap.get(id) ?? null)
  }

  saveNotification(n: Notification): void {
    const stamped = Object.freeze({ ...n, tenantId: this.tenantId })
    this.notificationMap.set(stamped.id, stamped)
    this.byNaturalKey.set(stamped.naturalKey, stamped.id)
  }

  getNotification(id: string): Notification | null {
    return this.notificationMap.get(id) ?? null
  }

  notifications(): readonly Notification[] {
    return Object.freeze([...this.notificationMap.values()])
  }

  /** طابورُ شخصٍ بعينه — **بلا فلترِ أدوارٍ ولا استعلامٍ عن الناس**: مطابقةُ معرّفٍ فقط. */
  notificationsFor(ownerId: string): readonly Notification[] {
    return Object.freeze([...this.notificationMap.values()].filter((n) => n.personId === ownerId))
  }

  // ── سطورُ التسليم ───────────────────────────────────────────────────────────
  saveDelivery(d: ChannelDelivery): void {
    const stamped = Object.freeze({ ...d, tenantId: this.tenantId })
    const at = this.deliveryList.findIndex((x) => x.id === stamped.id)
    if (at === -1) this.deliveryList.push(stamped)
    else this.deliveryList[at] = stamped
  }

  deliveriesOf(notificationId: string): readonly ChannelDelivery[] {
    return Object.freeze(this.deliveryList.filter((d) => d.notificationId === notificationId))
  }

  deliveries(): readonly ChannelDelivery[] {
    return Object.freeze([...this.deliveryList])
  }

  // ── رموزُ الربط والقنوات المربوطة ───────────────────────────────────────────
  saveToken(t: ChannelLinkToken): void {
    this.tokenMap.set(t.id, Object.freeze({ ...t, tenantId: this.tenantId }))
  }
  tokenById(id: string): ChannelLinkToken | null {
    return this.tokenMap.get(id) ?? null
  }
  tokens(): readonly ChannelLinkToken[] {
    return Object.freeze([...this.tokenMap.values()])
  }

  saveChannel(c: LinkedChannel): void {
    this.channelMap.set(
      channelKey(c.channel, c.externalId),
      Object.freeze({ ...c, tenantId: this.tenantId }),
    )
  }
  /** **حارسُ خ-٣ في طبقة البيانات**: المعرّفُ الخارجيّ مفتاحٌ فلا يحمله اثنان. */
  channelByExternalId(channel: ChannelId, externalId: string): LinkedChannel | null {
    return this.channelMap.get(channelKey(channel, externalId)) ?? null
  }
  channelsOf(ownerId: string): readonly LinkedChannel[] {
    return Object.freeze([...this.channelMap.values()].filter((c) => c.personId === ownerId))
  }
  /** كلُّ القنوات المربوطة — **قراءةٌ لطبقة الاستمرار** (الإسقاط إلى D1) لا مسارُ عمل. */
  channels(): readonly LinkedChannel[] {
    return Object.freeze([...this.channelMap.values()])
  }

  // ── الإعلانات ───────────────────────────────────────────────────────────────
  saveAnnouncement(a: Announcement): void {
    this.announcementMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  getAnnouncement(id: string): Announcement | null {
    return this.announcementMap.get(id) ?? null
  }
  announcements(): readonly Announcement[] {
    return Object.freeze([...this.announcementMap.values()])
  }
}
