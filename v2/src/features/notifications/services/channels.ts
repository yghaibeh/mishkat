/**
 * ع-١٦ + خ-٣ — **القنوات: عمرٌ معلنٌ يشرح نفسه، وملكيةٌ لا يُستولى عليها** (عقدُ الوحدة §٤).
 *
 * ثلاثةُ دروسٍ مدفوعةِ الثمن تعيش في هذا الملف:
 *  ١. **ع-١٦** (بلاغُ ميدانٍ): «رابط منتهٍ أو غير صحيح» **قبل** الاستخدام. الجذرُ أن العمرَ
 *     لم يكن معلناً ولا مشروحاً. فالعمرُ هنا **إعدادٌ حيّ**، والرسالةُ **تحمل المدة**،
 *     وغيرُ المضبوط **يُقفل ولا يُفتح** (نظيرُ `NO_SCOPE`).
 *  ٢. **خ-٣** (ثغرةٌ حمراء في v1): ربطُ القناة كان يكتب صاحبَها على **معرّفٍ قائم**، فمن
 *     يعرف معرّفَ غيره ينقل ملكيتَه أو يقطعها. فالملكيةُ هنا **تُتحقَّق قبل كل ربط**،
 *     والمعرّفُ الخارجيّ **مفتاحٌ في المستودع** فلا يحمله اثنان.
 *  ٣. **CR-011/قب-٣٦**: قائمةُ القنوات **تُشتقّ من سجل الإعدادات ولا تُسرد** — والاتحادُ
 *     النوعيُّ يُطابَق بالسجل **زمنَ التحميل**، فمصدران متباعدان يُعلنان فوراً لا بعد حين.
 */

import { ROOT_PATH } from "../../../authorization/scope.js"
import { SETTINGS_BY_ID } from "../../../settings/registry.js"
import type { NotificationStore } from "../data/store.js"
import { settingList, settingNumberOrNull, type NotificationContext } from "./context.js"
import {
  notifyErr,
  notifyOk,
  type ChannelId,
  type LinkedChannel,
  type NotificationResult,
} from "../types.js"

/** معرّفا الإعدادين الحاكمين — القيمُ من السجل لا من هنا (قب-٦/G14). */
export const CHANNELS_SETTING = "notify.channels.enabled"
export const LINK_TTL_SETTING = "notify.telegram_link_ttl_minutes"

/** أعضاءُ الاتحاد النوعيّ — يُطابَقون بالسجل فوراً (وإلا فمصدرا حقيقةٍ يتباعدان). */
const UNION_MEMBERS: Readonly<Record<ChannelId, true>> = Object.freeze({
  bell: true,
  telegram: true,
  push: true,
})

/**
 * فرقُ ما بين مصدرَي الحقيقة — **مُصدَّرٌ كي يُختبَر**: حارسٌ لا يُجرَّب على مدخلٍ متباعدٍ
 * فعليّ ليس حارساً بل نيّة (المادة ٠ · قب-١٥: البوابةُ تُثبَت بالفشل لا تُدّعى).
 */
export function channelDrift(
  registered: readonly string[],
  declared: readonly string[],
): readonly string[] {
  return [
    ...registered.filter((c) => !declared.includes(c)),
    ...declared.filter((c) => !registered.includes(c)),
  ]
}

function mirroredChannels(): readonly ChannelId[] {
  const registered = SETTINGS_BY_ID.get(CHANNELS_SETTING)?.allowed ?? []
  const drift = channelDrift(registered, Object.keys(UNION_MEMBERS))
  if (drift.length > 0) {
    throw new Error(`قاموسُ القنوات في السجل واتحادُ الكود تباعدا: ${drift.join("، ")}`)
  }
  return Object.freeze([...registered] as ChannelId[])
}

/** القاموسُ المغلقُ **مشتقٌّ من السجل** — لا قائمةَ ثانيةً في هذه الوحدة (CR-011). */
export const CHANNEL_IDS: readonly ChannelId[] = mirroredChannels()

