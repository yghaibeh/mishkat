// نموذج الصلاحيات القائم على القدرات (Capabilities) — مشترك بين الخادم والعميل.
// القدرة = "module.action". الدور له قدرات افتراضية، والمدير العام يضيف تجاوزات (منح/حجب).

export const CAP_CATALOG: Array<{ module: string; caps: Array<{ key: string; label: string }> }> = [
  { module: "الشبكة", caps: [{ key: "network.view", label: "عرض الشبكة والتنقّل" }] },
  { module: "التقرير وسجل اليوم", caps: [
    { key: "report.view", label: "عرض التقرير الشهري" },
    { key: "report.approve", label: "اعتماد التقرير (الطبقة الأقرب)" },
    { key: "report.approve.override", label: "التدخّل باعتماد وحدةٍ أدنى عند تعذّر الأقرب (ق1-د)" },
    { key: "dailyLog.view", label: "عرض سجل اليوم" },
    { key: "dailyLog.edit", label: "إدخال سجل اليوم" },
  ] },
  { module: "المالية المركزية", caps: [
    { key: "finance.view", label: "عرض الملف المالي (مطّلِع)" },
    { key: "box.view", label: "الصندوق (عهدة الوحدة)" },
    { key: "finance.entry", label: "إدخال الحركات المالية (مُدخِل)" },
    { key: "finance.approve", label: "اعتماد الصرف (معتمِد)" },
    { key: "finance.payout", label: "تسجيل الصرف" },
    { key: "finance.supervise", label: "اعتماد أعمال المسؤول الماليّ (الاعتماد الثنائيّ)" },
  ] },
  { module: "مالية المسجد", caps: [
    { key: "mosqueFinance.view", label: "عرض مالية المسجد" },
    { key: "mosqueFinance.manage", label: "تسجيل تبرعات/مصروفات" },
  ] },
  { module: "حلقات المسجد", caps: [
    { key: "circles.view", label: "عرض حلقات المسجد" },
    { key: "circles.manage", label: "إضافة وتعديل الحلقات" },
  ] },
  { module: "على بصيرة", caps: [
    { key: "alaBaseera.viewAll", label: "عرض على بصيرة (الشبكة)" },
    { key: "alaBaseera.view", label: "عرض حلقات المسجد" },
    { key: "alaBaseera.manage", label: "إدارة الحلقات والجلسات" },
  ] },
  { module: "التحفيظ", caps: [
    { key: "tahfeez.view", label: "عرض حلقات التحفيظ" },
    { key: "tahfeez.manage", label: "إدارة حلقات التحفيظ" },
  ] },
  { module: "الاجتماعات", caps: [
    { key: "meetings.view", label: "عرض الاجتماعات والقرارات" },
    { key: "meetings.manage", label: "تسجيل الاجتماعات" },
  ] },
  { module: "اللجان", caps: [
    { key: "committees.view", label: "عرض اللجان وخططها" },
    { key: "committees.manage", label: "تشكيل اللجان وإدارة خططها" },
    { key: "committee.own", label: "لجنتي — عرض لجنتي وإدارة خطتها (مسؤول لجنة)" },
  ] },
  { module: "حلقات المدرّس", caps: [
    { key: "circle.teach", label: "إدارة حلقاتي (مدرّس/محفّظ)" },
  ] },
  { module: "المسابقة", caps: [
    { key: "competition.view", label: "عرض المسابقة" },
    { key: "competition.manage", label: "إدارة المسابقة" },
  ] },
  { module: "الإعلام", caps: [
    { key: "media.hub", label: "مركز الإعلام — معرض صور الشبكة" },
    { key: "media.post", label: "نشر تغطية إعلامية (عملُ مسؤول الإعلام وحده)" },
  ] },
  { module: "المكتبة التدريبيّة", caps: [
    { key: "library.view", label: "مكتبتي — عرض الموادّ والإقرار بالإنجاز" },
    { key: "library.manage", label: "إدارة الموادّ ومتابعة الإنجاز" },
  ] },
  { module: "النشاطات والمتابعة", caps: [
    { key: "duties.view", label: "«المطلوب منّي» — عرض النشاطات والردّ" },
    { key: "duties.manage", label: "إنشاء النشاطات ومتابعة الردود" },
  ] },
  { module: "التهيئة والإدارة", caps: [
    { key: "admin.view", label: "عرض التهيئة" },
    { key: "user.manage", label: "إدارة المستخدمين" },
    { key: "orgUnit.manage", label: "إدارة الوحدات التنظيمية" },
    { key: "permissions.manage", label: "إدارة الصلاحيات" },
    { key: "settings.view", label: "عرض المعدّلات المالية" },
    { key: "settings.manage", label: "تعديل المعدّلات المالية" },
    { key: "audit.view", label: "عرض سجلّ التدقيق" },
  ] },
];

