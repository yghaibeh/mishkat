/**
 * سياقُ خدمات الإعلام — **يُحقن ولا يُستورد** (`SPEC_settings` §١-٨).
 *
 * الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ محقونةٌ (فلا رقمَ صلب — قب-٦)،
 * ومعها سؤالان لا تجيبهما هذه الوحدة بنفسها: **مدى النشر** (يُسأل للمحرّك — §٢.٢)
 * و**الواجهاتُ المستعارة** (§٥). فالخدمةُ لا تعرف دوراً ولا تستورد محرّكاً ولا وحدةً أخرى.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { PublishingScopeCheck } from "./scope.js"
import type { MediaPorts } from "./ports.js"

export type MediaContext = {
  readonly now: Date
  readonly settings: SettingsResolver
  /** **الفاعلُ من الجلسة** — كلُّ فعلٍ شخصيٍّ يُكتب بهذا لا بما في المدخل. */
  readonly actorPersonId: string
  readonly publishingScope: PublishingScopeCheck
  readonly ports: MediaPorts
}
