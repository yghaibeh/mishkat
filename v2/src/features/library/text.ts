/**
 * قاموسُ المكتبة — نصوصُ الوحدة **داخل وحدتها** (قب-٣١ §٣)، ويُدمَج في طبقة النصوص المركزية
 * بسطر تسجيلٍ واحد (المادة ٢/٦ + `SPEC_design_system` §٥-٢، وقب-٣٥ §٣-أ).
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً**: فلا نصَّ عربياً في شاشة (يُفشله G20)، ويُدقَّق كلُّ
 * حرفٍ يراه المستخدم في موضعٍ واحد. **ومفرداتُ العدسة** (`SPEC_role_lenses` §٢): «مكتبتي ·
 * إدارة الموادّ · متابعة الإنجاز» — لا مصطلحاتِ نظامٍ ولا «لا بيانات».
 */

export const LIBRARY = {
  "library.mineHeading": "مكتبتي",
  "library.mineScopeNote": "الموادُّ الموجَّهةُ إليك أنت",
  "library.mandatoryHeading": "الإلزاميُّ المطلوبُ منك",
  "library.title": "عنوانُ المادة",
  "library.category": "التصنيف",
  "library.audience": "الجمهورُ الموجَّهةُ إليه",
  "library.kind": "صنفُ المادة",
  "library.unit": "الوحدةُ المالكة",
  "library.mandatory": "إلزامية",
  "library.state": "حالتي معها",
  "library.open": "أفتحُ المادة",
  "library.complete": "أُقرّ بإنجازها",
  "library.completeNote": "الإقرارُ أمانةٌ ولا يُقبل قبل الفتح",
  "library.manageHeading": "إدارةُ الموادّ",
  "library.manageScopeNote": "موادُّ نطاقك وما تحته",
  "library.add": "أُضيفُ مادةً",
  "library.archive": "أُؤرشفُ المادة",
  "library.archiveNote": "الأرشفةُ تُخفيها من المكتبات ولا تمحو تاريخها",
  "library.trackingHeading": "متابعةُ الإنجاز",
  "library.person": "الشخص",
  "library.completedOfTotal": "المُنجَزُ من الإلزاميّ",
  "library.emptyMine": "لم تُوجَّه إليك مادةٌ بعد",
  "library.emptyMineOwner": "حين تُوجَّه إليك مادةٌ ستجدها هنا، والإلزاميُّ في صدر القائمة",
  "library.emptyCatalog": "لا مادةَ في نطاقك بعد",
  "library.emptyCatalogOwner": "ابدأ بإضافة مادةٍ وتوجيهها لجمهورها",
} as const
