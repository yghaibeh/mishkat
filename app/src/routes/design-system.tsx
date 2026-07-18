import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DesignSystemPage } from "@/components/design-system/DesignSystemPage";

// صفحة منفصلة داخل النظام لأصحاب المشروع فقط:
// خارج تبويبات المستخدمين (ليست في access.ts NAV)، وبلا شريط تنقّل التطبيق.
export const Route = createFileRoute("/design-system")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!user.caps?.includes("admin")) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "النظام التصميمي — مشكاة (مرجع داخلي)" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignSystemRoute,
});

function DesignSystemRoute() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <span className="text-xs font-semibold text-ink-faint">مرجع داخلي · لأصحاب المشروع</span>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line transition hover:bg-surface-2 hover:text-ink"
        >
          <ArrowRight className="size-4" strokeWidth={1.75} />
          العودة للتطبيق
        </Link>
      </div>
      <DesignSystemPage />
    </div>
  );
}
