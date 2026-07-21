/**
 * تصنيفُ الكيانات القانونيّ — SPEC_information_architecture §١ (ك-١…ك-٣٧).
 *
 * **لكل مفهومٍ موطنٌ واحد**: هذا الملفّ يسمّي الكيانات، وعقدُ الشاشة يعلن أيَّها هي موطنُه؛
 * وG20 ترفض كياناً يُعلَن موطنُه في شاشتين — وهو جذرُ مرض v1 («الحلقة في ثلاثة أنظمة»،
 * ز-١…ز-١٣: تكتب إحداهما وتقرأ الأخرى فيغيب ما أُدخل).
 */

export const ENTITIES = Object.freeze({
  // ١.١ التعليمية (ك-١…ك-١٠)
  circle: "الحلقة (كيانٌ واحد نوعُه سمة — ب-٢٨)",
  enrollment: "الطالب/التسجيل",
  lesson: "الدرس/الجلسة اليومية",
  curriculumProgress: "مصفوفة تقدّم المنهج",
  supervisionNote: "ملاحظات الإشراف على الحلقة",
  guardianLink: "رابط وليّ الأمر",
  exam: "الاختبار/الواجب",
  libraryItem: "المادة المكتبية",
  manhaj: "المنهاج العام (مرجعيٌّ قابلٌ للتوسّع — قب-٢٢)",
  mosqueLesson: "درس/محاضرة المسجد",
  // ١.٢ التنظيمية والحوكمة والهوية (ك-١١…ك-١٨)
  tenant: "الشبكة (جذرٌ فوق القسمين — قب-١٨)",
  orgUnit: "الوحدة التنظيمية",
  account: "الحساب/الشخص/التكليف",
  roleMatrix: "الدور/القدرة/التجاوز",
  setting: "الإعداد الحيّ",
  featureFlag: "مفتاح التفعيل",
  auditLog: "سجل التدقيق",
  activityCatalog: "كتالوج الأنشطة وأوزانها",
  // ١.٣ الإشراف والتقارير والمسابقة واللجان (ك-١٩…ك-٢٥)
  weeklyReport: "التقرير الأسبوعي/الطبقي",
  supervisionVisit: "الزيارة الإشرافية",
  competition: "المسابقة",
  competitionEnrollment: "المشترِك/التسجيل في المسابقة",
  committee: "اللجنة",
  meeting: "الاجتماع/المحضر",
  duty: "النشاط/المطلوب",
  // ١.٤ المالية والعُهد والإعلام (ك-٢٦…ك-٣٢)
  box: "الصندوق وسلسلة العهدة المالية",
  centralAccounting: "المحاسبة المركزية",
  mosqueFinance: "مالية المسجد الداخلية",
  payroll: "الرواتب/الحوافز/الاستحقاق",
  custody: "العُهدة/الأصل",
  mediaCoverage: "التغطية الإعلامية (كيانُ حدثٍ بألبوم — ق-١٠٣)",
  announcement: "الإعلان",
  // ١.٥ خدميّة وشخصيّة (ك-٣٣…ك-٣٧)
  nessa: "NESSA وآلة حالات السجل",
  mediaStorage: "خدمة الوسائط",
  notification: "الإشعار",
  search: "البحث",
  selfProfile: "الملف الشخصي والخدمة الذاتية",
})

export type EntityId = keyof typeof ENTITIES

export const ENTITY_IDS: readonly EntityId[] = Object.freeze(
  Object.keys(ENTITIES) as EntityId[],
)
