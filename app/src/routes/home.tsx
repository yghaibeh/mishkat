// «الرئيسية» — شاشة كلّ دورٍ الأولى (الوثيقة ٣٦ §١): تجيب أسئلة صباحه وتبتلع «المطلوب اليوم».
// المواصفات: product/ui/home-admin.md · home-amir.md (والبقية GenericHome حتى دفعاتها).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getHome, getDailyActivities } from "@/lib/api/functions";
import { getMyTasksSummary } from "@/lib/api/activities";
import { AdminHome } from "@/components/home/AdminHome";
import { AmirHome } from "@/components/home/AmirHome";
import { SupervisorHome } from "@/components/home/SupervisorHome";
import { FinanceHome } from "@/components/home/FinanceHome";
import { StudentHome } from "@/components/home/StudentHome";
import { GenericHome } from "@/components/home/GenericHome";
import type { HomeData } from "@/server/home.server";
import type { TaskCard } from "@/server/myTasks.server";

export const Route = createFileRoute("/home")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "الرئيسية — مشكاة" },
      { name: "description", content: "رئيسيتك: ما يخص دورك وما هو مطلوب منك الآن." },
    ],
  }),
  loader: async () => {
    const home = (await getHome().catch(() => null)) as HomeData;
    // رئيسيات المعلم/اللجنة/الإعلام هي صفحات عملهم (٣٦ §٢) — تحويلٌ من الخادم
    if (home?.role === "redirect") throw redirect({ to: home.to });
    let daily = null;
    let tasks: TaskCard[] = [];
    if (home?.role === "amir") {
      const track = home.genderTrack === "female" ? "female" : "male";
      const [d, t] = await Promise.all([
        getDailyActivities({ data: { track } }).catch(() => null),
        getMyTasksSummary().catch(() => ({ cards: [] as TaskCard[] })),
      ]);
      daily = d ? { tracks: { m: d.activities, w: d.activities }, weekTarget: d.weeklyTarget } : null;
      tasks = t.cards;
    }
    return { home, daily, tasks };
  },
  component: HomeRoute,
  pendingComponent: PageSkeleton,
});

function HomeRoute() {
  const { home, daily, tasks } = Route.useLoaderData();
  if (!home) return <GenericHome cards={[]} />;
  if (home.role === "admin") return <AdminHome data={home} />;
  if (home.role === "amir") {
    return <AmirHome data={home} daily={daily as never} genderTrack={home.genderTrack} tasks={tasks} />;
  }
  if (home.role === "supervisor") return <SupervisorHome data={home} />;
  if (home.role === "finance") return <FinanceHome data={home} />;
  if (home.role === "student") return <StudentHome data={home} />;
  if (home.role !== "generic") return null; // redirect عولج في الـloader
  return <GenericHome cards={home.cards} />;
}
