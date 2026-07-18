import { MapPin, CalendarDays, Sparkles } from "lucide-react";

interface Props {
  mosqueName: string;
  hijriDate: string;
  location: string;
  statusLabel: string;
}

export function ReportHeader({ mosqueName, hijriDate, location, statusLabel }: Props) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <Sparkles className="size-5" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {mosqueName}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-100">
            <span className="size-1.5 animate-pulse rounded-full bg-gold-600" />
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-ink-faint" strokeWidth={1.5} />
            {hijriDate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-ink-faint" strokeWidth={1.5} />
            {location}
          </span>
        </div>
      </div>
    </header>
  );
}
