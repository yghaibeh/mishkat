import { useEffect, useState } from "react";
import {
  Trophy, Users, Medal, BookOpen, ClipboardList, Loader2, Search, UserPlus, Plus, Crown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MTabs } from "@/components/ui/m-tabs";
import { fmtNum } from "@/lib/format";
import { MAsyncCombobox, type AsyncOption } from "@/components/ui/m-async-combobox";
import { getCompetition, getLeaderboard, registerParticipant, createCompetition,
  getCompetitionManage, addProgram, addCentralExam, recordScore, recordExamResult, qualifyTop, selectWinner } from "@/lib/api/competition";
import { searchPersons, searchOrgUnits } from "@/lib/api/search";

type Comp = { id: string; name: string; startMonth: string | null; endMonth: string | null; status: string; prizePool: number };
type Kpis = { participants: number; qualified: number; programs: number; exams: number };
type Data = { competition: Comp | null; kpis: Kpis };
type Rank = { rank: number; id: string; name: string; mosque: string; status: string; monthly: number; exam: number; total: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "مشارك", cls: "bg-surface-2 text-ink-soft ring-line" },
  qualified: { label: "متأهّل", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
  winner: { label: "فائز", cls: "bg-gold-50 text-gold-700 ring-gold-100" },
  withdrawn: { label: "منسحب", cls: "bg-danger-bg text-danger ring-danger/20" },
};
const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
const btn = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line";

const loadPersons = (q: string): Promise<AsyncOption[]> => searchPersons({ data: { q } }).then((rs) => rs.map((r) => ({ value: r.id, label: r.name })));
const loadMosques = (q: string): Promise<AsyncOption[]> => searchOrgUnits({ data: { q, types: ["mosque"] } }).then((rs) => rs.map((r) => ({ value: r.id, label: r.name })));

