import { createFileRoute, redirect } from "@tanstack/react-router";
import { MyCommitteePage } from "@/components/committee/MyCommitteePage";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/my-committee")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/my-committee", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "لجنتي — مشكاة" },
      { name: "description", content: "متابعةُ عمل اللجنة وخطّتها من حساب مسؤول اللجنة." },
    ],
  }),
  component: MyCommitteePage,
});
