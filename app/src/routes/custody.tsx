import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustodyPage } from "@/components/custody/CustodyPage";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/custody")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/custody", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "العُهد — مشكاة" },
      { name: "description", content: "عُهدُ الوحدة وعُهدتي: تسليمٌ واستردادٌ بإقرار المستلم وسلسلةُ حيازةٍ كاملة." },
    ],
  }),
  component: CustodyPage,
});