export function CompetitionPage({ data }: { data?: Data }) {
  const [comp, setComp] = useState<Comp | null>(data?.competition ?? null);
  const [kpis, setKpis] = useState<Kpis>(data?.kpis ?? { participants: 0, qualified: 0, programs: 0, exams: 0 });
  const [tab, setTab] = useState("board");
  const [items, setItems] = useState<Rank[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [listBusy, setListBusy] = useState(true);
  const [busy, setBusy] = useState(false);

  const [person, setPerson] = useState(""); const [personLbl, setPersonLbl] = useState("");
  const [mosque, setMosque] = useState(""); const [mosqueLbl, setMosqueLbl] = useState("");
  const [age, setAge] = useState("20");

  const refetch = async () => { try { const d = (await getCompetition()) as Data; setComp(d.competition); setKpis(d.kpis); return d.competition?.id ?? null; } catch { return comp?.id ?? null; } };
  const loadBoard = async (cid: string | null, query: string, offset: number, append: boolean) => {
    if (!cid) return;
    setListBusy(true);
    try {
      const r = await getLeaderboard({ data: { competitionId: cid, q: query || undefined, offset } });
      setItems((prev) => (append ? [...prev, ...r.items] : r.items));
      setTotal(r.total);
    } catch { /* dev */ } finally { setListBusy(false); }
  };

  useEffect(() => { (async () => { const cid = await refetch(); await loadBoard(cid, "", 0, false); })(); }, []);
  useEffect(() => { const t = setTimeout(() => void loadBoard(comp?.id ?? null, q, 0, false), 250); return () => clearTimeout(t); }, [q]);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comp) return;
    setBusy(true);
    try {
      const res = await registerParticipant({ data: { competitionId: comp.id, personId: person, mosqueId: mosque, age: Number(age) } });
      if ("error" in res && res.error) toast.error(res.error);
      else {
        toast.success("سُجّل المشترك", { description: personLbl });
        setPerson(""); setPersonLbl(""); setMosque(""); setMosqueLbl("");
        await refetch(); await loadBoard(comp.id, "", 0, false);
      }
    } catch { toast.error("تعذّر التسجيل"); } finally { setBusy(false); }
  };

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <Trophy className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">المسابقة</h1>
            <p className="mt-1 text-sm text-ink-soft">{comp ? comp.name : "مسابقة المسجد المؤثر السنوية"}</p>
          </div>
        </header>

        {!comp && <CreateCompetition onCreated={refetch} />}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
            <div className="flex items-center justify-between">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10"><Trophy className="size-[18px]" strokeWidth={1.75} /></span>
              <span className="text-[11px] font-medium text-emerald-100/70">قيمة الجوائز</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-sm font-medium text-emerald-100/80">$</span>
              <span className="text-3xl font-semibold tracking-tight text-gold-100 sm:text-4xl">{fmtNum(comp?.prizePool ?? 0)}</span>
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/60">{comp ? `${comp.startMonth} → ${comp.endMonth}` : "—"}</p>
          </div>
          <Kpi icon={Users} value={kpis.participants} label="المشتركون" />
          <Kpi icon={Medal} value={kpis.qualified} label="المتأهّلون" />
          <Kpi icon={BookOpen} value={kpis.programs} label="البرامج" sub={`${kpis.exams} اختبار`} />
        </section>

        <MTabs value={tab} onValueChange={setTab}
          options={[{ value: "board", label: "الترتيب" }, { value: "register", label: "تسجيل مشترك" }, { value: "manage", label: "الإدارة والرصد" }]} />

        {tab === "manage" ? (
          <ManagePanel comp={comp} onChanged={async () => { const cid = await refetch(); await loadBoard(cid, q, 0, false); }} />
        ) : tab === "board" ? (
          <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مشترك…" aria-label="ابحث عن مشترك"
                className="h-8 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
              {listBusy && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" />}
              <span className="shrink-0 font-mono-nums text-[11px] font-semibold text-ink-soft">{total} مشترك</span>
            </div>
            {listBusy && items.length === 0 ? (
              <div className="grid place-items-center px-6 py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="grid place-items-center px-6 py-16 text-center text-sm text-ink-soft">{q ? "لا مشترك مطابق." : "لا مشتركون بعد."}</div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                        <th className="px-5 py-3 font-medium">#</th>
                        <th className="px-5 py-3 font-medium">المشترك</th>
                        <th className="px-5 py-3 font-medium">المسجد</th>
                        <th className="px-5 py-3 font-medium">الشهرية</th>
                        <th className="px-5 py-3 font-medium">الاختبارات</th>
                        <th className="px-5 py-3 font-medium">المجموع</th>
                        <th className="px-5 py-3 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((r) => <Row key={r.id} r={r} />)}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-line md:hidden">
                  {items.map((r) => {
                    const s = STATUS[r.status] ?? STATUS.active;
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <RankBadge rank={r.rank} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                          <p className="truncate text-[11px] text-ink-faint">{r.mosque}</p>
                        </div>
                        <span className="font-mono-nums text-sm font-bold text-emerald-800">{fmtNum(r.total)}</span>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", s.cls)}>{s.label}</span>
                      </li>
                    );
                  })}
                </ul>
                {items.length < total && (
                  <button onClick={() => loadBoard(comp?.id ?? null, q, items.length, true)} disabled={listBusy}
                    className="w-full border-t border-line py-3 text-xs font-semibold text-emerald-800 transition hover:bg-surface-2/40 disabled:opacity-60">
                    تحميل المزيد ({total - items.length})
                  </button>
                )}
              </>
            )}
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            <form onSubmit={onRegister} className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-3">
              <div className="flex items-center gap-2 border-b border-line pb-3"><UserPlus className="size-4 text-emerald-800" strokeWidth={1.75} /><h2 className="font-display text-sm font-semibold text-ink">تسجيل مشترك</h2></div>
              <Field label="الشخص" required hint="ابحث في المسجّلين بالنظام."><MAsyncCombobox value={person} valueLabel={personLbl} onChange={(v, l) => { setPerson(v); setPersonLbl(l); }} loadOptions={loadPersons} placeholder="اختر الشخص…" searchPlaceholder="ابحث بالاسم…" emptyText="لا أشخاص." /></Field>
              <Field label="المسجد" required hint="الالتحاق بمسجد شرط الدخول."><MAsyncCombobox value={mosque} valueLabel={mosqueLbl} onChange={(v, l) => { setMosque(v); setMosqueLbl(l); }} loadOptions={loadMosques} placeholder="ابحث عن مسجد…" searchPlaceholder="ابحث بالاسم…" emptyText="لا مساجد." /></Field>
              <Field label="السن" required hint="من 15 إلى 40 سنة."><TextField inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="text-center font-mono-nums" /></Field>
              <button type="submit" disabled={busy || !person || !mosque || !(Number(age) >= 15 && Number(age) <= 40)} className={btn}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} تسجيل المشترك
              </button>
            </form>
            <aside className="space-y-2 rounded-2xl bg-gold-50 p-5 ring-1 ring-gold-100 lg:col-span-2">
              <div className="flex items-center gap-2"><Crown className="size-4 text-gold-700" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-gold-700">شروط المشاركة</h3></div>
              <p className="text-xs leading-relaxed text-gold-700/80">المشترك فرد بين 15 و40 سنة، مرتبط بمسجد. الترتيب = مجموع النقاط الشهرية + الاختبارات المركزية، والأعذار المقبولة لا تُخصم. التصفية النهائية لأعلى المتسابقين.</p>
            </aside>
          </div>
        )}
      </main>
    </MishkatShell>
  );
}

