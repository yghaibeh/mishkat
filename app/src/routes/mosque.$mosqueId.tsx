import { createFileRoute, redirect } from "@tanstack/react-router";
import { MosquePage } from "@/components/mosque/MosquePage";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getMosqueOverview, getMosqueReport } from "@/lib/api/network";
import { getDailyActivities } from "@/lib/api/functions";

export const Route = createFileRoute("/mosque/$mosqueId")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => ({ t: typeof s.t === "string" ? s.t : undefined }),
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "المسجد — مشكاة" }] }),
  loader: async ({ params }) => {
    const mosqueId = params.mosqueId;
    try {
      const [overview, report, m, w] = await Promise.all([
        getMosqueOverview({ data: { mosqueId } }),
        getMosqueReport({ data: { mosqueId } }).catch(() => null),
        getDailyActivities({ data: { track: "male" } }).catch(() => null),
        getDailyActivities({ data: { track: "female" } }).catch(() => null),
      ]);
      const daily = m && w ? { tracks: { m: m.activities, w: w.activities }, weekTarget: m.weeklyTarget } : null;
      return { mosqueId, overview, report, daily };
    } catch {
      return { mosqueId, overview: null, report: null, daily: null };
    }
  },
  component: MosqueRoute,
  pendingComponent: PageSkeleton,
});

function MosqueRoute() {
  const d = Route.useLoaderData();
  return <MosquePage mosqueId={d.mosqueId} overview={d.overview as never} report={d.report as never} daily={d.daily as never} />;
}
