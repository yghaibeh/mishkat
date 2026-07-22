/**
 * سياقُ خدمات الإشعارات — **يُحقن ولا يُستورد** (`SPEC_settings` §١-٨).
 *
 * الساعةُ من الطلب (فلا مؤقّتَ ولا `Date.now()` — عقدُ الوحدة §١١)، والفاعلُ من الجلسة،
 * والإعداداتُ محقونةٌ (فلا رقمَ صلب — قب-٦)، ومعها **سؤالُ المحرّك** (§٢) و**منفذا الإسناد**
 * (§٥). فالخدمةُ لا تعرف دوراً ولا تستورد محرّكاً ولا وحدةً أخرى.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { CapabilityAnswer } from "./targeting.js"
import type { NotificationPorts } from "./ports.js"

export type NotificationContext = {
  readonly now: Date
  readonly settings: SettingsResolver
  /** **الفاعلُ من الجلسة** — كلُّ فعلٍ شخصيٍّ يُكتب بهذا لا بما في المدخل. */
  readonly actorPersonId: string
  /** «هل يملك هذا الشخصُ هذه القدرةَ على هذا النطاق؟» — الجوابُ للمحرّك وحده (§٢). */
  readonly holdsCapability: CapabilityAnswer
  readonly ports: NotificationPorts
}

/** قيمةُ إعدادٍ عدديّة، أو `null` إن كان **غيرَ مضبوطٍ بلا افتراضيّ** (ق-م-٢). */
export function settingNumberOrNull(
  ctx: NotificationContext,
  settingId: string,
  scopePath: string,
): number | null {
  try {
    const value = ctx.settings(settingId, scopePath, ctx.now)
    return typeof value === "number" ? value : null
  } catch {
    return null
  }
}

/** قيمةُ إعدادٍ قائمةً — والفارغُ فراغٌ لا انفجار. */
export function settingList(
  ctx: NotificationContext,
  settingId: string,
  scopePath: string,
): readonly string[] {
  const value = ctx.settings(settingId, scopePath, ctx.now)
  return Array.isArray(value) ? value : []
}