/** الجرسُ داخل التطبيق: متاحٌ لكل مسجَّلٍ بحكم كونه في التطبيق، **ولا يُربط بمعرّفٍ خارجيّ**. */
export const IN_APP_CHANNEL: ChannelId = "bell"

/**
 * قنواتٌ يلزمها **إثباتُ حيازة**: معرّفُ تيليغرام يصل من **خارج الجلسة** (من البوت)، فيلزم
 * رمزٌ يثبت أنك أنت؛ أمّا اشتراكُ المتصفح فيُولَد **داخل الجلسة** نفسِها. الفارقُ **معلنٌ
 * هنا في ثابتٍ واحد** لا مبثوثٌ في فروع.
 */
export const PROOF_REQUIRED_CHANNELS: readonly ChannelId[] = Object.freeze(["telegram"])

function isChannelId(value: string): value is ChannelId {
  return (CHANNEL_IDS as readonly string[]).includes(value)
}

/** القنواتُ المفعَّلة على نطاقٍ — **من الإعداد الحيّ** ومصفّاةٌ بالقاموس المشتقّ. */
export function enabledChannels(
  ctx: NotificationContext,
  scopePath: string = ROOT_PATH,
): readonly ChannelId[] {
  return Object.freeze(settingList(ctx, CHANNELS_SETTING, scopePath).filter(isChannelId))
}

/** جمعُ دقائقَ إلى لحظة — **بجبر التقويم لا بثابتٍ زمنيٍّ مكتوب** (G14). */
function addMinutes(at: Date, minutes: number): Date {
  const out = new Date(at.getTime())
  out.setUTCMinutes(out.getUTCMinutes() + minutes)
  return out
}

export type IssuedLink = {
  readonly token: string
  readonly expiresAt: Date
  /** المدةُ المضبوطة — **تُعرض وتُشرح** لا تُخمَّن (ع-١٦). */
  readonly ttlMinutes: number
}

/**
 * ع-١٦ — إصدارُ رمز ربط تيليغرام بعمرٍ **من الإعداد**.
 * والإعدادُ مسجَّلٌ **بلا افتراضيٍّ عمداً** (ق-م-٢: «يُملأ من الإنتاج لا باختراع رقم») ⇒
 * غيرُ المضبوط يعني **لا رمز**: `LINK_TTL_UNSET` — يُقفل ولا يُفتح.
 */
export function startTelegramLink(
  store: NotificationStore,
  ctx: NotificationContext,
): NotificationResult<IssuedLink> {
  const ttlMinutes = settingNumberOrNull(ctx, LINK_TTL_SETTING, ROOT_PATH)
  if (ttlMinutes === null) return notifyErr("LINK_TTL_UNSET", LINK_TTL_SETTING)

  const token = store.nextId("lnk")
  const expiresAt = addMinutes(ctx.now, ttlMinutes)
  store.saveToken({
    tenantId: store.tenantId,
    id: token,
    personId: ctx.actorPersonId,
    channel: "telegram",
    issuedAt: ctx.now,
    expiresAt,
    ttlMinutes,
    consumedAt: null,
  })
  return notifyOk({ token, expiresAt, ttlMinutes })
}

export type LinkChannelInput = {
  readonly channel: ChannelId
  readonly externalId: string
  /** رمزُ إثبات الحيازة — `null` لقناةٍ يُولَد معرّفُها داخل الجلسة. */
  readonly token: string | null
}

/**
 * خ-٣ — ربطُ قناةٍ بمعرّفٍ خارجيّ. **ترتيبُ الحرّاس مقصود**:
 * التفعيلُ ثم القابليةُ للربط ثم **الملكية** ثم إثباتُ الحيازة — فلا يُستهلَك رمزٌ في فعلٍ
 * مرفوضٍ أصلاً، ولا يُكشف بالرسائل أنّ معرّفاً مملوكٌ لمن لم يجتز الحارسَ الأول.
 */
