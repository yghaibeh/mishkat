import { Target, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseProps {
  label: string;
  className?: string;
}

const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";

export function KpiProgressCard({
  label,
  value,
  total,
  percent,
}: BaseProps & { value: number; total: number; percent: number }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
      <div className="flex items-center justify-between">
        <span className={tile}><Target className="size-[18px]" strokeWidth={1.75} /></span>
        <span className="font-mono-nums text-[11px] font-semibold text-ink-faint">{percent}%</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5 font-mono-nums">
        <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{value}</span>
        <span className="text-base text-ink-faint">/ {total}</span>
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function KpiPercentCard({
  label,
  percent,
  delta,
}: BaseProps & { percent: number; delta: string }) {
  const segments = 5;
  const filled = Math.round((percent / 100) * segments);
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
      <div className="flex items-center justify-between">
        <span className={tile}><TrendingUp className="size-[18px]" strokeWidth={1.75} /></span>
        <span className="text-[11px] font-medium text-success">{delta}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 font-mono-nums">
        <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{percent}%</span>
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < filled ? "bg-emerald-700" : "bg-surface-2")} />
        ))}
      </div>
    </div>
  );
}

export function KpiAmountCard({
  label,
  amount,
  note,
}: BaseProps & { amount: string; note: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
      <div className="flex items-center justify-between">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10">
          <Wallet className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span className="text-[11px] font-medium text-emerald-100/70">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
        <span className="text-sm font-medium text-emerald-100/80">$</span>
        <span className="text-3xl font-semibold tracking-tight text-gold-100 sm:text-4xl">{amount}</span>
      </div>
      <p className="mt-3 text-[11px] text-emerald-100/60">{note}</p>
    </div>
  );
}
