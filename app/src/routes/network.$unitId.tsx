import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NetworkPage } from "@/components/network/NetworkPage";
import { getNetwork } from "@/lib/api/network";

export const Route = createFileRoute("/network/$unitId")({
  head: () => ({
    meta: [{ title: "الشبكة — مشكاة" }],
  }),
  loader: async ({ params }) => {
    const net = await getNetwork({ data: { unitId: params.unitId } }).catch(() => null);
    // الوصول لمسجد ⇐ يُفتح في صفحة المسجد المتبوّبة، لا داخل الشبكة
    if (net && (net as { leaf?: boolean; mosqueId?: string }).leaf) {
      throw redirect({ to: "/mosque/$mosqueId", params: { mosqueId: (net as { mosqueId: string }).mosqueId } });
    }
    return { net };
  },
  component: NetworkUnit,
  pendingComponent: PageSkeleton,
});

function NetworkUnit() {
  const { net } = Route.useLoaderData();
  return <NetworkPage data={net ?? undefined} report={null} />;
}
