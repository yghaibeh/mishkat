import { useEffect, useMemo, useState } from "react";
import { Link, useRouteContext } from "@tanstack/react-router";
import {
  Network, Building2, Grid3x3, Landmark, ChevronLeft,
  AlertTriangle, UserPlus, TrendingDown, Home, Wallet, BookOpen, Trophy, Users,
  Target, ClipboardCheck, Layers, MapPin, FileDown, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hasCap } from "@/lib/capabilities";
import { exportNetworkRollup, getNetwork, getPendingApprovals, getBreakGlassApprovals, approveMosqueMonth, rejectUnitPending, getLayerReportStatus, submitLayerReport } from "@/lib/api/network";
import { MTabs } from "@/components/ui/m-tabs";
import { RegistrationInbox } from "@/components/registration/RegistrationInbox";
import { getUnitDiagnosis } from "@/lib/api/functions";
import { Stamp, CheckCircle2, Send, BadgeCheck } from "lucide-react";
import { govLabel } from "@/lib/syria-regions";
import { CIRCLE_TYPES } from "@/lib/circles";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { ReportHeader } from "@/components/report/ReportHeader";
import { KpiAmountCard, KpiPercentCard, KpiProgressCard } from "@/components/report/KpiCard";
import { WeeklyTable } from "@/components/report/WeeklyTable";
import { ActivityList } from "@/components/report/ActivityList";
import { FormulaNote } from "@/components/report/FormulaNote";
import { ReportActions } from "@/components/report/ReportActions";

type Crumb = { id: string | null; name: string };
type Stats = { mosques: number; enteredPct: number; avgPoints: number; late: number; done: number; below: number; struggling: number };
type Child = { id: string; name: string; type: string; circles?: number; baseera?: number; governorate?: string | null; district?: string | null } & Stats;
type Region = { governorate: string | null; mosques: number; circles: number };
type Browse = {
  leaf: false; section?: "men" | "women"; scopeName: string; scopeType: string; childLabel: string; childCount: number;
  breadcrumbs: Crumb[]; kpis: Stats;
  children: Child[]; attention: { late: number; struggling: number; roleRequests: number } | null;
  regions?: Region[]; circleStats?: Record<string, number>; circlesTotal?: number;
  glimpses?: { users: number; halaqat: number; participants: number; financeTotal: number; financeMonth: string | null } | null;
};
type Leaf = { leaf: true; mosqueId: string; mosqueName: string; breadcrumbs: Crumb[] };
type NetData = Browse | Leaf;
type Report = {
  mosqueId: string; mosqueName: string; hijriDate: string; allApproved: boolean;
  kpis: { total: number; target: number; percent: number; amount: string };
  approval: { allApproved: boolean; canAmirApprove: boolean; canLayerApprove: boolean };
  weeklyRows: Array<{ weeklyRecordId: string | null; week: string; points: number; target: number; status: "done" | "below"; approvalStatus: string; canLayerReject: boolean; note: string }>;
  activities: Array<{ name: string; count: number; points: number; target: number }>;
};

const TYPE_LABEL: Record<string, string> = { rabita: "منطقة", square: "مربع", mosque: "مسجد", halaqa: "حلقة نسائية", root: "الشبكة" };
const TYPE_ICON: Record<string, typeof Building2> = { rabita: Landmark, square: Grid3x3, mosque: Building2, halaqa: Home, root: Network };
// مفردات الورقة حسب القسم — «مسجد» للرجال، «حلقة نسائية» للنساء
function leafNouns(section?: "men" | "women") {
  return section === "women"
    ? { one: "حلقة نسائية", counted: "حلقة نسائية", plural: "الحلقات النسائية", distribution: "توزيع حال الحلقات", leafType: "halaqa" }
    : { one: "مسجد", counted: "مسجداً", plural: "المساجد", distribution: "توزيع حالة المساجد", leafType: "mosque" };
}

export function NetworkPage({ data, report }: { data?: NetData; report?: Report | null }) {
  if (data?.leaf) return <MosqueLeaf data={data} report={report ?? null} />;
  return <Browser data={data as Browse | undefined} />;
}

