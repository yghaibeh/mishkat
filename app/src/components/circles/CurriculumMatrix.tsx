import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getHalaqaCurriculum, setCurriculumProgress } from "@/lib/api/alaBaseera";

type Cell = { majlis: string; status: string };
type Student = { id: string; name: string; progress: number; cells: Cell[] };
type Data = { majalis: string[]; students: Student[] };

const CYCLE: Record<string, "not_started" | "in_progress" | "completed"> = { not_started: "in_progress", in_progress: "completed", completed: "not_started" };
const CELL_CLS: Record<string, string> = {
  completed: "bg-emerald-600 text-white",
  in_progress: "bg-gold-400 text-white",
  not_started: "bg-surface-2 text-ink-faint ring-1 ring-line",
};

// مصفوفة تقدّم المنهج: طالبات (صفوف) × مجالس (أعمدة). النقر يبدّل الحالة يدويًّا.
export function CurriculumMatrix({ halaqaId }: { halaqaId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => { getHalaqaCurriculum({ data: { halaqaId } }).then((r) => setData(r as Data)).catch(() => setData(null)).finally(() => setLoading(false)); };
  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [halaqaId]);

  const toggle = async (enrollmentId: string, manhajKey: string, cur: string) => {
    const next = CYCLE[cur] ?? "in_progress";
    try { await setCurriculumProgress({ data: { halaqaId, enrollmentId, manhajKey, status: next } }); load(); }
    catch { toast.error("تعذّر التحديث"); }
  };

  if (loading) return <div className="grid place-items-center py-4 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>;
  if (!data || data.majalis.length === 0) return <p className="py-2 text-center text-[11px] text-ink-faint">لا مجالس مطروقة بعد (تُملأ آليًّا عند اعتماد الدروس).</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <GraduationCap className="size-3.5 text-emerald-800" strokeWidth={1.75} /> تقدّم المنهج
        <span className="ms-auto text-[10px] font-normal text-ink-faint">أخضر مكتمل · ذهبيّ جارٍ · انقر للتبديل</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[11px]">
          <thead>
            <tr>
              <th className="sticky start-0 bg-surface px-2 py-1 text-start font-medium text-ink-soft">الطالبة</th>
              {data.majalis.map((m, i) => <th key={m} className="px-1 py-1 font-medium text-ink-faint" title={m}>{i + 1}</th>)}
              <th className="px-2 py-1 font-medium text-ink-soft">٪</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td className="sticky start-0 max-w-28 truncate bg-surface px-2 py-1 text-ink">{s.name}</td>
                {s.cells.map((c) => (
                  <td key={c.majlis} className="px-0.5 py-0.5">
                    <button onClick={() => toggle(s.id, c.majlis, c.status)} title={c.majlis}
                      className={cn("size-5 rounded transition", CELL_CLS[c.status] ?? CELL_CLS.not_started)} />
                  </td>
                ))}
                <td className="px-2 py-1 font-mono-nums font-semibold text-emerald-800">{s.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
