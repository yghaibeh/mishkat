// الوصول للصفحات حسب القدرات (Capabilities) — مصدر واحد للتبويبات وحُرّاس المسارات.
import { hasCap } from "./capabilities";

// التبويبات العُليا = الشاشات العامة فقط (شاشات المسجد داخل /mosque/$id).
export const NAV = [
  // «الرئيسية» أولاً — رئيسيةُ كلّ دورٍ وصفحةُ هبوطه (الوثيقة ٣٦). duties.view يملكه كلُّ دور.
  { to: "/home", label: "الرئيسية", cap: "duties.view" },
  { to: "/network", label: "الشبكة", cap: "network.view" },
  { to: "/finance", label: "الصندوق", cap: "box.view" },
  // على بصيرة الشبكية للمشرفين/الإدارة (viewAll) فقط — الأمير يصل حلقات مسجده من تبويب مسجده
  // (كانت تظهر له مرتين: تبويب عام + تبويب مسجد — تدقيق ٣٣ هـ-١)
  // «التعليم» لا «على بصيرة» (قرار المالك ٢٠٢٦-٠٧-١٨): اسمُ منتجٍ صار نوعَ حلقةٍ — التبويبُ مكانٌ
  // وظيفيٌّ للمشرفين يجمع كل الأنواع والأماكن (مساجد/معاهد/بيوت)؛ الأمير بيتُه صفحةُ مسجده
  { to: "/ala-baseera", label: "التعليم", cap: "network.view" },
  { to: "/competition", label: "المسابقة", cap: "competition.view" },
  // «المطلوب اليوم» ذاب في «الرئيسية» (٣٦ §١) — لا تبويبَ له؛ يبقى وجهةَ عملٍ تصلها بطاقاتُ الرئيسية والجرس
  { to: "/duties", label: "المطلوب اليوم", cap: "duties.view", hidden: true },
  { to: "/library", label: "المكتبة", cap: "library.view" },
  // المنهاج مثبَّتٌ للجميع (قرار المالك ٢٠٢٦-٠٧-١٨): كان المسجَّلُ بلا أي طريقٍ إليه
  { to: "/manhaj", label: "المنهاج", cap: "library.view" },
  // الإعلام: معرضُ صور الشبكة (سجلّات اليوم + دروس الحلقات) + العُهدُ في العمل — للإدارة ومسؤول الإعلام
  { to: "/media-hub", label: "الإعلام", cap: "media.hub" },
  // «العُهد» (قرار المالك ٢٠٢٦-٠٧-١٨): ميزةٌ قائمةٌ بذاتها لا تبويبٌ داخل الصندوق —
  // يفتحها مسؤولُ الوحدة (تسليمٌ واسترداد) وصاحبُ العهدة نفسُه («عُهدتي» والإقرارُ بالاستلام).
  { to: "/custody", label: "العُهد", cap: "assets.manage", anyOf: ["assets.manage", "custody.own"] },
  // «الإدارة» بابٌ لكلّ من يملك قدرةَ إدارةٍ ولو واحدة — لا للمدير وحدَه (بلاغ الميدان ٢٠٢٦-٠٧-١٨:
  // مسؤولُ منطقةٍ يملك orgUnit.manage وuser.manage في الخادم ولا يجد البابَ فلا يستطيع إضافةَ مسجد).
  // الصفحةُ نفسُها تُبوَّب بالقدرات، والخادمُ يعزل بالنطاق — فالبابُ الواحد يفتح لكلٍّ ما يخصّه.
  { to: "/admin", label: "الإدارة", cap: "admin.view", anyOf: ["admin.view", "orgUnit.manage", "user.manage", "audit.view"] },
  // تبويبان «شخصيّان»: قدرتُهما في PERSONAL_CAPS، فـ hasCap وحدَه يمنع «*» منهما
  // (كان المديرُ يرى «حلقاتي» و«لجنتي» ولا حلقةَ له ولا لجنة — قاعدة المرآة ٣٤)
  { to: "/my-circles", label: "حلقاتي", cap: "circle.teach" },
  { to: "/my-committee", label: "لجنتي", cap: "committee.own" },
] as const;