export const ALL_CAPS = CAP_CATALOG.flatMap((g) => g.caps.map((c) => c.key));
export const CAP_LABEL: Record<string, string> = Object.fromEntries(CAP_CATALOG.flatMap((g) => g.caps.map((c) => [c.key, c.label])));

// الأدوار الفاعلة في النظام (التسمية الأساسية؛ التسمية المُجنَّسة عبر sectionRoleLabel)
export const ROLE_LABEL: Record<string, string> = {
  admin: "الإدارة العليا",
  section_head: "مشرف عام القسم",
  rabita: "مسؤول منطقة",
  square: "مسؤول مربع",
  amir: "أمير مسجد",
  teacher: "مدرّس/محفّظ",
  committee_head: "مسؤول لجنة",
  media: "مسؤول إعلام",
  finance_officer: "مسؤول ماليّ",
  student: "طالب",
};
export const ALL_ROLES = Object.keys(ROLE_LABEL);

// التسمية المُجنَّسة حسب القسم — تعكس الفصل التام في الواجهة
const SECTION_ROLE_LABEL: Record<string, { men: string; women: string }> = {
  section_head: { men: "مشرف عام قسم الذكور", women: "مشرفة عامة قسم النساء" },
  rabita: { men: "مسؤول منطقة", women: "مسؤولة منطقة" },
  square: { men: "مسؤول مربع", women: "مسؤولة مربع" },
  amir: { men: "أمير مسجد", women: "مشرفة حلقة نسائية" },
  teacher: { men: "مدرّس/محفّظ", women: "معلّمة حلقة نسائية" },
  committee_head: { men: "مسؤول لجنة", women: "مسؤولة لجنة" },
  media: { men: "مسؤول إعلام", women: "مسؤولة إعلام" },
  finance_officer: { men: "مسؤول ماليّ", women: "مسؤولة ماليّة" },
};

// تسمية نوع الوحدة التنظيمية (الورقة النسائية «حلقة نسائية» تمييزًا عن حلقات القرآن)
export const ORG_TYPE_LABEL: Record<string, string> = {
  section: "قسم", rabita: "منطقة", square: "مربع", mosque: "مسجد", halaqa: "حلقة نسائية",
};
export function sectionRoleLabel(role: string, section?: string | null): string {
  if (section === "men" || section === "women") return SECTION_ROLE_LABEL[role]?.[section] ?? ROLE_LABEL[role] ?? role;
  return ROLE_LABEL[role] ?? role;
}

// أنواع الوحدات التنظيمية القابلة للإنشاء داخل قسم (الجذر يُنشأ بذرًا)
export const ACTIVE_ORG_TYPES = ["rabita", "square", "mosque", "halaqa"] as const;
export type ActiveOrgType = typeof ACTIVE_ORG_TYPES[number];

// القدرات الافتراضية لكل دور ("*" = كل شيء)
// المنطقة: الاعتماد + إدارة المستخدمين والبنية في نطاقها
// المربع: عرض فقط لكل ما دونه
// الأمير: إدارة كاملة لمسجده
// عدسة المشرف (الوثيقتان ٣٤/٣٦): بلا «الملف المالي» المركزيّ وبلا «التهيئة» — كانا يظهران
// للمربع/المنطقة فيريان دفترَ اليومية وميزانَ المراجعة وصفحةً «للإدارة العليا» (تدقيق ٣٣ فئة أ).
// المحاسبةُ المركزية للمدير والمسؤول المالي حصرًا؛ والتهيئة للمدير.
const SUPERVISOR_VIEW = [
  "network.view",
  "report.view",
  "dailyLog.view",
  "mosqueFinance.view",
  "circles.view",
  "alaBaseera.viewAll", "alaBaseera.view",
  "tahfeez.view", "meetings.view", "committees.view",
  "competition.view",
  "library.view",
  "duties.view",
  // «الأعلى يطّلع على كلّ ما يخصّه في الأسفل» (بلاغ الميدان ٢٠٢٦-٠٧-١٨): معرضُ نطاقه — يرى
  // تغطياتِ منطقته وصورَ سجلّاتها ودروسِها. اطّلاعٌ لا نشر؛ فـ media.post قدرةٌ شخصيّةٌ لصاحب الدور.
  "media.hub",
];

