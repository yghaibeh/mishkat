import { createFileRoute, redirect } from "@tanstack/react-router";
import { NoAccessPage } from "@/components/auth/NoAccessPage";
import { firstAllowed, NO_ACCESS } from "@/lib/access";

// صفحةٌ طرفيّة لمُصادَقٍ بلا صلاحيات. غير مسجَّل ⇒ /login؛ وله صلاحيات ⇒ وجهته (لا يبقى هنا).
export const Route = createFileRoute("/no-access")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    const dest = firstAllowed(user.caps);
    if (dest !== NO_ACCESS) throw redirect({ to: dest });
  },
  head: () => ({ meta: [{ title: "لا صلاحيات — مشكاة" }] }),
  component: NoAccessPage,
});
