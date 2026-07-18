// «العُهد» — مساحةُ عملٍ قائمةٌ بذاتها (قرار المالك ٢٠٢٦-٠٧-١٨):
// «عُهدتي» لكلّ فردٍ بيده شيء (والإقرارُ بالاستلام بيده وحدَه)، و«عُهدُ نطاقي» لمسؤول الوحدة
// (تسليمٌ واستردادٌ وبلاغُ تلفٍ وسلسلةُ حيازةٍ كاملة). كان الأصلُ يحمل اسمَ حائزه الحاليّ فقط
// فيضيع «من كان يحوزها ومتى وبأيّ حال» — صار كلُّ تبدُّلٍ حدثاً مسجَّلاً لا يُحذف.
import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Briefcase, Car, Package, Loader2, User, History, CheckCircle2, RotateCcw,
  AlertTriangle, ArrowLeftRight, X, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { MTabs } from "@/components/ui/m-tabs";
import { MSelect } from "@/components/ui/m-select";
import { Field } from "@/components/ui/field";
import { fmtHijriShort } from "@/lib/format";
import { hasCap } from "@/lib/capabilities";
import { getScopeCustody, getMyCustody, getCustodyTimeline, assignCustody, acknowledgeCustody, returnCustody, reportCustody } from "@/lib/api/custody";

const KIND_META: Record<string, { label: string; Icon: LucideIcon }> = {
  personal_custody: { label: "عهدة شخصية", Icon: Briefcase },
  vehicle: { label: "مركبة", Icon: Car },
  equipment: { label: "آليّة/تجهيز", Icon: Package },
};
const CONDITIONS = [
  { value: "new", label: "جديدة" }, { value: "good", label: "سليمة" },
  { value: "fair", label: "بها أثرُ استعمال" }, { value: "damaged", label: "متضرّرة" },
];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "بعهدة", cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
  returned: { label: "في الوحدة", cls: "bg-surface-2 text-ink-soft ring-line" },
  damaged: { label: "متضرّرة", cls: "bg-gold-50 text-gold-800 ring-gold-100" },
  lost: { label: "مفقودة", cls: "bg-red-50 text-red-700 ring-red-100" },
  retired: { label: "خارج الخدمة", cls: "bg-surface-2 text-ink-faint ring-line" },
};

type ScopeItem = {
  id: string; name: string; kind: string; details: string | null; status: string; unitName: string;
  holderName: string | null; holderPersonId: string | null; conditionLabel: string; since: number | null; awaitingAck: boolean;
};
type MyItem = { id: string; name: string; kind: string; details: string | null; status: string; conditionLabel: string; since: number | null };
type Pending = { eventId: string; assetId: string; assetName: string; fromName: string | null; conditionLabel: string; at: number };
type TimelineEvent = { id: string; actionLabel: string; fromName: string | null; toName: string | null; conditionLabel: string; note: string | null; at: number; acknowledged: boolean };

// ===== سلسلةُ الحيازة =====
function Timeline({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [data, setData] = useState<{ asset: { name: string; holderName: string | null }; events: TimelineEvent[] } | null>(null);
  useEffect(() => { getCustodyTimeline({ data: { assetId } }).then((r) => setData(r as never)).catch(() => onClose()); }, [assetId]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{data ? `سلسلةُ حيازة: ${data.asset.name}` : "…"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
        </div>
        {!data ? <div className="grid place-items-center py-10 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div> : (
          <ol className="space-y-3">
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3 rounded-xl bg-surface-2/60 p-3 ring-1 ring-line">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-emerald-800 ring-1 ring-line"><History className="size-4" strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{e.actionLabel}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {e.fromName ? `من: ${e.fromName}` : "من الوحدة"} {e.toName ? `← إلى: ${e.toName}` : "← إلى الوحدة"} · الحال: {e.conditionLabel}
                  </p>
                  {e.note && <p className="mt-1 text-[12px] text-ink-faint">{e.note}</p>}
                  <p className="mt-1 flex items-center gap-2 font-mono-nums text-[11px] text-ink-faint">
                    {fmtHijriShort(e.at)}
                    {e.toName && (e.acknowledged
                      ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-3" /> أقرّ بالاستلام</span>
                      : <span className="inline-flex items-center gap-1 text-gold-700"><Clock className="size-3" /> بانتظار إقراره</span>)}
                  </p>
                </div>
              </li>
            ))}
            {!data.events.length && <li className="py-6 text-center text-sm text-ink-soft">لا حركاتِ حيازةٍ بعد.</li>}
          </ol>
        )}
      </div>
    </div>
  );
}

