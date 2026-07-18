// المصدرُ الواحدُ لفئات المكتبة التدريبيّة (قاعدة الحقيقة الواحدة + مفردات المستخدم ٣٤):
// كانت المفاتيحُ مفرّقةً بين البذرة والواجهة فتظهر أكوادٌ إنجليزيّةٌ خامٌ (management/leadership…).
// أيُّ فئةٍ جديدةٍ تُضاف هنا حصراً؛ والحارسُ material-categories.test يمنع مفتاحًا خارج القاموس.
export const MATERIAL_CATEGORIES: Record<string, string> = {
  leadership: "قيادة وإمارة",
  management: "إدارة المسجد",
  admin: "إداريّات وتقارير",
  admin_training: "تدريب إداريّ",
  supervision: "مهارات الإشراف",
  education: "التعليم والتربية",
  tech: "تقنية وأمن معلومات",
  safety: "سلامة وإسعاف",
  media: "إعلام",
  aqeedah: "عقيدة",
  fiqh: "فقه",
  seerah: "سيرة",
  tarbiya: "تربية",
  other: "أخرى",
};
// السقوط الآمن: لا يظهر مفتاحٌ خامٌ للمستخدم أبدًا
export const materialCategoryLabel = (k: string): string => MATERIAL_CATEGORIES[k] ?? MATERIAL_CATEGORIES.other;
