import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { ListTodo, Loader2, Plus, Send, CheckCircle2, Clock3, Eye, X, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hasCap } from "@/lib/capabilities";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { getMyDuties, respondActivity, getActivityScopes, createActivity, getMyActivities, reviewResponse, closeActivity, getMyTasksSummary } from "@/lib/api/activities";
import { StudentExams, ManageExams } from "@/components/duties/ExamsSection";
import { RegistrationInbox } from "@/components/registration/RegistrationInbox";
import { getMyStudentProgress } from "@/lib/api/tahfeez";
import { BookMarked } from "lucide-react";
import { Link } from "@tanstack/react-router";

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" });

export function DutiesPage() {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx.user?.caps ?? [];
  const canManage = hasCap(caps, "*") || hasCap(caps, "duties.manage");
  const [tab, setTab] = useState<"mine" | "follow">("mine");

  return (
    <MishkatShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <ListTodo className="size-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">المطلوب اليوم</h1>
            <p className="mt-0.5 text-sm text-ink-soft">متابعةٌ سلسة لما هو مطلوبٌ منك — وردودُ طلابك بين يديك</p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-1 border-b border-line">
            {([["mine", "المطلوب منّي"], ["follow", "متابعة النشاطات"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("relative px-4 py-2.5 text-sm font-medium transition-colors", tab === k ? "text-emerald-800" : "text-ink-soft hover:text-ink")}>
                {l}
                {tab === k && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-800" />}
              </button>
            ))}
          </div>
        )}

        <MyTasksStrip />

        {/* طلبات الانضمام تصل كلَّ مخوَّلٍ من هنا — الأمير خاصّةً (غ٧) */}
        <RegistrationInbox />

        {tab === "mine" && <><MyDuties /><StudentExams /><MyHifzProgress /></>}
        {tab === "follow" && canManage && <FollowUp />}
      </div>
    </MishkatShell>
  );
}

/* ===== «مهامّي» — كلّ عملٍ رئيسٍ مطلوبٍ منك عبر المنظومة، بعدّادٍ ورابطِ إنجاز ===== */
type TaskCard = { key: string; label: string; count: number; to: string; tone: "danger" | "warn" | "info" };
const TONE: Record<TaskCard["tone"], string> = {
  danger: "bg-danger-bg text-danger ring-danger/20 hover:ring-danger/40",
  warn: "bg-warn-bg text-warn ring-warn/20 hover:ring-warn/40",
  info: "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:ring-emerald-300",
};
function MyTasksStrip() {
  const [cards, setCards] = useState<TaskCard[] | null>(null);
  useEffect(() => { getMyTasksSummary().then((r) => setCards((r as { cards: TaskCard[] }).cards ?? [])).catch(() => setCards([])); }, []);
  if (!cards || !cards.length) return null;
  return (
    <section className="flex flex-wrap gap-2">
      {cards.map((c) => {
        const [path, query] = c.to.split("?");
        return (
          <Link key={c.key} to={path as never} search={(query ? Object.fromEntries(new URLSearchParams(query)) : undefined) as never}
            className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ring-1 transition", TONE[c.tone])}>
            <span className="grid min-w-[1.4rem] place-items-center rounded-full bg-white/70 px-1 font-mono-nums text-[11px]">{c.count}</span>
            {c.label}{c.count === 1 ? "" : ""} ←
          </Link>
        );
      })}
    </section>
  );
}

