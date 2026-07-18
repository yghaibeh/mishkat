import { WifiOff, RefreshCw, Check } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { cn } from "@/lib/utils";
import { flush } from "@/lib/offline/outbox";

// شارةٌ صغيرة: تظهر عند العمل دون اتصال أو وجود عملياتٍ بانتظار المزامنة.
export function SyncBadge({ className }: { className?: string }) {
  const { online, pending } = useOfflineStatus();
  if (online && pending === 0) return null; // كلّ شيءٍ متزامن — لا شارة

  const offline = !online;
  return (
    <button
      type="button"
      onClick={() => void flush()}
      title={offline ? "تعمل دون اتصال — سيُزامَن تلقائيًّا" : "بانتظار المزامنة — اضغط للمزامنة الآن"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition",
        offline
          ? "bg-gold-50 text-gold-700 ring-gold-100"
          : "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:bg-emerald-100",
        className,
      )}
    >
      {offline ? <WifiOff className="size-3.5" strokeWidth={2} /> : pending > 0 ? <RefreshCw className="size-3.5" strokeWidth={2} /> : <Check className="size-3.5" strokeWidth={2} />}
      {offline ? "دون اتصال" : `${pending} بانتظار المزامنة`}
    </button>
  );
}
