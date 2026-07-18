import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const baseControl =
  "h-10 w-full rounded-xl bg-surface px-3 text-sm text-ink ring-1 ring-line outline-none transition placeholder:text-ink-faint hover:ring-line-strong focus:ring-2 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

// غلاف حقل موحّد: عنوان + تحكّم + تلميح/خطأ
export function Field({
  label, hint, error, required, htmlFor, children, className,
}: {
  label?: string; hint?: string; error?: string; required?: boolean;
  htmlFor?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(baseControl, className)} {...props} />,
);
TextField.displayName = "TextField";

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseControl, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />
  ),
);
TextArea.displayName = "TextArea";

// مفتاح مقسّم (اختيارات قليلة متبادلة: الجنس/المسار…)
export type SegOption = { value: string; label: string; icon?: LucideIcon };
export function SegmentedControl({
  value, onValueChange, options, className, size = "md",
}: {
  value: string; onValueChange: (v: string) => void; options: SegOption[]; className?: string; size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-8 text-xs" : "h-10 text-sm";
  return (
    <div role="tablist" className={cn("inline-flex w-full gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-line", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-semibold transition",
              h,
              active ? "bg-emerald-800 text-emerald-50 shadow-soft" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.icon && <o.icon className="size-4" strokeWidth={1.75} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
