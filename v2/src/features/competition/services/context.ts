/**
 * سياقُ خدمات المسابقة — **الساعةُ والإعداداتُ والمفاتيحُ تُحقن ولا تُستورد**: دالةٌ تقرأ
 * `Date.now()` أو تستورد السجلَّ من داخلها ليست حتمية ولا تُختبر (TESTING_POLICY §٥،
 * `SPEC_settings` §١-٨: «حقنٌ لا استيرادٌ مبعثر»).
 *
 * **والفاعلُ من الجلسة لا من المدخل**: `actorPersonId` هو مَن يُنشئ ومَن يبتّ ومَن يرصد —
 * فلا يُنسب فعلٌ لغير صاحبه ولو مرّر العميلُ معرّفاً آخر.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"

export type CompetitionContext = {
  readonly now: Date
  readonly actorPersonId: string
  /** مُحلِّلُ الإعدادات — **كلُّ رقمٍ تشغيليٍّ في هذه الوحدة يأتي منه** (قب-٦، G14). */
  readonly settings: SettingsResolver
  readonly isFeatureEnabled: (flagId: string) => boolean
}
