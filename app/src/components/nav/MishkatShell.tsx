import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { TopTabs } from "./TopTabs";

export function MishkatShell({
  children,
  stickyFooter,
}: {
  children: ReactNode;
  stickyFooter?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-12">
      <Toaster position="top-center" richColors />
      <TopTabs />
      {children}
      {stickyFooter}
    </div>
  );
}
