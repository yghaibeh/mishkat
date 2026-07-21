/**
 * الخطُّ المُضمَّن — قب-٢٠ م-٢ («عصريّ هندسيّ») + المادة ٢ (**لا CDN**).
 *
 * الخطُّ أصلٌ في الشجرة بصيغة `data:` لا طلبٌ شبكيّ: عمّالُ الميدان على شبكاتٍ ضعيفة
 * (§٤-٣)، والاعتمادُ على مستضيفٍ خارجيّ يجعل الهويةَ رهينةَ اتصالٍ ورقابةٍ وخصوصية.
 *
 * **شريحةُ العربية وحدها** (٣٠ ك.ب) قرارٌ مقصود: الواجهةُ عربيةٌ كاملةً وأرقامُها
 * عربية-هندية، فاللاتينيّ النادرُ يسقط بأمانٍ إلى `system-ui` من رصّة العائلة — إضافةُ
 * شريحةٍ لاتينية كانت ستضاعف الحمولةَ لخدمة الحرف النادر (§٤-٣ الأداء على الجوال).
 *
 * الخطُّ متغيّرُ الوزن (٢٠٠–١٠٠٠) فملفٌّ واحدٌ يخدم الأوزانَ الثلاثة (§١-٤).
 */

import embedded from "./font.embedded.json"

export type EmbeddedFont = {
  readonly family: string
  readonly license: string
  readonly licenseUrl: string
  readonly sourceNote: string
  readonly weightRange: string
  readonly unicodeRange: string
  readonly format: string
  /** `data:font/woff2;base64,…` — مُضمَّنٌ في الورقة، صفرُ طلبٍ شبكيّ. */
  readonly dataUri: string
}

export const EMBEDDED_FONT: EmbeddedFont = {
  family: embedded.family,
  license: embedded.license,
  licenseUrl: embedded.licenseUrl,
  sourceNote: embedded.sourceNote,
  weightRange: embedded.weightRange,
  unicodeRange: embedded.unicodeRange,
  format: embedded.format,
  dataUri: `data:font/woff2;base64,${embedded.base64}`,
}
