import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// لوح جانبي موحّد (Radix Dialog) لنماذج التحرير/التفاصيل — بلغة مشكاة، RTL.
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function MDrawer({ open, onOpenChange, title, description, children, footer }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(94vw,30rem)] flex-col bg-surface shadow-soft ring-1 ring-line",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-base font-semibold text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-xs text-ink-soft">{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <button aria-label="إغلاق" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-2 hover:text-ink">
                <X className="size-4" strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
