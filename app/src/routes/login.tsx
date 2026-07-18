import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";
import { firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    // firstAllowed دالّةٌ كليّة لا تُعيد /login أبدًا (مَن بلا صلاحية ⇒ /no-access) ⇒ لا حلقةَ تحويل ممكنة
    if (user) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — مشكاة" },
      { name: "description", content: "تسجيل الدخول إلى نظام مشكاة لإدارة المسجد المؤثر." },
    ],
  }),
  component: LoginPage,
});
