/**
 * سياقُ خدمات المكتبة — **يُحقن ولا يُستورد** (`SPEC_settings` §١-٨).
 *
 * الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ محقونةٌ (فلا رقمَ صلب — قب-٦)، ومعها
 * سؤالان لا تجيبهما هذه الوحدة بنفسها: **انتماءُ الجمهور** (يُسأل للمحرّك — §٢)
 * و**بلوغُ النطاق** (يُقاس بمسار التكليف — §٦)، ومنفذُ **«مَن في هذا النطاق؟»**.
 * فالخدمةُ لا تعرف دوراً ولا تستورد محرّكاً ولا وحدةً أخرى.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { AudienceMembership } from "./audience.js"
import type { ScopeReach } from "./directory.js"
import type { LibraryPorts } from "./ports.js"

export type LibraryContext = {
  readonly now: Date
  /** **الفاعلُ من الجلسة** — كلُّ خَتمةٍ تُكتب بهذا لا بما في المدخل. */
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  readonly inAudience: AudienceMembership
  readonly reaches: ScopeReach
  readonly ports: LibraryPorts
}

/** قراءةُ إعدادٍ رقميّ — والنوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤). */
export function settingNumber(ctx: LibraryContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}

/** قراءةُ إعدادٍ نصّيّ (المنطقة الزمنية) — بالحارس نفسِه. */
export function settingText(ctx: LibraryContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}
