import { useEffect, useState } from "react";
import {
  Wallet, Coins, BadgeDollarSign, Clock, Banknote, Calculator,
  CheckCircle2, Loader2, Info, Users, CalendarDays, Search,
} from "lucide-react";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";
import { MTabs } from "@/components/ui/m-tabs";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/escape-html";
import { hasCap } from "@/lib/capabilities";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { AssetsPanel } from "@/components/finance/AssetsPanel";
import { MSelect } from "@/components/ui/m-select";
import { Field, TextField } from "@/components/ui/field";
import { getFinance, getFinanceTree, computeFinance, approveFinance, payoutFinance } from "@/lib/api/finance";
import { UnitTree, type TreeUnit } from "@/components/ui/unit-tree";
import { getIncentives, addIncentive, removeIncentive } from "@/lib/api/incentives";
import { Gift, Plus, X, ArrowRightLeft, FileSpreadsheet } from "lucide-react";

type TrackKind = "fixed" | "points" | "hours";
type Track = { kind: TrackKind; basis: number | null; rate: number | null; amount: number };
type Status = "proposed" | "approved" | "paid";
type Row = { id: string; name: string; unitId: string; personName: string; gross: number; status: Status; tracks: Track[]; paidAmount: number | null };
type RateRow = { kind: string; label: string; amount: number; perUnit: number | null };
type Dist = { proposed: number; approved: number; paid: number };
type FinanceData = {
  month: string | null; months: string[]; rates: RateRow[];
  eligibleCount: number; totals: { gross: number; approved: number; paid: number; beneficiaries: number }; dist: Dist;
};

const HIJRI_MONTHS = [
  "", "محرّم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
];
function hijriLabel(m: string | null) {
  if (!m) return "—";
  const [y, mm] = m.split("-");
  return `${HIJRI_MONTHS[Number(mm)] ?? mm} ${y}هـ`;
}

const TRACK_META: Record<TrackKind, { label: string; Icon: typeof Coins; unit: (b: number | null) => string }> = {
  fixed: { label: "راتب مقطوع", Icon: BadgeDollarSign, unit: () => "" },
  points: { label: "نقاط", Icon: Coins, unit: (b) => `${b ?? 0} نقطة` },
  hours: { label: "ساعات", Icon: Clock, unit: (b) => `${b ?? 0} ساعة` },
};

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  proposed: { label: "مُرشَّح", cls: "bg-gold-50 text-gold-700 ring-gold-100", dot: "bg-gold-600" },
  approved: { label: "معتمد", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100", dot: "bg-emerald-700" },
  paid: { label: "مصروف", cls: "bg-success-bg text-success ring-success/20", dot: "bg-success" },
};

const money = (n: number) => n.toFixed(2);

// الاعتمادُ الثنائيّ: استجابةُ «queued» تعني أنّ الفعل اقتُرح وينتظر اعتمادَ المدير — لا نجاحَ تنفيذٍ بعد.
function queuedToast(r: unknown): boolean {
  const q = r as { queued?: boolean; message?: string };
  if (q?.queued) {
    toast.info("بانتظار اعتماد المدير ⏳", { description: q.message ?? "أُرسل الاقتراحُ ولن يُنفَّذ قبل اعتماده", duration: 8000 });
    window.dispatchEvent(new CustomEvent("fin-action-queued")); // «مقترحاتي» تُنصت وتتحدّث فورًا
    return true;
  }
  return false;
}

