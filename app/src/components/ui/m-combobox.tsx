import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Combobox عالمي قابل للبحث (Radix Popover + cmdk) — للقوائم الكبيرة (وحدات/أشخاص)
export type ComboOption = { value: string; label: string; hint?: string; icon?: LucideIcon; depth?: number };

interface Props {
  value?: string;
  onValueChange?: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function MCombobox({
  value, onValueChange, options, placeholder = "اختر…",
  searchPlaceholder = "ابحث…", emptyText = "لا نتائج.", disabled, className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "group inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 text-sm ring-1 ring-line outline-none transition",
            "hover:ring-line-strong focus:ring-2 focus:ring-emerald-600 data-[state=open]:ring-2 data-[state=open]:ring-emerald-600",
            "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70",
            selected ? "text-ink" : "text-ink-faint",
            className,
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            {selected?.icon && <selected.icon className="size-4 shrink-0 text-emerald-700" strokeWidth={1.75} aria-hidden />}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-faint transition group-data-[state=open]:text-emerald-700" strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          dir="rtl"
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl bg-surface p-0 shadow-soft ring-1 ring-line",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Command className="overflow-hidden" filter={(val, search) => (val.includes(search) ? 1 : 0)}>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
              <Command.Input
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-soft">{emptyText}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => { onValueChange?.(o.value); setOpen(false); }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink transition",
                    "data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-900",
                  )}
                  style={{ paddingInlineStart: `${10 + (o.depth ?? 0) * 16}px` }}
                >
                  {o.icon && <o.icon className="size-4 shrink-0 text-emerald-700" strokeWidth={1.75} aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-[11px] text-ink-faint">{o.hint}</span>}
                  </span>
                  <Check className={cn("size-4 shrink-0 text-emerald-700", value === o.value ? "opacity-100" : "opacity-0")} strokeWidth={2.25} />
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
