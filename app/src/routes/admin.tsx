import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AdminPage } from "@/components/admin/AdminPage";
import { listOrgUnits } from "@/lib/api/admin";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/admin", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "الإدارة — مشكاة" },
      { name: "description", content: "إنشاء الهيكلية ومنح الأدوار في نظام مشكاة." },
    ],
  }),
  loader: async () => {
    try {
      return await listOrgUnits();
    } catch {
      return [];
    }
  },
  component: AdminRoute,
  pendingComponent: PageSkeleton,
});

function AdminRoute() {
  const orgUnits = Route.useLoaderData();
  return <AdminPage orgUnits={orgUnits ?? []} />;
}
