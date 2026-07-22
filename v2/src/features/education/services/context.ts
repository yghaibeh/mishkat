/**
 * سياقُ خدمات التعليم — «حقنٌ لا استيرادٌ مبعثر» (`SPEC_settings` §١-٨).
 *
 * والساعةُ والفاعلُ **من الطلب لا من داخل الدالة**: دالةٌ تقرأ `Date.now()` من داخلها ليست
 * حتمية ولا تُختبر (TESTING_POLICY §٥). وفيه **منفذُ الاعتماد** الذي يحفظ G22: تعرف الوحدةُ
 * أنّ درساً **معتمَد**، ولا تعرف **مَن اعتمده ولا بأيّ سلسلة ولا بأيّ حالة**.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { EducationPorts } from "./bindings.js"
import type { CircleDayPort, LessonApprovalCheck } from "./ports.js"

export type EducationContext = EducationPorts & {
  readonly now: Date
  /** الفاعلُ من الجلسة لا من مدخل العميل. */
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  readonly isLessonApproved: LessonApprovalCheck
  /** CR-016 — **الجلسةُ اليومية تُسأل ولا تُبنى**: كيانٌ واحدٌ موطنُه وحدةُ السجل اليوميّ. */
  readonly days: CircleDayPort
}

/** قراءةُ إعدادِ قائمة — والنوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤). */
export function settingList(ctx: EducationContext, id: string, scopePath: string): readonly string[] {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (!Array.isArray(value)) throw new TypeError(`الإعداد ${id} ليس قائمة`)
  return value as readonly string[]
}
