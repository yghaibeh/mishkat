import { useState } from "react";
import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { approveMonth } from "@/lib/api/functions";
import { approveMosqueMonth } from "@/lib/api/network";

interface Approval {
  allApproved: boolean;
  canAmirApprove: boolean;
  canLayerApprove: boolean;
}
interface Props {
  variant?: "inline" | "sticky";
  approval?: Approval;
  mosqueId?: string;
}

export function ReportActions({ variant = "inline", approval, mosqueId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const canApprove = !!(approval?.canAmirApprove || approval?.canLayerApprove);
  const label = approval?.canLayerApprove ? "الاعتماد النهائي" : "اعتماد التقرير";
  const done = approval?.allApproved && !canApprove;

  const onApprove = async () => {
    if (!canApprove) return;
    setBusy(true);
    try {
      const res = mosqueId ? await approveMosqueMonth({ data: { mosqueId } }) : await approveMonth();
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success(approval?.canLayerApprove ? "تم الاعتماد النهائي للتقرير" : "اعتمد الأمير التقرير", {
          description: "حُدِّثت حالة أسابيع الشهر.",
        });
        await router.invalidate();
      }
    } catch {
      toast.error("تعذّر تنفيذ الاعتماد");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () => {
    window.print();
  };

  const ApproveIcon = busy ? Loader2 : CheckCircle2;

  if (variant === "sticky") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:hidden print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={exportPdf}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft ring-1 ring-line active:scale-95"
            aria-label="تصدير PDF"
          >
            <FileDown className="size-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={onApprove}
            disabled={busy || !canApprove}
            className={cn(
              "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold active:scale-[0.98]",
              done
                ? "bg-success-bg text-success ring-1 ring-success/20"
                : canApprove
                  ? "bg-emerald-800 text-emerald-50 shadow-soft"
                  : "bg-surface-2 text-ink-faint ring-1 ring-line",
            )}
          >
            <ApproveIcon className={cn("size-5", busy && "animate-spin")} strokeWidth={1.75} />
            {done ? "معتمد نهائياً" : label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden gap-2 md:flex print:hidden">
      <button
        onClick={exportPdf}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-surface-2"
      >
        <FileDown className="size-4" strokeWidth={1.75} />
        تصدير PDF
      </button>
      <button
        onClick={onApprove}
        disabled={busy || !canApprove}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
          done
            ? "bg-success-bg text-success ring-1 ring-success/20"
            : canApprove
              ? "bg-emerald-800 text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 hover:bg-emerald-900"
              : "cursor-not-allowed bg-surface-2 text-ink-faint ring-1 ring-line",
        )}
      >
        <ApproveIcon className={cn("size-4", busy && "animate-spin")} strokeWidth={1.75} />
        {done ? "معتمد نهائياً" : label}
      </button>
    </div>
  );
}
