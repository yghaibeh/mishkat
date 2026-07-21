/**
 * سياقُ خدمات سجل اليوم — «حقنٌ لا استيرادٌ مبعثر» (`SPEC_settings` §١-٨).
 *
 * وفيه **منفذُ القفل** (`isPeriodLocked`) وهو موضعُ الفصل الذي يحفظ G22: هذه الوحدة تعرف
 * أنّ فترةً **مقفلةٌ للكتابة**، ولا تعرف **مَن أقفلها ولا بأيّ سلسلةٍ ولا بأيّ حالة** — فلا
 * مفردةَ اعتمادٍ واحدةٌ فيها. والمُنفِّذُ الحقيقيُّ لهذا المنفذ يعيش **داخل مجلد المحرّك**
 * (`approval/registered/weeklyRecord.ts`)، فيبقى منطقُ الاعتماد في موضعه الواحد.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"

/** «أهذه الفترةُ مقفلةٌ للكتابة على هذه الوحدة؟» — سؤالٌ عن **حالٍ** لا عن **سلسلة**. */
export type PeriodLockCheck = (unitPath: string, periodKey: string) => boolean

export type DailyLogContext = {
  readonly now: Date
  /** الفاعلُ من الجلسة لا من المدخل. */
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  readonly isPeriodLocked: PeriodLockCheck
}

/** قراءةُ إعدادٍ رقميّ — والنوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤). */
export function settingNumber(ctx: DailyLogContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}

export function settingBoolean(ctx: DailyLogContext, id: string, scopePath: string): boolean {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError(`الإعداد ${id} ليس مفتاحاً`)
  return value
}

export function settingText(ctx: DailyLogContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}
