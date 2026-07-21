/**
 * سياقُ خدمات اللجان — «حقنٌ لا استيرادٌ مبعثر» (`SPEC_settings` §١-٨، قب-٦).
 *
 * الساعةُ والإعداداتُ **تُحقنان** فلا تُقرأ ساعةٌ من داخل خدمة (حتميّة — TESTING_POLICY §٥)
 * ولا يُستورَد إعدادٌ مباشرةً. والفاعلُ **من الجلسة** يصل هنا معرّفاً وحده — **لا دورَ ولا
 * قدرةَ في هذه الطبقة**: القدرةُ تُفرَض عند حدّ الخادم بـ`can()` (المادة ٤/٤، G6).
 */

import type { SettingsResolver } from "../../../settings/resolver.js"

export type CommitteeContext = {
  readonly now: Date
  readonly actorPersonId: string
  readonly settings: SettingsResolver
}

/** مفتاحُ تفعيلٍ عالميّ: «التعطيل يُخفي الوحدة ولا يحذف بياناتها» (`SPEC_settings` §feature). */
function isFeatureOn(ctx: CommitteeContext, id: string, scopePath: string): boolean {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError(`الإعداد ${id} ليس مفتاحاً`)
  return value
}

/** قب-٧ — وحدةُ اللجان خلف مفتاحٍ إداريّ معلن (`feature.committees`). */
export function areCommitteesEnabled(ctx: CommitteeContext, scopePath: string): boolean {
  return isFeatureOn(ctx, "feature.committees", scopePath)
}

/** قب-٧ — وحدةُ الاجتماعات خلف مفتاحها المعلن (`feature.meetings`). */
export function areMeetingsEnabled(ctx: CommitteeContext, scopePath: string): boolean {
  return isFeatureOn(ctx, "feature.meetings", scopePath)
}

/** ق-٤٥/قب-٦ — أيُقبل تأريخُ إنجازٍ في المستقبل؟ **إعدادٌ حيّ** لا حكمٌ صلب. */
export function isFutureDatingAllowed(ctx: CommitteeContext, scopePath: string): boolean {
  const value = ctx.settings("records.allow_future_dating", scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError("الإعداد records.allow_future_dating ليس مفتاحاً")
  return value
}
