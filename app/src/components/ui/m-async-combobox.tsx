import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Combobox ببحث على الخادم (type-ahead) — لا يحمّل القوائم كاملة؛ يتوسّع لعشرات الآلاف.
export type AsyncOption = { value: string; label: string; hint?: string; icon?: LucideIcon };

interface Props {
  value?: string;
  valueLabel?: string; // عنوان القيمة المختارة (تُحفظ في الأب لأن النتائج غير متزامنة)
  onChange: (value: string, label: string) => void;
  loadOptions: (query: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function MAsyncCombobox({
  value, valueLabel, onChange, loadOptions,
  placeholder = "اختر…", searchPlaceholder = "اكتب للبحث…", emptyText = "لا نتائج.", disabled, className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [opts, setOpts] = React.useState<AsyncOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const seq = React.useRef(0);
  const loadRef = React.useRef(loadOptions);
  loadRef.current = loadOptions;

  React.useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await loadRef.current(q.trim());
        if (id === seq.current) setOpts(r);
      } catch {
        if (id === seq.current) setOpts([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  React.useEffect(() => { if (open) setQ(""); }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "group inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 text-sm ring-1 ring-line outline-none transition",
            "hover:ring-line-strong focus:ring-2 focus:ring-emerald-600 data-[state=open]:ring-2 data-[state=open]:ring-emerald-600",
            "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70",
            value ? "text-ink" : "text-ink-faint",
            className,
          )}
        >
          <span className="truncate">{value ? valueLabel ?? "—" : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-faint transition group-data-[state=open]:text-emerald-700" strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start" sideOffset={6} dir="rtl"
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl bg-surface p-0 shadow-soft ring-1 ring-line",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Command shouldFilter={false} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
              {loading && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" />}
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1.5">
              {!loading && opts.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-ink-soft">{q ? emptyText : "اكتب حرفين للبحث…"}</div>
              )}
              {opts.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.value}
                  onSelect={() => { onChange(o.value, o.label); setOpen(false); }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink transition",
                    "data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-900",
                  )}
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
