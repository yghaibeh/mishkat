import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NetworkPage } from "@/components/network/NetworkPage";
import { getNetwork } from "@/lib/api/network";

export const Route = createFileRoute("/network/")({
  head: () => ({
    meta: [
      { title: "الشبكة — مشكاة" },
      { name: "description", content: "متصفّح الشبكة الهرمي: الروابط والكتل والمربعات والمساجد بمؤشرات الأداء." },
    ],
  }),
  loader: async () => {
    try {
      return { net: await getNetwork({ data: {} }), report: null };
    } catch {
      return { net: null, report: null };
    }
  },
  component: NetworkIndex,
  pendingComponent: PageSkeleton,
});

function NetworkIndex() {
  const { net } = Route.useLoaderData();
  return <NetworkPage data={net ?? undefined} />;
}
