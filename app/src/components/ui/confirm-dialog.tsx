import * as React from "react";
import * as AD from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// حوار تأكيد موحّد للإجراءات المدمّرة/الحسّاسة (Radix AlertDialog بلغة مشكاة)
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "emerald";
  busy?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "تأكيد", cancelLabel = "إلغاء", tone = "danger", busy, onConfirm,
}: Props) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AD.Content
          dir="rtl"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-line",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1",
              tone === "danger" ? "bg-danger-bg text-danger ring-danger/20" : "bg-emerald-50 text-emerald-800 ring-emerald-100")}>
              <AlertTriangle className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <AD.Title className="font-display text-base font-semibold text-ink">{title}</AD.Title>
              {description && <AD.Description className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</AD.Description>}
            </div>
          </div>
          <div className="mt-6 flex justify-start gap-2">
            <button
              onClick={onConfirm}
              disabled={busy}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-soft transition disabled:opacity-60",
                tone === "danger" ? "bg-danger hover:opacity-90" : "bg-emerald-800 hover:bg-emerald-900",
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </button>
            <AD.Cancel asChild>
              <button className="inline-flex h-10 items-center rounded-xl bg-surface px-5 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-surface-2">
                {cancelLabel}
              </button>
            </AD.Cancel>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
