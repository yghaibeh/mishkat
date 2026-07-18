import { useEffect, useState } from "react";
import { Link, useRouteContext, useNavigate, useSearch } from "@tanstack/react-router";
import { Building2, Home, ChevronLeft, Users, CalendarDays, HandCoins, Receipt, Scale, BookOpen, GraduationCap, Clock, Loader2, AlertCircle, RefreshCw , Printer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasCap } from "@/lib/capabilities";
import { mosqueTabs } from "@/lib/mosque-tabs";
import { fmtNum, fmtHijriShort, hijriMonthLabel, hijriMonthOptions } from "@/lib/format";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { BoxPanel } from "@/components/finance/BoxPanel";
import { SegmentedControl, TextArea } from "@/components/ui/field";
import { KpiAmountCard, KpiPercentCard, KpiProgressCard } from "@/components/report/KpiCard";
import { WeeklyTable } from "@/components/report/WeeklyTable";
import { ActivityList } from "@/components/report/ActivityList";
import { FormulaNote } from "@/components/report/FormulaNote";
import { ReportActions } from "@/components/report/ReportActions";
import { DailyLogPage } from "@/components/daily-log/DailyLogPage";
import { TxnPanel } from "@/components/mosque-finance/MosqueFinancePage";
import { toast } from "sonner";
import { getMosqueFinance } from "@/lib/api/mosqueFinance";
import { getMosqueHalaqat } from "@/lib/api/alaBaseera";
import { WeeklyHalaqaPanel } from "@/components/circles/WeeklyHalaqaPanel";
import { getTahfeez, createTahfeezCircle, getTahfeezStudents, addTahfeezStudent, removeTahfeezStudent, getTahfeezProgress, addTahfeezProgress, removeTahfeezProgress, getTahfeezSession, saveTahfeezDaily } from "@/lib/api/tahfeez";
import { getMeetings, createMeeting, setMeetingMinutes, addDecision, removeDecision } from "@/lib/api/meetings";
import { LessonsTab } from "@/components/mosque/LessonsTab";
import { TahfeezDaily } from "@/components/tahfeez/TahfeezDailyRegister";
import { CircleRankings } from "@/components/circles/CircleRankings";
import { getCommittees, createCommittee, assignCommitteeHead, addCommitteePlan, setCommitteePlanStatus } from "@/lib/api/committees";
import { getMosqueCircles, createCircle, updateCircle, archiveCircle, getCircleStudents, addCircleStudent, removeCircleStudent, getMosqueTeacherOptions } from "@/lib/api/circles";
import { CIRCLE_TYPES, CIRCLE_TYPE_OPTIONS, circleTypeLabel, circleAllowsGender, type GenderTrack } from "@/lib/circles";
import { SURAH_OPTIONS, surahAyat } from "@/lib/quran";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { BookMarked, Plus, Gavel, Vote, Users2, UserPlus, ListChecks, CheckCircle2, Circle, Layers, Archive, Save, Sparkles } from "lucide-react";

const COMMITTEE_CATALOG: Array<{ name: string; type: "main" | "sub" }> = [
  { name: "الدعوة والتربية الشرعية", type: "main" },
  { name: "العلاقات العامة", type: "main" },
  { name: "الإغاثة", type: "main" },
  { name: "الرياضة والترفيه", type: "main" },
  { name: "المراحل الطلابية", type: "main" },
  { name: "الإعلام والنشر", type: "sub" },
  { name: "الصيانة والنظافة العامة", type: "sub" },
  { name: "العمل الجماهيري", type: "sub" },
];
const COMM_TYPE: Record<string, "main" | "sub"> = Object.fromEntries(COMMITTEE_CATALOG.map((c) => [c.name, c.type]));

type Crumb = { id: string | null; name: string };
type Overview = {
  mosque: { id: string; name: string; type: string; genderTrack: string };
  breadcrumbs: Crumb[]; members: number;
  week: { points: number; target: number; status: string; hijriMonth: string | null; daysSince: number | null } | null;
};
type Report = {
  mosqueId: string; mosqueName: string; hijriDate: string; allApproved: boolean;
  kpis: { total: number; target: number; percent: number; amount: string };
  approval: { allApproved: boolean; canAmirApprove: boolean; canLayerApprove: boolean };
  weeklyRows: Array<{ weeklyRecordId: string | null; week: string; points: number; target: number; status: "done" | "below"; approvalStatus: string; canLayerReject: boolean; note: string }>;
  activities: Array<{ name: string; count: number; points: number }>;
};
type DailyData = { tracks: { m: unknown[]; w: unknown[] }; weekTarget: number };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  layer_approved: { label: "معتمد نهائياً", cls: "bg-success-bg text-success ring-success/20" },
  amir_approved: { label: "اعتمده الأمير", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
  draft: { label: "مسودة", cls: "bg-gold-50 text-gold-700 ring-gold-100" },
};