export const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ["*"],
  // رأس القسم: أعلى طبقة داخل قسمه — يعتمد ويدير المستخدمين والبنية ضمن قسمه (لا يرى القسم الآخر)
  // ق1-د: رأسُ القسم والمنطقة يملكان «التدخّلَ الفوقيّ» (override) لاعتماد وحدةٍ أدنى عند تعذّر الأقرب؛ المربعُ أدنى طبقةٍ فلا override له.
  section_head: [...SUPERVISOR_VIEW, "box.view", "report.approve", "report.approve.override", "user.manage", "orgUnit.manage", "audit.view", "library.manage", "finance.approve", "finance.entry"],
  rabita: [...SUPERVISOR_VIEW, "box.view", "report.approve", "report.approve.override", "user.manage", "orgUnit.manage", "audit.view", "finance.approve"],
  square: [...SUPERVISOR_VIEW, "box.view", "report.approve"],
  amir: [
    "box.view",
    "report.view", "report.approve",
    "dailyLog.view", "dailyLog.edit",
    "mosqueFinance.view", "mosqueFinance.manage",
    "circles.view", "circles.manage",
    "alaBaseera.view", "alaBaseera.manage",
    "tahfeez.view", "tahfeez.manage",
    "meetings.view", "meetings.manage",
    "committees.view", "committees.manage",
    "competition.view", "competition.manage",
    "library.view",
    "duties.view", "duties.manage",
  ],
  // المدرّس/المحفّظ: يدير حلقاته فقط (تُعزل بالملكية في الخادم) — بلا شبكة/مالية/تهيئة
  teacher: ["circle.teach", "library.view", "duties.view", "duties.manage"],
  // مسؤول اللجنة: يرى ويدير لجنته فقط (تُعزل بالملكية في الخادم) — بلا شبكة/مالية/تهيئة
  committee_head: ["committee.own", "duties.view", "library.view"],
  // مسؤول الإعلام: مركزُ الإعلام (معرضُ صور نطاقه) ونشرُ التغطيات — بلا مالية/تهيئة
  media: ["media.hub", "media.post", "duties.view", "library.view"],
  // المسؤول الماليّ: يعمل بكامل القسم الماليّ لكنّ كلَّ فعلٍ يمسّ المال يمرّ باعتماد المدير (سياسة 0070)
  // بلا finance.approve إطلاقًا — لا يعتمد شيئًا، ولا فعلَ نفسِه (ثوابت الوثيقة ٢٨)
  finance_officer: ["finance.view", "box.view", "finance.entry", "finance.payout", "duties.view", "library.view"],
  // الطالب المعتمَد (تسجيلٌ ذاتيّ): «المطلوب منّي» + مكتبته فقط
  student: ["duties.view", "library.view"],
};

export type Override = { role: string; capability: string; effect: "grant" | "revoke" };

// القدرات الفعلية لمستخدم = اتحاد افتراضيات أدواره ± التجاوزات
export function effectiveCaps(roles: string[], overrides: Override[] = []): string[] {
  const set = new Set<string>();
  for (const r of roles) for (const c of ROLE_DEFAULTS[r] ?? []) set.add(c);
  for (const ov of overrides) {
    if (!roles.includes(ov.role)) continue;
    if (ov.effect === "grant") set.add(ov.capability);
    else if (ov.effect === "revoke") set.delete(ov.capability);
  }
  return [...set];
}

// «القدراتُ الشخصيّة» (قاعدة المالك الواحد ٣٤): عملٌ لا يقوم به إلا صاحبُ الدور نفسِه —
// الشمولُ «*» يمنح الاطّلاع لا العمل. المديرُ يرى مركزَ الإعلام ولا ينشر تغطية، ويرى
// الحلقات ولا يدرّس. أيُّ قدرةِ عملٍ شخصيّةٍ جديدةٍ تُضاف هنا فيسري عليها المنع تلقائيًّا.
export const PERSONAL_CAPS = ["circle.teach", "committee.own", "media.post"] as const;
export function isPersonalCap(cap: string): boolean {
  return (PERSONAL_CAPS as readonly string[]).includes(cap);
}

export function hasCap(caps: string[] = [], cap: string): boolean {
  if (isPersonalCap(cap)) return caps.includes(cap); // «*» لا يمنح عملًا شخصيًّا
  return caps.includes("*") || caps.includes(cap);
}

// الحالة الفعلية لدور واحد تجاه قدرة (لعرض المصفوفة)
export function roleEffective(role: string, cap: string, overrides: Override[] = []): boolean {
  const ov = overrides.find((o) => o.role === role && o.capability === cap);
  if (ov) return ov.effect === "grant";
  return roleDefaultHas(role, cap);
}
export function roleDefaultHas(role: string, cap: string): boolean {
  const d = ROLE_DEFAULTS[role] ?? [];
  return hasCap(d, cap);
}
