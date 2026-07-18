import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { FinancePage } from "@/components/finance/FinancePage";
import { getFinance } from "@/lib/api/finance";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/finance")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/finance", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "الملف المالي — مشكاة" },
      { name: "description", content: "احتساب المستحقات الشهرية واعتمادها وتسجيل الصرف في نظام مشكاة." },
    ],
  }),
  loader: async () => {
    try {
      return await getFinance({ data: {} });
    } catch {
      return null;
    }
  },
  component: FinanceRoute,
  pendingComponent: PageSkeleton,
});

function FinanceRoute() {
  const data = Route.useLoaderData();
  return <FinancePage data={data ?? undefined} />;
}
