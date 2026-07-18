import { useEffect, useState } from "react";
import { CalendarDays, Plus, Loader2, Clock3, MapPin, CheckCircle2, Users, Printer, AlertTriangle, BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/escape-html";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { getMosqueLessons, saveLesson, setLessonStatus, getLessonAttendance, addLessonAttendee, removeLessonAttendee } from "@/lib/api/mosqueLessons";

// تبويب «الدروس» (الوثيقة ٢٦ §د): جلسات اليوم بارزة + القادم + المُلقاة، كشف تعارض، حضور، طباعة.

type Item = { id: string; title: string; description: string | null; place: string | null; startsAt: number; durationMin: number; status: string; materialTitle: string | null; attendees: number };
type Data = { today: Item[]; upcoming: Item[]; delivered: Item[] };

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "مجدول", cls: "bg-surface-2 text-ink-soft ring-line" },
  confirmed: { label: "مؤكَّد", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
  delivered: { label: "أُلقي", cls: "bg-gold-50 text-gold-800 ring-gold-100" },
};
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { weekday: "long", day: "numeric", month: "long" });

export function LessonsTab({ mosqueId, canManage }: { mosqueId: string; canManage: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [attFor, setAttFor] = useState<Item | null>(null);
  const load = () => { getMosqueLessons({ data: { mosqueId } }).then((r) => { if (!("error" in (r as object))) setData(r as Data); }).catch(() => {}); };
  useEffect(() => { load(); }, [mosqueId]);

  const mark = async (id: string, status: "confirmed" | "delivered" | "cancelled") => {
    const r = await setLessonStatus({ data: { id, status } });
    if (r && "error" in r && r.error) toast.error(r.error);
    else { toast.success(status === "delivered" ? "سُجّل الإلقاء" : status === "cancelled" ? "أُلغي الدرس" : "أُكّد الموعد"); load(); }
  };

  const print = () => {
    if (!data) return;
    const rows = [...data.today, ...data.upcoming].map((l) => `<tr><td>${escapeHtml(l.title)}</td><td>${fmtDate(l.startsAt)} ${fmtTime(l.startsAt)}</td><td>${l.durationMin} د</td><td>${escapeHtml(l.place ?? "")}</td><td>${escapeHtml(l.materialTitle ?? "")}</td></tr>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>جدول الدروس</title>
      <style>body{font-family:system-ui;padding:2rem}h1{font-size:1.2rem}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:.5rem;text-align:right;font-size:.9rem}</style></head>
      <body><h1>جدول دروس المسجد</h1><table><tr><th>الدرس</th><th>الموعد</th><th>المدّة</th><th>المكان</th><th>المادّة</th></tr>${rows}</table>
      <script>print()</script></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  if (!data) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;

  const Section = ({ title, items, emph }: { title: string; items: Item[]; emph?: boolean }) => (
    <section className={cn("overflow-hidden rounded-2xl bg-surface ring-1", emph ? "ring-emerald-200" : "ring-line")}>
      <div className={cn("flex items-center gap-2 border-b border-line px-5 py-3.5", emph && "bg-emerald-50/50")}>
        <CalendarDays className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-ink-soft">{items.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((l) => {
          const st = STATUS[l.status] ?? STATUS.scheduled;
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{l.title}
                  {l.materialTitle && <span className="ms-1.5 inline-flex items-center gap-0.5 text-[11px] font-normal text-ink-faint"><BookOpen className="size-3" /> {l.materialTitle}</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
                  <span className="inline-flex items-center gap-0.5"><Clock3 className="size-3" /> {fmtDate(l.startsAt)} · {fmtTime(l.startsAt)} · {l.durationMin} د</span>
                  {l.place && <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" /> {l.place}</span>}
                  <span className="inline-flex items-center gap-0.5"><Users className="size-3" /> {l.attendees} حاضر</span>
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", st.cls)}>{st.label}</span>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setAttFor(l)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line hover:bg-surface-2">الحضور</button>
                {canManage && l.status === "scheduled" && <button onClick={() => mark(l.id, "confirmed")} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">تأكيد</button>}
                {canManage && l.status !== "delivered" && <button onClick={() => mark(l.id, "delivered")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-900"><CheckCircle2 className="size-3" /> أُلقي</button>}
                {canManage && l.status !== "delivered" && <button onClick={() => mark(l.id, "cancelled")} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger-bg" title="إلغاء"><X className="size-3" /></button>}
              </div>
            </li>
          );
        })}
        {!items.length && <li className="p-5 text-center text-[12px] text-ink-faint">لا دروس.</li>}
      </ul>
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><CalendarDays className="size-4 text-emerald-800" strokeWidth={1.75} /> دروس المسجد ومحاضراته</h2>
        <div className="flex gap-2">
          <button onClick={print} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line hover:bg-surface-2"><Printer className="size-3.5" /> طباعة الجدول</button>
          {canManage && (
            <button onClick={() => setFormOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
              <Plus className="size-3.5" /> درسٌ جديد
            </button>
          )}
        </div>
      </div>

      {formOpen && <LessonForm mosqueId={mosqueId} onDone={() => { setFormOpen(false); load(); }} />}
      {attFor && <AttendanceSheet lesson={attFor} onClose={() => { setAttFor(null); load(); }} />}

      <Section title="جلسات اليوم" items={data.today} emph />
      <Section title="الجدول القادم" items={data.upcoming} />
      <Section title="الدروس المُلقاة" items={data.delivered} />
    </div>
  );
}

function LessonForm({ mosqueId, onDone }: { mosqueId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("45");
  const [conflict, setConflict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (force = false) => {
    if (!title.trim() || !date || !time) { toast.error("العنوان والموعد مطلوبان"); return; }
    const startsAt = new Date(`${date}T${time}`).getTime();
    if (!startsAt || Number.isNaN(startsAt)) { toast.error("موعدٌ غير صالح"); return; }
    setBusy(true); setConflict(null);
    try {
      const r = await saveLesson({ data: { mosqueId, title: title.trim(), description: description.trim() || undefined, place: place.trim() || undefined, startsAt, durationMin: Number(duration) || 45, force } });
      if (r && "conflictWith" in r && r.conflictWith) {
        setConflict(`يوجد درسٌ آخر في نفس الموعد: «${r.conflictWith.title}» (${fmtTime(r.conflictWith.startsAt)})`);
      } else if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("أُضيف الدرس"); onDone(); }
    } catch { toast.error("تعذّرت الإضافة"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Field label="عنوان الدرس"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="تفسير سورة الكهف" /></Field>
      <Field label="وصفٌ مختصر (اختياري)"><TextField value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="التاريخ"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" /></Field>
        <Field label="الوقت"><TextField type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr" /></Field>
        <Field label="المدّة (دقيقة)"><TextField type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
        <Field label="المكان (اختياري)"><TextField value={place} onChange={(e) => setPlace(e.target.value)} placeholder="المصلّى الرئيس" /></Field>
      </div>
      {conflict && (
        <div className="flex items-start gap-2 rounded-xl bg-warn-bg p-3 text-[11px] font-semibold text-warn ring-1 ring-warn/20">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{conflict} — أتُريد الإضافة رغم ذلك؟
            <button onClick={() => submit(true)} className="ms-2 rounded-md bg-warn px-2 py-0.5 text-[10px] font-bold text-white">نعم، أضِف</button>
          </span>
        </div>
      )}
      <button onClick={() => submit(false)} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة الدرس
      </button>
    </div>
  );
}

function AttendanceSheet({ lesson, onClose }: { lesson: Item; onClose: () => void }) {
  const [data, setData] = useState<{ attendees: Array<{ id: string; name: string }>; suggestions: string[] } | null>(null);
  const [name, setName] = useState("");
  const load = () => { getLessonAttendance({ data: { lessonId: lesson.id } }).then((r) => { if (!("error" in (r as object))) setData(r as never); }).catch(() => {}); };
  useEffect(() => { load(); }, [lesson.id]);

  const add = async (n: string) => {
    if (!n.trim()) return;
    const r = await addLessonAttendee({ data: { lessonId: lesson.id, name: n.trim() } });
    if (r && "error" in r && r.error) toast.error(r.error); else { setName(""); load(); }
  };
  const remove = async (id: string) => { await removeLessonAttendee({ data: { id } }); load(); };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-emerald-200">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><Users className="size-4 text-emerald-800" /> حضور «{lesson.title}»</h3>
        <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-ink-faint ring-1 ring-line hover:bg-surface-2"><X className="size-3.5" /></button>
      </div>
      {!data ? <div className="flex justify-center p-4"><Loader2 className="size-4 animate-spin text-ink-faint" /></div> : (
        <>
          <div className="flex gap-2">
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الحاضر…" onKeyDown={(e) => { if (e.key === "Enter") add(name); }} />
            <button onClick={() => add(name)} className="shrink-0 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">إضافة</button>
          </div>
          {data.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.suggestions.slice(0, 20).map((s) => (
                <button key={s} onClick={() => add(s)} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink-soft ring-1 ring-line hover:bg-emerald-50 hover:text-emerald-800">+ {s}</button>
              ))}
            </div>
          )}
          <ul className="divide-y divide-line rounded-xl bg-surface-2/40 ring-1 ring-line">
            {data.attendees.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm text-ink">
                {a.name}
                <button onClick={() => remove(a.id)} aria-label="إزالة المرفق" className="rounded-md p-1 text-ink-faint hover:bg-danger-bg hover:text-danger"><X className="size-3" /></button>
              </li>
            ))}
            {!data.attendees.length && <li className="p-3 text-center text-[12px] text-ink-faint">لا حضور مسجَّلٌ بعد.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
