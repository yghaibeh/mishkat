// الوصول للصفحات حسب القدرات (Capabilities) — مصدر واحد للتبويبات وحُرّاس المسارات.
import { hasCap } from "./capabilities";

// التبويبات العُليا = الشاشات العامة فقط (شاشات المسجد داخل /mosque/$id).
export const NAV = [
  // «الرئيسية» أولاً — رئيسيةُ كلّ دورٍ وصفحةُ هبوطه (الوثيقة ٣٦). duties.view يملكه كلُّ دور.
  { to: "/home", label: "الرئيسية", cap: "duties.view" },
  { to: "/network", label: "الشبكة", cap: "network.view" },
  { to: "/finance", label: "الملف المالي", cap: "finance.view" },
  // على بصيرة الشبكية للمشرفين/الإدارة (viewAll) فقط — الأمير يصل حلقات مسجده من تبويب مسجده
  // (كانت تظهر له مرتين: تبويب عام + تبويب مسجد — تدقيق ٣٣ هـ-١)
  { to: "/ala-baseera", label: "على بصيرة", cap: "alaBaseera.viewAll" },
  { to: "/competition", label: "المسابقة", cap: "competition.view" },
  // «المطلوب اليوم» ذاب في «الرئيسية» (٣٦ §١) — لا تبويبَ له؛ يبقى وجهةَ عملٍ تصلها بطاقاتُ الرئيسية والجرس
  { to: "/duties", label: "المطلوب اليوم", cap: "duties.view", hidden: true },
  { to: "/library", label: "المكتبة", cap: "library.view" },
  // الإعلام: معرضُ صور الشبكة (سجلّات اليوم + دروس الحلقات) + العُهدُ في العمل — للإدارة ومسؤول الإعلام
  { to: "/media-hub", label: "الإعلام", cap: "media.hub" },
  { to: "/admin", label: "الإدارة", cap: "admin.view" },
  // حلقاتي: أخيراً — حتى لا يصبح صفحة هبوط المدير (الذي يملك "*")؛ المدرّس وحده نطاقُه هذا
  { to: "/my-circles", label: "حلقاتي", cap: "circle.teach" },
  // لجنتي: صفحةُ مسؤول اللجنة (نطاقُه لجنته وحدها)
  { to: "/my-committee", label: "لجنتي", cap: "committee.own" },
] as const;

export function allowedNav(caps: string[] = []) {
  return NAV.filter((n) => !("hidden" in n && n.hidden) && hasCap(caps, n.cap));
}

export function canAccess(path: string, caps: string[] = []): boolean {
  const n = NAV.find((x) => x.to === path);
  return !!n && hasCap(caps, n.cap);
}

// الوجهة الطرفيّة للمُصادَقين بلا صلاحيات — صفحةٌ محايدة لا تُعيد القذف (ثابت: التوجيه دالّةٌ كليّة لا تُحلّق أبدًا)
export const NO_ACCESS = "/no-access";

// أوّل صفحةٍ مسموحة؛ ومَن لا صلاحية له يذهب إلى /no-access (لا /login) تفاديًا لأيّ حلقةِ تحويل
export function firstAllowed(caps: string[] = []): string {
  return allowedNav(caps)[0]?.to ?? NO_ACCESS;
}