// بابٌ يُفتح بأيّ قدرةٍ من قدراته (anyOf) وإلّا فبقدرته الواحدة
function opens(n: (typeof NAV)[number], caps: string[]): boolean {
  const list = ("anyOf" in n && n.anyOf ? n.anyOf : [n.cap]) as readonly string[];
  return list.some((c) => hasCap(caps, c));
}

export function allowedNav(caps: string[] = []) {
  return NAV.filter((n) => !("hidden" in n && n.hidden) && opens(n, caps));
}

export function canAccess(path: string, caps: string[] = []): boolean {
  const n = NAV.find((x) => x.to === path);
  return !!n && opens(n, caps);
}

// الوجهة الطرفيّة للمُصادَقين بلا صلاحيات — صفحةٌ محايدة لا تُعيد القذف (ثابت: التوجيه دالّةٌ كليّة لا تُحلّق أبدًا)
export const NO_ACCESS = "/no-access";

// أوّل صفحةٍ مسموحة؛ ومَن لا صلاحية له يذهب إلى /no-access (لا /login) تفاديًا لأيّ حلقةِ تحويل
export function firstAllowed(caps: string[] = []): string {
  return allowedNav(caps)[0]?.to ?? NO_ACCESS;
}

// ترتيبُ الشريط حسب أهمية كل دور (قرار المالك ٢٠٢٦-٠٧-١٨): بعد «الرئيسية» يأتي أهمُّ أماكن عمل الدور
// (المدير: الإدارة أولاً؛ المعلم: حلقاتي؛ المالي: الصندوق؛ الطالب: المنهاج…). ما ليس في الخريطة يذيَّل بترتيبه.
const ROLE_PRECEDENCE = ["admin", "section_head", "rabita", "square", "finance_officer", "amir", "teacher", "committee_head", "media", "student"];
const ROLE_NAV_ORDER: Record<string, string[]> = {
  admin: ["/home", "/admin", "/network", "/finance", "/ala-baseera", "/custody", "/media-hub", "/competition", "/library", "/manhaj"],
  // الطبقاتُ المشرفة: «الإدارة» ثانيةً — أهمُّ واجبٍ لمسؤول المنطقة تفعيلُ دور مسجدٍ جديد
  // (بلاغ الميدان ٢٠٢٦-٠٧-١٨)؛ ثمّ شبكتُه فصندوقُه فتعليمُه فإعلامُ نطاقه.
  section_head: ["/home", "/admin", "/network", "/finance", "/ala-baseera", "/custody", "/media-hub", "/competition", "/library", "/manhaj"],
  rabita: ["/home", "/admin", "/network", "/finance", "/ala-baseera", "/custody", "/media-hub", "/competition", "/library", "/manhaj"],
  square: ["/home", "/network", "/finance", "/ala-baseera", "/custody", "/media-hub", "/competition", "/library", "/manhaj"],
  finance_officer: ["/home", "/finance", "/custody", "/library", "/manhaj"],
  amir: ["/home", "/finance", "/custody", "/competition", "/library", "/manhaj"],
  teacher: ["/home", "/my-circles", "/manhaj", "/library", "/custody"],
  committee_head: ["/home", "/my-committee", "/library", "/manhaj", "/custody"],
  media: ["/home", "/media-hub", "/custody", "/library", "/manhaj"],
  student: ["/home", "/manhaj", "/library"],
};
export function orderedNav(caps: string[] = [], roles: string[] = []) {
  const items = allowedNav(caps);
  const primary = ROLE_PRECEDENCE.find((r) => roles.includes(r));
  const order = primary ? ROLE_NAV_ORDER[primary] : undefined;
  if (!order) return items;
  const rank = (to: string) => { const i = order.indexOf(to); return i === -1 ? 99 : i; };
  return [...items].sort((a, b) => rank(a.to) - rank(b.to));
}
