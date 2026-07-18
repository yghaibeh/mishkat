import { createFileRoute, redirect } from "@tanstack/react-router";
import { MyCirclesPage } from "@/components/circles/MyCirclesPage";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/my-circles")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/my-circles", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "حلقاتي — مشكاة" },
      { name: "description", content: "إدارة حلقات المدرّس/المحفّظ: الطلاب والدروس والمتابعة الأسبوعية." },
    ],
  }),
  component: MyCirclesPage,
});
