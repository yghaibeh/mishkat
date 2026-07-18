import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCircleRankings } from "@/lib/api/tahfeez";

// تقييم الحلقات الدوريّ (قرار اللجنة): ترتيبٌ بالحضور والإنجاز آخر ٣٠ يومًا —
// للأمير في مسجده، وللمشرف عبر نطاقه (المربع/المنطقة) — «أفضل حلقة… وعلى ذلك يُكرَم».
type Item = { id: string; name: string; mosqueName: string; sessionsCount: number; attendancePct: number; avgGrade: number; score: number };

export function CircleRankings({ mosqueId, title }: { mosqueId?: string; title?: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    getCircleRankings({ data: { mosqueId } })
      .then((r) => { const d = r as { items?: Item[] }; setItems(d.items ?? []); })
      .catch(() => setItems([]));
  }, [mosqueId]);

  if (!items) return <div className="flex justify-center p-4"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>;
  if (items.length < 2) return null; // الترتيب يحتاج حلقتين فأكثر
  // قاعدة الصفر (٣٤): لا ترتيبَ كلُّه أصفارٌ «خاملة» — لا معنى لترتيبٍ بلا نشاط
  if (items.every((c) => c.sessionsCount === 0)) return null;

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);
  const tone = (i: number, len: number) =>
    i === 0 ? "bg-emerald-50 ring-emerald-200" : i === len - 1 ? "bg-danger-bg/40 ring-danger/20" : "bg-surface ring-line";

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <Trophy className="size-4 text-gold-700" strokeWidth={1.75} />
        <h3 className="font-display text-sm font-semibold text-ink">{title ?? "تقييم الحلقات الدوريّ"}</h3>
        <span className="text-[11px] text-ink-faint">— بالحضور والإنجاز آخر ٣٠ يومًا</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((c, i) => (
          <li key={c.id} className={cn("flex items-center gap-3 px-5 py-3 ring-0", tone(i, items.length))}>
            <span className="w-7 shrink-0 text-center text-base">{medal(i)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{c.name} <span className="text-[11px] font-normal text-ink-faint">· {c.mosqueName}</span></p>
              <p className="mt-0.5 font-mono-nums text-[11px] text-ink-faint">
                حضور {c.attendancePct}٪ · متوسّط العلامات {c.avgGrade} · {c.sessionsCount} جلسة
                {c.sessionsCount === 0 && <span className="font-sans font-bold text-danger"> — خاملة</span>}
              </p>
            </div>
            <div className="w-24 shrink-0">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
                <div className={cn("h-full rounded-full", c.score >= 75 ? "bg-emerald-700" : c.score >= 50 ? "bg-warn" : "bg-danger")} style={{ width: `${c.score}%` }} />
              </div>
            </div>
            <span className="w-10 shrink-0 text-end font-mono-nums text-sm font-bold text-ink">{c.score}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
