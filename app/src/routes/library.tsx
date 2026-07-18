import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeleton";
import { LibraryPage } from "@/components/library/LibraryPage";
import { canAccess, firstAllowed } from "@/lib/access";

// المكتبة التدريبيّة (الوثيقة ٢٦ §ت): مكتبتي + إدارة الموادّ + متابعة الإنجاز
export const Route = createFileRoute("/library")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/library", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "المكتبة — مشكاة" },
      { name: "description", content: "المكتبة التدريبيّة المصنّفة ومتابعة إنجاز القراءة." },
    ],
  }),
  component: LibraryPage,
  pendingComponent: PageSkeleton,
});
