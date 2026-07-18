// «لجنتي» — صفحةُ مسؤول اللجنة: يرى لجنتَه ويُدير خطّتها (بنودٌ مستمرّةٌ أو شهريّة) بكلّ سلاسة.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users2, Loader2, Plus, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getMyCommittees, addCommitteePlan, setCommitteePlanStatus, getMyCommitteeWeek, submitCommitteeActivity } from "@/lib/api/committees";
import { hijriMonthOptions, hijriMonthLabel } from "@/lib/format";

// «أنشطتنا هذا الأسبوع» (ق1 — ع٧): اللجنة تُدخل نشاطها المنفَّذ فيُحتسب في سجل المسجد بعد إقرار الأمير.
type WeekData = {
  committeeName: string; recordStatus: string; points: number;
  items: Array<{ id: string; day: string; count: number; points: number; activity: string }>;
  activities: Array<{ id: string; name: string }>;
};
const REC_STATUS: Record<string, string> = {
  draft: "بانتظار إقرار الأمير ضمن سجل المسجد",
  amir_approved: "أقرّها الأمير — بانتظار الطبقة الأعلى",
  layer_approved: "معتمدة نهائياً ضمن سجل المسجد ✓",
};

function CommitteeWeek() {
  const [data, setData] = useState<WeekData | null>(null);
  const [actId, setActId] = useState("");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const load = () => getMyCommitteeWeek().then((r) => setData(r as WeekData)).catch(() => setData(null));
  useEffect(() => { void load(); }, []);
  if (!data) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(count, 10);
    if (!actId) { toast.error("اختر النشاط"); return; }
    if (!Number.isFinite(n) || n < 1) { toast.error("عددٌ غير صالح"); return; }
    setBusy(true);
    try { await submitCommitteeActivity({ data: { activityTypeId: actId, count: n } }); toast.success("سُجّل نشاط لجنتكم — بانتظار إقرار الأمير"); setCount("1"); await load(); }
    catch { toast.error("تعذّر التسجيل"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink">أنشطتنا هذا الأسبوع</h3>
        {data.points > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 font-mono-nums">أضفنا {data.points} نقطة لمسجدنا</span>}
      </div>
      {data.items.length > 0 ? (
        <>
          <ul className="divide-y divide-line">
            {data.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{i.activity}</span>
                <span className="shrink-0 text-xs text-ink-faint font-mono-nums">{i.count} مرة · {i.points} نقطة</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-2 text-[11px] text-ink-faint">{REC_STATUS[data.recordStatus] ?? ""}</p>
        </>
      ) : (
        <p className="px-5 py-4 text-center text-[11px] text-ink-faint">لم تسجّلوا نشاطاً هذا الأسبوع بعد — سجّل أول نشاط منفَّذ.</p>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-line p-3">
        <div className="min-w-[12rem] flex-1">
          <MSelect value={actId} onValueChange={setActId} placeholder="النشاط المنفَّذ…" options={data.activities.map((a) => ({ value: a.id, label: a.name }))} />
        </div>
        <div className="w-20"><TextField type="number" value={count} onChange={(e) => setCount(e.target.value)} dir="ltr" className="text-center" /></div>
        <button type="submit" disabled={busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} تسجيل</button>
      </form>
    </section>
  );
}

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
          : <div className="space-y-4"><CommitteeWeek />{items.map((c) => <CommitteeBlock key={c.id} c={c} onChanged={load} />)}</div>}
      </main>
    </MishkatShell>
  );
}
