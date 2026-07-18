import * as React from "react";
import * as S from "@radix-ui/react-select";
import { Check, ChevronsUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Select عالمي بلغة تصميم مشكاة (مبني على Radix — وصول كامل ولوحة مفاتيح وRTL)
export type MOption = { value: string; label: string; icon?: LucideIcon; hint?: string };
export type MGroup = { label?: string; options: MOption[] };

interface MSelectProps {
  value?: string;
  onValueChange?: (v: string) => void;
  options?: MOption[];
  groups?: MGroup[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function MSelect({ value, onValueChange, options, groups, placeholder = "اختر…", disabled, className, ...rest }: MSelectProps) {
  const grouped: MGroup[] = groups ?? [{ options: options ?? [] }];
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled} dir="rtl">
      <S.Trigger
        aria-label={rest["aria-label"]}
        className={cn(
          "group inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 text-sm text-ink ring-1 ring-line outline-none transition",
          "hover:ring-line-strong focus:ring-2 focus:ring-emerald-600 data-[state=open]:ring-2 data-[state=open]:ring-emerald-600",
          "data-[placeholder]:text-ink-faint disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:opacity-70",
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon asChild>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-faint transition group-data-[state=open]:text-emerald-700" strokeWidth={1.75} />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          dir="rtl"
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl bg-surface p-1 text-ink shadow-soft ring-1 ring-line",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1",
          )}
        >
          <S.Viewport className="p-0.5">
            {grouped.map((g, gi) => (
              <S.Group key={gi}>
                {g.label && (
                  <S.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
                    {g.label}
                  </S.Label>
                )}
                {g.options.map((o) => (
                  <S.Item
                    key={o.value}
                    value={o.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition",
                      "data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900 data-[state=checked]:font-semibold",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    )}
                  >
                    {o.icon && <o.icon className="size-4 shrink-0 text-emerald-700" strokeWidth={1.75} aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <S.ItemText>{o.label}</S.ItemText>
                      {o.hint && <span className="block truncate text-[11px] font-normal text-ink-faint">{o.hint}</span>}
                    </span>
                    <S.ItemIndicator>
                      <Check className="size-4 shrink-0 text-emerald-700" strokeWidth={2.25} />
                    </S.ItemIndicator>
                  </S.Item>
                ))}
              </S.Group>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