// ===== حوارُ التسليم =====
function AssignDialog({ asset, people, onDone, onClose }: {
  asset: ScopeItem; people: Array<{ id: string; name: string }>; onDone: () => void; onClose: () => void;
}) {
  const [to, setTo] = useState(""); const [cond, setCond] = useState("good"); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!to) return toast.error("اختر مَن تُسلّمه");
    setBusy(true);
    try {
      const r = await assignCustody({ data: { assetId: asset.id, toPersonId: to, condition: cond, note: note.trim() || undefined } }) as { ok?: boolean; error?: string };
      if (!r.ok) return toast.error(r.error ?? "تعذّر التسليم");
      toast.success("سُلّمت العهدة — بانتظار إقرار المستلم");
      onDone(); onClose();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">تسليمُ «{asset.name}»</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
        </div>
        {asset.holderName && <p className="mb-3 rounded-xl bg-gold-50 p-2.5 text-[12px] text-gold-800 ring-1 ring-gold-100">بعهدة {asset.holderName} الآن — التسليمُ نقلٌ يُسجَّل في سلسلتها.</p>}
        <div className="space-y-3">
          <Field label="إلى مَن؟ (من أشخاص نطاقك)">
            <MSelect value={to} onValueChange={setTo} options={people.map((p) => ({ value: p.id, label: p.name }))} placeholder="اختر الشخص…" />
          </Field>
          <Field label="حالُ العهدة عند التسليم">
            <MSelect value={cond} onValueChange={setCond} options={CONDITIONS} />
          </Field>
          <Field label="ملاحظة (اختياريّة)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="رقمُ الجهاز، ملحقاتُه…"
              className="h-10 w-full rounded-xl bg-surface-2 px-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-emerald-700/40" />
          </Field>
          <button onClick={submit} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />} تسليمُ العهدة
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== عُهدتي =====
function MyCustody({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<{ items: MyItem[]; pending: Pending[] } | null>(null);
  const load = () => getMyCustody().then((r) => setData(r as never)).catch(() => setData({ items: [], pending: [] }));
  useEffect(() => { load(); }, []);
  const ack = async (eventId: string) => {
    const r = await acknowledgeCustody({ data: { eventId } }) as { ok?: boolean; error?: string };
    if (!r.ok) return toast.error(r.error ?? "تعذّر الإقرار");
    toast.success("أقررتَ بالاستلام"); load(); onChanged();
  };
  if (!data) return <div className="grid place-items-center rounded-2xl bg-surface py-14 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>;
  return (
    <div className="space-y-4">
      {/* الإقرارُ فعلٌ شخصيٌّ لا يقرّ به عنك أحد */}
      {data.pending.map((p) => (
        <div key={p.eventId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-200">
          <AlertTriangle className="size-5 shrink-0 text-gold-700" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">سُلّمت إليك «{p.assetName}» — أقرّ باستلامها</p>
            <p className="mt-0.5 text-[12px] text-ink-soft">{p.fromName ? `من: ${p.fromName}` : "من الوحدة"} · الحال: {p.conditionLabel} · {fmtHijriShort(p.at)}</p>
          </div>
          <button onClick={() => ack(p.eventId)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 hover:bg-emerald-900">
            <CheckCircle2 className="size-4" /> استلمتُ
          </button>
        </div>
      ))}
      {!data.items.length ? (
        <div className="grid place-items-center gap-1 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
          <Briefcase className="size-7 text-ink-faint" strokeWidth={1.25} />
          <p className="text-sm text-ink-soft">لا عُهدةَ باسمك.</p>
          <p className="text-[11px] text-ink-faint">ما يُسلَّم إليك من تجهيزاتٍ أو مركباتٍ يظهر هنا، وتُقرّ باستلامه بنفسك.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {data.items.map((a) => {
            const meta = KIND_META[a.kind] ?? { label: a.kind, Icon: Package };
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><meta.Icon className="size-4" strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{a.name}{a.details && <span className="ms-1.5 text-[11px] font-normal text-ink-faint">· {a.details}</span>}</p>
                  <p className="truncate text-[11px] text-ink-faint">الحال: {a.conditionLabel}{a.since ? ` · بعهدتك منذ ${fmtHijriShort(a.since)}` : ""}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", STATUS_META[a.status]?.cls)}>{STATUS_META[a.status]?.label ?? a.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ===== عُهدُ نطاقي =====
function ScopeCustody() {
  const [data, setData] = useState<{ items: ScopeItem[]; people: Array<{ id: string; name: string }> } | null>(null);
  const [assigning, setAssigning] = useState<ScopeItem | null>(null);
  const [timeline, setTimeline] = useState<string | null>(null);
  const load = () => getScopeCustody().then((r) => setData(r as never)).catch(() => setData({ items: [], people: [] }));
  useEffect(() => { load(); }, []);
  const doReturn = async (a: ScopeItem) => {
    const r = await returnCustody({ data: { assetId: a.id } }) as { ok?: boolean; error?: string };
    if (!r.ok) return toast.error(r.error ?? "تعذّرت الإعادة");
    toast.success("أُعيدت العهدة إلى الوحدة"); load();
  };
  const doReport = async (a: ScopeItem, state: "damaged" | "lost") => {
    const r = await reportCustody({ data: { assetId: a.id, state } }) as { ok?: boolean; error?: string };
    if (!r.ok) return toast.error(r.error ?? "تعذّر البلاغ");
    toast.success(state === "damaged" ? "سُجّل بلاغُ التلف" : "سُجّل بلاغُ الفقد"); load();
  };
  if (!data) return <div className="grid place-items-center rounded-2xl bg-surface py-14 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>;
  if (!data.items.length) return (
    <div className="grid place-items-center gap-1 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
      <Package className="size-7 text-ink-faint" strokeWidth={1.25} />
      <p className="text-sm text-ink-soft">لا عُهدَ مسجّلةً في نطاقك بعد.</p>
      <p className="text-[11px] text-ink-faint">تُسجَّل العُهد والمركبات من «الصندوق ← الأصول»، ثمّ تُسلَّم من هنا وتُتابَع سلسلتُها.</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {data.items.map((a) => {
          const meta = KIND_META[a.kind] ?? { label: a.kind, Icon: Package };
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><meta.Icon className="size-4" strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.name}{a.details && <span className="ms-1.5 text-[11px] font-normal text-ink-faint">· {a.details}</span>}</p>
                {/* سطرٌ مفهوم: مَن يحوزها ومنذ متى وبأيّ حال — لا رصفَ أرقام */}
                <p className="truncate text-[11px] text-ink-faint">
                  {a.holderName ? `بعهدة ${a.holderName}` : "في الوحدة — بلا حائز"} · {a.unitName} · الحال: {a.conditionLabel}
                  {a.since ? ` · منذ ${fmtHijriShort(a.since)}` : ""}
                </p>
              </div>
              {a.awaitingAck && <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold text-gold-800 ring-1 ring-gold-100"><Clock className="size-3" /> بانتظار إقراره</span>}
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", STATUS_META[a.status]?.cls)}>{STATUS_META[a.status]?.label ?? a.status}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => setAssigning(a)} title="تسليم" className="rounded-lg p-2 text-emerald-800 hover:bg-emerald-50"><ArrowLeftRight className="size-4" /></button>
                {a.holderPersonId && <button onClick={() => doReturn(a)} title="إعادة إلى الوحدة" className="rounded-lg p-2 text-ink-soft hover:bg-surface-2"><RotateCcw className="size-4" /></button>}
                <button onClick={() => doReport(a, "damaged")} title="بلاغ تلف" className="rounded-lg p-2 text-gold-700 hover:bg-gold-50"><AlertTriangle className="size-4" /></button>
                <button onClick={() => setTimeline(a.id)} title="سلسلة الحيازة" className="rounded-lg p-2 text-ink-soft hover:bg-surface-2"><History className="size-4" /></button>
              </div>
            </li>
          );
        })}
      </ul>
      {assigning && <AssignDialog asset={assigning} people={data.people} onDone={load} onClose={() => setAssigning(null)} />}
      {timeline && <Timeline assetId={timeline} onClose={() => setTimeline(null)} />}
    </div>
  );
}

export function CustodyPage() {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx.user?.caps ?? [];
  const canManage = hasCap(caps, "assets.manage");
  const [tab, setTab] = useState(canManage ? "scope" : "mine");
  const [v, setV] = useState(0);
  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20"><Briefcase className="size-5" strokeWidth={1.5} /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">العُهد</h1>
            <p className="mt-1 text-sm text-ink-soft">مَن يحوز ماذا، منذ متى، وبأيّ حال — بإقرارِ مستلمها وسلسلةِ حيازةٍ لا تُمحى</p>
          </div>
        </header>
        {canManage && <MTabs value={tab} onValueChange={setTab} options={[{ value: "scope", label: "عُهدُ نطاقي" }, { value: "mine", label: "عُهدتي" }]} />}
        {tab === "scope" && canManage ? <ScopeCustody key={v} /> : <MyCustody onChanged={() => setV((x) => x + 1)} />}
      </main>
    </MishkatShell>
  );
}
