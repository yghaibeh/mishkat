import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Loader2, Send, CheckCircle2, Stamp, Plus, MapPin, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtHijriShort } from "@/lib/format";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { CircleRankings } from "@/components/circles/CircleRankings";
import { getSupervisionVisits, getSupervisableCircles, getSupervisionDashboard, createSupervisionVisit, submitSupervisionVisit, approveSupervisionVisit } from "@/lib/api/supervision";

type Circle = { kind: "tahfeez" | "baseera"; id: string; name: string; mosqueName: string; mosqueId?: string | null };
type DashCircle = Circle & { lastVisitAt: number | null; lastVisitBy: string | null; lastScore: number | null; daysSince: number | null; status: string };
type Dashboard = { circles: DashCircle[]; cadenceDays: number; summary?: { total: number; never: number; overdue: number } };
type Visit = { id: string; circleKind: string; circleName: string; visitedByName: string | null; visitDateHijri: string | null; monthlyVisitNo: number | null; studentCount: number | null; finalScore: number | null; notes: string | null; details: Record<string, unknown>; status: string; approvedByName: string | null };
const CIRCLE_STATUS: Record<string, { label: string; cls: string }> = {
  never: { label: "لم تُزَر بعد", cls: "bg-danger-bg text-danger ring-danger/20" },
  overdue: { label: "زيارةٌ متأخّرة", cls: "bg-warn-bg text-warn ring-warn/20" },
  recent: { label: "زِيرت حديثًا", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
};

// تقييمات ١–٥ لحلقة التحفيظ (صورة ١)
const TAHFEEZ_DIMS: Array<{ k: string; label: string }> = [
  { k: "quranPlan", label: "التزامه بخطة القرآن للطلاب" },
  { k: "teacherMemorization", label: "حفظ المعلّم للمطلوب منه" },
  { k: "tajweedPlan", label: "التزامه بخطة التجويد" },
  { k: "recordsFilling", label: "تعبئة السجلات" },
  { k: "studentsMorals", label: "العناية بأخلاق الطلاب" },
  { k: "attendance", label: "الالتزام بساعات وأيام الدوام" },
];
const RATE_OPTS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `★ ${n}` }));
const STATUS_AR: Record<string, string> = { draft: "مسودة", submitted: "مُقدَّم للإدارة", approved: "معتمَد" };

