import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { canAccess, firstAllowed } from "@/lib/access";

export const Route = createFileRoute("/network")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (!user) throw redirect({ to: "/login" });
    if (!canAccess("/network", user.caps)) throw redirect({ to: firstAllowed(user.caps) });
  },
  component: Outlet,
});
