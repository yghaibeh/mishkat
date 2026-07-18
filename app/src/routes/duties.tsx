import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { DutiesPage } from "@/components/duties/DutiesPage";
import { canAccess, firstAllowed } from "@/lib/access";

// «المطلوب اليوم» (الوثيقة ٢٦ §ن): متابعةٌ سلسةٌ للمطلوب — للطالب ردٌّ، وللشيخ متابعةُ ردود
export const Route = createFileRoute("/duties")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/duties", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "المطلوب اليوم — مشكاة" },
      { name: "description", content: "نشاطاتك المطلوبة وردودك — ومتابعة ردود الطلاب." },
    ],
  }),
  component: DutiesPage,
  pendingComponent: PageSkeleton,
});
