import { useEffect, useState } from "react";
import { pendingCount } from "@/lib/offline/outbox";

// حالة الاتصال + عدد العمليات المعلّقة في طابور المزامنة.
export function useOfflineStatus() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => { void pendingCount().then(setPending); };
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("outbox-changed", refresh);
    refresh();
    const t = window.setInterval(refresh, 5_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("outbox-changed", refresh);
      window.clearInterval(t);
    };
  }, []);

  return { online, pending };
}