export function MosquePage({ mosqueId, overview, report, daily, weekPoints }: { mosqueId: string; overview?: Overview | null; report?: Report | null; daily?: DailyData | null; weekPoints?: number }) {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[]; homeMosqueId?: string | null; features?: Record<string, boolean> } };
  const caps = ctx.user?.caps ?? [];
  const isOwn = ctx.user?.homeMosqueId === mosqueId;   // طاقم المسجد يرى مسجده بلا مسار شبكة، والتبويبات في الشريط العلوي
  const ft = ctx.user?.features ?? {};

  const tabs = mosqueTabs(caps, ft);
  const canManageTahfeez = hasCap(caps, "tahfeez.manage");
  const canManageMeetings = hasCap(caps, "meetings.manage");
  const canManageCommittees = hasCap(caps, "committees.manage");
  const canManageCircles = hasCap(caps, "circles.manage");
  const canManageBaseera = hasCap(caps, "alaBaseera.manage");

  // التبويب الفعّال من الرابط (?t=) — يُشارَك مع الشريط العلوي لطاقم المسجد
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { t?: string };
  // طاقم المسجد يهبط على «سجل اليوم» (واجهة عمله اليومية)؛ المشرف الزائر على «نظرة».
  const defaultTab = isOwn && tabs.some((t) => t.k === "daily") ? "daily" : tabs[0]?.k ?? "overview";
  const tab = tabs.find((t) => t.k === search.t)?.k ?? defaultTab;
  const setTab = (k: string) => navigate({ to: "/mosque/$mosqueId", params: { mosqueId }, search: { t: k }, replace: true });

  const mosque = overview?.mosque;
  const crumbs = overview?.breadcrumbs ?? [];
  const wk = overview?.week;
  const badge = wk ? STATUS_BADGE[wk.status] : null;

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        {/* مسار التنقّل — للمشرف الزائر فقط؛ طاقم المسجد لا يَعنيه مسار الشبكة */}
        {!isOwn && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft" aria-label="مسار التنقّل">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={c.id ?? "root"} className="inline-flex items-center gap-1.5">
                {i > 0 && <ChevronLeft className="size-3.5 text-ink-faint" strokeWidth={2} />}
                {last ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-ink">{c.name}</span>
                ) : (
                  <Link to={c.id ? "/network/$unitId" : "/network"} params={c.id ? { unitId: c.id } : undefined}
                    className="inline-flex items-center gap-1 rounded-md px-1 transition hover:bg-surface-2 hover:text-ink">
                    {i === 0 && <Home className="size-3.5 text-ink-faint" strokeWidth={1.75} />}{c.name}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
        )}
        {/* مساحاتُ المسجد شريطاً ثانوياً للزائر — قشرةُ التطبيق فوقه ثابتةٌ لدوره (القشرة الواحدة) */}
        {!isOwn && tabs.length > 1 && (
          <div className="flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition", tab === t.k ? "bg-emerald-800 text-emerald-50" : "text-ink-soft hover:bg-surface-2 hover:text-ink")}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {/* ترويسة المسجد */}
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <Building2 className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{mosque?.name ?? "—"}</h1>
            <p className="mt-1 text-sm text-ink-soft">{isOwn ? (mosque?.genderTrack === "female" ? "مسجد نساء" : "أسرة المسجد") : `${crumbs.slice(1, -1).map((c) => c.name).join(" · ")}${mosque?.genderTrack === "female" ? " · نساء" : ""}`}</p>
          </div>
          {badge && (
            <span className={cn("ms-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1", badge.cls)}>{badge.label}</span>
          )}
        </header>

        {/* تبويبات المسجد صارت في الشريط العلوي (TopTabs) — لا تكرار هنا */}
        {tab === "overview" && <Overview overview={overview} onGo={setTab} tabs={tabs.map((t) => t.k)} canEdit={isOwn && hasCap(caps, "dailyLog.edit")} />}
        {tab === "report" && <ReportTab report={report} mosqueId={mosqueId} />}
        {tab === "daily" && <DailyLogPage data={(daily ?? undefined) as never} embedded mosqueId={mosqueId} genderTrack={mosque?.genderTrack} priorWeekPoints={weekPoints ?? 0} readOnly={!(isOwn && hasCap(caps, "dailyLog.edit"))} />}
        {tab === "circles" && <CirclesTab mosqueId={mosqueId} canManage={canManageCircles} defaultGender={(mosque?.genderTrack as GenderTrack) ?? "male"} />}
        {tab === "finance" && (<>
          {/* «صندوق مسجدي» (ق-د٢): الأميرُ أمينُ صندوقه — يقبض بنفسه ويقرّ عُهدةَ ما يصله من السلسلة */}
          <BoxPanel unitId={mosqueId} />
          <FinanceTab mosqueId={mosqueId} />
        </>)}
        {tab === "halaqat" && <HalaqatTab mosqueId={mosqueId} canManage={canManageBaseera} />}
        {tab === "tahfeez" && <TahfeezTab mosqueId={mosqueId} canManage={canManageTahfeez} mosqueName={mosque?.name ?? ""} />}
        {tab === "lessons" && <LessonsTab mosqueId={mosqueId} canManage={isOwn ? hasCap(caps, "dailyLog.edit") : hasCap(caps, "*")} />}
        {tab === "meetings" && <MeetingsTab mosqueId={mosqueId} canManage={canManageMeetings} />}
        {tab === "committees" && <CommitteesTab mosqueId={mosqueId} canManage={canManageCommittees} />}
      </main>
    </MishkatShell>
  );
}

function Overview({ overview, onGo, tabs, canEdit }: { overview?: Overview | null; onGo: (k: string) => void; tabs: string[]; canEdit?: boolean }) {
  const wk = overview?.week;
  const pct = wk ? Math.min(100, Math.round((wk.points / wk.target) * 100)) : 0;
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <span className={tile}><CalendarDays className="size-[18px]" strokeWidth={1.75} /></span>
            <span className="font-mono-nums text-[11px] font-semibold text-ink-faint">{pct}%</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 font-mono-nums"><span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{wk?.points ?? 0}</span><span className="text-base text-ink-faint">/ {wk?.target ?? 70}</span></div>
          <p className="mt-1.5 text-xs text-ink-soft">نقاط الأسبوع الأخير</p>
        </div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <span className={tile}><Users className="size-[18px]" strokeWidth={1.75} /></span>
          <div className="mt-3 font-mono-nums text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{overview?.members ?? 0}</div>
          <p className="mt-1.5 text-xs text-ink-soft">أعضاء أسرة المسجد</p>
        </div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <span className={tile}><CalendarDays className="size-[18px]" strokeWidth={1.75} /></span>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">{wk?.daysSince == null ? "—" : wk.daysSince === 0 ? "اليوم" : `قبل ${wk.daysSince} يوم`}</div>
          <p className="mt-1.5 text-xs text-ink-soft">آخر إدخال</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.includes("report") && <QuickLink onClick={() => onGo("report")}>عرض التقرير الشهري</QuickLink>}
        {tabs.includes("daily") && <QuickLink onClick={() => onGo("daily")}>{canEdit ? "إدخال سجل اليوم" : "عرض سجل اليوم"}</QuickLink>}
        {tabs.includes("finance") && <QuickLink onClick={() => onGo("finance")}>المالية الداخلية</QuickLink>}
      </div>
    </section>
  );
}
// بطاقة مؤشّر موحّدة + هيكل تحميل (skeleton) — تمنع وميض الأصفار قبل وصول البيانات
function KpiTile({ Icon, value, label, loading, big }: { Icon: LucideIcon; value: React.ReactNode; label: string; loading?: boolean; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><Icon className="size-[18px]" strokeWidth={1.75} /></span>
      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded-md bg-surface-2 sm:h-10" />
      ) : (
        <div className={cn("mt-3 font-semibold tracking-tight text-ink", big ? "text-2xl" : "font-mono-nums text-3xl sm:text-4xl")}>{typeof value === "number" ? fmtNum(value) : value}</div>
      )}
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}

// حالة خطأ موحّدة + إعادة محاولة (بدل الكتم الصامت)
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
      <AlertCircle className="size-7 text-warn" strokeWidth={1.5} />
      <p className="text-sm text-ink-soft">تعذّر تحميل البيانات. تحقّق من اتصالك وأعد المحاولة.</p>
      <button onClick={onRetry} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-surface-2 px-4 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface">
        <RefreshCw className="size-3.5" strokeWidth={2} /> إعادة المحاولة
      </button>
    </div>
  );
}

function QuickLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2">{children}<ChevronLeft className="size-4" strokeWidth={2} /></button>;
}

