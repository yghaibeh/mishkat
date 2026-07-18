// «مهامّي» (ملاحظة أصحاب المشروع): كلّ عملٍ رئيسٍ مطلوبٍ من المشرف/المحفّظ/الطالب يمتدّ
// في «المطلوب اليوم» — بطاقاتُ عدّاداتٍ تنقر فتُفضي لمكان الإنجاز. تجميعٌ فوق الدوالّ القائمة.
import { eq } from "drizzle-orm";
import { currentUser } from "./auth.server";
import { useDb } from "./utils/db";
import { orgUnits } from "./database/schema"; // ساكنٌ حصرًا — الديناميكيّ يكسر النشر (10021)

export type TaskCard = { key: string; label: string; count: number; to: string; tone: "danger" | "warn" | "info" };

export async function myTasksSummaryData(): Promise<{ cards: TaskCard[] }> {
  const u = await currentUser();
  if (!u) return { cards: [] };
  const cards: TaskCard[] = [];
  const push = (key: string, label: string, count: number, to: string, tone: TaskCard["tone"]) => {
    if (count > 0) cards.push({ key, label, count, to, tone });
  };

  // ١) تقارير بانتظار اعتمادك (الطبقة الأقرب فقط — ق1-د)
  try {
    const { pendingApprovalsData, pendingBreakGlassData } = await import("./data.server");
    push("approvals", "تقريرٌ بانتظار اعتمادك", (await pendingApprovalsData()).items.length, "/network", "warn");
    // كسرُ الزجاج (إدارة): وحداتٌ بلا طبقةٍ إشرافيّةٍ مُكلَّفة — تحتاج تعيينَ مسؤولٍ + اعتمادًا استثنائيًّا
    push("breakglass", "تقريرٌ بلا معتمِدٍ مُعيَّن — عيِّن مسؤولًا", (await pendingBreakGlassData()).items.length, "/network", "danger");
  } catch { /* */ }

  // ٢) طلبات انضمامٍ بانتظار بتّك
  try {
    const { pendingRegistrationsData } = await import("./registration.server");
    push("registrations", "طلبُ انضمامٍ بانتظار بتّك", (await pendingRegistrationsData()).items.length, "/duties", "info");
  } catch { /* */ }

  // ٢-ب) قاعدة الصلوات (٧٠٪) معطّلةٌ حتى يُحدَّد عدد طلاب الأسرة (ف٩) — نُظهرها للأمير لا نتجاوزها صامتين
  try {
    const amirAt = u.assignments.find((a) => a.role === "amir");
    if (amirAt) {
      const m = (await useDb().select({ id: orgUnits.id, fs: orgUnits.familyStudents }).from(orgUnits).where(eq(orgUnits.id, amirAt.orgUnitId)).all())[0];
      if (m && m.fs == null) push("family-students", "حدّد عددَ طلاب أسرة مسجدك — قاعدة الصلوات (٧٠٪) لا تعمل بدونه", 1, `/mosque/${m.id}?t=daily`, "warn");
    }
  } catch { /* */ }

  // ٣) زياراتٌ إشرافيّةٌ مطلوبة (لم تُزَر/متأخّرة) + زياراتٌ بانتظار اعتمادك
  try {
    const { supervisionDashboardData, supervisionVisitsData } = await import("./supervision.server");
    const d = await supervisionDashboardData();
    const due = ("summary" in d && d.summary) ? d.summary.never + d.summary.overdue : 0;
    push("supervision", "حلقةٌ تحتاج زيارتك الإشرافيّة", due, "/ala-baseera?tab=supervision", "danger");
    push("visit-approvals", "زيارةٌ إشرافيّةٌ بانتظار اعتمادك", (await supervisionVisitsData()).pending.length, "/ala-baseera?tab=supervision", "warn");
  } catch { /* */ }

  // ٤) موادّ إلزاميّةٌ لم تُنجَز في مكتبتك
  try {
    const { myLibraryData } = await import("./materials.server");
    const lib = await myLibraryData();
    if (!("error" in lib)) push("library", "مادّةٌ إلزاميّةٌ لم تُنجزها", lib.items.filter((i) => i.mandatory && !i.completedAt).length, "/library", "warn");
  } catch { /* */ }

  // ٥) نشاطاتٌ تنتظر ردّك (طالب) + ردودٌ تنتظر مراجعتك (منشئ)
  try {
    const { myDutiesData, myActivitiesData } = await import("./activities.server");
    push("duties", "نشاطٌ ينتظر ردّك", (await myDutiesData()).items.filter((i) => !i.myResponse).length, "/duties", "danger");
    const mine = await myActivitiesData();
    const pendingReviews = mine.items.reduce((s, a) => s + a.responses.filter((r) => r.reviewStatus === "pending").length, 0);
    push("reviews", "ردُّ طالبٍ ينتظر مراجعتك", pendingReviews, "/duties", "info");
  } catch { /* */ }

  // ٦) اختباراتٌ/واجباتٌ لم تُسلَّم بعد
  try {
    const { myExamsData } = await import("./exams.server");
    push("exams", "اختبارٌ/واجبٌ لم تسلّمه", (await myExamsData()).items.filter((e) => !e.mySubmission && !e.overdue).length, "/duties", "danger");
  } catch { /* */ }

  return { cards };
}