// «لماذا هذه الوحدة؟» — جوابُ النزول السؤالي (٣٦ §٢): حالُها هذا الأسبوع ومَن قائدُها ليُسأل.
// لا أدواتِ تشغيلٍ هنا لغير مالكها (قاعدة المالك الواحد) — كانت الصفحة نسخةَ قالبٍ عامّ.
function UnitDiagnosis({ unitId, entered, total, noun }: { unitId: string | null; entered: number; total: number; noun: string }) {
  const [diag, setDiag] = useState<{ leaderName: string | null; leaderRole: string | null; vacant: boolean } | null>(null);
  useEffect(() => {
    if (!unitId) return;
    getUnitDiagnosis({ data: { unitId } }).then((r) => setDiag(r as never)).catch(() => {});
  }, [unitId]);
  if (!unitId) return null;
  const behind = total - entered;
  return (
    <section className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
      <p className="text-sm text-ink">
        {behind > 0
          ? <>لم يُدخل <span className="font-bold text-danger font-mono-nums">{behind}</span> من {total} {noun} سجلَّ هذا الأسبوع بعد.</>
          : <>كل الوحدات هنا أدخلت سجلَّها هذا الأسبوع ✓</>}
        {" "}
        {diag?.vacant
          ? <span className="font-semibold text-danger">هذه الوحدة بلا مسؤولٍ مكلَّف — عيِّن مسؤولًا ليتولّاها.</span>
          : diag?.leaderName
            ? <span className="text-ink-faint">المسؤول عنها: <span className="font-semibold text-ink">{diag.leaderName}</span> ({diag.leaderRole}) — هو من يُتابعها ويُسأل عنها.</span>
            : null}
      </p>
    </section>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft" aria-label="مسار التنقّل">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const label = (
          <span className={cn("inline-flex items-center gap-1", last ? "font-semibold text-ink" : "")}>
            {i === 0 && <Home className="size-3.5 text-ink-faint" strokeWidth={1.75} />}
            {c.name}
          </span>
        );
        return (
          <span key={c.id ?? "root"} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronLeft className="size-3.5 text-ink-faint" strokeWidth={2} />}
            {last ? label : (
              <Link
                to={c.id ? "/network/$unitId" : "/network"}
                params={c.id ? { unitId: c.id } : undefined}
                className="rounded-md px-1 transition hover:bg-surface-2 hover:text-ink"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Browser({ data }: { data?: Browse }) {
  const EMPTY: Browse = {
    leaf: false, scopeName: "كل الشبكة", scopeType: "root", childLabel: "الوحدات", childCount: 0,
    breadcrumbs: [{ id: null, name: "كل الشبكة" }],
    kpis: { mosques: 0, enteredPct: 0, avgPoints: 0, late: 0, done: 0, below: 0, struggling: 0 },
    children: [], attention: null, glimpses: null,
  };
  // حالةٌ قابلةٌ للتبديل: الإدارةُ العليا على الجذر تبدّل بين قسم الذكور وقسم النساء (الفصل التام)
  const [d, setD] = useState<Browse>(data ?? EMPTY);
  useEffect(() => { setD(data ?? EMPTY); }, [data]);
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const isRootAdmin = hasCap(ctx.user?.caps ?? [], "*") && d.scopeType === "root";
  const [switching, setSwitching] = useState(false);
  const switchSection = async (s: "men" | "women") => {
    if (switching || s === (d.section ?? "men")) return;
    setSwitching(true);
    try { const r = await getNetwork({ data: { section: s } }); if (!(r as { leaf: boolean }).leaf) setD(r as Browse); }
    catch { toast.error("تعذّر تحميل القسم"); } finally { setSwitching(false); }
  };
  const noun = leafNouns(d.section);
  const ScopeIcon = TYPE_ICON[d.scopeType] ?? Network;
  const k = d.kpis;
  const enteredCount = Math.round((k.enteredPct / 100) * k.mosques);

  const [filter, setFilter] = useState<"all" | "struggling" | "top" | "below" | "late">("all");
  // كلّ إحصائيّةٍ تُفضي للتفاصيل: ترشيح قائمة الوحدات ثم الهبوط إليها (ملاحظة أصحاب المشروع)
  const goList = (f: "all" | "struggling" | "top" | "below" | "late") => {
    setFilter(f);
    requestAnimationFrame(() => document.getElementById("units-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const shown = useMemo(() => {
    let list = [...d.children];
    if (filter === "struggling") list = list.filter((c) => c.struggling > 0).sort((a, b) => b.struggling - a.struggling);
    else if (filter === "below") list = list.filter((c) => c.below > 0).sort((a, b) => b.below - a.below);
    else if (filter === "late") list = list.filter((c) => c.late > 0).sort((a, b) => b.late - a.late);
    else if (filter === "top") list.sort((a, b) => b.avgPoints - a.avgPoints);
    return list;
  }, [d.children, filter]);

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 md:px-6 md:py-12">
        <Breadcrumbs crumbs={d.breadcrumbs} />

        {/* الإدارةُ العليا: مبدّلُ القسمين على الجذر — منفذُ الدخول لقسم النساء ورؤيةِ إنتاجهنّ */}
        {isRootAdmin && (
          <div className="flex items-center gap-3">
            <MTabs value={d.section ?? "men"} onValueChange={(v) => switchSection(v as "men" | "women")}
              options={[{ value: "men", label: "قسم الذكور" }, { value: "women", label: "قسم النساء" }]} />
            {switching && <Loader2 className="size-4 animate-spin text-ink-faint" />}
          </div>
        )}

        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <ScopeIcon className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{d.scopeName}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                <span className="size-1.5 rounded-full bg-emerald-700" />
                {d.scopeType === "root" ? "لوحة الشبكة" : TYPE_LABEL[d.scopeType] ?? "نطاق"}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{d.childLabel}: {d.childCount} · ضمن النطاق {k.mosques} {noun.counted}</p>
          </div>
          <RollupExport section={d.section} unitId={d.breadcrumbs[d.breadcrumbs.length - 1]?.id ?? undefined} />
        </header>

        {d.scopeType !== "root" && <UnitDiagnosis unitId={d.breadcrumbs[d.breadcrumbs.length - 1]?.id ?? null} entered={enteredCount} total={k.mosques} noun={noun.counted} />}
        <RegistrationInbox />
        <PendingApprovals />
        <PendingApprovals breakGlass />
        {/* بطاقةُ «تحتاج زيارتك» أُزيلت من صفحات الشبكة (قاعدة القناة الواحدة — ٣٦ §١.٣): موضعُها رئيسيةُ المشرف */}
        <LayerReportAction unitId={d.breadcrumbs[d.breadcrumbs.length - 1]?.id ?? undefined} />

        {/* بطاقة الصدارة + توزيع حالة المساجد — كلّ إحصائيّةٍ تنقر فتهبط على قائمة الوحدات مُرشَّحة */}
        <section className="grid gap-4 lg:grid-cols-3">
          <button onClick={() => goList("all")} className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-start text-emerald-50 ring-1 ring-emerald-900 transition hover:ring-gold-300/60" title="اعرض الوحدات">
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-100/70">
              <ClipboardCheck className="size-4" strokeWidth={1.75} /> نسبة الإدخال هذا الأسبوع
            </div>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-4xl font-semibold tracking-tight text-gold-100 sm:text-5xl">{k.enteredPct}</span>
              <span className="text-lg text-emerald-100/80">%</span>
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/60">{enteredCount} من {k.mosques} {noun.counted} أدخلوا سجلهم هذا الأسبوع · انقر للتفاصيل</p>
          </button>

          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-soft">{noun.distribution}</p>
              <span className="font-mono-nums text-[11px] text-ink-faint">الهدف 70 نقطة</span>
            </div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-emerald-700 transition-[width] duration-700" style={{ width: pctOf(k.done, k.mosques) }} />
              <div className="bg-warn transition-[width] duration-700" style={{ width: pctOf(k.below, k.mosques) }} />
              <div className="bg-danger transition-[width] duration-700" style={{ width: pctOf(k.struggling, k.mosques) }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Legend dot="bg-emerald-700" label="مكتمل" value={k.done} onClick={() => goList("top")} />
              <Legend dot="bg-warn" label="دون الهدف" value={k.below} onClick={() => goList("below")} />
              <Legend dot="bg-danger" label="متعثّر" value={k.struggling} onClick={() => goList("struggling")} />
            </div>
            {enteredCount > 0 && (
              <p className="mt-3 text-[11px] text-ink-faint">متوسط نقاط المُدخلين: <span className="font-semibold text-ink font-mono-nums">{k.avgPoints}</span> من 70</p>
            )}
          </div>
        </section>

        {/* صفُّ البطاقات الثلاث حُذف (قاعدة الحقيقة الواحدة ٣٨): عدُّ المساجد في الترويسة،
            والمتعثرةُ في legend التوزيع، والمتوسط سطرٌ داخل قسم التوزيع */}

        {/* «يحتاج انتباهك» حُذف (الحقيقة الواحدة ٣٨): متعثرة/متأخرة في legend التوزيع أعلاه؛
            طلباتُ الأدوار شارةٌ واحدةٌ حين توجد فقط */}
        {(d.attention?.roleRequests ?? 0) > 0 && (
          <Link to="/admin" className="flex items-center justify-between rounded-2xl bg-surface px-5 py-4 ring-1 ring-line transition hover:bg-surface-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><UserPlus className="size-4 text-brand" /> طلبات منح أدوار بانتظار البتّ</span>
            <span className="font-mono-nums text-lg font-bold text-brand">{d.attention!.roleRequests}</span>
          </Link>
        )}

        <section id="units-list" className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold text-ink">{d.childLabel}</h3>
            {d.children.length > 0 && (
              <div className="flex gap-1 rounded-lg bg-surface p-1 ring-1 ring-line">
                <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>الكل · {d.children.length}</FilterBtn>
                <FilterBtn active={filter === "struggling"} onClick={() => setFilter("struggling")}>متعثّرة</FilterBtn>
                <FilterBtn active={filter === "top"} onClick={() => setFilter("top")}>الأعلى</FilterBtn>
              </div>
            )}
          </div>
          {shown.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center text-sm text-ink-soft">لا وحدات مطابقة.</div>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((c) => <ChildRow key={c.id} c={c} section={d.section} />)}
            </ul>
          )}
        </section>

        {(d.circlesTotal ?? 0) > 0 && <CircleStatsStrip stats={d.circleStats ?? {}} total={d.circlesTotal ?? 0} />}

        {/* «ماذا في كل منطقة» حُذفت نهائياً (الحقيقة الواحدة ٣٨): كانت تكرر قائمة الوحدات — المحافظةُ شارةٌ داخل سطر كل وحدة */}

        {/* «لمحات الوحدات» حُذفت (قاموس ٣٥ §٦-١): أرقام عامة بلا فعل — بدائلها بطاقات عدسة كل دور في رئيسيته */}
      </main>
    </MishkatShell>
  );
}

// ح٢ — تقرير الطبقة: يُظهره لمالك الوحدة الإشرافيّة (مربع/منطقة) — الحصيلة + تقديمٌ للاعتماد الأعلى.
type LayerStatus = { applicable: boolean; unitName?: string; typeLabel?: string; status?: string; rollup?: number };
function LayerReportAction({ unitId }: { unitId?: string }) {
  const [st, setSt] = useState<LayerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => { if (!unitId) { setSt(null); return; } getLayerReportStatus({ data: { unitId } }).then((r) => setSt(r as LayerStatus)).catch(() => setSt(null)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [unitId]);
  if (!unitId || !st?.applicable) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await submitLayerReport({ data: { unitId } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("قُدِّم تقرير الطبقة للاعتماد"); load(); }
    } catch { toast.error("تعذّر التقديم"); } finally { setBusy(false); }
  };

  const approved = st.status === "approved";
  const submitted = st.status === "submitted";
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 ring-1 ring-emerald-900/20"><Send className="size-5" strokeWidth={1.5} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">تقرير {st.typeLabel} — {st.unitName}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">حصيلة نطاقك هذا الأسبوع: <span className="font-mono-nums font-semibold text-emerald-800">{st.rollup ?? 0}</span> نقطة</p>
        </div>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100"><BadgeCheck className="size-4" /> معتمَدٌ نهائيًّا</span>
        ) : submitted ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-800 ring-1 ring-gold-200"><Stamp className="size-4" /> مُقدَّم — بانتظار اعتماد الأعلى</span>
        ) : (st.rollup ?? 0) === 0 ? (
          /* محظور ع٣: لا تقديمَ فوق صفر («كيف يعتمد أرقاماً صفرية؟») — حالةٌ موجِّهة بدل الزر */
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line">لا إدخال في نطاقك بعد — ذكّر مساجدك ثم قدِّم</span>
        ) : (
          <button onClick={submit} disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 shadow-soft transition hover:bg-emerald-900 disabled:opacity-60">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" strokeWidth={2} />} تقديم للاعتماد
          </button>
        )}
      </div>
    </section>
  );
}

