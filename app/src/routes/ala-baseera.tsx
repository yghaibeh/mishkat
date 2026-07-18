import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AlaBaseeraPage } from "@/components/ala-baseera/AlaBaseeraPage";
import { getAlaBaseera } from "@/lib/api/alaBaseera";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/ala-baseera")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/ala-baseera", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "التعليم — مشكاة" },
      { name: "description", content: "إدارة حلقات «على بصيرة»: المعلّمون والأماكن والطلاب وجلسات الدرس والمحاسبة بالساعة." },
    ],
  }),
  loader: async () => {
    try {
      return await getAlaBaseera();
    } catch {
      return null;
    }
  },
  component: AlaBaseeraRoute,
  pendingComponent: PageSkeleton,
});

function AlaBaseeraRoute() {
  const data = Route.useLoaderData();
  return <AlaBaseeraPage data={data ?? undefined} />;
}
