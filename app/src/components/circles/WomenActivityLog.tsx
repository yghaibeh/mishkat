import { useEffect, useState } from "react";
import { Minus, Plus, HeartHandshake, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDailyActivities } from "@/lib/api/functions";
import { enqueue, newClientUuid } from "@/lib/offline/outbox";

type Activity = { activityTypeId?: string; name: string; pts: number };

// سجلّ الأنشطة الدعوية للنساء (زيارة/جولات/توزيع حجابات…) — يُنسَب للوحدة النسائية بمخطط النساء.
export function WomenActivityLog({ unitId }: { unitId: string }) {
  const [acts, setActs] = useState<Activity[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [shura, setShura] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getDailyActivities({ data: { track: "female" } })
      .then((r) => { if (alive) { setActs((r.activities ?? []) as Activity[]); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const bump = (id: string, d: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));
  const total = acts.reduce((s, a) => s + a.pts * (counts[a.activityTypeId ?? ""] ?? 0), 0);

  const save = async () => {
    const batch = newClientUuid();
    const entries = acts
      .filter((a) => a.activityTypeId && (counts[a.activityTypeId] ?? 0) > 0)
      .map((a) => ({ activityTypeId: a.activityTypeId!, count: counts[a.activityTypeId!], clientUuid: `${batch}:${a.activityTypeId}`, recordedAt: Date.now() }));
    if (!entries.length) { toast.message("لا أنشطة لحفظها"); return; }
    setBusy(true);
    try {
      await enqueue("women_activity", { unitId, entries, shura }, { clientUuid: batch });
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      toast[offline ? "message" : "success"](offline ? "حُفظ محلّيًّا — سيُزامَن تلقائيًّا" : "حُفظ سجل الأنشطة");
      setCounts({});
    } catch { toast.error("تعذّر الحفظ"); } finally { setBusy(false); }
  };

  if (loading) return <div className="grid place-items-center py-6 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <HeartHandshake className="size-3.5 text-emerald-800" strokeWidth={1.75} />
        سجل الأنشطة الدعوية (نساء)
        <span className="ms-auto font-mono-nums text-[11px] text-emerald-800">{total} نقطة</span>
      </div>
      <ul className="divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
        {acts.map((a) => {
          const id = a.activityTypeId ?? a.name;
          const c = counts[id] ?? 0;
          return (
            <li key={id} className={cn("flex items-center gap-3 px-3 py-2", c > 0 && "bg-emerald-50/40")}>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.name}<span className="ms-1 text-[10px] text-ink-faint">({a.pts})</span></span>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-2 p-0.5 ring-1 ring-line">
                <button onClick={() => bump(id, -1)} disabled={c === 0} aria-label="إنقاص" className="grid size-8 place-items-center rounded-md text-ink disabled:opacity-40"><Minus className="size-3.5" strokeWidth={2} /></button>
                <span className="min-w-6 text-center font-mono-nums text-sm font-bold text-ink">{c}</span>
                <button onClick={() => bump(id, 1)} aria-label="زيادة" className="grid size-8 place-items-center rounded-md text-ink hover:bg-emerald-50 hover:text-emerald-800"><Plus className="size-3.5" strokeWidth={2} /></button>
              </div>
            </li>
          );
        })}
      </ul>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-soft">
        <input type="checkbox" checked={shura} onChange={(e) => setShura(e.target.checked)} className="size-3.5 accent-emerald-700" />
        أُقرّ أنّ هذه الأنشطة تمّت بالشورى.
      </label>
      <button onClick={save} disabled={busy || total === 0}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-800 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={2} />} حفظ الأنشطة
      </button>
    </div>
  );
}