export function linkChannel(
  store: NotificationStore,
  ctx: NotificationContext,
  input: LinkChannelInput,
): NotificationResult<LinkedChannel> {
  if (!enabledChannels(ctx).includes(input.channel)) {
    return notifyErr("CHANNEL_NOT_ENABLED", input.channel)
  }
  if (input.channel === IN_APP_CHANNEL) return notifyErr("CHANNEL_NOT_LINKABLE", input.channel)

  const existing = store.channelByExternalId(input.channel, input.externalId)
  if (existing !== null && existing.personId !== ctx.actorPersonId) {
    return notifyErr("CHANNEL_OWNED_BY_ANOTHER", input.channel)
  }
  // **عمليةٌ خاملة**: ربطُ ما تملكه أصلاً لا يُنشئ سطراً ثانياً ولا يستهلك رمزاً.
  if (existing !== null) return notifyOk(existing)

  if (PROOF_REQUIRED_CHANNELS.includes(input.channel)) {
    const proof = consumeToken(store, ctx, input)
    if (!proof.ok) return proof
  }

  const linked: LinkedChannel = {
    tenantId: store.tenantId,
    id: store.nextId("chn"),
    personId: ctx.actorPersonId,
    channel: input.channel,
    externalId: input.externalId,
    linkedAt: ctx.now,
  }
  store.saveChannel(linked)
  return notifyOk(linked)
}

/**
 * ع-١٦ — استهلاكُ الرمز: أسبابُ الرفض **مُشخِّصةٌ متمايزة** (مجهولٌ · منتهٍ · مستعملٌ ·
 * لغيرك)، و**المنتهي يحمل المدةَ المضبوطة** في تفصيله فتشرحها الرسالةُ للمستخدم.
 */
function consumeToken(
  store: NotificationStore,
  ctx: NotificationContext,
  input: LinkChannelInput,
): NotificationResult<true> {
  if (input.token === null) return notifyErr("LINK_PROOF_REQUIRED", input.channel)

  const token = store.tokenById(input.token)
  if (token === null || token.channel !== input.channel) {
    return notifyErr("LINK_TOKEN_UNKNOWN", input.channel)
  }
  if (token.personId !== ctx.actorPersonId) return notifyErr("LINK_TOKEN_NOT_OWNER", input.channel)
  if (token.consumedAt !== null) return notifyErr("LINK_TOKEN_CONSUMED", input.channel)
  if (ctx.now.getTime() >= token.expiresAt.getTime()) {
    return notifyErr("LINK_TOKEN_EXPIRED", String(token.ttlMinutes))
  }

  store.saveToken({ ...token, consumedAt: ctx.now })
  return notifyOk(true)
}

/** قنواتُ صاحبها المربوطة — **ملكيةٌ لا نطاق**. */
export function myChannels(
  store: NotificationStore,
  ctx: NotificationContext,
): readonly LinkedChannel[] {
  return Object.freeze(
    [...store.channelsOf(ctx.actorPersonId)].sort((a, b) => a.id.localeCompare(b.id)),
  )
}

/**
 * قنواتُ **إيصالِ** شخصٍ: المفعَّلةُ ∩ (الجرسُ دائماً + ما ربطه). وهي المكانُ الوحيد الذي
 * يُقرَّر فيه «أيَّ القنوات تصله» — فالمنطقُ **واحدٌ فوق الواجهة** لا فرعٌ لكل قناة.
 */
export function deliveryChannelsFor(
  store: NotificationStore,
  ctx: NotificationContext,
  ownerId: string,
): readonly ChannelId[] {
  const enabled = enabledChannels(ctx)
  const linked = new Set(store.channelsOf(ownerId).map((c) => c.channel))
  return Object.freeze(enabled.filter((c) => c === IN_APP_CHANNEL || linked.has(c)))
}