function Row({ r }: { r: Rank }) {
  const s = STATUS[r.status] ?? STATUS.active;
  return (
    <tr className="transition-colors hover:bg-surface-2/40">
      <td className="px-5 py-4"><RankBadge rank={r.rank} /></td>
      <td className="max-w-[16rem] truncate px-5 py-4 font-medium text-ink" title={r.name}>{r.name}</td>
      <td className="px-5 py-4 text-xs text-ink-soft">{r.mosque}</td>
      <td className="px-5 py-4 font-mono-nums text-ink-soft">{fmtNum(r.monthly)}</td>
      <td className="px-5 py-4 font-mono-nums text-ink-soft">{fmtNum(r.exam)}</td>
      <td className="px-5 py-4 font-mono-nums font-bold text-emerald-800">{fmtNum(r.total)}</td>
      <td className="px-5 py-4"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", s.cls)}>{s.label}</span></td>
    </tr>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const top = rank <= 3;
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full font-mono-nums text-[11px] font-bold ring-1",
      top ? "bg-gold-50 text-gold-700 ring-gold-100" : "bg-surface-2 text-ink-faint ring-line")}>
      {rank}
    </span>
  );
}

function Kpi({ icon: Icon, value, label, sub }: { icon: LucideIcon; value: number; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
      <div className="flex items-center justify-between">
        <span className={tile}><Icon className="size-[18px]" strokeWidth={1.75} /></span>
        {sub && <span className="text-[11px] font-semibold text-ink-faint">{sub}</span>}
      </div>
      <div className="mt-3 font-mono-nums text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{fmtNum(value)}</div>
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}

// لوحةُ الإدارة والرصد (ج٤ — وصْلُ منطق التأهّل/الفائز الذي كان بلا واجهة):
// برامجُ الشهر + الاختبارات المركزيّة، وشبكةُ رصدٍ لكلّ مشتركٍ، ثم التأهيلُ واختيارُ الفائز.
type ManageProgram = { id: string; monthHijri: string; track: string; title: string; maxPoints: number };
type ManageExam = { id: string; title: string; dateHijri: string | null; maxScore: number };
type ManagePart = { id: string; personId: string; name: string; status: string };
type ManageData = {
  programs: ManageProgram[]; exams: ManageExam[]; participants: ManagePart[];
  scores: Array<{ participantId: string; programId: string; points: number; excuseStatus: string }>;
  examResults: Array<{ participantId: string; examId: string; score: number }>;
};

function ManagePanel({ comp, onChanged }: { comp: Comp | null; onChanged: () => void }) {
  const [d, setD] = useState<ManageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topN, setTopN] = useState("10");
  const load = async () => {
    if (!comp) return;
    setLoading(true);
    try { setD((await getCompetitionManage({ data: { competitionId: comp.id } })) as ManageData); }
    catch { /* dev */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [comp?.id]);

  if (!comp) return <div className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-soft ring-1 ring-line">أنشئ مسابقةً أوّلًا.</div>;
  if (loading || !d) return <div className="grid place-items-center rounded-2xl bg-surface py-16 ring-1 ring-line"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;

  const scoreOf = (pid: string, progId: string) => d.scores.find((s) => s.participantId === pid && s.programId === progId)?.points ?? "";
  const examOf = (pid: string, exId: string) => d.examResults.find((r) => r.participantId === pid && r.examId === exId)?.score ?? "";

  const saveScore = async (pid: string, programId: string, raw: string) => {
    const points = Math.max(0, Math.floor(Number(raw) || 0));
    const res = await recordScore({ data: { participantId: pid, programId, points } });
    if (res && "error" in res && res.error) { toast.error(res.error as string); return; }
    await load(); onChanged();
  };
  const saveExam = async (pid: string, examId: string, raw: string) => {
    const score = Math.max(0, Math.floor(Number(raw) || 0));
    const res = await recordExamResult({ data: { participantId: pid, examId, score } });
    if (res && "error" in res && res.error) { toast.error(res.error as string); return; }
    await load(); onChanged();
  };
  const doQualify = async () => {
    const n = Math.max(1, Math.floor(Number(topN) || 0));
    const res = await qualifyTop({ data: { competitionId: comp.id, topN: n } });
    if (res && "error" in res && res.error) toast.error(res.error as string);
    else { toast.success(`تأهّل ${(res as { qualified: number }).qualified} مشتركًا`); await load(); onChanged(); }
  };
  const doWinner = async () => {
    const res = await selectWinner({ data: { competitionId: comp.id } });
    if (res && "error" in res && res.error) toast.error(res.error as string);
    else { toast.success("اختير الفائز وأُغلقت المسابقة"); await load(); onChanged(); }
  };

  const cols = [...d.programs.map((p) => ({ kind: "prog" as const, id: p.id, label: p.title, sub: `${p.monthHijri} · ${p.maxPoints || "—"}` })),
    ...d.exams.map((e) => ({ kind: "exam" as const, id: e.id, label: e.title, sub: `اختبار · ${e.maxScore}` }))];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <AddProgram compId={comp.id} onDone={load} />
        <AddExam compId={comp.id} onDone={load} />
      </div>

      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3"><ClipboardList className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">شبكةُ الرصد</h3><span className="text-[11px] text-ink-faint">النقاط تُحفظ فور تركِ الحقل</span></div>
        {d.participants.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-soft">لا مشتركون بعد — سجّل من تبويب «تسجيل مشترك».</div>
        ) : cols.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-soft">أضف برنامجًا أو اختبارًا لبدء الرصد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-right text-sm">
              <thead><tr className="border-b border-line text-[11px] text-ink-faint">
                <th className="sticky start-0 z-10 bg-surface px-4 py-2.5 text-right font-medium">المشترك</th>
                {cols.map((c) => <th key={c.kind + c.id} className="px-3 py-2.5 text-center font-medium"><div className="whitespace-nowrap">{c.label}</div><div className="font-mono-nums text-[10px] text-ink-faint">{c.sub}</div></th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {d.participants.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/30">
                    <td className="sticky start-0 z-10 max-w-[9rem] bg-surface px-4 py-2 font-medium text-ink"><div className="flex items-center gap-2"><span className="truncate">{p.name}</span>{p.status !== "active" && <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1", (STATUS[p.status] ?? STATUS.active).cls)}>{(STATUS[p.status] ?? STATUS.active).label}</span>}</div></td>
                    {cols.map((c) => (
                      <td key={c.kind + c.id} className="px-2 py-1.5 text-center">
                        <input type="text" inputMode="numeric" aria-label={`${p.name} — ${c.label}`} defaultValue={String(c.kind === "prog" ? scoreOf(p.id, c.id) : examOf(p.id, c.id))}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v === "") return; void (c.kind === "prog" ? saveScore(p.id, c.id, v) : saveExam(p.id, c.id, v)); }}
                          className="h-10 w-14 rounded-lg bg-surface-2 text-center font-mono-nums text-xs font-semibold text-ink ring-1 ring-line outline-none focus:ring-emerald-300" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-end gap-4 rounded-2xl bg-gold-50 p-5 ring-1 ring-gold-100">
        <div className="flex items-center gap-2"><Crown className="size-4 text-gold-700" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-gold-700">التصفية النهائية</h3></div>
        <div className="flex items-end gap-2">
          <div className="w-24"><Field label="عدد المتأهّلين"><TextField inputMode="numeric" value={topN} onChange={(e) => setTopN(e.target.value)} className="text-center font-mono-nums" /></Field></div>
          <button onClick={doQualify} disabled={comp.status === "closed"} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line"><Medal className="size-4" /> تأهيلُ الأعلى</button>
        </div>
        <button onClick={doWinner} disabled={comp.status === "closed"} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold-600 px-4 text-sm font-semibold text-white ring-1 ring-gold-700/40 transition hover:bg-gold-700 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line"><Crown className="size-4" /> اختيارُ الفائز وإغلاقُ المسابقة</button>
        {comp.status === "closed" && <span className="text-xs font-semibold text-gold-700">المسابقة مُغلقة.</span>}
      </section>
    </div>
  );
}

function AddProgram({ compId, onDone }: { compId: string; onDone: () => void }) {
  const [month, setMonth] = useState(""); const [track, setTrack] = useState("عام"); const [title, setTitle] = useState(""); const [max, setMax] = useState(""); const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || month.trim().length < 4) { toast.error("أكمل الشهر والعنوان"); return; }
    setBusy(true);
    try {
      const res = await addProgram({ data: { competitionId: compId, monthHijri: month.trim(), track: track.trim() || "عام", title: title.trim(), maxPoints: max ? Number(max) : undefined } });
      if (res && "error" in res && res.error) toast.error(res.error as string);
      else { toast.success("أُضيف البرنامج"); setTitle(""); setMax(""); onDone(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={add} className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line pb-3"><BookOpen className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">برنامجٌ شهريّ</h3></div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الشهر (هجري)"><TextField value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1447-07" dir="ltr" className="text-center" /></Field>
        <Field label="المسار"><TextField value={track} onChange={(e) => setTrack(e.target.value)} /></Field>
      </div>
      <Field label="العنوان"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="حفظ جزء عمّ" /></Field>
      <div className="flex items-end gap-2">
        <div className="w-28"><Field label="أقصى نقاط"><TextField inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} className="text-center font-mono-nums" /></Field></div>
        <button type="submit" disabled={busy} className={cn(btn, "flex-1")}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة</button>
      </div>
    </form>
  );
}

function AddExam({ compId, onDone }: { compId: string; onDone: () => void }) {
  const [title, setTitle] = useState(""); const [date, setDate] = useState(""); const [max, setMax] = useState("100"); const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) { toast.error("أدخل العنوان"); return; }
    setBusy(true);
    try {
      const res = await addCentralExam({ data: { competitionId: compId, title: title.trim(), dateHijri: date.trim() || undefined, maxScore: max ? Number(max) : undefined } });
      if (res && "error" in res && res.error) toast.error(res.error as string);
      else { toast.success("أُضيف الاختبار"); setTitle(""); onDone(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={add} className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line pb-3"><ClipboardList className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">اختبارٌ مركزيّ</h3></div>
      <Field label="العنوان"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اختبار منتصف العام" /></Field>
      <div className="flex items-end gap-2">
        <Field label="التاريخ (هجري)"><TextField value={date} onChange={(e) => setDate(e.target.value)} placeholder="1447-10-15" dir="ltr" className="text-center" /></Field>
        <div className="w-28"><Field label="الدرجة العظمى"><TextField inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} className="text-center font-mono-nums" /></Field></div>
      </div>
      <button type="submit" disabled={busy} className={btn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة الاختبار</button>
    </form>
  );
}

// إنشاء مسابقة (F7) — يظهر حين لا توجد مسابقة حالية (الإدارة العليا فقط؛ يُحرَس في الخادم)
function CreateCompetition({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("مسابقة المسجد المؤثر السنوية");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pool, setPool] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setBusy(true);
    try {
      const res = await createCompetition({ data: { name: name.trim(), startMonth: start.trim() || undefined, endMonth: end.trim() || undefined, prizePool: pool ? Number(pool) : undefined } });
      if (res && "error" in res && res.error) toast.error(res.error as string);
      else { toast.success("أُنشئت المسابقة"); onCreated(); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <Trophy className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">إنشاء مسابقة جديدة</h2>
      </div>
      <form onSubmit={create} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><Field label="اسم المسابقة"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
        <Field label="شهر البداية (هجري)"><TextField value={start} onChange={(e) => setStart(e.target.value)} placeholder="1447-07" dir="ltr" className="text-center" /></Field>
        <Field label="شهر النهاية (هجري)"><TextField value={end} onChange={(e) => setEnd(e.target.value)} placeholder="1448-07" dir="ltr" className="text-center" /></Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <div className="w-40"><Field label="قيمة الجوائز ($)"><TextField type="number" value={pool} onChange={(e) => setPool(e.target.value)} dir="ltr" className="text-center" /></Field></div>
          <button type="submit" disabled={busy || name.trim().length < 2} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إنشاء</button>
        </div>
      </form>
    </section>
  );
}
