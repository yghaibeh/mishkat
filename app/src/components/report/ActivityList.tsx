interface Activity {
  name: string;
  count: number;
  points: number;
}

// لا نِسَبَ زائفة (كانت 100% دائمًا لأنّ target=points — تدقيق ٣٣): العدُّ والنقاطُ الحقيقيّان فقط.
export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <div className="rounded-2xl bg-surface ring-1 ring-line">
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink">تفصيل الأنشطة</h3>
      </div>
      <ul className="divide-y divide-line">
        {items.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-ink-faint">لا أنشطة مسجّلة هذا الشهر بعد.</li>
        )}
        {items.map((a) => (
          <li key={a.name} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{a.name}</p>
            <span className="shrink-0 text-[11px] text-ink-faint font-mono-nums">{a.count} مرة</span>
            <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 font-mono-nums">
              {a.points} نقطة
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
