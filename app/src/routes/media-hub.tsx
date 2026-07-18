import { createFileRoute, redirect } from "@tanstack/react-router";
import { MediaHubPage } from "@/components/media/MediaHubPage";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/media-hub")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/media-hub", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  head: () => ({
    meta: [
      { title: "الإعلام — مشكاة" },
      { name: "description", content: "معرضُ صور الشبكة مربوطةً بالمسجد والمنطقة، والعُهدُ التي في العمل — للإدارة ومسؤول الإعلام." },
    ],
  }),
  component: MediaHubPage,
});
