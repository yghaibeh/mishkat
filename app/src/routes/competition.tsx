import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CompetitionPage } from "@/components/competition/CompetitionPage";
import { getCompetition } from "@/lib/api/competition";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/competition")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/competition", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "المسابقة — مشكاة" },
      { name: "description", content: "مسابقة المسجد المؤثر السنوية: المشتركون، الترتيب العام، والتأهيل." },
    ],
  }),
  loader: async () => {
    try {
      return await getCompetition();
    } catch {
      return null;
    }
  },
  component: CompetitionRoute,
  pendingComponent: PageSkeleton,
});

function CompetitionRoute() {
  const data = Route.useLoaderData();
  return <CompetitionPage data={data ?? undefined} />;
}
