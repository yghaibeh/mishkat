import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// شريط تبويبات علوي موحّد (نمط الشريط العلوي) — أفقي قابل للتمرير، يُبرز النشِط ويمرّره للوسط، RTL.
export type TabOption = { value: string; label: string };

export function MTabs({ value, onValueChange, options, className }: {
  value: string;
  onValueChange: (v: string) => void;
  options: TabOption[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [value]);
  return (
    <div ref={ref} role="tablist" className={cn("flex items-center gap-0.5 overflow-x-auto border-b border-line", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            data-active={active}
            aria-current={active ? "page" : undefined}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center whitespace-nowrap px-3.5 text-sm font-medium transition-colors sm:px-4",
              active ? "text-emerald-800" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-800" />}
          </button>
        );
      })}
    </div>
  );
}