export function SupervisionRegister() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [mine, setMine] = useState<Visit[]>([]);
  const [pending, setPending] = useState<Visit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("");

  const load = () => {
    getSupervisableCircles().then((r) => setCircles((r as { items: Circle[] }).items)).catch(() => {});
    getSupervisionDashboard().then((r) => setDash(r as Dashboard)).catch(() => {});
    getSupervisionVisits().then((r) => { const d = r as { mine: Visit[]; pending: Visit[] }; setMine(d.mine); setPending(d.pending); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const act = async (key: string, fn: () => Promise<{ error?: string } | { ok: true } | { ok: true; id: string }>, ok: string, after?: () => void) => {
    setBusy(key);
    try { const r = await fn(); if (r && "error" in r && r.error) toast.error(r.error); else { toast.success(ok); after?.(); load(); } }
    catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };
  const startVisit = (c: DashCircle) => {
    setPreset(`${c.kind}:${c.id}`); setOpen(true);
    // الهبوط إلى نموذج الزيارة — كان الزرّ يفتح النموذج دون أن يُرى
    setTimeout(() => {
      const el = document.getElementById("visit-form");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76 });
    }, 80);
  };

  return (
    <div className="space-y-6">
      {/* لوحة الإشراف الميدانيّ — حلقاتك وحالة زياراتها */}
      {dash && dash.circles.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
            <MapPin className="size-4 text-emerald-800" strokeWidth={1.75} />
            <h3 className="font-display text-sm font-semibold text-ink">لوحة الإشراف الميدانيّ</h3>
            <span className="text-[11px] text-ink-faint">— زيارةٌ لكلّ حلقةٍ كلّ {dash.cadenceDays} يومًا</span>
            {dash.summary && (dash.summary.never + dash.summary.overdue) > 0 && (
              <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-bold text-danger ring-1 ring-danger/20">
                <AlertTriangle className="size-3.5" /> {dash.summary.never + dash.summary.overdue} تحتاج زيارة
              </span>
            )}
          </div>
          <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
            {dash.circles.map((c) => {
              const st = CIRCLE_STATUS[c.status] ?? CIRCLE_STATUS.recent;
              return (
                <li key={`${c.kind}:${c.id}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><ClipboardCheck className="size-[18px]" strokeWidth={1.75} /></span>
                  <div className="min-w-0 flex-1">
                    {c.mosqueId ? (
                      <Link to="/mosque/$mosqueId" params={{ mosqueId: c.mosqueId }} search={{ t: c.kind === "tahfeez" ? "tahfeez" : "halaqat" } as never} title="ادخل إلى الحلقة"
                        className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:text-emerald-800 hover:underline">
                        {c.name} <span className="text-[11px] font-normal text-ink-faint">· {c.kind === "tahfeez" ? "تحفيظ" : "على بصيرة"} · {c.mosqueName}</span>
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold text-ink">{c.name} <span className="text-[11px] font-normal text-ink-faint">· {c.kind === "tahfeez" ? "تحفيظ" : "على بصيرة"} · {c.mosqueName}</span></p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                      <CalendarClock className="size-3" strokeWidth={1.75} />
                      {c.lastVisitAt ? `آخر زيارة قبل ${c.daysSince} يومًا — ${fmtHijriShort(c.lastVisitAt)}${c.lastScore != null ? ` · ${c.lastScore}٪` : ""}` : "لم تُسجَّل زيارةٌ بعد"}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", st.cls)}>{st.label}</span>
                  <button onClick={() => startVisit(c)} disabled={!!busy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900 disabled:opacity-60">
                    <Plus className="size-3.5" /> سجّل زيارة
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* تقييم الحلقات الدوريّ عبر نطاق المشرف (المربع/المنطقة) */}
      <CircleRankings title="ترتيب الحلقات في نطاقك" />

      <div className="grid gap-6 lg:grid-cols-5">
      <section id="visit-form" className="space-y-3 scroll-mt-20 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><ClipboardCheck className="size-4 text-emerald-800" strokeWidth={1.75} /> السجل الإشرافيّ</h2>
          <button onClick={() => { setPreset(""); setOpen((v) => !v); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900">
            <Plus className="size-3.5" /> زيارةٌ جديدة
          </button>
        </div>
        {open && <VisitForm key={preset || "new"} circles={circles} busy={busy} initialCircleKey={preset} onCreate={(payload) => act("create", () => createSupervisionVisit({ data: payload as never }), "سُجّلت الزيارة", () => setOpen(false))} />}

        <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">زياراتي</h3>
        {mine.length === 0 ? <p className="text-xs text-ink-soft">لا زيارات بعد.</p> : (
          <ul className="space-y-2">
            {mine.map((v) => (
              <li key={v.id} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{v.circleName}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", v.status === "approved" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : v.status === "submitted" ? "bg-gold-50 text-gold-800 ring-gold-200" : "bg-surface-2 text-ink-soft ring-line")}>{STATUS_AR[v.status]}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">{v.circleKind === "tahfeez" ? "تحفيظ" : "على بصيرة"} · {v.visitDateHijri ?? "—"}{v.finalScore != null && ` · ${v.finalScore}٪`}</p>
                {v.status === "draft" && (
                  <button onClick={() => act(`s${v.id}`, () => submitSupervisionVisit({ data: { id: v.id } }), "رُفعت للإدارة")} disabled={!!busy}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 hover:text-emerald-900 disabled:opacity-60">
                    {busy === `s${v.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} رفع للإدارة
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-3">
        <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-gold-300/50">
          <div className="flex items-center gap-2 border-b border-line bg-gold-50/60 px-4 py-3">
            <Stamp className="size-4 text-gold-700" strokeWidth={1.75} />
            <h3 className="font-display text-sm font-semibold text-ink">زياراتٌ بانتظار اعتمادك</h3>
            <span className="rounded-full bg-gold-100 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-800">{pending.length}</span>
          </div>
          {pending.length === 0 ? <p className="px-4 py-8 text-center text-xs text-ink-soft">لا زيارات بانتظار اعتمادك.</p> : (
            <ul className="divide-y divide-line">
              {pending.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{v.circleName}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">{v.visitedByName} · {v.circleKind === "tahfeez" ? "تحفيظ" : "على بصيرة"} · {v.visitDateHijri ?? "—"}{v.finalScore != null && ` · ${v.finalScore}٪`}</p>
                    </div>
                    <button onClick={() => act(`a${v.id}`, () => approveSupervisionVisit({ data: { id: v.id } }), "اعتُمدت الزيارة")} disabled={!!busy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900 disabled:opacity-60">
                      {busy === `a${v.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} اعتماد
                    </button>
                  </div>
                  {v.notes && <p className="mt-1.5 rounded-lg bg-surface-2/60 px-2 py-1 text-[11px] text-ink-soft">{v.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

function VisitForm({ circles, busy, initialCircleKey, onCreate }: { circles: Circle[]; busy: string | null; initialCircleKey?: string; onCreate: (p: Record<string, unknown>) => void }) {
  const [circleKey, setCircleKey] = useState(initialCircleKey ?? "");
  const [date, setDate] = useState(""); const [visitNo, setVisitNo] = useState(""); const [students, setStudents] = useState("");
  const [score, setScore] = useState(""); const [notes, setNotes] = useState("");
  const [dims, setDims] = useState<Record<string, string>>({});
  const [b, setB] = useState<Record<string, string>>({}); // حقول على‑بصيرة

  const sel = circles.find((c) => `${c.kind}:${c.id}` === circleKey);
  const submit = () => {
    if (!sel) { toast.error("اختر الحلقة"); return; }
    const details = sel.kind === "tahfeez"
      ? { ...Object.fromEntries(TAHFEEZ_DIMS.map((d) => [d.k, Number(dims[d.k]) || undefined])), logistics: b.logistics || undefined }
      : { activityTitle: b.activityTitle || undefined, last5Activities: b.last5Activities || undefined, registeredCount: Number(b.registeredCount) || undefined, actualAttendance: Number(b.actualAttendance) || undefined, place: b.place || undefined, lessonNo: b.lessonNo || undefined, supervisionEval: Number(b.supervisionEval) || undefined };
    onCreate({
      circleKind: sel.kind, circleRefId: sel.id, visitDateHijri: date || undefined,
      monthlyVisitNo: Number(visitNo) || undefined, studentCount: Number(students) || undefined,
      finalScore: sel.kind === "tahfeez" ? (Number(score) || undefined) : undefined, notes: notes || undefined, details,
    });
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Field label="الحلقة">
        <MSelect value={circleKey} onValueChange={setCircleKey} placeholder="اختر الحلقة…"
          options={circles.map((c) => ({ value: `${c.kind}:${c.id}`, label: `${c.name} — ${c.mosqueName} (${c.kind === "tahfeez" ? "تحفيظ" : "على بصيرة"})` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="تاريخ الزيارة (هجريّ)"><TextField value={date} onChange={(e) => setDate(e.target.value)} placeholder="1447-12-05" dir="ltr" /></Field>
        <Field label="عدد الطلاب"><TextField type="number" value={students} onChange={(e) => setStudents(e.target.value)} /></Field>
      </div>

      {sel?.kind === "tahfeez" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="رقم الزيارة الشهريّ"><TextField type="number" value={visitNo} onChange={(e) => setVisitNo(e.target.value)} /></Field>
            <Field label="التقييم النهائيّ (٪)"><TextField type="number" value={score} onChange={(e) => setScore(e.target.value)} /></Field>
          </div>
          <div className="space-y-1.5 rounded-xl bg-surface-2/50 p-2.5">
            {TAHFEEZ_DIMS.map((d) => (
              <div key={d.k} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[12px] text-ink-soft">{d.label}</span>
                <div className="w-24 shrink-0"><MSelect value={dims[d.k] ?? ""} onValueChange={(v) => setDims((m) => ({ ...m, [d.k]: v }))} options={RATE_OPTS} placeholder="—" /></div>
              </div>
            ))}
          </div>
          <Field label="لوازم لوجستية"><TextField value={b.logistics ?? ""} onChange={(e) => setB((m) => ({ ...m, logistics: e.target.value }))} /></Field>
        </>
      )}

      {sel?.kind === "baseera" && (
        <>
          <Field label="عنوان النشاط / الدرس (تفصيلًا)"><TextField value={b.activityTitle ?? ""} onChange={(e) => setB((m) => ({ ...m, activityTitle: e.target.value }))} /></Field>
          <Field label="آخر خمس نشاطات قامت بها الحلقة"><TextField value={b.last5Activities ?? ""} onChange={(e) => setB((m) => ({ ...m, last5Activities: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="عدد المسجّلين"><TextField type="number" value={b.registeredCount ?? ""} onChange={(e) => setB((m) => ({ ...m, registeredCount: e.target.value }))} /></Field>
            <Field label="الحضور الفعليّ"><TextField type="number" value={b.actualAttendance ?? ""} onChange={(e) => setB((m) => ({ ...m, actualAttendance: e.target.value }))} /></Field>
            <Field label="المكان"><TextField value={b.place ?? ""} onChange={(e) => setB((m) => ({ ...m, place: e.target.value }))} /></Field>
            <Field label="رقم الدرس في المكان"><TextField type="number" value={b.lessonNo ?? ""} onChange={(e) => setB((m) => ({ ...m, lessonNo: e.target.value }))} /></Field>
          </div>
          <Field label="تقييم الإشراف (١–٥)"><div className="w-28"><MSelect value={b.supervisionEval ?? ""} onValueChange={(v) => setB((m) => ({ ...m, supervisionEval: v }))} options={RATE_OPTS} placeholder="—" /></div></Field>
        </>
      )}

      <Field label="ملاحظات المشرف واقتراحاته"><TextField value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button onClick={submit} disabled={busy === "create" || !sel}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint">
        {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} حفظ الزيارة (مسودة)
      </button>
    </div>
  );
}
