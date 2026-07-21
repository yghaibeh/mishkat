/**
 * قاموسُ الإعلام — نصوصُ الوحدة **داخل وحدتها** (قب-٣١ §٣: «نصوصه وشاشاته داخل وحدته لا في
 * ملفٍّ مشترك»)، ويُدمَج في طبقة النصوص المركزية بسطر تسجيلٍ واحد (المادة ٢/٦ + §٥-٢).
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً**: فلا نصَّ عربياً في شاشة (يُفشله G20)، ويُدقَّق كلُّ
 * حرفٍ يراه المستخدم في موضعٍ واحد. **ومفرداتُ العدسة** (SPEC_role_lenses §٢.٨): «معرضي ·
 * تغطياتي» — لا مصطلحاتِ نظامٍ ولا «لا بيانات».
 */

export const MEDIA = {
  "media.heading": "مركزُ الإعلام",
  "media.galleryHeading": "المعرض",
  "media.scopeNote": "المعرضُ على نطاقك وما تحته",
  "media.stream": "الرافد",
  "media.streamCoverage": "من التغطيات",
  "media.streamDailyLog": "من سجلّ اليوم",
  "media.streamLesson": "من الدروس",
  "media.attribution": "المنسوبةُ إليه",
  "media.unattributed": "غيرُ منسوبة",
  "media.occurredOn": "تاريخُ الوقوع",
  "media.unit": "وحدةُ الحدث",
  "media.title": "عنوانُ الحدث",
  "media.kind": "نوعُ التغطية",
  "media.coveragesHeading": "تغطياتي",
  "media.publish": "أُغطّي حدثاً",
  "media.addPhoto": "أُضيف صورةً إلى الألبوم",
  "media.photoCount": "صورُ الألبوم",
  "media.delete": "أحذف تغطيتي",
  "media.deleteNote": "الحذفُ يأخذ صورَ التغطية معها",
  "media.emptyGallery": "لم يُرفع في نطاقك محتوىً بعد",
  "media.emptyOwner": "لم تُغطِّ حدثاً بعد — ابدأ بتسجيل حدثٍ ثم ارفع صورَه",
  "media.emptyCoverages": "لا تغطيةَ باسمك بعد",
} as const