// صندوق «بانتظار اعتمادك» — التقارير المُقدَّمة ضمن نطاق المعتمِد؛ اعتمادٌ نهائيّ بضغطة.
// النقر على الوحدة يفتح صفحتها ليطّلع المعتمِد على طبيعة العمل وآليّة تحصيل النقاط قبل الاعتماد،
// و«لا يُعتمد» يردّ التقرير لمقدِّمه بتعليلٍ إلزاميٍّ يصله إشعارًا.
type PendItem = { unitId: string; name: string; type: string; typeLabel: string; weeks: number; points: number };
// breakGlass=true: صندوقُ الإدارة الاستثنائيّ (ق1-د) — وحداتٌ بلا طبقةٍ إشرافيّةٍ مُكلَّفة.
function PendingApprovals({ breakGlass = false }: { breakGlass?: boolean }) {
  const [items, setItems] = useState<PendItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = () => { (breakGlass ? getBreakGlassApprovals() : getPendingApprovals()).then((r) => setItems((r as { items: PendItem[] }).items ?? [])).catch(() => {}); };
  useEffect(() => { load(); }, []);
  if (!items.length) return null;

  const approve = async (unitId: string) => {
    setBusy(unitId);
    try {
      const res = await approveMosqueMonth({ data: { mosqueId: unitId } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("اعتُمد التقرير نهائيًّا"); load(); }
    } catch { toast.error("تعذّر الاعتماد"); } finally { setBusy(null); }
  };
  const reject = async (unitId: string) => {
    if (!reason.trim()) { toast.error("التعليل إلزاميّ — اكتب سبب عدم الاعتماد"); return; }
    setBusy(unitId);
    try {
      const res = await rejectUnitPending({ data: { unitId, reason: reason.trim() } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("رُدَّ التقرير لمقدِّمه مع التعليل"); setRejecting(null); setReason(""); load(); }
    } catch { toast.error("تعذّر الرفض"); } finally { setBusy(null); }
  };

  return (
    <section className={cn("overflow-hidden rounded-2xl bg-surface ring-1", breakGlass ? "ring-danger/40" : "ring-gold-300/50")}>
      <div className={cn("flex items-center gap-2 border-b border-line px-5 py-3.5", breakGlass ? "bg-danger-bg/50" : "bg-gold-50/60")}>
        <Stamp className={cn("size-4", breakGlass ? "text-danger" : "text-gold-700")} strokeWidth={1.75} />
        <h3 className="font-display text-sm font-semibold text-ink">{breakGlass ? "بلا معتمِدٍ مُعيَّن (اعتمادٌ استثنائيّ)" : "بانتظار اعتمادك"}</h3>
        <span className={cn("rounded-full px-2 py-0.5 font-mono-nums text-[11px] font-bold", breakGlass ? "bg-danger-bg text-danger" : "bg-gold-100 text-gold-800")}>{items.length}</span>
        <span className="ms-auto hidden text-[11px] text-ink-faint sm:inline">{breakGlass ? "هذه الوحدات بلا طبقةٍ إشرافيّةٍ مُكلَّفة — عيِّن مسؤولًا ليتولّى اعتمادها" : "انقر الوحدة للاطّلاع على التفاصيل قبل الاعتماد"}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it) => {
          const detailsLink: { to: string; params: Record<string, string>; search?: Record<string, string> } = it.type === "mosque"
            ? { to: "/mosque/$mosqueId", params: { mosqueId: it.unitId }, search: { t: "report" } }
            : { to: "/network/$unitId", params: { unitId: it.unitId } };
          return (
            <li key={it.unitId} className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Link to={detailsLink.to as never} params={detailsLink.params as never} search={detailsLink.search as never} className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line transition group-hover:bg-emerald-50"><Stamp className="size-[18px]" strokeWidth={1.75} /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink underline-offset-4 group-hover:text-emerald-800 group-hover:underline">{it.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{it.typeLabel} · {it.weeks} أسبوع · {it.points} نقطة — قُدِّم للاعتماد · <span className="text-emerald-800">اعرض التفاصيل ←</span></span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => approve(it.unitId)} disabled={!!busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 shadow-soft transition hover:bg-emerald-900 disabled:opacity-60">
                    {busy === it.unitId ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" strokeWidth={2} />} اعتماد نهائيّ
                  </button>
                  <button onClick={() => { setRejecting(rejecting === it.unitId ? null : it.unitId); setReason(""); }} disabled={!!busy}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-danger ring-1 ring-danger/30 transition hover:bg-danger-bg disabled:opacity-60">لا يُعتمد</button>
                </div>
              </div>
              {rejecting === it.unitId && (
                <div className="mt-2 flex items-center gap-2">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
                    placeholder="التعليل (إلزاميّ) — يصل مقدِّمَ التقرير ليصحّح ويعيد التقديم"
                    className="h-9 min-w-0 flex-1 rounded-lg bg-surface-2 px-3 text-xs text-ink ring-1 ring-line outline-none focus:ring-emerald-700/40"
                    onKeyDown={(e) => { if (e.key === "Enter") reject(it.unitId); }} />
                  <button onClick={() => reject(it.unitId)} disabled={!!busy}
                    className="shrink-0 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">تأكيد عدم الاعتماد</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}


// ر.١ — زرّ تصدير التقرير القياديّ (PDF عبر طباعة المتصفّح، أو CSV) — للقيادة فقط
function RollupExport({ section, unitId }: { section?: "men" | "women"; unitId?: string }) {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx.user?.caps ?? [];
  const canExport = hasCap(caps, "*") || hasCap(caps, "report.approve");
  const [busy, setBusy] = useState<"html" | "csv" | null>(null);
  if (!canExport) return null;

  const run = async (format: "html" | "csv") => {
    setBusy(format);
    try {
      const res = await exportNetworkRollup({ data: { section, unitId, format } });
      const mime = format === "csv" ? "text/csv;charset=utf-8" : "text/html;charset=utf-8";
      const url = URL.createObjectURL(new Blob([res.content], { type: mime }));
      if (format === "csv") {
        const a = document.createElement("a");
        a.href = url; a.download = `تقرير-${res.scopeName}.csv`; a.click();
      } else {
        window.open(url, "_blank"); // صفحةٌ للطباعة→PDF عبر زرّ الطباعة داخلها
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { toast.error("تعذّر التصدير"); } finally { setBusy(null); }
  };

  return (
    <div className="ms-auto flex items-center gap-1.5 self-start">
      <button onClick={() => run("html")} disabled={!!busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 shadow-soft transition hover:bg-emerald-900 disabled:opacity-60">
        {busy === "html" ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" strokeWidth={2} />} PDF
      </button>
      <button onClick={() => run("csv")} disabled={!!busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-ink disabled:opacity-60">
        {busy === "csv" ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" strokeWidth={2} />} CSV
      </button>
    </div>
  );
}

function pctOf(n: number, total: number) { return total ? `${(n / total) * 100}%` : "0%"; }

function Legend({ dot, label, value, onClick }: { dot: string; label: string; value: number; onClick?: () => void }) {
  if (onClick) {
    return (
      <button onClick={onClick} className="rounded-lg p-1 text-start transition hover:bg-surface-2/60" title="اعرض التفاصيل">
        <LegendBody dot={dot} label={label} value={value} />
      </button>
    );
  }
  return <LegendBody dot={dot} label={label} value={value} />;
}
function LegendBody({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", dot)} />
      <div className="min-w-0">
        <div className="font-mono-nums text-lg font-bold leading-none text-ink">{value}</div>
        <div className="mt-0.5 text-[11px] text-ink-soft">{label}</div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition",
        active ? "bg-emerald-800 text-emerald-50 shadow-soft" : "text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}


// شريط إحصاء الحلقات حسب النوع — لمحة سريعة على طبيعة العمل في النطاق
function CircleStatsStrip({ stats, total }: { stats: Record<string, number>; total: number }) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">الحلقات حسب النوع · {total} حلقة</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CIRCLE_TYPES.map((t) => (
          <Link key={t.type} to={"/ala-baseera" as never} title="اعرض التفاصيل"
            className="rounded-2xl bg-surface-2 p-4 ring-1 ring-line transition hover:ring-line-strong">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Layers className="size-4 text-emerald-700" strokeWidth={1.75} /> {t.label}
              <ChevronLeft className="ms-auto size-3.5 text-ink-faint" strokeWidth={2} />
            </div>
            <div className="mt-2 font-mono-nums text-xl font-semibold tracking-tight text-ink">{stats[t.type] ?? 0}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ChildRow({ c, section }: { c: Child; section?: "men" | "women" }) {
  const noun = leafNouns(section);
  const isLeaf = c.type === noun.leafType;
  const Icon = TYPE_ICON[c.type] ?? Building2;
  const tone = c.enteredPct >= 75 ? "bg-emerald-700" : c.enteredPct >= 50 ? "bg-warn" : "bg-danger";
  return (
    <li>
      <Link
        to="/network/$unitId"
        params={{ unitId: c.id }}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/40"
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line">
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {isLeaf ? (
              <>{c.governorate ? govLabel(c.governorate) : "بلا منطقة"}{(c.circles ?? 0) > 0 && ` · ${c.circles} حلقة`}</>
            ) : (
              // جملةٌ تجيب سؤال الأسبوع (قاعدة السطر المفهوم ٣٨) — لا رصفَ شاراتٍ متراكمة
              <>{TYPE_LABEL[c.type] ?? c.type}{c.governorate ? ` · ${govLabel(c.governorate)}` : ""} — أدخل {Math.round((c.enteredPct / 100) * c.mosques)} من {c.mosques} {noun.counted} هذا الأسبوع{(c.circles ?? 0) > 0 && ` · ${c.circles} حلقة`}</>
            )}
            {c.struggling > 0 && <span className="text-danger"> · {c.struggling} يحتاج دعماً</span>}
          </p>
        </div>
        <div className="hidden w-28 shrink-0 sm:block">
          <div className="flex items-center justify-between text-[11px] text-ink-soft">
            <span>الإدخال</span>
            <span className="font-mono-nums font-semibold">{c.enteredPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${c.enteredPct}%` }} />
          </div>
        </div>
        <div className="hidden w-16 shrink-0 text-end font-mono-nums text-sm font-bold text-ink sm:block">
          {c.avgPoints}<span className="text-[11px] font-medium text-ink-faint"> /70</span>
        </div>
        <ChevronLeft className="size-4 shrink-0 text-ink-faint transition group-hover:text-emerald-800" strokeWidth={2} />
      </Link>
    </li>
  );
}



function MosqueLeaf({ data, report }: { data: Leaf; report: Report | null }) {
  const r = report;
  return (
    <MishkatShell stickyFooter={r ? <ReportActions variant="sticky" approval={r.approval} mosqueId={data.mosqueId} /> : undefined}>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <Breadcrumbs crumbs={data.breadcrumbs} />
        {!r ? (
          <div className="grid place-items-center rounded-2xl bg-surface px-6 py-20 text-center ring-1 ring-line">
            <Building2 className="size-8 text-ink-faint" strokeWidth={1.25} />
            <p className="mt-3 text-sm font-semibold text-ink">{data.mosqueName}</p>
            <p className="mt-1 text-xs text-ink-soft">لا سجلات لهذا المسجد بعد.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1">
                <ReportHeader
                  mosqueName={r.mosqueName}
                  hijriDate={r.hijriDate}
                  location={data.breadcrumbs.slice(0, -1).map((c) => c.name).join(" · ")}
                  statusLabel={r.allApproved ? "معتمد نهائياً" : "بانتظار الاعتماد"}
                />
              </div>
              <ReportActions approval={r.approval} mosqueId={data.mosqueId} />
            </div>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiProgressCard label="مجموع نقاط الشهر" value={r.kpis.total} total={r.kpis.target} percent={r.kpis.percent} />
              <KpiPercentCard label="نسبة تحقيق الهدف" percent={r.kpis.percent} delta="مقارنةً بالهدف الشهري" />
              <KpiAmountCard label="القيمة المستحقة (تقديرية)" amount={r.kpis.amount} note="تُصرف بعد الاعتماد النهائي." />
            </section>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                <WeeklyTable rows={r.weeklyRows} lastEntryAt={(r as { lastEntryAt?: number | null }).lastEntryAt} />
                <FormulaNote />
              </div>
              <aside className="lg:col-span-2">
                <ActivityList items={r.activities} />
              </aside>
            </div>
          </>
        )}
      </main>
    </MishkatShell>
  );
}
