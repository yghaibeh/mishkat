/**
 * ق-٨ + ب-٣٩د — **القفلان**: قفلُ الاعتماد وقفلُ الزمن (عقدُ الوحدة §٥).
 *
 * - **قفلُ الاعتماد**: المعتمَدُ لا يُكتب عليه — حالةٌ في الكيان لا انضباطُ مستدعٍ.
 * - **القفلُ الزمنيّ**: مدّتُه **إعدادٌ حيّ** (`records.backdate_lock_days`، قب-٦) — **صفر
 *   رقمٍ في هذا الملفّ** (G14)؛ ورفعُ الإعداد وحده يغيّر السلوك بلا تغيير سطرِ كود.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { ApprovalPeriod, ApprovalRequest } from "../types.js"

export type LockingContext = {
  readonly now: Date
  readonly settings: SettingsResolver
}

function settingNumber(ctx: LockingContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}

function settingBoolean(ctx: LockingContext, id: string, scopePath: string): boolean {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "boolean") throw new TypeError(`الإعداد ${id} ليس مفتاحاً`)
  return value
}

/** طرحُ الأيام بحساب التقويم — بلا ثابتٍ زمنيٍّ صلبٍ في طبقة الخدمات (G14). */
function minusDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

/** ب-٣٩د: أمضت الفترةُ أكثرَ من مدة القفل الرجعيّ؟ */
export function isPeriodTimeLocked(
  ctx: LockingContext,
  unitPath: string,
  period: ApprovalPeriod,
): boolean {
  const days = settingNumber(ctx, "records.backdate_lock_days", unitPath)
  return period.endsAt.getTime() < minusDays(ctx.now, days).getTime()
}

/** ب-٣٠ج: هل السحبُ متاحٌ سياسةً؟ (**سياسةٌ تُضبط، لا حارسٌ يُعطَّل** — CR-008). */
export function isWithdrawalEnabled(ctx: LockingContext, unitPath: string): boolean {
  return settingBoolean(ctx, "approval.amir_can_withdraw", unitPath)
}

/** ب-٣٠ب: مدةُ التصعيد الإشعاريّ — **إشعارٌ لا صلاحية**. */
export function escalationDays(ctx: LockingContext, unitPath: string): number {
  return settingNumber(ctx, "approval.escalation_days", unitPath)
}

/** ق-٨: المعتمَدُ مقفلٌ — والقفلُ حالةٌ في الكيان تُقرأ بدالةٍ واحدة. */
export function isLocked(request: ApprovalRequest): boolean {
  return request.state === "approved" || request.lockedAt !== null
}