export function FinancePage({ data }: { data?: FinanceData }) {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx?.user?.caps ?? [];
  const canApprove = hasCap(caps, "finance.approve");
  const canPayout = hasCap(caps, "finance.payout");
  const canEntry = hasCap(caps, "finance.entry");
  const canOperate = canApprove || canEntry;              // المسؤولُ الماليُّ (مُدخِل) يرى النماذجَ ويقترح
  const canSupervise = hasCap(caps, "finance.supervise"); // المديرُ يعتمد (تشمل «*»)
  const EMPTY: FinanceData = { month: null, months: [], rates: [], eligibleCount: 0, totals: { gross: 0, approved: 0, paid: 0, beneficiaries: 0 }, dist: { proposed: 0, approved: 0, paid: 0 } };
  const [state, setState] = useState<FinanceData>(data ?? EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState<Record<string, string>>({});
  const [payslipFor, setPayslipFor] = useState<string | null>(null); // معرّفُ المستحقّ لكشف الراتب
  // ن٢ (الوثيقة ٣٨): أربعُ مساحات عملٍ بدل ٢١ قسماً متراكماً في لفافةٍ واحدة (تدقيق ٣٣ هـ-٢)
  const [tab, setTab] = useState<string>(canSupervise ? "money" : "entitlements");

  // مستحقّات الشهر ضمن شجرة الهيكلية (تفادي اختلاط أسماء المستفيدين المتشابهة عبر الوحدات)
  const [tree, setTree] = useState<{ units: TreeUnit[]; leaves: Row[] }>({ units: [], leaves: [] });
  const [rq, setRq] = useState("");
  const [listBusy, setListBusy] = useState(true);

  const refetch = async (month?: string) => {
    try {
      const fresh = await getFinance({ data: { month: month ?? state.month ?? undefined } });
      setState(fresh as FinanceData);
      return (fresh as FinanceData).month;
    } catch { return state.month; }
  };
  const loadTree = async (month: string | null) => {
    if (!month) { setTree({ units: [], leaves: [] }); return; }
    setListBusy(true);
    try {
      const r = await getFinanceTree({ data: { month } });
      setTree({ units: r.units as TreeUnit[], leaves: (r.leaves as Row[]) });
    } catch { /* dev */ } finally { setListBusy(false); }
  };

  useEffect(() => { (async () => { const m = await refetch(); await loadTree(m ?? null); })(); }, []);

  const refreshAll = async () => { const m = await refetch(); await loadTree(m ?? null); };

  const onMonth = async (m: string) => { setBusy("month"); setRq(""); await refetch(m); await loadTree(m); setBusy(null); };

  const onCompute = async () => {
    if (!state.month) return;
    setBusy("compute");
    try {
      const res = await computeFinance({ data: { month: state.month } });
      toast.success("احتُسبت المستحقات", { description: `${(res as { computed: number }).computed} مستفيداً لشهر ${hijriLabel(state.month)}.` });
      await refreshAll();
    } catch { toast.error("تعذّر الاحتساب"); } finally { setBusy(null); }
  };

  const onApprove = async (id: string) => {
    setBusy(id);
    try {
      const res = await approveFinance({ data: { id } });
      if ("error" in res && res.error) toast.error(res.error);
      else { toast.success("اعتُمد المستحق"); await refreshAll(); }
    } catch { toast.error("تعذّر الاعتماد"); } finally { setBusy(null); }
  };

  const onPayout = async (id: string, gross: number) => {
    const amount = pay[id] !== undefined ? Number(pay[id]) : gross;
    if (!(amount >= 0)) { toast.error("مبلغ غير صالح"); return; }
    setBusy(id);
    try {
      const res = await payoutFinance({ data: { id, paidAmount: amount } });
      if ("error" in res && res.error) toast.error(res.error);
      else { toast.success("سُجّل الصرف", { description: `$${money(amount)}` }); await refreshAll(); }
    } catch { toast.error("تعذّر تسجيل الصرف"); } finally { setBusy(null); }
  };

  const { totals, rates, dist } = state;
  const proposedCount = dist.proposed, approvedCount = dist.approved, paidCount = dist.paid;
  const pendingApproval = proposedCount;
  const distTotal = proposedCount + approvedCount + paidCount;
  const finPct = (n: number) => (distTotal ? `${(n / distTotal) * 100}%` : "0%");

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        {/* Header */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
                <Wallet className="size-5" strokeWidth={1.5} />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                الملف المالي
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                <span className="size-1.5 rounded-full bg-emerald-700" />
                {canApprove ? "للإدارة العليا" : "عرض ضمن نطاقك"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-ink-faint" strokeWidth={1.5} />
                شهر {hijriLabel(state.month)}
              </span>
              {canApprove && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-ink-faint" strokeWidth={1.5} />
                  {state.eligibleCount} مؤهَّلاً للمستحق
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <MSelect
                value={state.month ?? ""}
                onValueChange={onMonth}
                disabled={!state.months.length || busy === "month"}
                options={state.months.map((m) => ({ value: m, label: hijriLabel(m) }))}
                placeholder="لا أشهر"
                aria-label="اختيار الشهر الهجري"
              />
            </div>
            <ExcelExportButton months={state.months} />
            {canApprove && (
              <button
                onClick={onCompute}
                disabled={!state.month || busy === "compute"}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line"
              >
                {busy === "compute" ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" strokeWidth={1.75} />}
                احتساب المستحقات
              </button>
            )}
          </div>
        </header>

        <MTabs value={tab} onValueChange={setTab} options={[
          ...(canSupervise || canOperate ? [{ value: "money", label: "القرارات" }] : []),
          { value: "entitlements", label: "الاستحقاقات" },
          { value: "ledger", label: "الدفتر والقوائم" },
          { value: "donors", label: "المانحون" },
        ]} />

        {tab === "entitlements" && (<>
        {/* KPI */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
            <div className="flex items-center justify-between">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line">
                <Coins className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-semibold text-ink-faint">{totals.beneficiaries} مستفيد</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-sm font-medium text-ink-faint">$</span>
              <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{money(totals.gross)}</span>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">إجمالي المستحقات</p>
          </div>

          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
            <div className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line">
                <CheckCircle2 className="size-[18px]" strokeWidth={1.75} />
              </span>
              <p className="text-xs font-medium text-ink-soft">حالة الاعتماد</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline gap-1 font-mono-nums">
                  <span className="text-3xl font-semibold tracking-tight text-emerald-800 sm:text-4xl">
                    {totals.beneficiaries - pendingApproval}
                  </span>
                </div>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="size-3" /> معتمد/مصروف
                </p>
              </div>
              <div className="border-r border-line pr-4">
                <div className="flex items-baseline gap-1 font-mono-nums">
                  <span className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", pendingApproval > 0 ? "text-gold-700" : "text-ink-faint")}>
                    {pendingApproval}
                  </span>
                </div>
                <p className={cn("mt-1 inline-flex items-center gap-1 text-[11px] font-semibold", pendingApproval > 0 ? "text-gold-700" : "text-ink-faint")}>
                  <Info className="size-3" /> بانتظار الاعتماد
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
            <div className="flex items-center justify-between">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10">
                <Banknote className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-medium text-emerald-100/70">المصروف فعلياً</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-sm font-medium text-emerald-100/80">$</span>
              <span className="text-3xl font-semibold tracking-tight text-gold-100 sm:text-4xl">{money(totals.paid)}</span>
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/60">يُسجَّل يدوياً بعد الاعتماد — لا خصومات.</p>
          </div>
        </section>

        </>)}

        {/* الاعتمادُ الثنائيّ (الوثيقة ٢٨): صندوقُ المدير + «مقترحاتي» للمسؤول الماليّ — مساحة «القرارات» */}
        {tab === "money" && (<>
          {canSupervise && <ApprovalInbox onChanged={refreshAll} />}
          <MyProposals />
        </>)}

        {tab === "entitlements" && (<>
        {/* مسار الصرف — توزيع حالات المستحقات */}
        {distTotal > 0 && (
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-soft">مسار الصرف</p>
              <span className="font-mono-nums text-[11px] text-ink-faint">{distTotal} مستحق</span>
            </div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-gold-600 transition-[width] duration-700" style={{ width: finPct(proposedCount) }} />
              <div className="bg-emerald-600 transition-[width] duration-700" style={{ width: finPct(approvedCount) }} />
              <div className="bg-success transition-[width] duration-700" style={{ width: finPct(paidCount) }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <FinLegend dot="bg-gold-600" label="مُرشَّح" value={proposedCount} />
              <FinLegend dot="bg-emerald-600" label="معتمد" value={approvedCount} />
              <FinLegend dot="bg-success" label="مصروف" value={paidCount} />
            </div>
          </div>
        )}

        {/* Rates callout — gold */}
        <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-100">
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
            <Banknote className="size-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-gold-700">المعدّلات السارية</h4>
            <p className="text-xs leading-relaxed text-gold-700/80">
              {rates.length === 0 ? "لا معدّلات مُعرّفة." : rates.map((r, i) => (
                <span key={r.kind}>
                  {i > 0 && <span className="mx-1.5 text-gold-700/40">·</span>}
                  {r.label}{" "}
                  <span className="font-mono-nums font-semibold">
                    {r.perUnit ? `${r.perUnit} نقطة = $${money(r.amount)}` : `$${money(r.amount)}`}
                  </span>
                </span>
              ))}
              <span className="mx-1.5 text-gold-700/40">·</span>
              المستحق = جمع مسارات الشخص (مقطوع/نقاط/ساعات)، يُنسب للأمير، بلا خصومات.
            </p>
          </div>
        </div>

        {/* Entitlements */}
        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
            <input value={rq} onChange={(e) => setRq(e.target.value)} placeholder="ابحث عن مستفيد في الشجرة…"
              className="h-8 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
            {listBusy && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" />}
          </div>

          {listBusy && tree.leaves.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
          ) : (
            <UnitTree leafKind="person"
              units={tree.units}
              leaves={tree.leaves}
              filter={rq.trim() ? (l) => l.name.includes(rq.trim()) : undefined}
              emptyLabel={rq ? "لا مستفيد مطابق." : "لا مستحقات محتسبة لهذا الشهر بعد — اضغط «احتساب المستحقات»."}
              renderLeaf={(r) => {
                const s = STATUS_META[r.status];
                return (
                  <div className="flex flex-col gap-2 py-2.5 pe-3 ps-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.personName}</span>
                      <span className="font-mono-nums text-sm font-bold text-emerald-800">${money(r.gross)}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", s.cls)}>
                        <span className={cn("size-1 rounded-full", s.dot)} />{s.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.tracks.map((t, ti) => {
                        const tm = TRACK_META[t.kind];
                        return (
                          <span key={ti} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line">
                            <tm.Icon className="size-3 text-emerald-700" strokeWidth={2} />
                            {tm.label}{tm.unit(t.basis) && <span className="font-mono-nums text-ink-faint">· {tm.unit(t.basis)}</span>}
                          </span>
                        );
                      })}
                    </div>
                    <RowAction row={r} busy={busy === r.id} pay={pay} setPay={setPay} onApprove={onApprove} onPayout={onPayout} canApprove={canApprove} canPayout={canPayout} onPayslip={setPayslipFor} />
                  </div>
                );
              }}
            />
          )}
        </section>
        </>)}

        {tab === "entitlements" && canApprove && <IncentivesSection month={state.month} />}

        {/* المرحلة ٠: أرصدةُ الصناديق + ميزانُ المراجعة — قراءةٌ من الدفتر المحاسبيّ الخفيّ */}
        {tab === "ledger" && <LedgerOverview canManage={canApprove} />}

        {/* تعدّدُ العملات: أرصدةٌ + أسعارُ الصرف + التصريف */}
        {tab === "ledger" && <CurrencySection canManage={canOperate} />}

        {/* المرحلة ١: المانحون وكشوفهم + التعهّدات */}
        {tab === "donors" && <DonorsSection />}
        {tab === "donors" && <PledgesSection canEnter={hasCap(caps, "finance.entry") || canApprove} />}

        {/* المرحلة ٢: الموازنة (مخطّطٌ مقابل فعليّ) */}
        {tab === "ledger" && <BudgetSection canSet={canOperate} />}

        {/* المرحلة ٣: مطالبات الصرف (فصلُ المهامّ: مُدخِلٌ يطلب، معتمِدٌ يُقرّ) */}
        {tab === "ledger" && <ClaimsSection canEnter={hasCap(caps, "finance.entry") || canApprove} canDecide={canOperate} />}

        {/* القوائم الماليّة (قائمةُ النشاط + المركزُ الماليّ) — من الدفتر */}
        {tab === "ledger" && <StatementsSection />}

        {/* المرحلة ٤ (تكملة): سُلَفُ الموظّفين — تُمنَح من كشف الراتب وتُستردُّ أقساطًا */}
        {tab === "entitlements" && <AdvancesSection canManage={canOperate} />}

        {/* المرحلة ٣ (متخصّص): الصناديقُ النثريّة — سلفةٌ مستديمةٌ تُصرَف وتُزوَّد */}
        {tab === "ledger" && <PettyCashSection canManage={canOperate} />}

        {/* المرحلة ٥: الأصولُ الثابتةُ والإهلاك — رسملةٌ ثمّ إهلاكٌ شهريٌّ بالقسط الثابت */}
        {tab === "ledger" && <FixedAssetsSection canManage={canOperate} />}

        {/* المرحلة ٣ (متخصّص): دفعاتُ الصرف المجمّعة — قيدٌ واحدٌ + كشفُ صرفٍ للطباعة */}
        {tab === "entitlements" && <PaymentBatchesSection canEnter={hasCap(caps, "finance.entry") || canApprove} canPay={canOperate} />}

        {/* المرحلة ٣ (متخصّص): المطابقةُ البنكيّة/النقديّة */}
        {tab === "ledger" && <ReconciliationSection canManage={canApprove} />}

        {/* د٤ (الوثيقة ٢٨): الاستيرادُ بالقوالب — للمُدخِل والمعتمِد (يمرّ بالاعتماد لمن عليه سياسة) */}
        {tab === "entitlements" && canOperate && <ImportSection onChanged={refreshAll} />}

        {payslipFor && <PayslipModal entitlementId={payslipFor} canEdit={canOperate} onClose={() => setPayslipFor(null)} onChanged={refreshAll} />}

        {/* الأصول والعُهد (§ع) — مركبات المؤسّسة ومصروفها وعُهدها */}
        <AssetsPanel />
      </main>
    </MishkatShell>
  );
}

// نظرةُ الدفتر: أرصدةُ الصناديق الخمسة + ميزانُ المراجعة (يُثبت أنّ الدفتر متوازن).
type Overview = {
  funds: Array<{ id: string; name: string; restricted: boolean; balance: number }>;
  trialBalance: Array<{ accountId: string; name: string; type: string; debit: number; credit: number; balance: number }>;
  balanced: boolean; totals: { debit: number; credit: number };
};
type Journal = { entries: Array<{ id: string; memo: string | null; dateHijri: string | null; source: string | null; lines: Array<{ account: string; debit: number; credit: number }> }> };
function LedgerOverview({ canManage }: { canManage: boolean }) {
  const [d, setD] = useState<Overview | null>(null);
  const [open, setOpen] = useState(false);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [showJournal, setShowJournal] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getLedgerOverview()).then((r) => setD(r as Overview)).catch(() => {});
  useEffect(() => { void reload(); }, []);
  const backfill = async () => {
    setBusy(true);
    try {
      const { backfillLedger } = await import("@/lib/api/ledger");
      const r = await backfillLedger() as { donations: number; expenses: number; payouts: number; fuel: number };
      toast.success("رُحّلت الحركات التاريخيّة", { description: `تبرّعات ${r.donations} · مصروفات ${r.expenses} · رواتب ${r.payouts} · محروقات ${r.fuel}` });
      await reload();
    } catch { toast.error("تعذّر الترحيل"); } finally { setBusy(false); }
  };
  const openJournal = async () => {
    setShowJournal((v) => !v);
    if (!journal) { const { getJournal } = await import("@/lib/api/ledger"); setJournal((await getJournal()) as Journal); }
  };
  if (!d) return null;
  const FUND_TONE: Record<string, string> = {
    zakat: "bg-emerald-50 text-emerald-800 ring-emerald-100", waqf: "bg-gold-50 text-gold-700 ring-gold-100",
    projects: "bg-sky-50 text-sky-800 ring-sky-100", sadaqah: "bg-surface-2 text-ink-soft ring-line", general: "bg-surface-2 text-ink-soft ring-line",
  };
  return (
    <section className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h2 className="font-display text-sm font-semibold text-ink">أرصدةُ الصناديق</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", d.balanced ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-danger-bg text-danger ring-danger/20")}>
          {d.balanced ? "الدفتر متوازن ✓" : "خلل توازن ✗"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {d.funds.map((f) => (
          <div key={f.id} className={cn("rounded-xl p-4 ring-1", FUND_TONE[f.id] ?? "bg-surface-2 text-ink-soft ring-line")}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">{f.name}{f.restricted && <span title="مقيّد — لا يُصرف في غير غرضه">🔒</span>}</div>
            <div className="mt-1 font-mono-nums text-xl font-bold">${money(f.balance)}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] font-semibold text-emerald-800 hover:underline">
          {open ? "إخفاء ميزان المراجعة" : "عرض ميزان المراجعة (للمدقّق)"}
        </button>
        <button onClick={openJournal} className="text-[11px] font-semibold text-emerald-800 hover:underline">
          {showJournal ? "إخفاء دفتر اليوميّة" : "عرض دفتر اليوميّة"}
        </button>
        {canManage && (
          <button onClick={backfill} disabled={busy} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface disabled:opacity-60" title="يُرحّل التبرّعات والمصروفات والرواتب والمحروقات السابقة للدفتر (آمنٌ للإعادة)">
            {busy ? <Loader2 className="size-3 animate-spin" /> : null} ترحيل الحركات التاريخيّة
          </button>
        )}
      </div>
      {showJournal && journal && (
        <div className="space-y-2 rounded-xl bg-surface-2/40 p-3">
          {journal.entries.length === 0 ? <p className="text-center text-xs text-ink-soft">لا قيودَ بعد.</p> : journal.entries.map((e) => (
            <div key={e.id} className="rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
              <div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-ink">{e.memo || e.source}</span><span className="text-ink-faint">{e.dateHijri || ""}</span></div>
              <div className="mt-1 space-y-0.5 font-mono-nums text-[11px] text-ink-soft">
                {e.lines.map((l, i) => (
                  <div key={i} className="flex justify-between"><span className="font-sans">{l.account}</span><span>{l.debit ? `مدين ${money(l.debit)}` : `دائن ${money(l.credit)}`}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="overflow-x-auto">
          {d.trialBalance.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-soft">لا حركاتٍ مُرحَّلةٌ في الدفتر بعد.</p>
          ) : (
            <table className="w-full min-w-[28rem] text-right text-xs">
              <thead><tr className="border-b border-line text-[11px] text-ink-faint">
                <th className="px-3 py-2 font-medium">الحساب</th><th className="px-3 py-2 font-medium">مدين</th><th className="px-3 py-2 font-medium">دائن</th><th className="px-3 py-2 font-medium">الرصيد</th>
              </tr></thead>
              <tbody className="divide-y divide-line font-mono-nums">
                {d.trialBalance.map((r) => (
                  <tr key={r.accountId}><td className="px-3 py-1.5 font-sans text-ink">{r.name}</td><td className="px-3 py-1.5 text-ink-soft">{r.debit ? money(r.debit) : "—"}</td><td className="px-3 py-1.5 text-ink-soft">{r.credit ? money(r.credit) : "—"}</td><td className="px-3 py-1.5 font-bold text-ink">{money(r.balance)}</td></tr>
                ))}
                <tr className="border-t-2 border-line font-bold"><td className="px-3 py-1.5 font-sans">الإجمالي</td><td className="px-3 py-1.5">{money(d.totals.debit)}</td><td className="px-3 py-1.5">{money(d.totals.credit)}</td><td className="px-3 py-1.5">—</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

// مطبوعةٌ رسميّةٌ (كشفُ مانحٍ) — HTML مُهرَّبٌ عبر نافذةٍ منفصلة
function printDonorStatement(st: { donor: { name: string; phone: string | null }; total: number; items: Array<{ receiptNo: string | null; fund: string; amount: number; note: string | null }>; byFund: Array<{ fund: string; amount: number }> }) {
  const FUND_AR: Record<string, string> = { general: "العامّ", zakat: "الزكاة", sadaqah: "الصدقة", waqf: "الوقف", projects: "المشاريع" };
  const rows = st.items.map((i) => `<tr><td>${escapeHtml(i.receiptNo ?? "—")}</td><td>${FUND_AR[i.fund] ?? escapeHtml(i.fund)}</td><td class="n">$${money(i.amount)}</td><td>${escapeHtml(i.note ?? "")}</td></tr>`).join("");
  const funds = st.byFund.map((f) => `<span class="chip">${FUND_AR[f.fund] ?? escapeHtml(f.fund)}: $${money(f.amount)}</span>`).join(" ");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف المانح ${escapeHtml(st.donor.name)}</title>
    <style>body{font-family:'IBM Plex Sans Arabic',system-ui;padding:1.5rem;color:#1a2e28}h1{font-size:1.15rem;color:#14532d;margin:0}.sub{font-size:.8rem;color:#555}
    table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:1rem}th,td{border:1px solid #9ca3af;padding:.4rem .6rem;text-align:center}th{background:#ecfdf5;color:#14532d}td.n{font-weight:700}
    .chip{display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:1rem;padding:.15rem .6rem;font-size:.75rem;margin:.15rem}
    .total{margin-top:1rem;font-size:1rem;font-weight:700;color:#14532d}.head{border-bottom:3px double #14532d;padding-bottom:.6rem;display:flex;justify-content:space-between;align-items:center}</style></head><body>
    <div class="head"><div><h1>كشفُ حسابِ مانح</h1><div class="sub">${escapeHtml(st.donor.name)}${st.donor.phone ? ` · ${escapeHtml(st.donor.phone)}` : ""}</div></div><div class="sub">مِشكاة — منظومة المسجد المؤثر</div></div>
    <div style="margin-top:.8rem">${funds}</div>
    <table><thead><tr><th>سند القبض</th><th>الصندوق</th><th>المبلغ</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">الإجماليّ: $${money(st.total)}</div>
    <button onclick="print()" style="margin-top:1rem;padding:.5rem 1.5rem">طباعة / حفظ PDF</button></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// قسمُ المانحين: بحثٌ + قائمةٌ بالإجماليّ، نقرُ مانحٍ يفتح كشفَه القابلَ للطباعة.
type DonorRow = { id: string; name: string; total: number; count: number };
function DonorsSection() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<DonorRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { import("@/lib/api/ledger").then((m) => m.getDonorsList({ data: { q: q || undefined } })).then((r) => setRows((r as { items: DonorRow[] }).items)).catch(() => setRows([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const openStatement = async (id: string) => {
    setBusyId(id);
    try { const { getDonorStatement } = await import("@/lib/api/ledger"); const st = await getDonorStatement({ data: { donorId: id } }); printDonorStatement(st as never); }
    catch { toast.error("تعذّر فتح الكشف"); } finally { setBusyId(null); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Users className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">المانحون</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم…" aria-label="ابحث عن مانح"
          className="ms-auto h-8 w-40 rounded-lg bg-surface px-2 text-xs text-ink ring-1 ring-line outline-none placeholder:text-ink-faint focus:ring-emerald-300" />
      </div>
      {!rows ? <div className="grid place-items-center py-8"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : rows.length === 0 ? <p className="py-8 text-center text-sm text-ink-soft">{q ? "لا مانحَ مطابق." : "لا مانحين بعد — يُسجَّلون تلقائيًّا عند إدخال التبرّعات."}</p>
        : (
          <ul className="divide-y divide-line">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{d.name}</p><p className="text-[11px] text-ink-faint">{d.count} تبرّع</p></div>
                <span className="font-mono-nums text-sm font-bold text-emerald-800">${money(d.total)}</span>
                <button onClick={() => openStatement(d.id)} disabled={busyId === d.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface disabled:opacity-60">
                  {busyId === d.id ? <Loader2 className="size-3 animate-spin" /> : "كشفٌ للطباعة"}
                </button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// التعهّداتُ المفتوحة: المتبقّي على كلّ متعهِّد + نموذجُ تسجيلِ تعهّدٍ جديد.
const FUND_LABELS: Record<string, string> = { general: "العامّ", zakat: "الزكاة", sadaqah: "الصدقة", waqf: "الوقف", projects: "المشاريع" };
type Pledge = { id: string; donorName: string; fund: string; amount: number; fulfilled: number; remaining: number; dueAt: number | null };
function PledgesSection({ canEnter }: { canEnter: boolean }) {
  const [items, setItems] = useState<Pledge[] | null>(null);
  const [name, setName] = useState(""); const [amt, setAmt] = useState(""); const [fund, setFund] = useState("projects"); const [busy, setBusy] = useState(false);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getOpenPledges()).then((r) => setItems((r as { items: Pledge[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !(Number(amt) > 0)) { toast.error("أكمل الاسم والمبلغ"); return; }
    setBusy(true);
    try {
      const { recordPledge } = await import("@/lib/api/ledger");
      const r = await recordPledge({ data: { donorName: name.trim(), amount: Number(amt), fund: fund as never } }) as { error?: string };
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("سُجّل التعهّد"); setName(""); setAmt(""); await reload(); }
    } catch { toast.error("تعذّر التسجيل"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <CalendarDays className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">التعهّدات المفتوحة</h2>
        {items && <span className="ms-auto font-mono-nums text-[11px] font-semibold text-ink-soft">{items.length}</span>}
      </div>
      {canEnter && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <div className="min-w-0 flex-1"><Field label="المتعهِّد"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" /></Field></div>
          <div className="w-32"><Field label="الصندوق"><MSelect value={fund} onValueChange={setFund} options={Object.entries(FUND_LABELS).map(([value, label]) => ({ value, label }))} /></Field></div>
          <div className="w-24"><Field label="المبلغ $"><TextField inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} تعهّد</button>
        </form>
      )}
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : items.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا تعهّداتٍ مفتوحة.</p>
        : (
          <ul className="divide-y divide-line">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.donorName} <span className="text-[11px] font-normal text-ink-faint">· {FUND_LABELS[p.fund] ?? p.fund}</span></p>
                  <p className="text-[11px] text-ink-faint">وفَّى ${money(p.fulfilled)} من ${money(p.amount)}</p>
                </div>
                <span className="rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">متبقٍّ ${money(p.remaining)}</span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// الموازنة: ضبطُ مخطّطٍ لصندوقٍ لفترة + جدولُ المخطّط/الفعليّ/المتبقّي (المتجاوَزُ بالأحمر).
type BudgetRow = { id: string; fundId: string; fundName: string; planned: number; actual: number; remaining: number; pct: number; over: boolean };
function BudgetSection({ canSet }: { canSet: boolean }) {
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState<BudgetRow[] | null>(null);
  const [fund, setFund] = useState("general"); const [amt, setAmt] = useState(""); const [busy, setBusy] = useState(false);
  const reload = (p?: string) => import("@/lib/api/ledger").then((m) => m.getBudgetReport({ data: { period: p || undefined } })).then((r) => { const d = r as { period: string; items: BudgetRow[] }; setPeriod(d.period); setRows(d.items); }).catch(() => setRows([]));
  useEffect(() => { void reload(); }, []);
  const set = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(Number(amt) > 0) || !period) { toast.error("أدخل مبلغًا موجبًا"); return; }
    setBusy(true);
    try {
      const { setBudget } = await import("@/lib/api/ledger");
      const r = await setBudget({ data: { period, fundId: fund, amount: Number(amt) } }) as { error?: string };
      if (queuedToast(r)) { setAmt(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("ضُبطت الموازنة"); setAmt(""); await reload(period); }
    } catch { toast.error("تعذّر الضبط"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Calculator className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">الموازنة</h2>
        <span className="ms-auto font-mono-nums text-[11px] font-semibold text-ink-soft">فترة {period}هـ</span>
      </div>
      {canSet && (
        <form onSubmit={set} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <div className="w-28"><Field label="الفترة (هجري)"><TextField value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="1447 أو 1447-12" dir="ltr" className="text-center" /></Field></div>
          <div className="w-32"><Field label="الصندوق"><MSelect value={fund} onValueChange={setFund} options={Object.entries(FUND_LABELS).map(([value, label]) => ({ value, label }))} /></Field></div>
          <div className="w-24"><Field label="المخطّط $"><TextField inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} ضبط</button>
        </form>
      )}
      {!rows ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : rows.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا موازناتٍ لهذه الفترة{canSet ? " — اضبط موازنةً أعلاه." : "."}</p>
        : (
          <ul className="divide-y divide-line">
            {rows.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{b.fundName}</span>
                  <span className={cn("font-mono-nums text-[11px] font-semibold", b.over ? "text-danger" : "text-ink-soft")}>${money(b.actual)} من ${money(b.planned)}{b.over ? " · متجاوَز" : ""}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full rounded-full", b.over ? "bg-danger" : b.pct >= 80 ? "bg-gold-500" : "bg-emerald-600")} style={{ width: `${Math.min(100, b.pct)}%` }} />
                </div>
                <p className={cn("mt-1 text-[11px]", b.over ? "text-danger" : "text-ink-faint")}>{b.over ? `تجاوزٌ بـ$${money(-b.remaining)}` : `متبقٍّ $${money(b.remaining)} (${b.pct}%)`}</p>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// مطالبات الصرف: مُدخِلٌ يقدّم طلبًا معلّقًا، ومعتمِدٌ يُقرّ (يُرحَّل للدفتر) أو يرفض بسبب.
type Claim = { id: string; fundName: string; fundId: string; category: string | null; amount: number; note: string | null; receiptUrl: string | null };
function ClaimsSection({ canEnter, canDecide }: { canEnter: boolean; canDecide: boolean }) {
  const [items, setItems] = useState<Claim[] | null>(null);
  const [fund, setFund] = useState("general"); const [cat, setCat] = useState(""); const [amt, setAmt] = useState(""); const [receipt, setReceipt] = useState(""); const [busy, setBusy] = useState(false);
  const [actId, setActId] = useState<string | null>(null);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getClaims()).then((r) => setItems((r as { items: Claim[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(Number(amt) > 0)) { toast.error("أدخل مبلغًا موجبًا"); return; }
    setBusy(true);
    try {
      const { submitClaim } = await import("@/lib/api/ledger");
      const r = await submitClaim({ data: { fundId: fund, category: cat.trim() || undefined, amount: Number(amt), receiptUrl: receipt.trim() || undefined } }) as { error?: string };
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("قُدّمت المطالبة — بانتظار الاعتماد"); setAmt(""); setCat(""); setReceipt(""); await reload(); }
    } catch { toast.error("تعذّر التقديم"); } finally { setBusy(false); }
  };
  const decide = async (id: string, approve: boolean) => {
    let reason = "";
    if (!approve) { reason = window.prompt("سببُ الرفض:") ?? ""; if (!reason.trim()) return; }
    setActId(id);
    try {
      const { decideClaim } = await import("@/lib/api/ledger");
      const r = await decideClaim({ data: { claimId: id, approve, reason } }) as { error?: string; ok?: boolean; budgetWarning?: string | null };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else {
        toast.success(approve ? "اعتُمدت المطالبة وصُرفت" : "رُفضت المطالبة");
        if (approve && r.budgetWarning) toast.warning("تنبيه الموازنة", { description: r.budgetWarning });
        await reload();
      }
    } catch { toast.error("تعذّر البتّ"); } finally { setActId(null); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Banknote className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">مطالبات الصرف</h2>
        {items && <span className="ms-auto rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">{items.length} معلّقة</span>}
      </div>
      {canEnter && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <div className="w-32"><Field label="الصندوق"><MSelect value={fund} onValueChange={setFund} options={Object.entries(FUND_LABELS).map(([value, label]) => ({ value, label }))} /></Field></div>
          <div className="min-w-0 flex-1"><Field label="البند"><TextField value={cat} onChange={(e) => setCat(e.target.value)} placeholder="كهرباء، صيانة…" /></Field></div>
          <div className="w-24"><Field label="المبلغ $"><TextField inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
          <div className="min-w-0 flex-1"><Field label="رابطُ الإيصال (اختياري)"><TextField value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="https://…" /></Field></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} تقديمُ مطالبة</button>
        </form>
      )}
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : items.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا مطالباتٍ معلّقة.</p>
        : (
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.category || "مصروف"} <span className="text-[11px] font-normal text-ink-faint">· {c.fundName}</span>{c.receiptUrl && <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="ms-1 text-[11px] font-normal text-emerald-700 underline">إيصال</a>}</p>
                  {c.note && <p className="truncate text-[11px] text-ink-faint">{c.note}</p>}
                </div>
                <span className="font-mono-nums text-sm font-bold text-emerald-800">${money(c.amount)}</span>
                {canDecide && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => decide(c.id, true)} disabled={actId === c.id} className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 disabled:opacity-60">{actId === c.id ? <Loader2 className="size-3 animate-spin" /> : "اعتماد"}</button>
                    <button onClick={() => decide(c.id, false)} disabled={actId === c.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-danger/30 transition hover:bg-danger-bg disabled:opacity-60">رفض</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// القوائم الماليّة: قائمةُ النشاط (إيراد/مصروف/صافٍ لكلّ صندوق) + المركزُ الماليّ (أصول=خصوم+صافي أصول).
type CashFlowCat = { lines: Array<{ source: string; label: string; amount: number }>; net: number };
type Statements = {
  activities: { period: string; funds: Array<{ fundId: string; fundName: string; income: number; expense: number; net: number }>; totals: { income: number; expense: number; net: number } };
  position: { assets: Array<{ name: string; balance: number }>; liabilities: Array<{ name: string; balance: number }>; netAssetsByFund: Array<{ fundName: string; balance: number }>; assetsTotal: number; liabilitiesTotal: number; netAssetsTotal: number; balanced: boolean };
  cashFlow: { period: string; operating: CashFlowCat; investing: CashFlowCat; financing: CashFlowCat; netChange: number; cashBalance: number };
};
function printStatements(s: Statements) {
  const a = s.activities, p = s.position;
  const actRows = a.funds.map((f) => `<tr><td class="n">${escapeHtml(f.fundName)}</td><td>$${money(f.income)}</td><td>$${money(f.expense)}</td><td class="b">$${money(f.net)}</td></tr>`).join("");
  const asset = p.assets.map((x) => `<tr><td class="n">${escapeHtml(x.name)}</td><td class="b">$${money(x.balance)}</td></tr>`).join("");
  const liab = p.liabilities.map((x) => `<tr><td class="n">${escapeHtml(x.name)}</td><td class="b">$${money(x.balance)}</td></tr>`).join("") || `<tr><td class="n">لا خصوم</td><td class="b">$0.00</td></tr>`;
  const na = p.netAssetsByFund.map((x) => `<tr><td class="n">${escapeHtml(x.fundName)}</td><td class="b">$${money(x.balance)}</td></tr>`).join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>القوائم الماليّة</title>
    <style>body{font-family:'IBM Plex Sans Arabic',system-ui;padding:1.5rem;color:#1a2e28}h1{font-size:1.15rem;color:#14532d;margin:0}h2{font-size:.95rem;color:#14532d;margin:1.4rem 0 .4rem;border-bottom:2px solid #14532d;padding-bottom:.2rem}.sub{font-size:.8rem;color:#555}
    table{width:100%;border-collapse:collapse;font-size:.85rem}th,td{border:1px solid #9ca3af;padding:.4rem .6rem;text-align:center}th{background:#ecfdf5;color:#14532d}td.n{text-align:right}td.b{font-weight:700}tfoot td{background:#fafaf5;font-weight:700}
    .head{border-bottom:3px double #14532d;padding-bottom:.6rem;display:flex;justify-content:space-between;align-items:center}</style></head><body>
    <div class="head"><div><h1>القوائم الماليّة</h1><div class="sub">قائمةُ النشاط للفترة ${escapeHtml(a.period)}هـ · المركزُ الماليّ حتى تاريخه</div></div><div class="sub">مِشكاة — منظومة المسجد المؤثر</div></div>
    <h2>قائمةُ النشاط (الإيرادات والمصروفات حسب الصندوق)</h2>
    <table><thead><tr><th>الصندوق</th><th>الإيرادات</th><th>المصروفات</th><th>صافي التغيّر</th></tr></thead><tbody>${actRows}</tbody>
    <tfoot><tr><td class="n">الإجماليّ</td><td>$${money(a.totals.income)}</td><td>$${money(a.totals.expense)}</td><td>$${money(a.totals.net)}</td></tr></tfoot></table>
    <h2>المركزُ الماليّ</h2>
    <table><thead><tr><th>الأصول</th><th></th></tr></thead><tbody>${asset}</tbody><tfoot><tr><td class="n">إجماليّ الأصول</td><td>$${money(p.assetsTotal)}</td></tr></tfoot></table>
    <table style="margin-top:.8rem"><thead><tr><th>الخصوم وصافي الأصول</th><th></th></tr></thead><tbody>${liab}${na}</tbody><tfoot><tr><td class="n">إجماليّ الخصوم وصافي الأصول</td><td>$${money(p.liabilitiesTotal + p.netAssetsTotal)}</td></tr></tfoot></table>
    <p style="margin-top:.6rem;font-size:.8rem;color:${p.balanced ? "#14532d" : "#b91c1c"}">${p.balanced ? "✓ متوازن (الأصول = الخصوم + صافي الأصول)" : "✗ خللٌ في التوازن"}</p>
    ${s.cashFlow ? `<h2>التدفّقُ النقديّ (الطريقةُ المباشرة)</h2>
    <table><thead><tr><th>البند</th><th>التدفّق</th></tr></thead><tbody>${
      ([["نشاطٌ تشغيليّ", s.cashFlow.operating], ["نشاطٌ استثماريّ", s.cashFlow.investing], ["نشاطٌ تمويليّ", s.cashFlow.financing]] as const)
        .map(([lbl, cat]) => `<tr><td class="n" style="font-weight:700;background:#f6f6f0">${lbl}</td><td class="b">${cat.net >= 0 ? "+" : "−"}$${money(Math.abs(cat.net))}</td></tr>` +
          cat.lines.map((l) => `<tr><td class="n">${escapeHtml(l.label)}</td><td>${l.amount >= 0 ? "+" : "−"}$${money(Math.abs(l.amount))}</td></tr>`).join("")).join("")
    }</tbody><tfoot><tr><td class="n">صافي التغيّر في النقد</td><td>${s.cashFlow.netChange >= 0 ? "+" : "−"}$${money(Math.abs(s.cashFlow.netChange))}</td></tr><tr><td class="n">الرصيدُ النقديُّ الحاليّ</td><td>$${money(s.cashFlow.cashBalance)}</td></tr></tfoot></table>` : ""}
    <button onclick="print()" style="margin-top:1rem;padding:.5rem 1.5rem">طباعة / حفظ PDF</button></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
// تصديرُ القوائم إلى CSV (يفتحه Excel عربيًّا بفضل BOM) — «تصدير Excel».
function exportStatementsCsv(s: Statements) {
  const rows: string[][] = [["القوائم الماليّة", ""], ["", ""], ["قائمة النشاط — الفترة", s.activities.period], ["الصندوق", "الإيراد", "المصروف", "صافي التغيّر"] as string[]];
  s.activities.funds.forEach((f) => rows.push([f.fundName, String(f.income), String(f.expense), String(f.net)]));
  rows.push(["الإجماليّ", String(s.activities.totals.income), String(s.activities.totals.expense), String(s.activities.totals.net)]);
  rows.push(["", ""], ["المركز الماليّ", ""], ["الأصول", "الرصيد"]);
  s.position.assets.forEach((a) => rows.push([a.name, String(a.balance)]));
  rows.push(["إجماليّ الأصول", String(s.position.assetsTotal)], ["", ""], ["صافي الأصول بالصندوق", "الرصيد"]);
  s.position.netAssetsByFund.forEach((f) => rows.push([f.fundName, String(f.balance)]));
  if (s.cashFlow) {
    rows.push(["", ""], ["التدفّق النقديّ", ""]);
    ([["تشغيليّ", s.cashFlow.operating], ["استثماريّ", s.cashFlow.investing], ["تمويليّ", s.cashFlow.financing]] as const).forEach(([lbl, cat]) => {
      rows.push([lbl, String(cat.net)]);
      cat.lines.forEach((l) => rows.push([`  ${l.label}`, String(l.amount)]));
    });
    rows.push(["صافي التغيّر في النقد", String(s.cashFlow.netChange)], ["الرصيد النقديّ الحاليّ", String(s.cashFlow.cashBalance)]);
  }
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `financial-statements-${s.activities.period}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function StatementsSection() {
  const [s, setS] = useState<Statements | null>(null);
  useEffect(() => { import("@/lib/api/ledger").then((m) => m.getFinancialStatements({ data: {} })).then((r) => setS(r as Statements)).catch(() => {}); }, []);
  if (!s) return null;
  const a = s.activities, p = s.position;
  const empty = a.funds.length === 0 && p.assets.length === 0;
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <BadgeDollarSign className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">القوائم الماليّة</h2>
        <span className="ms-auto font-mono-nums text-[11px] text-ink-faint">{a.period}هـ</span>
        {!empty && <button onClick={() => exportStatementsCsv(s)} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface">Excel</button>}
        {!empty && <button onClick={() => printStatements(s)} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface">طباعةٌ رسميّة</button>}
      </div>
      {empty ? <p className="py-6 text-center text-sm text-ink-soft">لا حركاتٍ ماليّةٌ بعد.</p> : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink-soft">قائمةُ النشاط (حسب الصندوق)</h3>
            <ul className="space-y-1.5">
              {a.funds.map((f) => (
                <li key={f.fundId} className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-1.5 text-xs">
                  <span className="text-ink">{f.fundName}</span>
                  <span className="font-mono-nums"><span className="text-emerald-700">+{money(f.income)}</span> <span className="text-danger">−{money(f.expense)}</span> = <span className={cn("font-bold", f.net >= 0 ? "text-ink" : "text-danger")}>{money(f.net)}</span></span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-line px-3 pt-2 text-xs font-bold text-ink"><span>الصافي</span><span className="font-mono-nums">${money(a.totals.net)}</span></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink-soft">المركزُ الماليّ</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between rounded-lg bg-emerald-50/60 px-3 py-1.5 font-semibold"><span className="text-emerald-800">إجماليّ الأصول (النقد)</span><span className="font-mono-nums text-emerald-800">${money(p.assetsTotal)}</span></div>
              {p.netAssetsByFund.map((f) => (<div key={f.fundName} className="flex justify-between px-3 py-1"><span className="text-ink-soft">صافي أصول {f.fundName}</span><span className="font-mono-nums text-ink">${money(f.balance)}</span></div>))}
              <div className={cn("flex justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold", p.balanced ? "bg-emerald-50 text-emerald-800" : "bg-danger-bg text-danger")}>
                <span>{p.balanced ? "متوازن ✓" : "خلل توازن ✗"}</span><span className="font-mono-nums">أصول ${money(p.assetsTotal)} = خصوم+صافي ${money(p.liabilitiesTotal + p.netAssetsTotal)}</span>
              </div>
            </div>
          </div>
          {s.cashFlow && (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-xs font-semibold text-ink-soft">التدفّقُ النقديّ (الطريقةُ المباشرة)</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {([["تشغيليّ", s.cashFlow.operating], ["استثماريّ", s.cashFlow.investing], ["تمويليّ", s.cashFlow.financing]] as const).map(([label, cat]) => (
                  <div key={label} className="rounded-lg bg-surface-2/50 p-2.5 text-xs">
                    <div className="mb-1 flex items-center justify-between font-semibold text-ink"><span>{label}</span><span className={cn("font-mono-nums", cat.net >= 0 ? "text-emerald-700" : "text-danger")}>{cat.net >= 0 ? "+" : "−"}{money(Math.abs(cat.net))}</span></div>
                    {cat.lines.length === 0 ? <p className="text-ink-faint">—</p> : cat.lines.map((l) => (
                      <div key={l.source} className="flex items-center justify-between py-0.5"><span className="text-ink-soft">{l.label}</span><span className={cn("font-mono-nums", l.amount >= 0 ? "text-emerald-700" : "text-danger")}>{l.amount >= 0 ? "+" : "−"}{money(Math.abs(l.amount))}</span></div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50/60 px-3 py-1.5 text-xs font-semibold">
                <span className="text-emerald-800">صافي التغيّر في النقد</span>
                <span className="font-mono-nums text-emerald-800">{s.cashFlow.netChange >= 0 ? "+" : "−"}${money(Math.abs(s.cashFlow.netChange))} · الرصيدُ الحاليّ ${money(s.cashFlow.cashBalance)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// كشفُ الراتب: نافذةٌ تعرض الإجماليّ/البدلات/الخصومات/الصافي، وللمعتمِد إضافةُ بندٍ، مع طباعةٍ رسميّة.
type Payslip = { personId: string; personName: string; month: string; gross: number; allowances: number; deductions: number; advanceRecovery: number; net: number; items: Array<{ id: string; kind: string; amount: number; note: string | null }> };
function printPayslip(ps: Payslip) {
  const rows = ps.items.map((i) => `<tr><td class="n">${i.kind === "allowance" ? "بدل" : "خصم"}${i.note ? ` — ${escapeHtml(i.note)}` : ""}</td><td class="${i.kind === "allowance" ? "pos" : "neg"}">${i.kind === "allowance" ? "+" : "−"}$${money(i.amount)}</td></tr>`).join("")
    + (ps.advanceRecovery > 0 ? `<tr><td class="n">استردادُ سُلفة (قسطٌ شهريّ)</td><td class="neg">−$${money(ps.advanceRecovery)}</td></tr>` : "");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف راتب ${escapeHtml(ps.personName)}</title>
    <style>body{font-family:'IBM Plex Sans Arabic',system-ui;padding:1.5rem;color:#1a2e28}h1{font-size:1.15rem;color:#14532d;margin:0}.sub{font-size:.8rem;color:#555}
    table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:1rem}td{border:1px solid #9ca3af;padding:.45rem .7rem}td.n{text-align:right}td.pos{color:#14532d;font-weight:700;text-align:center}td.neg{color:#b91c1c;font-weight:700;text-align:center}
    .head{border-bottom:3px double #14532d;padding-bottom:.6rem;display:flex;justify-content:space-between;align-items:center}
    .net{margin-top:1rem;font-size:1.15rem;font-weight:700;color:#14532d;text-align:center;background:#ecfdf5;padding:.6rem;border-radius:.5rem}</style></head><body>
    <div class="head"><div><h1>كشفُ راتب</h1><div class="sub">${escapeHtml(ps.personName)} · شهر ${escapeHtml(ps.month)}هـ</div></div><div class="sub">مِشكاة — منظومة المسجد المؤثر</div></div>
    <table><tbody><tr><td class="n">الإجماليّ (المستحقّ)</td><td class="pos">$${money(ps.gross)}</td></tr>${rows}</tbody></table>
    <div class="net">صافي الراتب: $${money(ps.net)}</div>
    <div style="display:flex;justify-content:space-between;margin-top:2rem;font-size:.8rem"><span>توقيع المستلِم: ــــــــــــ</span><span>توقيع المعتمِد: ــــــــــــ</span></div>
    <button onclick="print()" style="margin-top:1rem;padding:.5rem 1.5rem">طباعة / حفظ PDF</button></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function PayslipModal({ entitlementId, canEdit, onClose, onChanged }: { entitlementId: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [ps, setPs] = useState<Payslip | null>(null);
  const [kind, setKind] = useState<"allowance" | "deduction">("allowance"); const [amt, setAmt] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const [advPrincipal, setAdvPrincipal] = useState(""); const [advMonthly, setAdvMonthly] = useState(""); const [advBusy, setAdvBusy] = useState(false);
  const load = () => import("@/lib/api/ledger").then((m) => m.getPayslipByEntitlement({ data: { entitlementId } })).then((r) => setPs(r as Payslip)).catch(() => onClose());
  useEffect(() => { void load(); }, [entitlementId]);
  const grant = async () => {
    if (!ps) return;
    const principal = Number(advPrincipal), monthly = Number(advMonthly);
    if (!(principal > 0) || !(monthly > 0)) { toast.error("أدخل أصلَ السلفة والقسط (موجبين)"); return; }
    if (monthly > principal) { toast.error("القسطُ لا يتجاوز أصلَ السلفة"); return; }
    setAdvBusy(true);
    try {
      const { grantAdvance } = await import("@/lib/api/ledger");
      const r = await grantAdvance({ data: { personId: ps.personId, principal, monthlyDeduction: monthly } }) as { error?: string };
      if (queuedToast(r)) { setAdvPrincipal(""); setAdvMonthly(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("مُنحت السلفة — ستُستردُّ أقساطًا من الراتب"); setAdvPrincipal(""); setAdvMonthly(""); await load(); onChanged(); }
    } catch { toast.error("تعذّر منحُ السلفة"); } finally { setAdvBusy(false); }
  };
  const add = async () => {
    if (!ps || !(Number(amt) > 0)) { toast.error("أدخل مبلغًا موجبًا"); return; }
    setBusy(true);
    try {
      const { addAdjustment } = await import("@/lib/api/ledger");
      const r = await addAdjustment({ data: { personId: ps.personId, month: ps.month, kind, amount: Number(amt), note: note.trim() || undefined } }) as { error?: string };
      if (queuedToast(r)) { setAmt(""); setNote(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { setAmt(""); setNote(""); await load(); onChanged(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { const { removeAdjustment } = await import("@/lib/api/ledger"); const r = await removeAdjustment({ data: { id } }); if (queuedToast(r)) return; await load(); onChanged(); } catch { toast.error("تعذّر"); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-ink">كشفُ راتب {ps?.personName ?? ""}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-ink-faint ring-1 ring-line hover:bg-surface-2"><X className="size-3.5" /></button>
        </div>
        {!ps ? <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div> : (
          <div className="space-y-3 p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">الإجماليّ (المستحقّ)</span><span className="font-mono-nums font-semibold text-ink">${money(ps.gross)}</span></div>
              {ps.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs">
                  <span className="text-ink-soft">{i.kind === "allowance" ? "بدل" : "خصم"}{i.note ? ` · ${i.note}` : ""}</span>
                  <span className="flex items-center gap-2"><span className={cn("font-mono-nums font-semibold", i.kind === "allowance" ? "text-emerald-700" : "text-danger")}>{i.kind === "allowance" ? "+" : "−"}${money(i.amount)}</span>{canEdit && <button onClick={() => remove(i.id)} aria-label="حذف" className="text-ink-faint hover:text-danger"><X className="size-3" /></button>}</span>
                </div>
              ))}
              {ps.advanceRecovery > 0 && (
                <div className="flex items-center justify-between text-xs"><span className="text-ink-soft">استردادُ سُلفة (قسطٌ شهريّ)</span><span className="font-mono-nums font-semibold text-danger">−${money(ps.advanceRecovery)}</span></div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-sm font-bold text-emerald-800"><span>الصافي</span><span className="font-mono-nums">${money(ps.net)}</span></div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/50 p-3">
                <div className="w-24"><Field label="النوع"><MSelect value={kind} onValueChange={(v) => setKind(v as "allowance" | "deduction")} options={[{ value: "allowance", label: "بدل +" }, { value: "deduction", label: "خصم −" }]} /></Field></div>
                <div className="min-w-0 flex-1"><Field label="البيان"><TextField value={note} onChange={(e) => setNote(e.target.value)} placeholder="مواصلات، غياب…" /></Field></div>
                <div className="w-20"><Field label="$"><TextField inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
                <button onClick={add} disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}</button>
              </div>
            )}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-gold-50/50 p-3 ring-1 ring-gold-100">
                <p className="w-full text-[11px] font-semibold text-gold-700">منحُ سُلفةٍ (تُستردُّ أقساطًا من الراتب)</p>
                <div className="w-24"><Field label="أصلُ السلفة $"><TextField inputMode="decimal" value={advPrincipal} onChange={(e) => setAdvPrincipal(e.target.value)} className="text-center font-mono-nums" /></Field></div>
                <div className="w-24"><Field label="القسط الشهريّ $"><TextField inputMode="decimal" value={advMonthly} onChange={(e) => setAdvMonthly(e.target.value)} className="text-center font-mono-nums" /></Field></div>
                <button onClick={grant} disabled={advBusy} className="inline-flex h-10 items-center gap-1 rounded-xl bg-gold-600 px-3 text-xs font-semibold text-white ring-1 ring-gold-700/30 hover:bg-gold-700 disabled:opacity-60">{advBusy ? <Loader2 className="size-4 animate-spin" /> : "منح"}</button>
              </div>
            )}
            <button onClick={() => printPayslip(ps)} className="w-full rounded-xl bg-surface-2 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface">كشفٌ رسميٌّ للطباعة</button>
          </div>
        )}
      </div>
    </div>
  );
}

// سُلَفُ الموظّفين: قائمةُ السُلَف القائمة برصيدها المتبقّي + زرُّ تسجيلِ استردادِ قسطٍ (للمعتمِد).
type Advance = { id: string; personId: string; personName: string; principal: number; balance: number; monthlyDeduction: number; status: string; createdAt: number };
function AdvancesSection({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Advance[] | null>(null);
  const [actId, setActId] = useState<string | null>(null);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getAdvances()).then((r) => setItems((r as { items: Advance[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const repay = async (a: Advance) => {
    const raw = window.prompt(`مبلغُ الاسترداد من «${a.personName}» (المتبقّي $${money(a.balance)}):`, money(Math.min(a.monthlyDeduction, a.balance)));
    if (raw == null) return;
    const amount = Number(raw);
    if (!(amount > 0)) { toast.error("أدخل مبلغًا موجبًا"); return; }
    setActId(a.id);
    try {
      const { repayAdvance } = await import("@/lib/api/ledger");
      const r = await repayAdvance({ data: { advanceId: a.id, amount } }) as { error?: string; settled?: boolean; applied?: number };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(r.settled ? "سُدِّدت السلفةُ بالكامل" : `سُجِّل استردادُ $${money(r.applied ?? amount)}`); await reload(); }
    } catch { toast.error("تعذّر التسجيل"); } finally { setActId(null); }
  };
  const active = (items ?? []).filter((a) => a.status === "active");
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Coins className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">سُلَفُ الموظّفين</h2>
        {items && <span className="ms-auto rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">{active.length} قائمة</span>}
      </div>
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : active.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا سُلَفَ قائمة. تُمنَح السلفةُ من كشف راتب الموظّف.</p>
        : (
          <ul className="divide-y divide-line">
            {active.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{a.personName}</p>
                  <p className="truncate text-[11px] text-ink-faint">أصلٌ ${money(a.principal)} · قسطٌ شهريّ ${money(a.monthlyDeduction)}</p>
                </div>
                <div className="text-end">
                  <span className="block font-mono-nums text-sm font-bold text-emerald-800">${money(a.balance)}</span>
                  <span className="text-[10px] text-ink-faint">المتبقّي</span>
                </div>
                {canManage && (
                  <button onClick={() => repay(a)} disabled={actId === a.id} className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 disabled:opacity-60">{actId === a.id ? <Loader2 className="size-3 animate-spin" /> : "تسجيلُ استرداد"}</button>
                )}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// الصندوقُ النثريّ (السلفة المستديمة): سقفٌ ثابتٌ يُصرَف منه ويُزوَّد دوريًّا للسقف.
type PettyBox = { id: string; name: string; custodianName: string | null; floatAmount: number; balance: number; spent: number; needsReplenish: boolean; status: string };
function PettyCashSection({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<PettyBox[] | null>(null);
  const [name, setName] = useState(""); const [flt, setFlt] = useState(""); const [busy, setBusy] = useState(false);
  const [actId, setActId] = useState<string | null>(null);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getPettyBoxes()).then((r) => setItems((r as { items: PettyBox[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(Number(flt) > 0)) { toast.error("أدخل الاسمَ والسقف (موجبًا)"); return; }
    setBusy(true);
    try {
      const { openPettyBox } = await import("@/lib/api/ledger");
      const r = await openPettyBox({ data: { name: name.trim(), floatAmount: Number(flt) } }) as { error?: string };
      if (queuedToast(r)) { setName(""); setFlt(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("فُتح الصندوقُ النثريّ"); setName(""); setFlt(""); await reload(); }
    } catch { toast.error("تعذّر الفتح"); } finally { setBusy(false); }
  };
  const spend = async (b: PettyBox) => {
    const raw = window.prompt(`مبلغُ المصروف من «${b.name}» (المتاح $${money(b.balance)}):`);
    if (raw == null) return;
    const amount = Number(raw);
    if (!(amount > 0)) { toast.error("أدخل مبلغًا موجبًا"); return; }
    const category = window.prompt("البند (قرطاسية، ضيافة…):") ?? "";
    setActId(b.id);
    try {
      const { pettyExpense } = await import("@/lib/api/ledger");
      const r = await pettyExpense({ data: { boxId: b.id, amount, category: category.trim() || undefined } }) as { error?: string };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`سُجِّل مصروفُ $${money(amount)}`); await reload(); }
    } catch { toast.error("تعذّر التسجيل"); } finally { setActId(null); }
  };
  const replenish = async (b: PettyBox) => {
    setActId(b.id);
    try {
      const { replenishPettyBox } = await import("@/lib/api/ledger");
      const r = await replenishPettyBox({ data: { boxId: b.id } }) as { toppedUp?: number };
      if (queuedToast(r)) return;
      toast.success(r.toppedUp ? `زُوِّد الصندوقُ بـ$${money(r.toppedUp)}` : "الصندوقُ ممتلئٌ — لا تزويد");
      await reload();
    } catch { toast.error("تعذّر التزويد"); } finally { setActId(null); }
  };
  const boxes = (items ?? []).filter((b) => b.status === "active");
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Wallet className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">الصناديقُ النثريّة</h2>
        {items && <span className="ms-auto rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">{boxes.length}</span>}
      </div>
      {canManage && (
        <form onSubmit={open} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <div className="min-w-0 flex-1"><Field label="اسمُ الصندوق"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="نثريّة المكتب…" /></Field></div>
          <div className="w-28"><Field label="السقف $"><TextField inputMode="decimal" value={flt} onChange={(e) => setFlt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} فتحُ صندوق</button>
        </form>
      )}
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : boxes.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا صناديقَ نثريّة.</p>
        : (
          <ul className="divide-y divide-line">
            {boxes.map((b) => {
              const pct = b.floatAmount > 0 ? Math.max(0, Math.min(100, (b.balance / b.floatAmount) * 100)) : 0;
              return (
                <li key={b.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{b.name}{b.custodianName && <span className="text-[11px] font-normal text-ink-faint"> · {b.custodianName}</span>}</p>
                      <p className="truncate text-[11px] text-ink-faint">صُرِف ${money(b.spent)} من سقفٍ ${money(b.floatAmount)}</p>
                    </div>
                    <div className="text-end"><span className="block font-mono-nums text-sm font-bold text-emerald-800">${money(b.balance)}</span><span className="text-[10px] text-ink-faint">المتاح</span></div>
                    {b.needsReplenish && <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold text-gold-700 ring-1 ring-gold-100">يحتاج تزويدًا</span>}
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => spend(b)} disabled={actId === b.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface disabled:opacity-60">صرف</button>
                        <button onClick={() => replenish(b)} disabled={actId === b.id} className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 disabled:opacity-60">{actId === b.id ? <Loader2 className="size-3 animate-spin" /> : "تزويد"}</button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", pct > 50 ? "bg-emerald-600" : pct > 25 ? "bg-gold-500" : "bg-danger")} style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

// الأصولُ الثابتةُ والإهلاك (المرحلة ٥): رسملةٌ ثمّ إهلاكٌ شهريٌّ بالقسط الثابت.
type FixedAsset = { id: string; name: string; cost: number; salvage: number; monthly: number; accumulated: number; netBookValue: number; usefulLifeMonths: number; startPeriod: string; status: string };
function FixedAssetsSection({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<FixedAsset[] | null>(null);
  const [name, setName] = useState(""); const [cost, setCost] = useState(""); const [life, setLife] = useState(""); const [salvage, setSalvage] = useState(""); const [start, setStart] = useState("");
  const [period, setPeriod] = useState(""); const [busy, setBusy] = useState(false); const [running, setRunning] = useState(false);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getFixedAssets()).then((r) => setItems((r as { items: FixedAsset[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(Number(cost) > 0) || !(Number(life) > 0)) { toast.error("أدخل الاسمَ والتكلفةَ والعمر"); return; }
    if (!/^\d{4}-\d{2}$/.test(start.trim())) { toast.error("شهرُ البدء بصيغة 1447-01"); return; }
    setBusy(true);
    try {
      const { capitalizeAsset } = await import("@/lib/api/ledger");
      const r = await capitalizeAsset({ data: { name: name.trim(), cost: Number(cost), usefulLifeMonths: Math.round(Number(life)), salvageValue: Number(salvage) || 0, startPeriod: start.trim() } }) as { error?: string };
      if (queuedToast(r)) { setName(""); setCost(""); setLife(""); setSalvage(""); setStart(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("رُسمِل الأصل"); setName(""); setCost(""); setLife(""); setSalvage(""); setStart(""); await reload(); }
    } catch { toast.error("تعذّرت الرسملة"); } finally { setBusy(false); }
  };
  const run = async () => {
    if (!/^\d{4}-\d{2}$/.test(period.trim())) { toast.error("أدخل فترةً بصيغة 1447-01"); return; }
    setRunning(true);
    try {
      const { runDepreciation } = await import("@/lib/api/ledger");
      const r = await runDepreciation({ data: { period: period.trim() } }) as { error?: string; count?: number; total?: number };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`أُهلِك ${r.count ?? 0} أصلًا بمجموع $${money(r.total ?? 0)}`); await reload(); }
    } catch { toast.error("تعذّر التشغيل"); } finally { setRunning(false); }
  };
  const dispose = async (a: FixedAsset) => {
    const raw = window.prompt(`استبعادُ «${a.name}» (قيمةٌ دفتريّة $${money(a.netBookValue)}). المتحصّلُ من البيع $ (اتركه 0 للخُردة):`, "0");
    if (raw == null) return;
    const proceeds = Number(raw);
    if (proceeds < 0 || Number.isNaN(proceeds)) { toast.error("أدخل مبلغًا غير سالب"); return; }
    try {
      const { disposeAsset } = await import("@/lib/api/ledger");
      const r = await disposeAsset({ data: { fixedAssetId: a.id, proceeds } }) as { error?: string; gain?: number; loss?: number };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(r.gain ? `استُبعد بمكسبٍ $${money(r.gain)}` : r.loss ? `استُبعد بخسارةٍ $${money(r.loss)}` : "استُبعد الأصل"); await reload(); }
    } catch { toast.error("تعذّر الاستبعاد"); }
  };
  const active = (items ?? []).filter((a) => a.status === "active");
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Calculator className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">الأصولُ الثابتةُ والإهلاك</h2>
        {items && <span className="ms-auto rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">{active.length}</span>}
      </div>
      {canManage && (
        <>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
            <div className="min-w-0 flex-1"><Field label="اسمُ الأصل"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="حاسوب، مركبة…" /></Field></div>
            <div className="w-24"><Field label="التكلفة $"><TextField inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="text-center font-mono-nums" /></Field></div>
            <div className="w-20"><Field label="العمر (شهر)"><TextField inputMode="numeric" value={life} onChange={(e) => setLife(e.target.value)} className="text-center font-mono-nums" /></Field></div>
            <div className="w-24"><Field label="المتبقّية $"><TextField inputMode="decimal" value={salvage} onChange={(e) => setSalvage(e.target.value)} placeholder="0" className="text-center font-mono-nums" /></Field></div>
            <div className="w-24"><Field label="بدءُ الإهلاك"><TextField value={start} onChange={(e) => setStart(e.target.value)} placeholder="1447-01" className="text-center font-mono-nums" /></Field></div>
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} رسملة</button>
          </form>
          <div className="flex flex-wrap items-end gap-2 border-b border-line bg-surface-2/40 p-4">
            <div className="w-28"><Field label="إهلاكُ شهر"><TextField value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="1447-01" className="text-center font-mono-nums" /></Field></div>
            <button onClick={run} disabled={running} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold-600 px-4 text-sm font-semibold text-white ring-1 ring-gold-700/30 transition hover:bg-gold-700 disabled:opacity-60">{running ? <Loader2 className="size-4 animate-spin" /> : "تشغيلُ إهلاك الشهر"}</button>
            <p className="text-[11px] text-ink-faint">يُهلِك كلَّ الأصول النشطة للفترة (idempotent — تكرارُ الفترة آمن).</p>
          </div>
        </>
      )}
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : active.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا أصولَ ثابتةً مرسمَلة.</p>
        : (
          <ul className="divide-y divide-line">
            {active.map((a) => {
              const pct = a.cost > 0 ? Math.max(0, Math.min(100, (a.netBookValue / a.cost) * 100)) : 0;
              return (
                <li key={a.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                      <p className="truncate text-[11px] text-ink-faint">تكلفة ${money(a.cost)} · قسطٌ شهريّ ${money(a.monthly)} · مجمّعٌ ${money(a.accumulated)}</p>
                    </div>
                    <div className="text-end"><span className="block font-mono-nums text-sm font-bold text-emerald-800">${money(a.netBookValue)}</span><span className="text-[10px] text-ink-faint">القيمةُ الدفتريّة</span></div>
                    {canManage && <button onClick={() => dispose(a)} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-danger-bg hover:text-danger">استبعاد</button>}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

// ===== د٣ (الوثيقة ٢٨): التصديرُ الشامل — مصنّفٌ واحدٌ بـ١٩ ورقةً عربيّةً RTL، بمرشّح فترة =====
function ExcelExportButton({ months }: { months: string[] }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const years = [...new Set(months.map((m) => m.split("-")[0]))];
  const options = [
    { value: "__all__", label: "كلُّ الفترات" },
    ...years.map((y) => ({ value: y, label: `سنة ${y}هـ` })),
    ...months.map((m) => ({ value: m, label: hijriLabel(m) })),
  ];
  const run = async () => {
    setBusy(true);
    try {
      const p = period === "__all__" ? "" : period;
      const { getFinanceWorkbook } = await import("@/lib/api/ledger");
      const data = await getFinanceWorkbook({ data: { period: p || undefined } });
      const { buildFinanceWorkbook, downloadBlob } = await import("@/lib/excel/financeWorkbook");
      const blob = await buildFinanceWorkbook(data);
      downloadBlob(blob, `مشكاة-المالية-${p || "الكل"}.xlsx`);
      toast.success("صُدّر المصنّفُ الشامل", { description: "١٩ ورقةً عربيّةً — أرقامُها تطابق الشاشةَ بالسنت" });
      setOpen(false);
    } catch (e) { toast.error("تعذّر التصدير", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50">
        <FileSpreadsheet className="size-4" strokeWidth={1.75} /> تصدير Excel شامل
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-30 w-64 rounded-2xl bg-surface p-3 shadow-soft ring-1 ring-line">
          <p className="mb-2 text-xs font-semibold text-ink-soft">فترةُ التصدير</p>
          <MSelect value={period || "__all__"} onValueChange={setPeriod} options={options} aria-label="فترة التصدير" />
          <button onClick={run} disabled={busy}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} توليدُ المصنّف (١٩ ورقة)
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">يُولَّد في متصفّحك — لا يغادر الملفُّ جهازَك إلى أيّ خادم.</p>
        </div>
      )}
    </div>
  );
}

// ===== د٤ (الوثيقة ٢٨): الاستيرادُ بالقوالب — تنزيلُ قالب ⇒ رفعٌ ⇒ معاينةٌ ⇒ تأكيدٌ (يمرّ بالاعتماد) =====
type TplSpec = { kind: string; label: string; columns: Array<{ key: string; label: string; required?: boolean; list?: string }> };
type ImpErr = { row: number; error: string };
type ImpBatch = { id: string; kind: string; filename: string | null; rowCount: number; totalUsd: number; status: string; executedRows: number; error: string | null };
function ImportSection({ onChanged }: { onChanged: () => void }) {
  const [spec, setSpec] = useState<{ kinds: TplSpec[]; lists: Record<string, string[]> } | null>(null);
  const [kind, setKind] = useState("donations");
  const [busy, setBusy] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: Array<Record<string, unknown>>; count: number; totalUsd: number } | null>(null);
  const [errors, setErrors] = useState<ImpErr[] | null>(null);
  const [batches, setBatches] = useState<ImpBatch[] | null>(null);
  const loadSpec = () => import("@/lib/api/ledger").then((m) => m.getImportTemplateSpec()).then((r) => setSpec(r as never)).catch(() => setSpec(null));
  const loadBatches = () => import("@/lib/api/ledger").then((m) => m.getImportBatches()).then((r) => setBatches((r as { items: ImpBatch[] }).items)).catch(() => {});
  useEffect(() => { void loadSpec(); void loadBatches(); }, []);
  const current = spec?.kinds.find((k) => k.kind === kind);

  const downloadTemplate = async () => {
    if (!current || !spec) return;
    setBusy("tpl");
    try {
      const { buildImportTemplate } = await import("@/lib/excel/importTemplates");
      const { downloadBlob } = await import("@/lib/excel/financeWorkbook");
      const blob = await buildImportTemplate(current, spec.lists as never);
      downloadBlob(blob, `قالب-${current.label}.xlsx`);
    } catch (e) { toast.error("تعذّر توليدُ القالب", { description: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const onFile = async (f: File | null) => {
    setFile(f); setPreview(null); setErrors(null);
    if (!f) return;
    setBusy("parse");
    try {
      const { parseImportFile } = await import("@/lib/excel/importTemplates");
      const parsed = await parseImportFile(f);
      if ("error" in parsed) { toast.error(parsed.error); setFile(null); return; }
      const m = await import("@/lib/api/ledger");
      const v = await m.validateImport({ data: { kind, rows: parsed.rows } }) as { ok: boolean; count?: number; totalUsd?: number; errors?: ImpErr[] };
      if (v.ok) { setPreview({ rows: parsed.rows, count: v.count ?? parsed.rows.length, totalUsd: v.totalUsd ?? 0 }); setErrors(null); }
      else { setErrors(v.errors ?? []); setPreview(null); }
    } catch (e) { toast.error("تعذّر التحليل", { description: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const downloadErrors = async () => {
    if (!errors || !current) return;
    const { buildErrorSheet } = await import("@/lib/excel/importTemplates");
    const { downloadBlob } = await import("@/lib/excel/financeWorkbook");
    downloadBlob(await buildErrorSheet(current.label, errors), `أخطاء-${current.label}.xlsx`);
  };

  const confirm = async () => {
    if (!preview || !file) return;
    setBusy("submit");
    try {
      const m = await import("@/lib/api/ledger");
      const r = await m.submitImport({ data: { kind, rows: preview.rows, filename: file.name } }) as { ok?: boolean; error?: string; errors?: ImpErr[]; queued?: boolean };
      if (r?.error) { toast.error(r.error); if (r.errors) setErrors(r.errors); return; }
      if (queuedToast(r)) { /* اعتراضُ المحرّك: بانتظار المدير */ }
      else { toast.success("نُفِّذ الاستيرادُ بالكامل", { description: `${preview.count} صفًّا` }); onChanged(); }
      setFile(null); setPreview(null); await loadBatches();
    } catch (e) { toast.error("تعذّر الاستيراد", { description: (e as Error).message }); }
    finally { setBusy(null); }
  };

  if (!spec) return null;
  const B_LBL: Record<string, string> = { pending: "بانتظار الاعتماد", executing: "قيدُ التنفيذ", done: "منفَّذة", failed: "متوقّفة" };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <FileSpreadsheet className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">الاستيرادُ من Excel (بالقوالب المعتمدة)</h2>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-b border-line p-4">
        <div className="w-44"><Field label="نوعُ القالب"><MSelect value={kind} onValueChange={(v) => { setKind(v); setFile(null); setPreview(null); setErrors(null); }} options={spec.kinds.map((k) => ({ value: k.kind, label: k.label }))} /></Field></div>
        <button onClick={downloadTemplate} disabled={busy === "tpl"} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50 disabled:opacity-60">
          {busy === "tpl" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} تنزيلُ القالب
        </button>
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
          {busy === "parse" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} رفعُ ملفٍّ مملوء
          <input type="file" accept=".xlsx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </label>
        <p className="text-[11px] text-ink-faint">الحدُّ ٥٠٠ صفًّا / 2MB — يُدقَّق الملفُّ كاملًا: أيُّ خطأٍ يوقفه (الكلُّ أو لا شيء).</p>
      </div>
      {errors && (
        <div className="border-b border-line bg-danger-bg/40 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-danger">{errors.length} خطأً — لم يُقبل الملفّ</p>
            <button onClick={downloadErrors} className="ms-auto rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger-bg">تنزيلُ ورقة الأخطاء</button>
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {errors.slice(0, 30).map((e, i) => <li key={i} className="text-[11px] text-danger">الصفّ {e.row}: {e.error}</li>)}
            {errors.length > 30 && <li className="text-[11px] text-ink-faint">… و{errors.length - 30} أخرى في ورقة الأخطاء</li>}
          </ul>
        </div>
      )}
      {preview && (
        <div className="border-b border-line bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-800">✓ الملفُّ سليم: {preview.count} صفًّا{preview.totalUsd ? ` بإجماليّ $${money(preview.totalUsd)}` : ""} — {file?.name}</p>
          <button onClick={confirm} disabled={busy === "submit"} className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">
            {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} تأكيدُ الاستيراد
          </button>
        </div>
      )}
      {batches && batches.length > 0 && (
        <ul className="divide-y divide-line">
          {batches.slice(0, 6).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{spec.kinds.find((k) => k.kind === b.kind)?.label ?? b.kind} · {b.filename ?? "—"} · {b.executedRows}/{b.rowCount} صفًّا</p>
                {b.error && <p className="truncate text-[11px] text-danger">{b.error}</p>}
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                b.status === "done" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : b.status === "failed" ? "bg-danger-bg text-danger ring-danger/20" : "bg-gold-50 text-gold-700 ring-gold-100")}>{B_LBL[b.status] ?? b.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ===== محرّكُ الاعتماد الثنائيّ (الوثيقة ٢٨): صندوقُ اعتماد المدير + «مقترحاتي» للمسؤول الماليّ =====
type FinAction = { id: string; kind: string; kindLabel: string; summary: string; amountUsd: number; status: string; proposedByName: string; proposedAt: number; decidedByName: string | null; rejectReason: string | null; error: string | null };
type PvLine = { accountId: string; accountName: string; fundName: string; debit: number; credit: number };

// معاينةُ أثرِ الدفتر داخل بطاقة الاقتراح — المديرُ يرى القيدَ قبل أن يعتمد
function ActionPreview({ actionId }: { actionId: string }) {
  const [lines, setLines] = useState<PvLine[] | null>(null);
  useEffect(() => { import("@/lib/api/ledger").then((m) => m.previewFinanceAction({ data: { actionId } })).then((r) => setLines((r as { lines: PvLine[] }).lines)).catch(() => setLines([])); }, [actionId]);
  if (lines === null) return <div className="py-2 text-center"><Loader2 className="mx-auto size-3.5 animate-spin text-ink-faint" /></div>;
  if (!lines.length) return <p className="py-1 text-[11px] text-ink-faint">لا أثرَ مباشرًا على الدفتر (إعدادٌ/بيانات).</p>;
  return (
    <table className="w-full text-[11px]">
      <thead><tr className="text-ink-faint"><th className="pb-1 text-start font-medium">الحساب</th><th className="pb-1 text-start font-medium">الصندوق</th><th className="pb-1 text-end font-medium">مدين</th><th className="pb-1 text-end font-medium">دائن</th></tr></thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-t border-line/60">
            <td className="py-1 text-ink">{l.accountName}</td>
            <td className="py-1 text-ink-soft">{l.fundName}</td>
            <td className="py-1 text-end font-mono-nums text-emerald-800">{l.debit ? `$${money(l.debit)}` : "—"}</td>
            <td className="py-1 text-end font-mono-nums text-danger">{l.credit ? `$${money(l.credit)}` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// صندوقُ الاعتماد الماليّ (للمدير): كلُّ اقتراحات المسؤول الماليّ المعلّقة + الفاشلة — قرارٌ على بصيرةٍ بمعاينة القيد.
function ApprovalInbox({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<FinAction[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = async () => {
    try {
      const m = await import("@/lib/api/ledger");
      const [pending, failed] = await Promise.all([
        m.getFinanceActions({ data: { status: "pending" } }), m.getFinanceActions({ data: { status: "failed" } }),
      ]);
      setItems([...(pending as { items: FinAction[] }).items, ...(failed as { items: FinAction[] }).items]);
    } catch { setItems([]); }
  };
  useEffect(() => { void reload(); }, []);
  const decide = async (a: FinAction, approve: boolean) => {
    let reason = "";
    if (!approve) { reason = window.prompt("سببُ الرفض (إلزاميّ):") ?? ""; if (!reason.trim()) return; }
    setBusy(a.id);
    try {
      const m = await import("@/lib/api/ledger");
      const r = await m.decideFinanceAction({ data: { actionId: a.id, approve, reason } }) as { error?: string; status?: string };
      if (r?.error) toast.error(r.error);
      else if (r.status === "executed") { toast.success("اعتُمد ونُفِّذ", { description: a.summary }); await reload(); onChanged(); }
      else if (r.status === "failed") { toast.error("اعتُمد لكنّ التنفيذَ فشل — راجع السبب في الصندوق"); await reload(); }
      else { toast.success("رُفض الاقتراحُ وأُبلغ صاحبُه"); await reload(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(null); }
  };
  const retry = async (a: FinAction) => {
    setBusy(a.id);
    try {
      const m = await import("@/lib/api/ledger");
      const r = await m.retryFinanceAction({ data: { actionId: a.id } }) as { error?: string; status?: string };
      if (r?.error) toast.error(r.error);
      else if (r.status === "executed") { toast.success("نُفِّذ بنجاح"); await reload(); onChanged(); }
      else { toast.error("ما يزال يفشل — راجع السبب"); await reload(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(null); }
  };
  if (!items || items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl bg-gold-50/40 ring-2 ring-gold-200">
      <div className="flex items-center gap-2 border-b border-gold-200 bg-gold-50 px-4 py-2.5">
        <Clock className="size-4 text-gold-700" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">صندوقُ الاعتماد الماليّ</h2>
        <span className="ms-auto rounded-full bg-gold-100 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-200">{items.length}</span>
      </div>
      <ul className="divide-y divide-gold-100">
        {items.map((a) => (
          <li key={a.id} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium text-ink">{a.summary}</p>
                <p className="truncate text-[11px] text-ink-faint">{a.kindLabel} · اقترحه {a.proposedByName}{a.status === "failed" ? ` · ⚠️ فشل التنفيذ: ${a.error}` : ""}</p>
              </button>
              {a.amountUsd > 0 && <span className="font-mono-nums text-sm font-bold text-emerald-800">${money(a.amountUsd)}</span>}
              {a.status === "pending" ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => decide(a, true)} disabled={busy === a.id} className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 disabled:opacity-60">{busy === a.id ? <Loader2 className="size-3 animate-spin" /> : "اعتماد"}</button>
                  <button onClick={() => decide(a, false)} disabled={busy === a.id} className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-danger/30 transition hover:bg-danger-bg disabled:opacity-60">لا يُعتمد</button>
                </div>
              ) : (
                <button onClick={() => retry(a)} disabled={busy === a.id} className="rounded-lg bg-gold-600 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-gold-700/30 transition hover:bg-gold-700 disabled:opacity-60">{busy === a.id ? <Loader2 className="size-3 animate-spin" /> : "إعادةُ المحاولة"}</button>
              )}
            </div>
            {open === a.id && (
              <div className="mt-2 rounded-xl bg-surface p-3 ring-1 ring-line">
                <p className="mb-1.5 text-[11px] font-semibold text-ink-soft">معاينةُ أثر الدفتر (القيدُ الذي سيُرحَّل):</p>
                <ActionPreview actionId={a.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// «مقترحاتي» (للمسؤول الماليّ): المعلّق (يُلغى) + المرفوض (بسببه) + آخرُ المنفَّذ.
function MyProposals() {
  const [items, setItems] = useState<FinAction[] | null>(null);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getFinanceActions({ data: { mine: true } })).then((r) => setItems((r as { items: FinAction[] }).items)).catch(() => setItems([]));
  useEffect(() => {
    void reload();
    const h = () => void reload(); // تحديثٌ فوريّ عند queuedToast
    window.addEventListener("fin-action-queued", h);
    return () => window.removeEventListener("fin-action-queued", h);
  }, []);
  const cancel = async (id: string) => {
    try {
      const m = await import("@/lib/api/ledger");
      const r = await m.cancelFinanceAction({ data: { actionId: id } }) as { error?: string };
      if (r?.error) toast.error(r.error); else { toast.success("أُلغي الاقتراح"); await reload(); }
    } catch { toast.error("تعذّر"); }
  };
  if (!items || items.length === 0) return null;
  const STATUS_LBL: Record<string, { l: string; cls: string }> = {
    pending: { l: "بانتظار الاعتماد", cls: "bg-gold-50 text-gold-700 ring-gold-100" },
    executed: { l: "اعتُمد ونُفِّذ", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    rejected: { l: "مرفوض", cls: "bg-danger-bg text-danger ring-danger/20" },
    approved: { l: "معتمَد", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    failed: { l: "فشل التنفيذ", cls: "bg-danger-bg text-danger ring-danger/20" },
    cancelled: { l: "مُلغى", cls: "bg-surface-2 text-ink-faint ring-line" },
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Info className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">مقترحاتي الماليّة</h2>
        <span className="ms-auto font-mono-nums text-[11px] text-ink-faint">{items.length}</span>
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {items.map((a) => {
          const st = STATUS_LBL[a.status] ?? { l: a.status, cls: "bg-surface-2 text-ink-soft ring-line" };
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{a.summary}</p>
                {a.rejectReason && <p className="truncate text-[11px] text-danger">سببُ الرفض: {a.rejectReason}</p>}
                {a.error && <p className="truncate text-[11px] text-danger">خطأُ التنفيذ: {a.error}</p>}
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", st.cls)}>{st.l}</span>
              {a.status === "pending" && <button onClick={() => cancel(a.id)} className="shrink-0 rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line hover:text-danger">إلغاء</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// المطابقةُ البنكيّة/النقديّة: وسمُ قيودِ حسابٍ بأنّها ظهرت في كشف البنك/الجرد.
type ReconData = { accountId: string; entries: Array<{ entryId: string; date: number; memo: string | null; amount: number; reconciled: boolean }>; summary: { bookBalance: number; cleared: number; uncleared: number; unclearedCount: number } };
const RECON_ACCOUNTS = [{ value: "1110", label: "الصندوق النقديّ ($)" }, { value: "1120", label: "الحساب البنكيّ" }, { value: "1115", label: "نقد (ل.س)" }, { value: "1116", label: "نقد (₺)" }];
function ReconciliationSection({ canManage }: { canManage: boolean }) {
  const [acc, setAcc] = useState("1120");
  const [data, setData] = useState<ReconData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = (a: string) => import("@/lib/api/ledger").then((m) => m.getReconciliation({ data: { accountId: a } })).then((r) => setData(r as ReconData)).catch(() => setData(null));
  useEffect(() => { void reload(acc); }, [acc]);
  const toggle = async (entryId: string, reconciled: boolean) => {
    setBusy(entryId);
    try { const { setReconciled } = await import("@/lib/api/ledger"); await setReconciled({ data: { entryId, accountId: acc, reconciled } }); await reload(acc); }
    catch { toast.error("تعذّر"); } finally { setBusy(null); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <CheckCircle2 className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">المطابقةُ البنكيّة/النقديّة</h2>
        <div className="ms-auto w-40"><MSelect value={acc} onValueChange={setAcc} options={RECON_ACCOUNTS} /></div>
      </div>
      {!data ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-2 border-b border-line p-4 text-center text-xs">
            <div><div className="text-ink-faint">رصيدُ الدفتر</div><div className="font-mono-nums text-sm font-bold text-ink">${money(data.summary.bookBalance)}</div></div>
            <div><div className="text-ink-faint">مُطابَق</div><div className="font-mono-nums text-sm font-bold text-emerald-700">${money(data.summary.cleared)}</div></div>
            <div><div className="text-ink-faint">غيرُ مطابَق ({data.summary.unclearedCount})</div><div className="font-mono-nums text-sm font-bold text-gold-700">${money(data.summary.uncleared)}</div></div>
          </div>
          {data.entries.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا حركاتٍ على هذا الحساب.</p> : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {data.entries.map((e) => (
                <li key={e.entryId} className="flex items-center gap-3 px-4 py-2">
                  <button onClick={() => canManage && toggle(e.entryId, !e.reconciled)} disabled={!canManage || busy === e.entryId} aria-label="تبديل المطابقة"
                    className={cn("grid size-5 shrink-0 place-items-center rounded-md ring-1 transition", e.reconciled ? "bg-emerald-600 text-white ring-emerald-700" : "bg-surface-2 text-transparent ring-line hover:ring-emerald-400", !canManage && "cursor-default")}>
                    {busy === e.entryId ? <Loader2 className="size-3 animate-spin text-ink-faint" /> : <CheckCircle2 className="size-3.5" />}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{e.memo || "قيد"}</span>
                  <span className={cn("font-mono-nums text-xs font-semibold", e.amount >= 0 ? "text-emerald-700" : "text-danger")}>{e.amount >= 0 ? "+" : "−"}${money(Math.abs(e.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// تعدّدُ العملات: أرصدةٌ لكلّ عملة + ضبطُ الأسعار + التصريف (تحويلُ عملةٍ لأخرى مع مكسب/خسارة).
type Cur = { code: string; name: string; symbol: string; isBase: boolean; cashAccount: string; rate: number };
type CurBal = { code: string; name: string; symbol: string; isBase: boolean; native: number; usdValue: number; rate: number };
function CurrencySection({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<{ list: Cur[]; balances: CurBal[] } | null>(null);
  const [rateCur, setRateCur] = useState(""); const [rate, setRate] = useState(""); const [busy, setBusy] = useState(false);
  const [fromCur, setFromCur] = useState(""); const [fromAmt, setFromAmt] = useState(""); const [toCur, setToCur] = useState("USD"); const [toAmt, setToAmt] = useState(""); const [xBusy, setXBusy] = useState(false);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getCurrencies()).then((r) => { const d = r as { list: Cur[]; balances: CurBal[] }; setData(d); const foreign = d.list.find((c) => !c.isBase); if (foreign && !rateCur) setRateCur(foreign.code); if (foreign && !fromCur) setFromCur(foreign.code); }).catch(() => setData({ list: [], balances: [] }));
  useEffect(() => { void reload(); }, []);
  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateCur || !(Number(rate) > 0)) { toast.error("اختر العملةَ وأدخل سعرًا موجبًا"); return; }
    setBusy(true);
    try {
      const { setRate: sr } = await import("@/lib/api/ledger");
      const r = await sr({ data: { currency: rateCur, rateToBase: Number(rate) } }) as { error?: string };
      if (queuedToast(r)) { setRate(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("حُدّث السعر"); setRate(""); await reload(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(false); }
  };
  const exchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCur || !toCur || fromCur === toCur) { toast.error("اختر عملتين مختلفتين"); return; }
    if (!(Number(fromAmt) > 0) || !(Number(toAmt) > 0)) { toast.error("أدخل المبلغين"); return; }
    setXBusy(true);
    try {
      const { recordExchange } = await import("@/lib/api/ledger");
      const r = await recordExchange({ data: { fromCurrency: fromCur, fromAmount: Number(fromAmt), toCurrency: toCur, toAmount: Number(toAmt) } }) as { error?: string; gain?: number; loss?: number };
      if (queuedToast(r)) { setFromAmt(""); setToAmt(""); return; }
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(r.gain ? `تمّ التصريف (مكسب $${money(r.gain)})` : r.loss ? `تمّ التصريف (خسارة $${money(r.loss)})` : "تمّ التصريف"); setFromAmt(""); setToAmt(""); await reload(); }
    } catch { toast.error("تعذّر التصريف"); } finally { setXBusy(false); }
  };
  if (!data) return null;
  const foreignCurs = data.list.filter((c) => !c.isBase);
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <ArrowRightLeft className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">العملاتُ والتصريف</h2>
      </div>
      {/* أرصدةُ العملات */}
      <div className="grid gap-2 p-4 sm:grid-cols-3">
        {data.balances.map((b) => (
          <div key={b.code} className="rounded-lg bg-surface-2/50 p-2.5 text-xs">
            <div className="flex items-center justify-between font-semibold text-ink"><span>{b.name} <span className="text-ink-faint">{b.symbol}</span></span>{b.isBase && <span className="rounded-full bg-emerald-50 px-1.5 text-[9px] text-emerald-700">أساس</span>}</div>
            <div className="mt-1 font-mono-nums text-sm font-bold text-emerald-800">{b.native.toLocaleString()} {b.symbol}</div>
            <div className="font-mono-nums text-[11px] text-ink-faint">≈ ${money(b.usdValue)}{!b.isBase && b.rate > 0 ? ` · سعر ${b.rate}` : !b.isBase ? " · لا سعر" : ""}</div>
          </div>
        ))}
      </div>
      {canManage && foreignCurs.length > 0 && (
        <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2">
          {/* ضبطُ سعرِ الصرف */}
          <form onSubmit={saveRate} className="rounded-xl bg-surface-2/50 p-3">
            <p className="mb-2 text-[11px] font-semibold text-ink-soft">سعرُ الصرف (كم دولارًا تساوي وحدةٌ واحدة)</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-28"><Field label="العملة"><MSelect value={rateCur} onValueChange={setRateCur} options={foreignCurs.map((c) => ({ value: c.code, label: `${c.name} (${c.symbol})` }))} /></Field></div>
              <div className="w-28"><Field label="السعر بالدولار"><TextField inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.0001" className="text-center font-mono-nums" /></Field></div>
              <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}</button>
            </div>
          </form>
          {/* التصريف */}
          <form onSubmit={exchange} className="rounded-xl bg-gold-50/40 p-3 ring-1 ring-gold-100">
            <p className="mb-2 text-[11px] font-semibold text-gold-700">تصريفٌ (أعطِ عملةً وخُذ أخرى)</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-24"><Field label="من"><MSelect value={fromCur} onValueChange={setFromCur} options={data.list.map((c) => ({ value: c.code, label: c.symbol }))} /></Field></div>
              <div className="w-24"><Field label="مبلغ"><TextField inputMode="decimal" value={fromAmt} onChange={(e) => setFromAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
              <div className="w-24"><Field label="إلى"><MSelect value={toCur} onValueChange={setToCur} options={data.list.map((c) => ({ value: c.code, label: c.symbol }))} /></Field></div>
              <div className="w-24"><Field label="مبلغ"><TextField inputMode="decimal" value={toAmt} onChange={(e) => setToAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
              <button type="submit" disabled={xBusy} className="inline-flex h-10 items-center gap-1 rounded-xl bg-gold-600 px-3 text-xs font-semibold text-white ring-1 ring-gold-700/30 hover:bg-gold-700 disabled:opacity-60">{xBusy ? <Loader2 className="size-4 animate-spin" /> : "تصريف"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// دفعاتُ الصرف المجمّعة (المرحلة ٣): تجميعُ مستحقّي الصرف في دفعةٍ تُصرَف بقيدٍ واحدٍ + كشفُ صرفٍ للطباعة.
type Batch = { id: string; title: string; period: string | null; status: string; total: number; count: number; createdAt: number; paidAt: number | null };
type BatchDetail = { id: string; title: string; period: string | null; status: string; total: number; items: Array<{ id: string; personName: string; amount: number; note: string | null }>; paidAt: number | null };
function printDisbursement(b: BatchDetail) {
  const rows = b.items.map((it, i) => `<tr><td>${i + 1}</td><td class="n">${escapeHtml(it.personName)}</td><td class="b">$${money(it.amount)}</td><td class="sig"></td></tr>`).join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف صرف — ${escapeHtml(b.title)}</title>
    <style>body{font-family:'IBM Plex Sans Arabic',system-ui;padding:1.5rem;color:#1a2e28}h1{font-size:1.15rem;color:#14532d;margin:0}.sub{font-size:.8rem;color:#555}
    table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:1rem}th,td{border:1px solid #9ca3af;padding:.45rem .6rem;text-align:center}th{background:#ecfdf5;color:#14532d}td.n{text-align:right}td.b{font-weight:700}td.sig{width:6rem}tfoot td{background:#fafaf5;font-weight:700}
    .head{border-bottom:3px double #14532d;padding-bottom:.6rem;display:flex;justify-content:space-between;align-items:center}</style></head><body>
    <div class="head"><div><h1>كشفُ صرفِ دفعة</h1><div class="sub">${escapeHtml(b.title)}${b.period ? ` · ${escapeHtml(b.period)}هـ` : ""} · ${b.status === "paid" ? "مصروفة" : "مسودّة"}</div></div><div class="sub">مِشكاة — منظومة المسجد المؤثر</div></div>
    <table><thead><tr><th>#</th><th>المستفيد</th><th>المبلغ</th><th>التوقيع</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2" class="n">الإجماليّ (${b.items.length} مستفيدًا)</td><td class="b">$${money(b.total)}</td><td></td></tr></tfoot></table>
    <div style="display:flex;justify-content:space-between;margin-top:2.5rem;font-size:.8rem"><span>أمينُ الصندوق: ــــــــــــ</span><span>المعتمِد: ــــــــــــ</span></div>
    <button onclick="print()" style="margin-top:1rem;padding:.5rem 1.5rem">طباعة / حفظ PDF</button></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function PaymentBatchesSection({ canEnter, canPay }: { canEnter: boolean; canPay: boolean }) {
  const [items, setItems] = useState<Batch[] | null>(null);
  const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const reload = () => import("@/lib/api/ledger").then((m) => m.getBatches()).then((r) => setItems((r as { items: Batch[] }).items)).catch(() => setItems([]));
  useEffect(() => { void reload(); }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("أدخل عنوانَ الدفعة"); return; }
    setBusy(true);
    try {
      const { createBatch } = await import("@/lib/api/ledger");
      const r = await createBatch({ data: { title: title.trim() } }) as { error?: string; id?: string };
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("أُنشئت الدفعة"); setTitle(""); await reload(); if (r.id) setOpenId(r.id); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <Banknote className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">دفعاتُ الصرف المجمّعة</h2>
        {items && <span className="ms-auto rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-gold-700 ring-1 ring-gold-100">{items.length}</span>}
      </div>
      {canEnter && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <div className="min-w-0 flex-1"><Field label="عنوانُ الدفعة"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="رواتب رجب ١٤٤٧…" /></Field></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} دفعةٌ جديدة</button>
        </form>
      )}
      {!items ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-ink-faint" /></div>
        : items.length === 0 ? <p className="py-6 text-center text-sm text-ink-soft">لا دفعاتِ صرف.</p>
        : (
          <ul className="divide-y divide-line">
            {items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{b.title}</p>
                  <p className="truncate text-[11px] text-ink-faint">{b.count} مستفيدًا · {b.status === "paid" ? "مصروفة" : "مسودّة"}</p>
                </div>
                <span className="font-mono-nums text-sm font-bold text-emerald-800">${money(b.total)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", b.status === "paid" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-gold-50 text-gold-700 ring-gold-100")}>{b.status === "paid" ? "مصروفة" : "مسودّة"}</span>
                <button onClick={() => setOpenId(b.id)} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface">فتح</button>
              </li>
            ))}
          </ul>
        )}
      {openId && <BatchModal batchId={openId} canEnter={canEnter} canPay={canPay} onClose={() => setOpenId(null)} onChanged={reload} />}
    </section>
  );
}
function BatchModal({ batchId, canEnter, canPay, onClose, onChanged }: { batchId: string; canEnter: boolean; canPay: boolean; onClose: () => void; onChanged: () => void }) {
  const [b, setB] = useState<BatchDetail | null>(null);
  const [name, setName] = useState(""); const [amt, setAmt] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => import("@/lib/api/ledger").then((m) => m.getBatchDetail({ data: { batchId } })).then((r) => setB(r as BatchDetail)).catch(() => onClose());
  useEffect(() => { void load(); }, [batchId]);
  const open = b?.status === "open";
  const add = async () => {
    if (!name.trim() || !(Number(amt) > 0)) { toast.error("أدخل الاسمَ والمبلغ"); return; }
    setBusy(true);
    try {
      const { addBatchItem } = await import("@/lib/api/ledger");
      const r = await addBatchItem({ data: { batchId, personName: name.trim(), amount: Number(amt) } }) as { error?: string };
      if (r && "error" in r && r.error) toast.error(r.error);
      else { setName(""); setAmt(""); await load(); onChanged(); }
    } catch { toast.error("تعذّر"); } finally { setBusy(false); }
  };
  const remove = async (itemId: string) => {
    try { const { removeBatchItem } = await import("@/lib/api/ledger"); await removeBatchItem({ data: { itemId } }); await load(); onChanged(); } catch { toast.error("تعذّر"); }
  };
  const pay = async () => {
    if (!window.confirm(`صرفُ الدفعة «${b?.title}» بإجماليّ $${money(b?.total ?? 0)}؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    try {
      const { payBatch } = await import("@/lib/api/ledger");
      const r = await payBatch({ data: { batchId } }) as { error?: string; total?: number };
      if (queuedToast(r)) return;
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`صُرفت الدفعةُ ($${money(r.total ?? 0)})`); await load(); onChanged(); }
    } catch { toast.error("تعذّر الصرف"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-ink">{b?.title ?? "دفعة"} {b && <span className="text-[11px] font-normal text-ink-faint">· {b.status === "paid" ? "مصروفة" : "مسودّة"}</span>}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-ink-faint ring-1 ring-line hover:bg-surface-2"><X className="size-3.5" /></button>
        </div>
        {!b ? <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div> : (
          <div className="space-y-3 p-4">
            {b.items.length === 0 ? <p className="text-center text-xs text-ink-soft">لا بنودَ بعد.</p> : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {b.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-1.5 text-xs">
                    <span className="truncate text-ink">{it.personName}</span>
                    <span className="flex items-center gap-2"><span className="font-mono-nums font-semibold text-emerald-800">${money(it.amount)}</span>{open && canEnter && <button onClick={() => remove(it.id)} aria-label="حذف" className="text-ink-faint hover:text-danger"><X className="size-3" /></button>}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-sm font-bold text-emerald-800"><span>الإجماليّ ({b.items.length})</span><span className="font-mono-nums">${money(b.total)}</span></div>
            {open && canEnter && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/50 p-3">
                <div className="min-w-0 flex-1"><Field label="المستفيد"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمُ المستفيد" /></Field></div>
                <div className="w-20"><Field label="$"><TextField inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="text-center font-mono-nums" /></Field></div>
                <button onClick={add} disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 hover:bg-emerald-900 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => printDisbursement(b)} className="flex-1 rounded-xl bg-surface-2 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface">كشفٌ للطباعة</button>
              {open && canPay && <button onClick={pay} disabled={busy || b.items.length === 0} className="flex-1 rounded-xl bg-emerald-700 py-2 text-xs font-semibold text-white ring-1 ring-emerald-900/30 hover:bg-emerald-800 disabled:opacity-60">صرفُ الدفعة</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Incentive = { id: string; name: string; month: string; reason: string | null; amount: number };
function IncentivesSection({ month }: { month: string | null }) {
  const [items, setItems] = useState<Incentive[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const r = await getIncentives({ data: { month: month ?? undefined } }) as { total: number; items: Incentive[] }; setItems(r.items); setTotal(r.total); }
    catch { /* غير إداري — تبقى فارغة */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [month]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("مبلغ غير صالح"); return; }
    if (!month) { toast.error("اختر الشهر أولاً"); return; }
    setAdding(true);
    try { await addIncentive({ data: { recipientName: name.trim(), month, amount: amt, reason: reason.trim() || undefined } }); toast.success("أُضيف الحافز"); setName(""); setAmount(""); setReason(""); await load(); }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const del = async (id: string) => {
    try { await removeIncentive({ data: { id } }); await load(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <div className="flex items-center gap-2"><Gift className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">الحوافز التشغيلية</h3><span className="text-[11px] text-ink-faint">{hijriLabel(month)}</span></div>
        <span className="font-mono-nums text-xs font-semibold text-emerald-800">{money(total)}$</span>
      </div>
      <form onSubmit={add} className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_7rem_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المستفيد…" className="h-10 rounded-xl bg-surface px-3 text-sm text-ink ring-1 ring-line transition focus:outline-none focus:ring-2 focus:ring-emerald-700/40" />
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ$" dir="ltr" className="h-10 rounded-xl bg-surface px-3 text-center text-sm text-ink ring-1 ring-line transition focus:outline-none focus:ring-2 focus:ring-emerald-700/40" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (اختياري)…" className="h-10 rounded-xl bg-surface px-3 text-sm text-ink ring-1 ring-line transition focus:outline-none focus:ring-2 focus:ring-emerald-700/40" />
        <button type="submit" disabled={adding || !month} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة</button>
      </form>
      {busy && !items.length ? (
        <div className="grid place-items-center py-10 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
      ) : !items.length ? (
        <div className="grid place-items-center px-6 py-10 text-center text-sm text-ink-soft">لا حوافز مسجّلة لهذا الشهر.</div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{it.name}</p>{it.reason && <p className="truncate text-[11px] text-ink-faint">{it.reason}</p>}</div>
              <span className="shrink-0 font-mono-nums text-sm font-semibold text-emerald-800">{money(it.amount)}$</span>
              <button onClick={() => del(it.id)} aria-label="حذف الحافز" className="text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FinLegend({ dot, label, value }: { dot: string; label: string; value: number }) {
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

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", m.cls)}><span className={cn("size-1.5 rounded-full", m.dot)} />{m.label}</span>;
}

function RowAction({
  row, busy, pay, setPay, onApprove, onPayout, canApprove, canPayout, onPayslip,
}: {
  row: Row; busy: boolean; pay: Record<string, string>;
  setPay: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onApprove: (id: string) => void; onPayout: (id: string, gross: number) => void;
  canApprove: boolean; canPayout: boolean; onPayslip: (entitlementId: string) => void;
}) {
  const Payslip = (
    <button onClick={() => onPayslip(row.id)} aria-label="كشف الراتب" title="كشف الراتب"
      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft ring-1 ring-line transition hover:bg-surface-2 hover:text-ink">
      <BadgeDollarSign className="size-3.5" strokeWidth={1.75} />
    </button>
  );
  if (row.status === "paid") {
    return <div className="flex items-center gap-1.5">{Payslip}<span className="font-mono-nums text-xs font-semibold text-success">صُرف ${money(row.paidAmount ?? row.gross)}</span></div>;
  }
  // عرض فقط لمن لا يملك الاعتماد/الصرف (المشرف يرى الحالة دون إجراء)
  if (row.status === "proposed" && !canApprove) return <div className="flex items-center gap-1.5">{Payslip}<StatusBadge status={row.status} /></div>;
  if (row.status === "approved" && !canPayout) return <div className="flex items-center gap-1.5">{Payslip}<StatusBadge status={row.status} /></div>;
  if (row.status === "proposed") {
    return (
      <div className="flex items-center gap-1.5">
        {Payslip}
        <button
          onClick={() => onApprove(row.id)}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" strokeWidth={2} />}
          اعتماد
        </button>
      </div>
    );
  }
  // approved → record payout (amount editable, default = gross)
  return (
    <div className="flex items-center gap-1.5">
      {Payslip}
      <div className="relative">
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">$</span>
        <input
          inputMode="decimal"
          value={pay[row.id] ?? String(row.gross)}
          onChange={(e) => setPay((p) => ({ ...p, [row.id]: e.target.value }))}
          className="h-9 w-24 rounded-xl bg-surface pr-5 pl-2 text-left font-mono-nums text-xs text-ink ring-1 ring-line outline-none transition focus:ring-2 focus:ring-emerald-600"
        />
      </div>
      <button
        onClick={() => onPayout(row.id, row.gross)}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-gold-600 px-3 text-xs font-semibold text-white shadow-soft ring-1 ring-gold-700/30 transition hover:bg-gold-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Banknote className="size-3.5" strokeWidth={2} />}
        صرف
      </button>
    </div>
  );
}
