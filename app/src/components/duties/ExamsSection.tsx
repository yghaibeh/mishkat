import { useEffect, useState } from "react";
import { FileQuestion, Loader2, Plus, CheckCircle2, Clock3, ChevronDown, Send, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getMyExams, getExamQuestions, submitExam, createExam, publishExam, getMyCreatedExams, closeExam } from "@/lib/api/exams";

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" });
const kindLabel = (k: string) => (k === "homework" ? "واجب" : "اختبار");

/* ===== قسم الطالب: اختباراتك وواجباتك ===== */
type MyExam = { id: string; title: string; kind: string; description: string | null; dueAt: number | null; overdue: boolean; mySubmission: { score: number; maxScore: number; submittedAt: number } | null };
export function StudentExams() {
  const [items, setItems] = useState<MyExam[] | null>(null);
  const [taking, setTaking] = useState<string | null>(null);
  const load = () => { getMyExams().then((r) => setItems((r as { items: MyExam[] }).items ?? [])).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);
  if (!items || !items.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><FileQuestion className="size-4 text-emerald-800" /> اختباراتك وواجباتك</h2>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className={cn("rounded-2xl bg-surface p-4 ring-1", e.mySubmission ? "ring-emerald-200" : "ring-line")}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{e.title} <span className="text-[11px] font-normal text-ink-faint">· {kindLabel(e.kind)}</span></p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                  {e.dueAt && <span className="inline-flex items-center gap-0.5"><Clock3 className="size-3" /> التسليم قبل {fmtDate(e.dueAt)}</span>}
                  {e.overdue && !e.mySubmission && <span className="font-bold text-danger">— انتهى وقت التسليم</span>}
                </p>
              </div>
              {e.mySubmission ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 font-mono-nums text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
                  {e.mySubmission.score}/{e.mySubmission.maxScore}
                </span>
              ) : !e.overdue ? (
                <button onClick={() => setTaking(taking === e.id ? null : e.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
                  <Send className="size-3.5" /> {kindLabel(e.kind) === "واجب" ? "تسليم الواجب" : "ابدأ الاختبار"}
                </button>
              ) : null}
            </div>
            {taking === e.id && <TakeExam examId={e.id} onDone={() => { setTaking(null); load(); }} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TakeExam({ examId, onDone }: { examId: string; onDone: () => void }) {
  const [data, setData] = useState<{ questions: Array<{ id: string; kind: string; text: string; options: string[] | null; points: number }> } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { getExamQuestions({ data: { examId } }).then((r) => { if (!("error" in (r as object))) setData(r as never); }).catch(() => {}); }, [examId]);
  if (!data) return <div className="flex justify-center p-4"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>;

  const submit = async () => {
    if (Object.keys(answers).length < data.questions.length) { toast.error("أجب عن كلّ الأسئلة"); return; }
    setBusy(true);
    try {
      const r = await submitExam({ data: { examId, answers } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`سُلِّم — درجتك ${(r as { score: number }).score}/${(r as { maxScore: number }).maxScore}`); onDone(); }
    } catch { toast.error("تعذّر التسليم"); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {data.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl bg-surface-2/50 p-3 ring-1 ring-line">
          <p className="text-[13px] font-semibold text-ink">{i + 1}. {q.text} <span className="text-[10px] font-normal text-ink-faint">({q.points} نقطة)</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(q.kind === "tf" ? [["true", "صحيح"], ["false", "خطأ"]] : (q.options ?? []).map((o, idx) => [String(idx), o])).map(([val, label]) => (
              <button key={val} onClick={() => setAnswers((a) => ({ ...a, [q.id]: val }))}
                className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 transition",
                  answers[q.id] === val ? "bg-emerald-800 text-emerald-50 ring-emerald-900/30" : "bg-surface text-ink-soft ring-line hover:bg-surface-2")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={submit} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} تسليم الإجابات
      </button>
    </div>
  );
}

/* ===== قسم المنشئ: بناء ومتابعة ===== */
type Scope = { kind: "circle" | "mosque"; id: string; label: string };
type CreatedExam = { id: string; title: string; kind: string; status: string; dueAt: number | null; expected: number; submissions: Array<{ personName: string | null; score: number; maxScore: number }> };
export function ManageExams({ scopes }: { scopes: Scope[] }) {
  const [items, setItems] = useState<CreatedExam[] | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = () => { getMyCreatedExams().then((r) => setItems((r as { items: CreatedExam[] }).items ?? [])).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);
  if (!items) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><FileQuestion className="size-4 text-emerald-800" /> الاختبارات والواجبات</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
          <Plus className="size-3.5" /> اختبارٌ جديد
        </button>
      </div>
      {open && <ExamBuilder scopes={scopes} onDone={() => { setOpen(false); load(); }} />}
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-2xl bg-surface ring-1 ring-line">
            <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="flex w-full items-center gap-3 p-4 text-start">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", e.status === "closed" ? "text-ink-faint line-through" : "text-ink")}>
                  {e.title} <span className="text-[11px] font-normal text-ink-faint">· {kindLabel(e.kind)}{e.status === "draft" ? " · مسودّة" : ""}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">سلّم {e.submissions.length} من {e.expected}{e.dueAt ? ` · حتى ${fmtDate(e.dueAt)}` : ""}</p>
              </div>
              {e.status === "draft" && (
                <span onClick={async (ev) => { ev.stopPropagation(); const r = await publishExam({ data: { id: e.id } }); if (r && "error" in r && r.error) toast.error(r.error); else { toast.success(`نُشر وأُشعر ${(r as { notified?: number }).notified ?? 0} طالبًا`); load(); } }}
                  className="shrink-0 cursor-pointer rounded-lg bg-emerald-800 px-3 py-1.5 text-[11px] font-bold text-emerald-50 hover:bg-emerald-900">نشر</span>
              )}
              <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition", expanded === e.id && "rotate-180")} />
            </button>
            {expanded === e.id && (
              <div className="space-y-1.5 border-t border-line p-4">
                {e.submissions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-surface-2/50 px-3 py-2 ring-1 ring-line">
                    <span className="text-[12px] font-semibold text-ink">{s.personName ?? "طالب"}</span>
                    <span className="font-mono-nums text-xs font-bold text-emerald-800">{s.score}/{s.maxScore}</span>
                  </div>
                ))}
                {!e.submissions.length && <p className="text-center text-[12px] text-ink-faint">لا تسليمات بعد.</p>}
                {e.status !== "closed" && (
                  <button onClick={async () => { await closeExam({ data: { id: e.id } }); load(); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger-bg"><X className="size-3" /> إغلاق</button>
                )}
              </div>
            )}
          </li>
        ))}
        {!items.length && <li className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-faint ring-1 ring-line">لا اختبارات بعد.</li>}
      </ul>
    </section>
  );
}

type Q = { kind: "mcq" | "tf"; text: string; options: string[]; correct: string; points: number };
function ExamBuilder({ scopes, onDone }: { scopes: Scope[]; onDone: () => void }) {
  const [scopeKey, setScopeKey] = useState("");
  const [kind, setKind] = useState<"exam" | "homework">("exam");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [qs, setQs] = useState<Q[]>([{ kind: "mcq", text: "", options: ["", ""], correct: "0", points: 1 }]);
  const [busy, setBusy] = useState(false);

  const setQ = (i: number, patch: Partial<Q>) => setQs((all) => all.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const submit = async () => {
    const s = scopes.find((x) => `${x.kind}:${x.id}` === scopeKey);
    if (!s) { toast.error("اختر النطاق"); return; }
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    for (const q of qs) {
      if (!q.text.trim()) { toast.error("أكمل نصوص الأسئلة"); return; }
      if (q.kind === "mcq" && q.options.filter((o) => o.trim()).length < 2) { toast.error("خياران على الأقلّ"); return; }
    }
    setBusy(true);
    try {
      const r = await createExam({ data: {
        scopeKind: s.kind, scopeId: s.id, kind, title: title.trim(),
        dueAt: due ? new Date(`${due}T23:59`).getTime() : undefined,
        questions: qs.map((q) => ({
          kind: q.kind, text: q.text.trim(),
          options: q.kind === "mcq" ? q.options.filter((o) => o.trim()) : undefined,
          correct: q.correct, points: q.points,
        })),
      } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("أُنشئ (مسودّة) — انشره ليصل الطلاب"); onDone(); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="grid grid-cols-2 gap-2">
        <Field label="النطاق"><MSelect value={scopeKey} onValueChange={setScopeKey} placeholder="اختر…" options={scopes.map((s) => ({ value: `${s.kind}:${s.id}`, label: s.label }))} /></Field>
        <Field label="النوع"><MSelect value={kind} onValueChange={(v) => setKind(v as never)} options={[{ value: "exam", label: "اختبار" }, { value: "homework", label: "واجب" }]} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="العنوان"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اختبار جزء عمّ" /></Field>
        <Field label="آخر موعدٍ للتسليم (اختياري)"><TextField type="date" value={due} onChange={(e) => setDue(e.target.value)} dir="ltr" /></Field>
      </div>

      {qs.map((q, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-ink-faint">س{i + 1}</span>
            <div className="w-36"><MSelect value={q.kind} onValueChange={(v) => setQ(i, { kind: v as never, correct: v === "tf" ? "true" : "0" })} options={[{ value: "mcq", label: "اختيار من متعدّد" }, { value: "tf", label: "صح / خطأ" }]} /></div>
            <div className="ms-auto flex items-center gap-1">
              <span className="text-[10px] text-ink-faint">نقاط</span>
              <input type="number" min={1} max={20} value={q.points} onChange={(e) => setQ(i, { points: Number(e.target.value) || 1 })} className="h-8 w-14 rounded-lg bg-surface px-2 text-center text-xs ring-1 ring-line" />
              {qs.length > 1 && <button onClick={() => setQs((all) => all.filter((_, idx) => idx !== i))} aria-label="حذف السؤال" className="rounded-md p-1.5 text-danger hover:bg-danger-bg"><Trash2 className="size-3.5" /></button>}
            </div>
          </div>
          <TextField value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="نصّ السؤال…" />
          {q.kind === "mcq" ? (
            <div className="space-y-1.5">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" checked={q.correct === String(oi)} onChange={() => setQ(i, { correct: String(oi) })} className="size-4 accent-emerald-800" title="الإجابة الصحيحة" />
                  <TextField value={o} onChange={(e) => setQ(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} placeholder={`الخيار ${oi + 1}`} />
                  {q.options.length > 2 && <button onClick={() => setQ(i, { options: q.options.filter((_, xi) => xi !== oi), correct: "0" })} aria-label="إزالة الخيار" className="rounded-md p-1 text-ink-faint hover:text-danger"><X className="size-3.5" /></button>}
                </div>
              ))}
              {q.options.length < 6 && <button onClick={() => setQ(i, { options: [...q.options, ""] })} className="text-[11px] font-semibold text-emerald-800 hover:underline">+ خيار</button>}
            </div>
          ) : (
            <div className="flex gap-1.5">
              {[["true", "صحيح"], ["false", "خطأ"]].map(([v, l]) => (
                <button key={v} onClick={() => setQ(i, { correct: v })}
                  className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1", q.correct === v ? "bg-emerald-800 text-emerald-50 ring-emerald-900/30" : "bg-surface text-ink-soft ring-line")}>
                  الإجابة: {l}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button onClick={() => setQs((all) => [...all, { kind: "mcq", text: "", options: ["", ""], correct: "0", points: 1 }])}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"><Plus className="size-3.5" /> سؤالٌ آخر</button>
        <button onClick={submit} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} حفظ (مسودّة)
        </button>
      </div>
    </div>
  );
}