// تصنيف «المسجد المؤثر» المُكتسَب بالإنجاز (ق-23 / §36): ≥100% متميّز · 50–99% دون الهدف · <50% متعثّر
function influenceTier(percent: number): { label: string; cls: string } {
  if (percent >= 100) return { label: "مسجد مؤثر — متميّز", cls: "bg-success-bg text-success ring-success/20" };
  if (percent >= 50) return { label: "دون الهدف", cls: "bg-gold-50 text-gold-700 ring-gold-100" };
  return { label: "متعثّر — يحتاج دعماً", cls: "bg-danger-bg text-danger ring-danger/20" };
}
function ReportTab({ report, mosqueId }: { report?: Report | null; mosqueId: string }) {
  if (!report) return <div className="grid place-items-center rounded-2xl bg-surface px-6 py-16 text-center text-sm text-ink-soft ring-1 ring-line">لا سجلات لهذا المسجد بعد.</div>;
  const tier = influenceTier(report.kpis.percent);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-sm text-ink-soft">الشهر: <span className="font-semibold text-ink">{report.hijriDate}</span></p>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1", tier.cls)}><Sparkles className="size-3.5" strokeWidth={1.75} />{tier.label}</span>
        </div>
        <ReportActions approval={report.approval} mosqueId={mosqueId} />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiProgressCard label="مجموع نقاط الشهر" value={report.kpis.total} total={report.kpis.target} percent={report.kpis.percent} />
        <KpiPercentCard label="نسبة تحقيق الهدف" percent={report.kpis.percent} delta="مقارنةً بالهدف الشهري" />
        <KpiAmountCard label="القيمة المستحقة (تقديرية)" amount={report.kpis.amount} note="تُصرف بعد الاعتماد النهائي." />
      </section>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3"><WeeklyTable rows={report.weeklyRows} lastEntryAt={(report as { lastEntryAt?: number | null }).lastEntryAt} /><FormulaNote /></div>
        <aside className="lg:col-span-2"><ActivityList items={report.activities} /></aside>
      </div>
    </div>
  );
}

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function FinanceTab({ mosqueId }: { mosqueId: string }) {
  const [t, setT] = useState<{ donations: number; expenses: number; balance: number; donCount: number; expCount: number } | null>(null);
  const [err, setErr] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async () => { setErr(false); try { const r = await getMosqueFinance({ data: { mosqueId } }) as { totals?: typeof t }; setT(r.totals ?? null); } catch { setErr(true); } };
  useEffect(() => { void load(); }, [mosqueId]);
  const v = t ?? { donations: 0, expenses: 0, balance: 0, donCount: 0, expCount: 0 };
  if (err && t === null) return <LoadError onRetry={load} />;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line"><span className={tile}><HandCoins className="size-[18px]" strokeWidth={1.75} /></span>{t === null ? <div className="mt-3 h-9 w-24 animate-pulse rounded-md bg-surface-2 sm:h-10" /> : <div className="mt-3 font-mono-nums text-3xl font-semibold text-ink sm:text-4xl">${money(v.donations)}</div>}<p className="mt-1.5 text-xs text-ink-soft">إجمالي التبرّعات</p></div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line"><span className={tile}><Receipt className="size-[18px]" strokeWidth={1.75} /></span>{t === null ? <div className="mt-3 h-9 w-24 animate-pulse rounded-md bg-surface-2 sm:h-10" /> : <div className="mt-3 font-mono-nums text-3xl font-semibold text-warn sm:text-4xl">${money(v.expenses)}</div>}<p className="mt-1.5 text-xs text-ink-soft">إجمالي المصروفات</p></div>
        <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900"><div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" /><span className="grid size-9 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10"><Scale className="size-[18px]" strokeWidth={1.75} /></span>{t === null ? <div className="mt-3 h-9 w-24 animate-pulse rounded-md bg-emerald-50/10 sm:h-10" /> : <div className="mt-3 font-mono-nums text-3xl font-semibold text-gold-100 sm:text-4xl">${money(v.balance)}</div>}<p className="mt-1.5 text-[11px] text-emerald-100/60">الرصيد (تبرّعات − مصروفات)</p></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <TxnPanel mosqueId={mosqueId} kind="donation" onChanged={load} />
        <TxnPanel mosqueId={mosqueId} kind="expense" onChanged={load} />
      </div>
    </div>
  );
}

