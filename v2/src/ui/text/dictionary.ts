/**
 * طبقة النصوص المركزية — المادة ٢/٦ + SPEC_design_system §٥.
 *
 * مصدرٌ واحدٌ لكل حرفٍ يراه المستخدم: القواميسُ المجالية تُدمَج هنا، **والتصادمُ يُرفض
 * صراحةً** (مفتاحٌ يُعرَّف مرتين خطأُ مصدرٍ مزدوج — المادة ١/٢، لا سكوتَ عليه بالكتابة فوقه).
 */

import { COMMON, SHELL, STATES, AMIR_HOME, ORG, LEDGER, BOX, DAILY_LOG } from "./domains.js"
// قاموسُ وحدةٍ يعيش **في وحدتها** ويُدمج هنا (قب-٣١ §٣: نصوصُ الوحدة لا في ملفٍّ مشترك)؛
// والدمجُ يبقى في موضعٍ واحد فيُفحص التصادمُ لكل المفاتيح معاً.
import { CUSTODY } from "../../features/custody/text.js"

const DOMAINS = [COMMON, SHELL, STATES, AMIR_HOME, ORG, LEDGER, BOX, DAILY_LOG, CUSTODY] as const

const SOURCE = {
  ...COMMON,
  ...SHELL,
  ...STATES,
  ...AMIR_HOME,
  ...ORG,
  ...LEDGER,
  ...BOX,
  ...DAILY_LOG,
  ...CUSTODY,
} as const

export type TextKey = keyof typeof SOURCE

/** يكشف تصادمَ المفاتيح بين القواميس بدل الكتابة الصامتة فوقها. */
function assertNoCollision(domains: readonly Readonly<Record<string, string>>[]): void {
  const seen = new Set<string>()
  for (const domain of domains) {
    for (const key of Object.keys(domain)) {
      if (seen.has(key)) throw new Error(`مفتاحُ نصٍّ مكرَّرٌ في قاموسين: ${key}`)
      seen.add(key)
    }
  }
}
assertNoCollision(DOMAINS)

export const TEXT: Readonly<Record<TextKey, string>> = Object.freeze(SOURCE)
export const TEXT_KEYS: readonly TextKey[] = Object.freeze(Object.keys(SOURCE) as TextKey[])

/** يحلّ المفتاحَ إلى عربيّته المدقَّقة — المكوّنُ لا يحمل حرفاً. */
export function t(key: TextKey): string {
  return TEXT[key]
}

export { assertNoCollision as assertNoTextKeyCollision }
