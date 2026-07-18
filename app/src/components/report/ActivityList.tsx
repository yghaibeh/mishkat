interface Activity {
  name: string;
  count: number;
  points: number;
  target: number;
}

export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <div className="rounded-2xl bg-surface ring-1 ring-line">
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink">تفصيل الأنشطة</h3>
      </div>
      <ul className="divide-y divide-line">
        {items.map((a) => {
          const pct = Math.round((a.points / a.target) * 100);
          return (
            <li key={a.name} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint font-mono-nums">
                    {a.count} مرة · {a.points}/{a.target} نقطة
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 font-mono-nums">
                  {pct}%
                </span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