type Halaqa = { id: string; name: string; teacherName: string; venueName: string; genderTrack: string; capacity: number; students: number };
function HalaqatTab({ mosqueId, canManage }: { mosqueId: string; canManage: boolean }) {
  const [kpis, setKpis] = useState<{ halaqat: number; students: number; hours: number } | null>(null);
  const [items, setItems] = useState<Halaqa[]>([]);
  const [total, setTotal] = useState(0);
  const [openH, setOpenH] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async (offset: number, append: boolean) => {
    setBusy(true); setErr(false);
    try {
      const r = await getMosqueHalaqat({ data: { mosqueId, offset } }) as { kpis: typeof kpis; items: Halaqa[]; total: number };
      setKpis(r.kpis); setItems((p) => (append ? [...p, ...r.items] : r.items)); setTotal(r.total);
    } catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { void load(0, false); }, [mosqueId]);
  const k = kpis ?? { halaqat: 0, students: 0, hours: 0 };
  if (err && kpis === null) return <LoadError onRetry={() => load(0, false)} />;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiTile Icon={BookOpen} value={k.halaqat} label="حلقات المسجد" loading={kpis === null} />
        <KpiTile Icon={GraduationCap} value={k.students} label="طلاب مسجّلون" loading={kpis === null} />
        <KpiTile Icon={Clock} value={k.hours} label="إجمالي ساعات الدروس" loading={kpis === null} />
      </section>
      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <div className="flex items-center gap-2"><BookOpen className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">الحلقات</h3></div>
          <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{total}</span>
        </div>
        {busy && !items.length ? (
          <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
        ) : !items.length ? (
          <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لا حلقات «على بصيرة» في هذا المسجد بعد.</div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {items.map((h) => (
                <li key={h.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className={tile}><BookOpen className="size-4" strokeWidth={1.75} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{h.name}{h.genderTrack === "female" && <span className="ms-1.5 text-[10px] text-gold-700">نساء</span>}</p>
                      <p className="truncate text-[11px] text-ink-faint">{h.teacherName} · {h.venueName}</p>
                    </div>
                    {canManage ? (
                      <button onClick={() => setOpenH(openH === h.id ? null : h.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                        <ListChecks className="size-3.5" strokeWidth={1.75} />
                        التقييم الأسبوعي
                        <ChevronLeft className={cn("size-3.5 transition", openH === h.id && "-rotate-90")} strokeWidth={2} />
                      </button>
                    ) : (
                      <span className="shrink-0 font-mono-nums text-xs font-semibold text-ink-soft">{h.students}{h.capacity ? `/${h.capacity}` : ""} طالب</span>
                    )}
                  </div>
                  {canManage && openH === h.id && <WeeklyHalaqaPanel halaqaId={h.id} />}
                </li>
              ))}
            </ul>
            {items.length < total && (
              <button onClick={() => load(items.length, true)} disabled={busy} className="w-full border-t border-line py-3 text-xs font-semibold text-emerald-800 transition hover:bg-surface-2/40 disabled:opacity-60">تحميل المزيد ({total - items.length})</button>
            )}
          </>
        )}
      </section>
    </div>
  );
}


type Circle = { id: string; name: string; teacherName: string; students: number };
function TahfeezTab({ mosqueId, canManage, mosqueName }: { mosqueId: string; canManage: boolean; mosqueName?: string }) {
  const [kpis, setKpis] = useState<{ circles: number; students: number; progress: number } | null>(null);
  const [items, setItems] = useState<Circle[]>([]);
  const [openT, setOpenT] = useState<string | null>(null);
  const [openDaily, setOpenDaily] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async () => {
    setBusy(true); setErr(false);
    try { const r = await getTahfeez({ data: { mosqueId } }) as { kpis: typeof kpis; items: Circle[] }; setKpis(r.kpis); setItems(r.items); } catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [mosqueId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setAdding(true);
    try { await createTahfeezCircle({ data: { mosqueId, name: name.trim() } }); toast.success("أُضيفت حلقة التحفيظ"); setName(""); await load(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const k = kpis ?? { circles: 0, students: 0, progress: 0 };
  if (err && kpis === null) return <LoadError onRetry={load} />;
  return (
    <div className="space-y-6">
      {/* تقييم الحلقات الدوريّ داخل المسجد (قرار اللجنة) */}
      <CircleRankings mosqueId={mosqueId} title="ترتيب حلقات المسجد" />
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiTile Icon={BookMarked} value={k.circles} label="حلقات التحفيظ" loading={kpis === null} />
        <KpiTile Icon={GraduationCap} value={k.students} label="طلاب التحفيظ" loading={kpis === null} />
        <KpiTile Icon={CalendarDays} value={k.progress} label="سجلّات المتابعة" loading={kpis === null} />
      </section>
      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <div className="flex items-center gap-2"><BookMarked className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">الحلقات</h3></div>
          <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{k.circles}</span>
        </div>
        {canManage && (
          <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
            <div className="min-w-0 flex-1"><Field label="اسم حلقة جديدة"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حلقة الفجر" /></Field></div>
            <button type="submit" disabled={adding || name.trim().length < 2} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة</button>
          </form>
        )}
        {busy && !items.length ? (
          <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
        ) : !items.length ? (
          <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لا حلقات تحفيظ في هذا المسجد بعد.</div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.id}>
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className={tile}><BookMarked className="size-4" strokeWidth={1.75} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{c.name}</p><p className="truncate text-[11px] text-ink-faint">{c.teacherName}</p></div>
                  <button onClick={() => { setOpenDaily(openDaily === c.id ? null : c.id); setOpenT(null); }}
                    className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 transition", openDaily === c.id ? "bg-emerald-800 text-emerald-50 ring-emerald-900/30" : "bg-surface-2 text-ink-soft ring-line hover:text-emerald-800")}>
                    <CalendarDays className="size-3.5" strokeWidth={1.75} /> سجلّ اليوم
                  </button>
                  <button onClick={() => { setOpenT(openT === c.id ? null : c.id); setOpenDaily(null); }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                    <Users2 className="size-3.5" strokeWidth={1.75} />
                    <span className="font-mono-nums">{c.students}</span> طالب
                    <ChevronLeft className={cn("size-3.5 transition", openT === c.id && "-rotate-90")} strokeWidth={2} />
                  </button>
                </div>
                {openDaily === c.id && <TahfeezDaily circleId={c.id} circleName={c.name} mosqueName={mosqueName ?? ""} />}
                {openT === c.id && <TahfeezStudents circleId={c.id} canManage={canManage} onChanged={load} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// سجلّ التحفيظ اليوميّ (المعلّم): حضور + حفظ + مراجعة (سورة/آية أو صفحات) + تجويد + مصاحب مُهيكَل
type TStudent = { id: string; name: string };
function TahfeezStudents({ circleId, canManage, onChanged }: { circleId: string; canManage: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<TStudent[]>([]);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [openS, setOpenS] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    try { const r = await getTahfeezStudents({ data: { circleId } }) as TStudent[]; setItems(r); } catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [circleId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setAdding(true);
    try { await addTahfeezStudent({ data: { circleId, name: name.trim() } }); setName(""); await load(); onChanged(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const del = async (id: string) => {
    try { await removeTahfeezStudent({ data: { id } }); await load(); onChanged(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-3">
      {canManage && (
        <form onSubmit={add} className="mb-2 flex items-center gap-2">
          <div className="min-w-0 flex-1"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الطالب…" /></div>
          <button type="submit" disabled={adding || name.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{adding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} إضافة طالب</button>
        </form>
      )}
      {busy ? (
        <div className="grid place-items-center py-3 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>
      ) : !items.length ? (
        <p className="py-2 text-center text-[11px] text-ink-faint">لا طلاب مسجّلون في هذه الحلقة بعد.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id} className="rounded-lg bg-surface ring-1 ring-line">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{s.name}</span>
                <button onClick={() => setOpenS(openS === s.id ? null : s.id)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                  المتابعة<ChevronLeft className={cn("size-3 transition", openS === s.id && "-rotate-90")} strokeWidth={2} />
                </button>
                {canManage && <button onClick={() => del(s.id)} aria-label="حذف الطالب" className="text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>}
              </div>
              {openS === s.id && <TahfeezProgress studentId={s.id} canManage={canManage} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ProgressEntry = { id: string; scope: string | null; fromAyah: number | null; toAyah: number | null; rating: number | null; dateHijri: string | null };
function TahfeezProgress({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const [items, setItems] = useState<ProgressEntry[]>([]);
  const [ayahs, setAyahs] = useState(0);
  const [busy, setBusy] = useState(true);
  const [scope, setScope] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rating, setRating] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const r = await getTahfeezProgress({ data: { studentId } }) as { memorizedAyahs: number; items: ProgressEntry[] }; setItems(r.items); setAyahs(r.memorizedAyahs); } catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [studentId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scope.trim().length < 1) { toast.error("حدّد المقطع"); return; }
    const f = from ? parseInt(from, 10) : undefined;
    const t = to ? parseInt(to, 10) : undefined;
    const r = rating ? parseInt(rating, 10) : undefined;
    setSaving(true);
    try { await addTahfeezProgress({ data: { studentId, scope: scope.trim(), fromAyah: f, toAyah: t, rating: r } }); setScope(""); setFrom(""); setTo(""); setRating(""); await load(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setSaving(false); }
  };
  const del = async (id: string) => {
    try { await removeTahfeezProgress({ data: { id } }); await load(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <div className="border-t border-line bg-surface-2/40 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-semibold text-ink-faint">المحفوظ تقديراً: <span className="font-mono-nums text-emerald-800">{ayahs}</span> آية</p>
      {canManage && (
        <form onSubmit={add} className="mb-2 grid grid-cols-[1fr_3rem_3rem_3.5rem_auto] gap-1.5">
          <TextField value={scope} onChange={(e) => setScope(e.target.value)} placeholder="المقطع (سورة/جزء)…" />
          <TextField type="number" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="من" dir="ltr" className="text-center" />
          <TextField type="number" value={to} onChange={(e) => setTo(e.target.value)} placeholder="إلى" dir="ltr" className="text-center" />
          <TextField type="number" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="٥/" dir="ltr" className="text-center" />
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-800 px-2.5 text-[11px] font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}</button>
        </form>
      )}
      {busy ? (
        <div className="grid place-items-center py-2 text-ink-faint"><Loader2 className="size-3.5 animate-spin" /></div>
      ) : !items.length ? (
        <p className="py-1 text-center text-[10px] text-ink-faint">لا سجلّات متابعة بعد.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1 text-[11px] ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate text-ink">{p.scope || "—"}{p.fromAyah != null && p.toAyah != null && <span className="ms-1 font-mono-nums text-ink-faint">({p.fromAyah}–{p.toAyah})</span>}{p.rating != null && <span className="ms-1 text-gold-700">★{p.rating}</span>}</span>
              {p.dateHijri && <span className="shrink-0 font-mono-nums text-[9px] text-ink-faint">{p.dateHijri}</span>}
              {canManage && <button onClick={() => del(p.id)} aria-label="حذف" className="shrink-0 text-xs leading-none text-ink-faint transition hover:text-danger">✕</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type MosqueCircle = { id: string; type: string; genderTrack: string; name: string; teacherPersonId: string | null; teacherName: string | null; capacity: number | null; notes: string | null; students: number };
function CirclesTab({ mosqueId, canManage, defaultGender }: { mosqueId: string; canManage: boolean; defaultGender: GenderTrack }) {
  const [items, setItems] = useState<MosqueCircle[]>([]);
  const [openCircle, setOpenCircle] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [type, setType] = useState<string>("tahfeez");
  const [gender, setGender] = useState<GenderTrack>(defaultGender);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherOpts, setTeacherOpts] = useState<Array<{ personId: string; name: string }>>([]);
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async () => {
    setBusy(true); setErr(false);
    try { const r = await getMosqueCircles({ data: { mosqueId } }) as MosqueCircle[]; setItems(r); } catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [mosqueId]);
  // خيارات المعلّمين (غ٢) — لتعيين معلّم الحلقة إنشاءً وتعديلًا (يُكمل الجسور)
  useEffect(() => {
    getMosqueTeacherOptions({ data: { mosqueId } })
      .then((r) => setTeacherOpts((r as { items: Array<{ personId: string; name: string }> }).items ?? []))
      .catch(() => {});
  }, [mosqueId]);
  // المسجد المؤثر للرجال فقط — صحّح المسار تلقائياً عند تغيير النوع
  useEffect(() => { if (!circleAllowsGender(type, gender)) setGender("male"); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setAdding(true);
    try {
      const cap = capacity ? parseInt(capacity, 10) : NaN;
      const res = await createCircle({ data: { mosqueId, type: type as never, genderTrack: gender, name: name.trim(), capacity: Number.isFinite(cap) && cap > 0 ? cap : null, teacherPersonId: teacherId || null } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else {
        const notice = (res as { notice?: string }).notice;
        if (notice) toast.message("أُضيفت الحلقة", { description: notice });
        else toast.success("أُضيفت الحلقة");
        setName(""); setCapacity(""); await load();
      }
    } catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const remove = async (id: string) => {
    try { await archiveCircle({ data: { id } }); toast.success("أُرشفت الحلقة"); await load(); }
    catch { toast.error("تعذّرت الأرشفة"); }
  };

  const counts = CIRCLE_TYPES.map((t) => ({ type: t.type, label: t.label, n: items.filter((c) => c.type === t.type).length }));
  const shown = filter === "all" ? items : items.filter((c) => c.type === filter);
  if (err && !items.length) return <LoadError onRetry={load} />;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((c) => <KpiTile key={c.type} Icon={Layers} value={c.n} label={c.label} loading={busy && !items.length} />)}
      </section>
      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <div className="flex items-center gap-2"><Layers className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">حلقات المسجد</h3></div>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 ring-1 ring-line">
              <CircleChip active={filter === "all"} onClick={() => setFilter("all")}>الكل · {items.length}</CircleChip>
              {CIRCLE_TYPES.filter((t) => items.some((c) => c.type === t.type)).map((t) => (
                <CircleChip key={t.type} active={filter === t.type} onClick={() => setFilter(t.type)}>{t.label}</CircleChip>
              ))}
            </div>
          )}
        </div>
        {canManage && (
          <form onSubmit={add} className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="النوع"><MSelect value={type} onValueChange={setType} options={CIRCLE_TYPES.map((t) => ({ value: t.type, label: t.label }))} /></Field>
            <Field label="المسار">
              <SegmentedControl value={gender} onValueChange={(v) => setGender(v as GenderTrack)}
                options={[{ value: "male", label: "رجال" }, ...(circleAllowsGender(type, "female") ? [{ value: "female", label: "نساء" }] : [])]} />
            </Field>
            <Field label="اسم الحلقة"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حلقة الفجر" /></Field>
            <div className="flex items-end gap-2">
              <div className="w-24"><Field label="السعة"><TextField type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} dir="ltr" className="text-left" /></Field></div>
            <div className="w-44"><Field label="المعلّم (يُكمل الربط)"><MSelect value={teacherId} onValueChange={setTeacherId} placeholder="بلا تعيين"
              options={teacherOpts.map((t) => ({ value: t.personId, label: t.name }))} /></Field></div>
              <button type="submit" disabled={adding || name.trim().length < 2} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة</button>
            </div>
          </form>
        )}
        {busy && !items.length ? (
          <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
        ) : !shown.length ? (
          <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لا حلقات مسجّلة بهذا التصنيف بعد.</div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id}>
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className={tile}><Layers className="size-4" strokeWidth={1.75} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{c.name}{c.genderTrack === "female" && <span className="ms-1.5 text-[10px] text-gold-700">نساء</span>}</p>
                    <p className="truncate text-[11px] text-ink-faint">
                      {circleTypeLabel(c.type)}
                      {c.teacherName ? <> · {c.teacherName}</> : canManage ? <> · <span className="font-semibold text-warn">بلا معلّم</span></> : null}
                    </p>
                  </div>
                  <button onClick={() => setOpenCircle(openCircle === c.id ? null : c.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                    <Users2 className="size-3.5" strokeWidth={1.75} />
                    <span className="font-mono-nums">{c.students}{c.capacity ? `/${c.capacity}` : ""}</span> طالب
                    <ChevronLeft className={cn("size-3.5 transition", openCircle === c.id && "-rotate-90")} strokeWidth={2} />
                  </button>
                  {canManage && (
                    <button onClick={() => remove(c.id)} aria-label="أرشفة الحلقة" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-danger-bg hover:text-danger"><Archive className="size-4" strokeWidth={1.75} /></button>
                  )}
                </div>
                {openCircle === c.id && (
                  <div>
                    {canManage && (
                      <div className="flex items-center gap-2 border-t border-line bg-surface-2/20 px-5 py-2.5">
                        <span className="text-[11px] font-semibold text-ink-soft">معلّم الحلقة</span>
                        <div className="w-52">
                          <MSelect value={c.teacherPersonId ?? ""} placeholder="اختر المعلّم…"
                            options={teacherOpts.map((t) => ({ value: t.personId, label: t.name }))}
                            onValueChange={async (v) => {
                              const r = await updateCircle({ data: { id: c.id, teacherPersonId: v || null } });
                              if (r && "error" in r && r.error) toast.error(r.error);
                              else { toast.success("عُيّن المعلّم واكتمل ربط الحلقة"); await load(); }
                            }} />
                        </div>
                        {!c.teacherPersonId && <span className="text-[10px] text-warn">التعيينُ يُكمل ربطَها بوحدتها ويُظهرها في «حلقاتي» عند المعلّم</span>}
                      </div>
                    )}
                    <CircleStudents circleId={c.id} canManage={canManage} onChanged={load} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
function CircleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition", active ? "bg-emerald-800 text-emerald-50 shadow-soft" : "text-ink-soft hover:text-ink")}>{children}</button>
  );
}

type CStudent = { id: string; name: string; notes: string | null };
function CircleStudents({ circleId, canManage, onChanged }: { circleId: string; canManage: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<CStudent[]>([]);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const r = await getCircleStudents({ data: { circleId } }) as CStudent[]; setItems(r); } catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [circleId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setAdding(true);
    try { await addCircleStudent({ data: { circleId, name: name.trim() } }); setName(""); await load(); onChanged(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const del = async (id: string) => {
    try { await removeCircleStudent({ data: { id } }); await load(); onChanged(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-3">
      {canManage && (
        <form onSubmit={add} className="mb-2 flex items-center gap-2">
          <div className="min-w-0 flex-1"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الطالب…" /></div>
          <button type="submit" disabled={adding || name.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{adding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} إضافة طالب</button>
        </form>
      )}
      {busy ? (
        <div className="grid place-items-center py-3 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>
      ) : !items.length ? (
        <p className="py-2 text-center text-[11px] text-ink-faint">لا طلاب مسجّلون في هذه الحلقة بعد.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs text-ink ring-1 ring-line">
              {s.name}
              {canManage && <button onClick={() => del(s.id)} aria-label="حذف الطالب" className="text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Plan = { id: string; title: string; recurring: boolean; monthHijri: string | null; status: string };
type Committee = { id: string; name: string; type: string; headName: string | null; hasHeadAccount?: boolean; plans: Plan[] };
function CommitteesTab({ mosqueId, canManage }: { mosqueId: string; canManage: boolean }) {
  const [kpis, setKpis] = useState<{ committees: number; withHead: number; planItems: number } | null>(null);
  const [items, setItems] = useState<Committee[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"main" | "sub">("main");
  const [creating, setCreating] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async () => {
    setBusy(true); setErr(false);
    try { const r = await getCommittees({ data: { mosqueId } }) as { kpis: typeof kpis; items: Committee[] }; setKpis(r.kpis); setItems(r.items); } catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [mosqueId]);
  const existing = new Set(items.map((i) => i.name));
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 2) { toast.error("أدخل اسمَ اللجنة"); return; }
    if (existing.has(name)) { toast.error("لجنةٌ بهذا الاسم موجودة"); return; }
    setCreating(true);
    try { await createCommittee({ data: { mosqueId, name, type: newType } }); toast.success("شُكّلت اللجنة"); setNewName(""); await load(); }
    catch { toast.error("تعذّر التشكيل"); } finally { setCreating(false); }
  };
  // اقتراحاتُ الأسماء الشائعة (للنقر السريع) — والإدخالُ حرٌّ لأيّ لجنةٍ مخصّصة
  const suggestions = COMMITTEE_CATALOG.filter((c) => !existing.has(c.name));
  const k = kpis ?? { committees: 0, withHead: 0, planItems: 0 };
  if (err && kpis === null) return <LoadError onRetry={load} />;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiTile Icon={Users2} value={k.committees} label="عدد اللجان" loading={kpis === null} />
        <KpiTile Icon={UserPlus} value={k.withHead} label="لجان مُسنَدة لمسؤول" loading={kpis === null} />
        <KpiTile Icon={ListChecks} value={k.planItems} label="بنود الخطة" loading={kpis === null} />
      </section>

      {canManage && (
        <form onSubmit={create} className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1"><Field label="تشكيل لجنة (اسمٌ حرّ)"><TextField value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسمُ اللجنة…" /></Field></div>
            <div className="w-44"><Field label="النوع"><SegmentedControl size="sm" value={newType} onValueChange={(v) => setNewType(v as "main" | "sub")} options={[{ value: "main", label: "رئيسية" }, { value: "sub", label: "فرعية" }]} /></Field></div>
            <button type="submit" disabled={creating || newName.trim().length < 2} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} تشكيل</button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-ink-faint">اقتراحات:</span>
              {suggestions.map((s) => (
                <button key={s.name} type="button" onClick={() => { setNewName(s.name); setNewType(s.type); }} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-line transition hover:text-emerald-800">{s.name}</button>
              ))}
            </div>
          )}
        </form>
      )}

      {busy && !items.length ? (
        <div className="grid place-items-center rounded-2xl bg-surface py-12 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>
      ) : !items.length ? (
        <div className="grid place-items-center rounded-2xl bg-surface px-6 py-12 text-center text-sm text-ink-soft ring-1 ring-line">لا لجان مُشكَّلة في هذا المسجد بعد.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((c) => <CommitteeCard key={c.id} c={c} canManage={canManage} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

const HIJRI_MONTHS = hijriMonthOptions(14);
function CommitteeCard({ c, canManage, onChanged }: { c: Committee; canManage: boolean; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [planMode, setPlanMode] = useState<"recurring" | "month">("recurring");
  const [planMonth, setPlanMonth] = useState(HIJRI_MONTHS[0]?.value ?? "");
  const [adding, setAdding] = useState(false);
  const [headName, setHeadName] = useState("");
  const [assignMode, setAssignMode] = useState<"name" | "account">("name");
  const [hLogin, setHLogin] = useState(""); const [hPass, setHPass] = useState("");
  const [assigning, setAssigning] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const addPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) { toast.error("عنوان غير صالح"); return; }
    setAdding(true);
    const recurring = planMode === "recurring";
    try { await addCommitteePlan({ data: { committeeId: c.id, title: title.trim(), recurring, monthHijri: recurring ? null : planMonth } }); setTitle(""); toast.success("أُضيف بند للخطة"); onChanged(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const assign = async () => {
    if (headName.trim().length < 2) { toast.error("أدخل اسمَ المسؤول"); return; }
    setAssigning(true);
    try {
      if (assignMode === "account") {
        if (hLogin.trim().length < 3 || hPass.length < 6) { toast.error("دخول ٣ أحرف+ وكلمة مرور ٦ أحرف+"); setAssigning(false); return; }
        const r = await assignCommitteeHead({ data: { committeeId: c.id, newHead: { fullName: headName.trim(), login: hLogin.trim(), password: hPass } } }) as { error?: string; newAccount?: { login: string } };
        if (r?.error) toast.error(r.error);
        else { toast.success("عُيّن المسؤول وأُنشئ حسابُه", { description: `اسمُ الدخول: ${r.newAccount?.login} — سلّمه له ليطّلع على لجنته من «لجنتي».`, duration: 12000 }); setHLogin(""); setHPass(""); onChanged(); }
      } else {
        await assignCommitteeHead({ data: { committeeId: c.id, headName: headName.trim() } }); toast.success("عُيّن المسؤول"); onChanged();
      }
    } catch { toast.error("تعذّر التعيين"); } finally { setAssigning(false); }
  };
  const toggle = async (p: Plan) => {
    if (!canManage) return;
    const next = p.status === "done" ? "planned" : "done";
    try { await setCommitteePlanStatus({ data: { planId: p.id, status: next } }); onChanged(); } catch { /* */ }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-start gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <span className={tile}><Users2 className="size-4" strokeWidth={1.75} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-sm font-semibold text-ink">{c.name}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", c.type === "main" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-gold-50 text-gold-700 ring-gold-100")}>{c.type === "main" ? "رئيسية" : "فرعية"}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-faint">{c.headName ? `المسؤول: ${c.headName}` : "بلا مسؤول"}</p>
        </div>
        <span className="shrink-0 font-mono-nums text-[11px] font-semibold text-ink-soft">{c.plans.length} بند</span>
      </div>

      {canManage && !c.hasHeadAccount && (
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-52"><SegmentedControl size="sm" value={assignMode} onValueChange={(v) => setAssignMode(v as "name" | "account")} options={[{ value: "name", label: "اسم فقط" }, { value: "account", label: "مسؤول بحساب دخول" }]} /></div>
            {c.headName && <span className="text-[11px] text-ink-faint">الحاليّ: {c.headName}</span>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1"><TextField value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="اسم المسؤول…" /></div>
            {assignMode === "account" && <>
              <div className="w-32"><TextField value={hLogin} onChange={(e) => setHLogin(e.target.value)} placeholder="اسم الدخول" className="font-mono-nums" /></div>
              <div className="w-32"><TextField value={hPass} onChange={(e) => setHPass(e.target.value)} placeholder="كلمة المرور" /></div>
            </>}
            <button onClick={assign} disabled={headName.trim().length < 2 || assigning} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{assigning ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} تعيين</button>
          </div>
        </div>
      )}

      {c.plans.length > 0 ? (
        <ul className="divide-y divide-line">
          {c.plans.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 px-5 py-2.5">
              <button onClick={() => toggle(p)} disabled={!canManage} className={cn("shrink-0 transition", p.status === "done" ? "text-emerald-700" : "text-ink-faint", canManage ? "hover:text-emerald-700" : "cursor-default")} aria-label="حالة البند">
                {p.status === "done" ? <CheckCircle2 className="size-4" strokeWidth={1.75} /> : <Circle className="size-4" strokeWidth={1.75} />}
              </button>
              <p className={cn("min-w-0 flex-1 truncate text-sm", p.status === "done" ? "text-ink-faint line-through" : "text-ink")}>{p.title}</p>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", p.recurring ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-surface-2 text-ink-soft ring-line")}>
                {p.recurring ? "مستمر" : p.monthHijri ? hijriMonthLabel(p.monthHijri) : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-center text-[11px] text-ink-faint">لا بنود في خطة هذه اللجنة بعد.</p>
      )}

      {canManage && (
        <form onSubmit={addPlan} className="space-y-2 border-t border-line p-3">
          <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="بند جديد في الخطة…" />
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-44"><SegmentedControl size="sm" value={planMode} onValueChange={(v) => setPlanMode(v as "recurring" | "month")} options={[{ value: "recurring", label: "مستمر" }, { value: "month", label: "شهر محدّد" }]} /></div>
            {planMode === "month" && (
              <div className="min-w-[10rem] flex-1"><MSelect value={planMonth} onValueChange={setPlanMonth} options={HIJRI_MONTHS} /></div>
            )}
            <button type="submit" disabled={adding || title.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface disabled:text-ink-faint">{adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة بند</button>
          </div>
        </form>
      )}
    </section>
  );
}

type Decision = { id: string; title: string; kind: string; result: string | null; note: string | null };
type Meeting = { id: string; type: string; scheduledAt: number; memberCount: number; minutes: string | null; decisions: number; decisionList: Decision[] };
function MeetingsTab({ mosqueId, canManage }: { mosqueId: string; canManage: boolean }) {
  const [kpis, setKpis] = useState<{ meetings: number; decisions: number; lastAt: number | null } | null>(null);
  const [items, setItems] = useState<Meeting[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [type, setType] = useState<"periodic" | "extraordinary">("periodic");
  const [date, setDate] = useState("");
  const [members, setMembers] = useState("");
  const [minutes, setMinutes] = useState("");
  const [adding, setAdding] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const load = async (offset: number, append: boolean) => {
    setBusy(true); setErr(false);
    try { const r = await getMeetings({ data: { mosqueId, offset } }) as { kpis: typeof kpis; items: Meeting[]; total: number }; setKpis(r.kpis); setItems((p) => (append ? [...p, ...r.items] : r.items)); setTotal(r.total); }
    catch { setErr(true); } finally { setBusy(false); }
  };
  useEffect(() => { void load(0, false); }, [mosqueId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const ts = date ? new Date(date).getTime() : NaN;
    if (!ts) { toast.error("اختر تاريخاً"); return; }
    setAdding(true);
    const mc = members ? parseInt(members, 10) : 0;
    try { await createMeeting({ data: { mosqueId, type, scheduledAt: ts, memberCount: Number.isFinite(mc) && mc > 0 ? mc : 0, minutes: minutes.trim() || undefined } }); toast.success("سُجّل الاجتماع"); setDate(""); setMembers(""); setMinutes(""); await load(0, false); }
    catch { toast.error("تعذّر التسجيل"); } finally { setAdding(false); }
  };
  const k = kpis ?? { meetings: 0, decisions: 0, lastAt: null };
  if (err && kpis === null) return <LoadError onRetry={() => load(0, false)} />;
  const fmtDate = (t: number) => fmtHijriShort(t);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiTile Icon={Users} value={k.meetings} label="عدد الاجتماعات" loading={kpis === null} />
        <KpiTile Icon={Vote} value={k.decisions} label="قرارات الشورى" loading={kpis === null} />
        <KpiTile Icon={CalendarDays} big value={k.lastAt ? fmtDate(k.lastAt) : "—"} label="آخر اجتماع" loading={kpis === null} />
      </section>
      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <div className="flex items-center gap-2"><Gavel className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">سجلّ الاجتماعات</h3></div>
          <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{total}</span>
        </div>
        {canManage && (
          <form onSubmit={add} className="space-y-3 border-b border-line p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1"><Field label="النوع"><SegmentedControl value={type} onValueChange={(v) => setType(v as "periodic" | "extraordinary")} options={[{ value: "periodic", label: "دورية" }, { value: "extraordinary", label: "طارئة" }]} /></Field></div>
              <div className="w-40"><Field label="التاريخ"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="text-left" /></Field></div>
              <div className="w-24"><Field label="الحضور"><TextField type="number" value={members} onChange={(e) => setMembers(e.target.value)} dir="ltr" className="text-center font-mono-nums" /></Field></div>
            </div>
            <Field label="محضر الاجتماع (خلاصة ما جرى وما تُوصِّل إليه)">
              <TextArea value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="مثال: نوقشت خطة لجنة الدعوة، واتُّفق على إطلاق درسٍ أسبوعي، وتقرّر تخصيص ميزانية للصيانة…" />
            </Field>
            <button type="submit" disabled={adding || !date} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} تسجيل الاجتماع</button>
          </form>
        )}
        {busy && !items.length ? (
          <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
        ) : !items.length ? (
          <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لا اجتماعات مسجّلة في هذا المسجد بعد.</div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {items.map((m) => <MeetingCard key={m.id} m={m} canManage={canManage} onChanged={() => load(0, false)} />)}
            </ul>
            {items.length < total && (
              <button onClick={() => load(items.length, true)} disabled={busy} className="w-full border-t border-line py-3 text-xs font-semibold text-emerald-800 transition hover:bg-surface-2/40 disabled:opacity-60">تحميل المزيد ({total - items.length})</button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function MeetingCard({ m, canManage, onChanged }: { m: Meeting; canManage: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(m.minutes ?? "");
  const [savingMin, setSavingMin] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dKind, setDKind] = useState<"binding" | "advisory">("binding");
  const [addingD, setAddingD] = useState(false);
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
  const saveMinutes = async () => {
    setSavingMin(true);
    try { await setMeetingMinutes({ data: { meetingId: m.id, minutes } }); toast.success("حُفظ المحضر"); onChanged(); }
    catch { toast.error("تعذّر الحفظ"); } finally { setSavingMin(false); }
  };
  const addDec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dTitle.trim().length < 2) { toast.error("عنوان غير صالح"); return; }
    setAddingD(true);
    try { await addDecision({ data: { meetingId: m.id, title: dTitle.trim(), kind: dKind } }); setDTitle(""); toast.success("أُضيف القرار"); onChanged(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAddingD(false); }
  };
  const delDec = async (id: string) => { try { await removeDecision({ data: { id } }); onChanged(); } catch { /* */ } };
  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3">
        <span className={tile}><Gavel className="size-4" strokeWidth={1.75} /></span>
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-right">
          <p className="truncate text-sm font-medium text-ink">{m.type === "extraordinary" ? "اجتماع طارئ" : "اجتماع دوري"}</p>
          <p className="truncate text-[11px] text-ink-faint">{fmtHijriShort(m.scheduledAt)}{m.memberCount ? ` · ${m.memberCount} حاضراً` : ""} · {m.decisions} قرار{m.minutes ? " · محضر" : ""}</p>
        </button>
        <ChevronLeft className={cn("size-4 shrink-0 text-ink-faint transition", open && "-rotate-90")} strokeWidth={2} />
      </div>
      {open && (
        <div className="space-y-4 border-t border-line bg-surface-2/30 px-5 py-3">
          <div>
            <h5 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">المحضر</h5>
            {canManage ? (
              <div className="space-y-2">
                <TextArea value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="خلاصة ما جرى وما تُوصِّل إليه…" />
                <button onClick={saveMinutes} disabled={savingMin} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-surface px-3 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-60">{savingMin ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ المحضر</button>
              </div>
            ) : m.minutes ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{m.minutes}</p>
            ) : (
              <p className="text-[11px] text-ink-faint">لا محضر مُسجَّل.</p>
            )}
          </div>
          <div>
            <h5 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">القرارات</h5>
            {canManage && (
              <form onSubmit={addDec} className="mb-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1"><TextField value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="عنوان القرار…" /></div>
                <div className="w-40"><SegmentedControl size="sm" value={dKind} onValueChange={(v) => setDKind(v as "binding" | "advisory")} options={[{ value: "binding", label: "ملزمة" }, { value: "advisory", label: "معلِمة" }]} /></div>
                <button type="submit" disabled={addingD || dTitle.trim().length < 2} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{addingD ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة قرار</button>
              </form>
            )}
            {m.decisionList.length === 0 ? (
              <p className="text-[11px] text-ink-faint">لا قرارات في هذا الاجتماع.</p>
            ) : (
              <ul className="space-y-1.5">
                {m.decisionList.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                    <Vote className="size-3.5 shrink-0 text-emerald-700" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{d.title}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", d.kind === "binding" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-gold-50 text-gold-700 ring-gold-100")}>{d.kind === "binding" ? "ملزمة" : "معلِمة"}</span>
                    {canManage && <button onClick={() => delDec(d.id)} aria-label="حذف القرار" className="shrink-0 text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
