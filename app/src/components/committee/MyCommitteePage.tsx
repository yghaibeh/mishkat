// «لجنتي» — صفحةُ مسؤول اللجنة: يرى لجنتَه ويُدير خطّتها (بنودٌ مستمرّةٌ أو شهريّة) بكلّ سلاسة.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users2, Loader2, Plus, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getMyCommittees, addCommitteePlan, setCommitteePlanStatus } from "@/lib/api/committees";
import { hijriMonthOptions, hijriMonthLabel } from "@/lib/format";

type Plan = { id: string; title: string; recurring: boolean; monthHijri: string | null; status: string };
type Committee = { id: string; name: string; type: string; headName: string | null; plans: Plan[] };
const HIJRI_MONTHS = hijriMonthOptions(14);

function CommitteeBlock({ c, onChanged }: { c: Committee; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"recurring" | "month">("recurring");
  const [month, setMonth] = useState(HIJRI_MONTHS[0]?.value ?? "");
  const [adding, setAdding] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) { toast.error("عنوان غير صالح"); return; }
    setAdding(true);
    const recurring = mode === "recurring";
    try { await addCommitteePlan({ data: { committeeId: c.id, title: title.trim(), recurring, monthHijri: recurring ? null : month } }); setTitle(""); toast.success("أُضيف بندٌ للخطة"); onChanged(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const toggle = async (p: Plan) => {
    const next = p.status === "done" ? "planned" : "done";
    try { await setCommitteePlanStatus({ data: { planId: p.id, status: next } }); onChanged(); } catch { toast.error("تعذّر"); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><Users2 className="size-4" strokeWidth={1.75} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-semibold text-ink">{c.name}</h3>
          <p className="text-[11px] text-ink-faint">{c.type === "main" ? "لجنة رئيسية" : "لجنة فرعية"} · {c.plans.length} بند</p>
        </div>
      </div>
      {c.plans.length > 0 ? (
        <ul className="divide-y divide-line">
          {c.plans.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 px-5 py-2.5">
              <button onClick={() => toggle(p)} className={cn("shrink-0 transition hover:text-emerald-700", p.status === "done" ? "text-emerald-700" : "text-ink-faint")} aria-label="حالة البند">
                {p.status === "done" ? <CheckCircle2 className="size-4" strokeWidth={1.75} /> : <Circle className="size-4" strokeWidth={1.75} />}
              </button>
              <p className={cn("min-w-0 flex-1 truncate text-sm", p.status === "done" ? "text-ink-faint line-through" : "text-ink")}>{p.title}</p>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", p.recurring ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-surface-2 text-ink-soft ring-line")}>{p.recurring ? "مستمر" : p.monthHijri ? hijriMonthLabel(p.monthHijri) : "—"}</span>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-4 text-center text-[11px] text-ink-faint">لا بنود في خطتك بعد — أضِف أوّلَ بند.</p>}
      <form onSubmit={add} className="space-y-2 border-t border-line p-3">
        <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="بند جديد في الخطة…" />
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44"><SegmentedControl size="sm" value={mode} onValueChange={(v) => setMode(v as "recurring" | "month")} options={[{ value: "recurring", label: "مستمر" }, { value: "month", label: "شهر محدّد" }]} /></div>
          {mode === "month" && <div className="min-w-[10rem] flex-1"><MSelect value={month} onValueChange={setMonth} options={HIJRI_MONTHS} /></div>}
          <button type="submit" disabled={adding || title.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface disabled:text-ink-faint">{adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة بند</button>
        </div>
      </form>
    </section>
  );
}

export function MyCommitteePage() {
  const [items, setItems] = useState<Committee[] | null>(null);
  const load = () => getMyCommittees().then((r) => setItems((r as { items: Committee[] }).items)).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);
  return (
    <MishkatShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20"><Users2 className="size-5" strokeWidth={1.5} /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">لجنتي</h1>
            <p className="mt-1 text-sm text-ink-soft">متابعةُ عمل لجنتك وخطّتها</p>
          </div>
        </header>
        {items === null ? <div className="grid place-items-center py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
          : items.length === 0 ? <div className="grid place-items-center rounded-2xl bg-surface px-6 py-14 text-center text-sm text-ink-soft ring-1 ring-line">لا لجنةَ مُسنَدةً إليك بعد.</div>
          : <div className="space-y-4">{items.map((c) => <CommitteeBlock key={c.id} c={c} onChanged={load} />)}</div>}
      </main>
    </MishkatShell>
  );
}
