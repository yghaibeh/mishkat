/**
 * سياقُ خدمات السجلّ اليوميّ — «حقنٌ لا استيرادٌ مبعثر» (`SPEC_settings` §١-٨).
 *
 * أربعةٌ تُحقن ولا تُستورد، وكلٌّ منها لسببٍ مكتوب:
 *  - **الساعة**: دالةٌ تقرأ `Date.now()` من داخلها ليست حتمية ولا تُختبر (TESTING_POLICY §٥).
 *  - **الفاعل**: من الجلسة لا من مدخل العميل — فلا يُسجَّل باسم غيرِك.
 *  - **الإعدادات**: كلُّ حدٍّ ونسبةٍ وعمرٍ من السجل المركزيّ (قب-٦/G14) — **صفر رقمٍ هنا**.
 *  - **نموذجُ الحلقات**: منفذٌ يُسأل ولا يُستنسَخ (§١) — ولا مِقبضَ كتابةٍ فيه.
 *  - **ومولّدُ الرمز**: العشوائيةُ خارج الخدمة، فيبقى الرمزُ في الاختبار حتمياً وفي الإنتاج آمناً.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { CircleModelPort } from "./circleModel.js"

export type TahfeezLogContext = {
  readonly now: Date
  /** الفاعلُ **من الجلسة** لا من مدخل العميل. */
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  readonly circles: CircleModelPort
  /** مولّدُ رمز وليّ الأمر — يُحقن فلا عشوائيّةَ داخل الخدمة (ق-٩٣). */
  readonly newToken: () => string
}

/** قراءةُ إعدادٍ رقميّ — والنوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤). */
export function settingNumber(ctx: TahfeezLogContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}

export function settingBoolean(ctx: TahfeezLogContext, id: string, scopePath: string): boolean {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError(`الإعداد ${id} ليس مفتاحاً`)
  return value
}

export function settingText(ctx: TahfeezLogContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}
