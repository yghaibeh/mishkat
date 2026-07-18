import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { BookOpen, Search, ChevronLeft, Loader2, Menu, X, LogIn, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouteContext } from "@tanstack/react-router";
import { TopTabs } from "@/components/nav/TopTabs";
import { Blocks, toAr, type Block } from "./render";
import { getManhajTree, getManhajLesson } from "@/lib/api/manhaj";

type TreeLesson = { id: string; title: string };
type TreeUnit = { id: string; title: string; lessons: TreeLesson[] };
type LessonContent = { id: string; unitTitle: string; title: string; subject?: string | null; durationMin?: number | null; hadithCount: number; quranCount: number; blocks: Block[] };

export function ManhajPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { lesson?: string };
  const [tree, setTree] = useState<TreeUnit[] | null>(null);
  const [treeBusy, setTreeBusy] = useState(true);
  const [treeErr, setTreeErr] = useState(false);
  const [cache, setCache] = useState<Record<string, LessonContent>>({});
  const [lessonBusy, setLessonBusy] = useState(false);
  const [lessonErr, setLessonErr] = useState(false);
  const [q, setQ] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const fetchTree = () => { setTreeBusy(true); setTreeErr(false); getManhajTree().then((r) => setTree((r as { units: TreeUnit[] }).units)).catch(() => setTreeErr(true)).finally(() => setTreeBusy(false)); };
  useEffect(() => { fetchTree(); }, []);

  const flat = useMemo(() => {
    const list: { unitTitle: string; id: string; title: string }[] = [];
    tree?.forEach((u) => u.lessons.forEach((l) => list.push({ unitTitle: u.title, id: l.id, title: l.title })));
    return list;
  }, [tree]);

  const currentId = useMemo(() => {
    if (!flat.length) return null;
    return flat.some((f) => f.id === search.lesson) ? search.lesson! : flat[0].id;
  }, [flat, search.lesson]);
  const currentIdx = currentId ? flat.findIndex((f) => f.id === currentId) : -1;

  // جلب محتوى الدرس عند الطلب (مع تخزينٍ مؤقّت)
  const fetchLesson = (id: string) => {
    if (cache[id]) return;
    setLessonBusy(true); setLessonErr(false);
    getManhajLesson({ data: { id } }).then((r) => { const lesson = (r as { lesson: LessonContent | null }).lesson; if (lesson) setCache((c) => ({ ...c, [lesson.id]: lesson })); else setLessonErr(true); }).catch(() => setLessonErr(true)).finally(() => setLessonBusy(false));
  };
  useEffect(() => { if (currentId) fetchLesson(currentId); /* eslint-disable-next-line */ }, [currentId]);

  const go = (idx: number) => {
    const f = flat[idx]; if (!f) return;
    navigate({ to: "/manhaj", search: { lesson: f.id }, replace: false });
    setNavOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  };
  const current = currentId ? cache[currentId] : null;
  // القشرة الواحدة (قاعدة معمّمة — بلاغ المالك ٢٠٢٦-٠٧-١٨): المسجَّلُ يحتفظ بشريط تطبيقه
  // أينما ذهب (كان المنهاجُ يبدّل الترويسةَ كلها فيضيع طريقُ العودة)؛ الزائرُ له ترويسةٌ عامةٌ خفيفة.
  const shellCtx = useRouteContext({ strict: false }) as { user?: unknown };
  const isLogged = !!shellCtx.user;

  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      {isLogged ? (
        <>
          <TopTabs />
          {/* زرُّ الفهرس للجوال — كان داخل الترويسة الخاصة */}
          <div className="border-b border-line bg-surface px-4 py-2 lg:hidden">
            <button onClick={() => setNavOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-surface-2"><Menu className="size-4" strokeWidth={1.75} /> فهرس المنهاج</button>
          </div>
        </>
      ) : (
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setNavOpen(true)} aria-label="الفهرس" className="grid size-9 place-items-center rounded-lg ring-1 ring-line transition hover:bg-surface-2 lg:hidden"><Menu className="size-5" strokeWidth={1.75} /></button>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-800 text-emerald-100 ring-1 ring-emerald-900/20"><BookOpen className="size-5" strokeWidth={1.6} /></span>
              <div className="leading-tight">
                <p className="font-display text-base font-semibold text-ink">منهاج على بصيرة</p>
                <p className="text-[11px] text-ink-faint">منهاج تربويّ للشباب والأسرة</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-2 hover:text-ink sm:inline">الرئيسية</Link>
            <Link to="/login" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900"><LogIn className="size-3.5" strokeWidth={1.75} /> دخول</Link>
          </div>
        </div>
      </header>
      )}

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className={cn("border-line bg-surface lg:block lg:border-e", navOpen ? "fixed inset-0 z-50 overflow-y-auto" : "hidden")}>
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-line bg-surface p-3 lg:hidden">
            <span className="font-display text-sm font-semibold text-ink">الفهرس</span>
            <button onClick={() => setNavOpen(false)} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg ring-1 ring-line"><X className="size-4" /></button>
          </div>
          <div className="p-3">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في عناوين الدروس…"
                className="h-10 w-full rounded-xl bg-surface-2 pe-3 ps-9 text-sm text-ink ring-1 ring-line outline-none transition focus:ring-2 focus:ring-emerald-700/40" />
            </div>
            {treeBusy && !tree ? (
              <div className="grid place-items-center py-10 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
            ) : treeErr ? (
              <button onClick={fetchTree} className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-emerald-800"><RefreshCw className="size-4" /> إعادة المحاولة</button>
            ) : (
              <Tree units={tree ?? []} q={q} currentId={currentId} onPick={(id) => { const i = flat.findIndex((f) => f.id === id); if (i >= 0) go(i); }} />
            )}
          </div>
        </aside>

        <main ref={mainRef} className="min-w-0 px-4 py-8 md:px-10">
          {(treeBusy && !tree) || (lessonBusy && !current) ? (
            <div className="grid place-items-center py-32 text-ink-faint"><Loader2 className="size-6 animate-spin" /></div>
          ) : lessonErr && !current ? (
            <div className="mx-auto max-w-lg rounded-2xl bg-danger-bg p-6 text-center ring-1 ring-danger/20">
              <p className="text-sm font-semibold text-danger">تعذّر تحميل الدرس</p>
              <button onClick={() => currentId && fetchLesson(currentId)} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50"><RefreshCw className="size-4" /> إعادة المحاولة</button>
            </div>
          ) : current ? (
            <article className="mx-auto max-w-3xl text-[19px] leading-[2.05]">
              <div className="text-sm text-ink-faint">{current.unitTitle}</div>
              <h1 className="mt-1 border-b-2 border-gold-500 pb-2 font-display text-3xl font-bold text-emerald-900">{current.title}</h1>
              {current.subject && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="subj">{current.subject}</Badge>
                </div>
              )}
              <div className="mt-6"><Blocks blocks={current.blocks} /></div>
              <div className="mt-12 flex justify-between gap-3 border-t border-line pt-6">
                <button disabled={currentIdx <= 0} onClick={() => go(currentIdx - 1)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-40"><ArrowRight className="size-4" strokeWidth={2} /> الدرس السابق</button>
                <button disabled={currentIdx >= flat.length - 1} onClick={() => go(currentIdx + 1)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-40">الدرس التالي <ArrowLeft className="size-4" strokeWidth={2} /></button>
              </div>
            </article>
          ) : (
            <div className="grid place-items-center py-32 text-ink-soft">اختر درساً من الفهرس.</div>
          )}
        </main>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "subj" | "h" | "q" }) {
  const cls = tone === "subj" ? "bg-emerald-800 text-emerald-50 ring-emerald-900/30"
    : tone === "h" ? "bg-gold-50 text-gold-700 ring-gold-100"
    : tone === "q" ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : "bg-surface-2 text-ink-soft ring-line";
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1", cls)}>{children}</span>;
}

function Tree({ units, q, currentId, onPick }: { units: TreeUnit[]; q: string; currentId: string | null; onPick: (id: string) => void }) {
  const term = q.trim().toLowerCase();
  return (
    <div className="space-y-1">
      {units.map((u) => {
        const lessons = u.lessons.filter((l) => !term || l.title.toLowerCase().includes(term));
        if (!lessons.length) return null;
        const hasCurrent = lessons.some((l) => l.id === currentId);
        return (
          <details key={u.id} open={!!term || hasCurrent} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 truncate">{u.title}</span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-normal text-ink-faint">{toAr(u.lessons.length)}<ChevronLeft className="size-3.5 transition group-open:-rotate-90" strokeWidth={2} /></span>
            </summary>
            <div className="mt-0.5 space-y-0.5 pb-1">
              {lessons.map((l) => (
                <button key={l.id} onClick={() => onPick(l.id)}
                  className={cn("block w-full rounded-lg px-3 py-1.5 pe-6 text-start text-[13.5px] transition",
                    l.id === currentId ? "bg-emerald-800 font-medium text-emerald-50" : "text-ink-soft hover:bg-surface-2 hover:text-ink")}>
                  {l.title}
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
