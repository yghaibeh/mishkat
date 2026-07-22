/**
 * قاموسُ الإشعارات والإعلانات — نصوصُ الوحدة **داخل وحدتها** (قب-٣١ §٣-أ)، ويُدمَج في طبقة
 * النصوص المركزية بسطر تسجيلٍ واحد (المادة ٢/٦ + `SPEC_design_system` §٥-٢).
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً**: فلا نصَّ عربياً في شاشة (يُفشله G20).
 * **ومفرداتُ الميدان لا مفرداتُ النظام**: «قرأتُه · أربط تيليغرام · أنشرُ إعلاناً» — ولا
 * «لا بيانات» ولا «طابور» ولا «قناة تسليم» في وجه المستخدم.
 *
 * **وع-١٦ نصّاً**: رسالةُ الرمز المنتهي **تشرح المدة** — والمدةُ تصل من الخادم قيمةً
 * (تفصيلُ الخطأ) لا رقماً مكتوباً هنا (قب-٦/G14).
 */

export const NOTIFY = {
  "notify.heading": "ما وصلني",
  "notify.unreadHeading": "ما ينتظر نظرك",
  "notify.scopeNote": "هذه إشعاراتُك أنت وحدك",
  "notify.kind": "نوعُ الإشعار",
  "notify.summary": "الخلاصة",
  "notify.when": "متى وصل",
  "notify.markRead": "قرأتُه",
  "notify.emptyInbox": "لم يصلك إشعارٌ بعد",
  "notify.emptyOwner": "لا شيءَ عليك الآن — لا إشعارَ ينتظرك",
  "notify.channelsHeading": "قنواتُ إيصالي",
  "notify.channel": "القناة",
  "notify.channelState": "حالُ الربط",
  "notify.channelExternalId": "معرّفي في القناة",
  "notify.linkTelegram": "أربط تيليغرام",
  "notify.linkTtlNote": "رابطُ الربط صالحٌ مدةً معلنة، وإن انتهت فأعد إصدارَه من هنا",
  "notify.emptyChannels": "لم تربط قناةً بعد — الجرسُ داخل التطبيق يصلك على كل حال",
  "announce.heading": "الإعلانات",
  "announce.scopeNote": "إعلاناتُ نطاقك وما تحته",
  "announce.title": "عنوانُ الإعلان",
  "announce.body": "نصُّ الإعلان",
  "announce.unit": "نطاقُ الإعلان",
  "announce.audience": "الجمهور",
  "announce.audienceSubtree": "النطاقُ وما تحته",
  "announce.audienceUnit": "الوحدةُ بعينها",
  "announce.publishedAt": "تاريخُ النشر",
  "announce.publish": "أنشرُ إعلاناً",
  "announce.emptyOwner": "لم تنشر إعلاناً بعد — ابدأ بإعلانٍ لنطاقك",
  "announce.emptyViewer": "لا إعلانَ على نطاقك بعد",
} as const