/* ===== «المطلوب منّي» — شاشة الطالب ===== */
type Duty = {
  id: string; title: string; details: string | null; dueAt: number | null; required: boolean;
  createdByName: string | null; scopeLabel: string;
  myResponse: { body: string; submittedAt: number; reviewStatus: string } | null;
};
function MyDuties() {
  const [items, setItems] = useState<Duty[] | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => { getMyDuties().then((r) => setItems((r as { items: Duty[] }).items ?? [])).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);

  if (!items) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;
  if (!items.length) return <p className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-line">لا نشاطات مطلوبةً منك الآن — أحسنت المتابعة.</p>;

  const pending = items.filter((i) => !i.myResponse).length;

  const submit = async (id: string) => {
    if (!body.trim()) { toast.error("اكتب ردّك"); return; }
    setBusy(true);
    try {
      const r = await respondActivity({ data: { activityId: id, body: body.trim() } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("تمّ إرسال ردّك"); setReplyFor(null); setBody(""); load(); }
    } catch { toast.error("تعذّر الإرسال"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {pending > 0 && (
        <p className="rounded-xl bg-warn-bg px-4 py-2.5 text-[12px] font-semibold text-warn ring-1 ring-warn/20">
          عليك {pending} {pending === 1 ? "نشاطٌ ينتظر ردّك" : "نشاطاتٍ تنتظر ردّك"}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.id} className={cn("rounded-2xl bg-surface p-4 ring-1", d.myResponse ? "ring-emerald-200" : "ring-line")}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{d.title}</p>
                {d.details && <p className="mt-1 text-[12px] leading-5 text-ink-soft">{d.details}</p>}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
                  <span>{d.scopeLabel}</span>
                  {d.createdByName && <span>· من {d.createdByName}</span>}
                  {d.dueAt && <span className="inline-flex items-center gap-0.5">· <Clock3 className="size-3" /> يستحقّ {fmtDate(d.dueAt)}</span>}
                </p>
              </div>
              {d.myResponse ? (
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1",
                  d.myResponse.reviewStatus === "accepted" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-gold-50 text-gold-800 ring-gold-100")}>
                  {d.myResponse.reviewStatus === "accepted" ? "قُبل ردّك ✓" : "تمّ الردّ — بانتظار المراجعة"}
                </span>
              ) : (
                <button onClick={() => { setReplyFor(replyFor === d.id ? null : d.id); setBody(""); }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
                  <Send className="size-3.5" /> أرسل ردّك
                </button>
              )}
            </div>
            {replyFor === d.id && (
              <div className="mt-3 flex gap-2">
                <TextField value={body} onChange={(e) => setBody(e.target.value)} placeholder="ردّك: أنجزتُ… / أرفقتُ…" onKeyDown={(e) => { if (e.key === "Enter") submit(d.id); }} />
                <button onClick={() => submit(d.id)} disabled={busy}
                  className="shrink-0 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : "إرسال"}
                </button>
              </div>
            )}
            {d.myResponse && <p className="mt-2 rounded-xl bg-surface-2/60 p-2.5 text-[12px] text-ink-soft ring-1 ring-line">ردّك: {d.myResponse.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ===== متابعة النشاطات — شاشة الشيخ/الأمير ===== */
type Scope = { kind: "circle" | "mosque"; id: string; label: string };
type MyAct = {
  id: string; title: string; details: string | null; dueAt: number | null; status: string; createdAt: number;
  expected: number; responses: Array<{ id: string; personName: string | null; body: string; submittedAt: number; reviewStatus: string }>;
};
function FollowUp() {
  const [acts, setActs] = useState<MyAct[] | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = () => {
    getMyActivities().then((r) => setActs((r as { items: MyAct[] }).items ?? [])).catch(() => setActs([]));
    getActivityScopes().then((r) => setScopes((r as { items: Scope[] }).items ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const review = async (responseId: string, status: "accepted" | "seen") => {
    const r = await reviewResponse({ data: { responseId, status } });
    if (r && "error" in r && r.error) toast.error(r.error); else load();
  };

  if (!acts) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><MessageSquare className="size-4 text-emerald-800" /> نشاطاتك وردود الطلاب</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
          <Plus className="size-3.5" /> نشاطٌ جديد
        </button>
      </div>
      {open && <NewActivityForm scopes={scopes} onDone={() => { setOpen(false); load(); }} />}
      <ul className="space-y-2">
        {acts.map((a) => (
          <li key={a.id} className="rounded-2xl bg-surface ring-1 ring-line">
            <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="flex w-full items-center gap-3 p-4 text-start">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", a.status === "closed" ? "text-ink-faint line-through" : "text-ink")}>{a.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  أجاب {a.responses.length} من {a.expected}
                  {a.dueAt ? ` · يستحقّ ${fmtDate(a.dueAt)}` : ""}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono-nums text-[10px] font-bold ring-1",
                a.responses.length >= a.expected && a.expected > 0 ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-surface-2 text-ink-soft ring-line")}>
                {a.responses.length}/{a.expected}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition", expanded === a.id && "rotate-180")} />
            </button>
            {expanded === a.id && (
              <div className="space-y-2 border-t border-line p-4">
                {a.responses.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-ink">{r.personName ?? "طالب"}</p>
                      <p className="mt-0.5 text-[12px] leading-5 text-ink-soft">{r.body}</p>
                    </div>
                    {r.reviewStatus === "accepted" ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100">مقبول ✓</span>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => review(r.id, "accepted")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2 py-1 text-[10px] font-bold text-emerald-50 hover:bg-emerald-900"><CheckCircle2 className="size-3" /> قبول</button>
                        {r.reviewStatus === "pending" && <button onClick={() => review(r.id, "seen")} className="rounded-lg px-2 py-1 text-[10px] font-bold text-ink-soft ring-1 ring-line hover:bg-surface-2" title="اطّلعت"><Eye className="size-3" /></button>}
                      </div>
                    )}
                  </div>
                ))}
                {!a.responses.length && <p className="text-center text-[12px] text-ink-faint">لا ردود بعد.</p>}
                {a.status === "active" && (
                  <button onClick={async () => { await closeActivity({ data: { id: a.id } }); load(); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger-bg"><X className="size-3" /> إغلاق النشاط</button>
                )}
              </div>
            )}
          </li>
        ))}
        {!acts.length && <li className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-line">لا نشاطات — أنشئ أوّل نشاطٍ لطلابك.</li>}
      </ul>

      {/* الاختبارات والواجبات (§خ) — نفس النطاقات */}
      <ManageExams scopes={scopes} />
    </div>
  );
}

function NewActivityForm({ scopes, onDone }: { scopes: Scope[]; onDone: () => void }) {
  const [scopeKey, setScopeKey] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const s = scopes.find((x) => `${x.kind}:${x.id}` === scopeKey);
    if (!s) { toast.error("اختر النطاق"); return; }
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    setBusy(true);
    try {
      const r = await createActivity({ data: {
        scopeKind: s.kind, scopeId: s.id, title: title.trim(), details: details.trim() || undefined,
        dueAt: due ? new Date(`${due}T23:59`).getTime() : undefined,
      } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`أُنشئ النشاط وأُشعر ${(r as { notified?: number }).notified ?? 0} طالبًا`); onDone(); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Field label="النطاق (حلقة أو مسجد)">
        <MSelect value={scopeKey} onValueChange={setScopeKey} placeholder="اختر…"
          options={scopes.map((s) => ({ value: `${s.kind}:${s.id}`, label: s.label }))} />
      </Field>
      <Field label="عنوان النشاط"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="احفظ الوجه الأوّل من سورة الملك" /></Field>
      <Field label="تفصيلٌ (اختياري)"><TextField value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <Field label="تاريخ الاستحقاق (اختياري)"><TextField type="date" value={due} onChange={(e) => setDue(e.target.value)} dir="ltr" /></Field>
      <button onClick={submit} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إنشاء وإشعار الطلاب
      </button>
    </div>
  );
}


/* ===== «تقدّمي في الحفظ» (غ٣) — الطالب يرى حضورَه وتسميعَه وعلاماتِه بنفسه ===== */
type ProgressItem = {
  circleName: string; mosqueName: string; attendancePct: number; sessions: number; avgGrade: number | null;
  recent: Array<{ dateHijri: string; attendance: string; hifz: string | null; hifzGrade: number | null; review: string | null; reviewGrade: number | null; tajweedGrade: number | null }>;
};
const ATT_AR: Record<string, string> = { present: "حاضر", absent: "غائب", left: "تارك", excused: "مستأذن" };
function MyHifzProgress() {
  const [items, setItems] = useState<ProgressItem[] | null>(null);
  useEffect(() => { getMyStudentProgress().then((r) => setItems((r as { items: ProgressItem[] }).items ?? [])).catch(() => setItems([])); }, []);
  if (!items || !items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><BookMarked className="size-4 text-emerald-800" /> تقدّمي في الحفظ</h2>
      {items.map((c, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2/60 px-4 py-3">
            <span className="text-sm font-semibold text-ink">{c.circleName} <span className="text-[11px] font-normal text-ink-faint">· {c.mosqueName}</span></span>
            <span className="ms-auto flex items-center gap-2 font-mono-nums text-[11px] text-ink-soft">
              حضوري {c.attendancePct}٪ · {c.sessions} جلسة{c.avgGrade != null ? ` · متوسّطي ${c.avgGrade}` : ""}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {c.recent.map((r, j) => (
              <li key={j} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-[12px]">
                <span className="w-20 shrink-0 font-mono-nums text-ink-faint" dir="ltr">{r.dateHijri}</span>
                <span className={cn("w-14 shrink-0 font-semibold", r.attendance === "present" ? "text-emerald-800" : "text-danger")}>{ATT_AR[r.attendance] ?? r.attendance}</span>
                {r.hifz && <span className="text-ink">تسميع: {r.hifz}{r.hifzGrade != null ? ` (${r.hifzGrade})` : ""}</span>}
                {r.review && <span className="text-ink-soft">مراجعة: {r.review}{r.reviewGrade != null ? ` (${r.reviewGrade})` : ""}</span>}
                {r.tajweedGrade != null && <span className="text-ink-faint">تجويد {r.tajweedGrade}</span>}
              </li>
            ))}
            {!c.recent.length && <li className="px-4 py-3 text-center text-[11px] text-ink-faint">لا جلسات مسجَّلةً بعد.</li>}
          </ul>
        </div>
      ))}
    </section>
  );
}
