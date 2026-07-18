// «الصندوق» — وجهُ سلسلة العهدة الهرمية (ق-د٢، الوثيقة ٣٩ §٦-٩):
// «كم بقي معي؟» بالعملات أولاً، ثم ما ينتظر إقراري، ثم العمليات (قبض/صرف/تسليم بأسطر عملات)،
// ثم صناديقُ ما تحتي (نزولٌ بالنقر — قاعدة المالك: العمليات لأمين الصندوق المعروض حصراً).
import { useEffect, useState } from "react";
import { Loader2, Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Plus, CheckCircle2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getUnitBox, boxReceive, boxSpend, boxHandover, boxAcknowledge } from "@/lib/api/box";

type Line = { currency: string; amount: string };
type Box = {
  unit: { id: string; name: string };
  custodian: boolean;
  balances: Array<{ currency: string; amount: number }>;
  children: Array<{ unitId: string; name: string; usd: number }>;
  pendingAck: Array<{ id: string; purpose: string; lines: Array<{ currency: string; amount: number }>; deliveredAt: number; note: string | null }>;
  recent: Array<{ id: string; memo: string | null; at: number; source: string | null }>;
  categories: Array<{ key: string; label: string }>;
};

const CUR = [{ value: "USD", label: "دولار $" }, { value: "SYP", label: "ليرة سورية" }, { value: "TRY", label: "ليرة تركية" }];
const fmtCur = (c: string, n: number) => c === "USD" ? `$${n.toLocaleString()}` : `${n.toLocaleString()} ${c === "SYP" ? "ل.س" : c === "TRY" ? "₺" : c}`;
const PURPOSE = [{ value: "salaries", label: "رواتب" }, { value: "operations", label: "تشغيل" }, { value: "other", label: "أخرى" }];

function LinesEditor({ lines, setLines }: { lines: Line[]; setLines: (l: Line[]) => void }) {
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="w-36"><Field label={i === 0 ? "العملة" : ""}><MSelect value={l.currency} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, currency: v } : x))} options={CUR} /></Field></div>
          <div className="flex-1"><Field label={i === 0 ? "المبلغ" : ""}><TextField type="number" dir="ltr" className="text-center" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /></Field></div>
          {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="mb-1 rounded-lg px-2 py-1.5 text-xs text-danger ring-1 ring-danger/20">حذف</button>}
        </div>
      ))}
      {/* التبرع الواحد قد يأتي بعملات عدة (ق-د٢): دولار + سوري + تركي في عملية واحدة */}
      <button type="button" onClick={() => setLines([...lines, { currency: "SYP", amount: "" }])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"><Plus className="size-3" /> عملة أخرى</button>
    </div>
  );
}

export function BoxPanel() {
  const [box, setBox] = useState<Box | null>(null);
  const [viewUnit, setViewUnit] = useState<string | undefined>(undefined);
  const [op, setOp] = useState<"" | "receive" | "spend" | "handover">("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ currency: "USD", amount: "" }]);
  const [who, setWho] = useState(""); const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("");
  const [toUnit, setToUnit] = useState(""); const [purpose, setPurpose] = useState("operations");

  const load = (unitId?: string) => getUnitBox({ data: { unitId } }).then((r) => setBox(r as Box)).catch(() => toast.error("تعذّر تحميل الصندوق"));
  useEffect(() => { load(viewUnit); }, [viewUnit]);

  if (!box) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;

  const parsed = () => lines.filter((l) => Number(l.amount) > 0).map((l) => ({ currency: l.currency, amount: Number(l.amount) }));
  const reset = () => { setOp(""); setLines([{ currency: "USD", amount: "" }]); setWho(""); setMemo(""); setCategory(""); setToUnit(""); };
  const run = async (fn: () => Promise<{ error?: string } | { ok: true }>) => {
    if (!parsed().length) { toast.error("أدخل مبلغاً"); return; }
    setBusy(true);
    try { const r = await fn(); if (r && "error" in r && r.error) toast.error(r.error); else { toast.success("تمت العملية"); reset(); load(viewUnit); } }
    catch { toast.error("تعذّرت العملية"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {/* بطاقة «كم بقي معي؟» — بالعملات كما هي في الدرج (لا مكافئ يخفي الواقع) */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
        <div className="flex items-center gap-2 text-emerald-100/80"><Wallet className="size-4" /> <span className="text-sm font-semibold">{box.unit.name}</span>{!box.custodian && <span className="rounded-full bg-emerald-50/10 px-2 py-0.5 text-[10px]">اطّلاع</span>}</div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono-nums">
          {box.balances.length === 0
            ? <span className="text-sm text-emerald-100/70">الصندوق فارغ — لم يصله قبضٌ بعد.</span>
            : box.balances.map((b) => <span key={b.currency} className="text-2xl font-semibold tracking-tight text-gold-100 sm:text-3xl">{fmtCur(b.currency, b.amount)}</span>)}
        </div>
      </section>

      {/* تسليماتٌ تنتظر إقراري — بصمةُ الطرف الثاني (لا يُرسم فارغاً) */}
      {box.pendingAck.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-gold-300/50">
          <div className="border-b border-line bg-gold-50/60 px-5 py-3"><h3 className="font-display text-sm font-semibold text-ink">عهدةٌ سُلِّمت إليك — أقرّ الاستلام</h3></div>
          <ul className="divide-y divide-line">
            {box.pendingAck.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 text-sm text-ink">{PURPOSE.find((p) => p.value === h.purpose)?.label ?? h.purpose} · <span className="font-mono-nums font-semibold">{h.lines.map((l) => fmtCur(l.currency, l.amount)).join(" + ")}</span>{h.note && <span className="text-[11px] text-ink-faint"> — {h.note}</span>}</div>
                <button disabled={busy} onClick={() => run(() => boxAcknowledge({ data: { handoverId: h.id } }))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900"><CheckCircle2 className="size-3.5" /> استلمتُ</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* العمليات — لأمين الصندوق المعروض حصراً */}
      {box.custodian && (
        <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="flex flex-wrap gap-2">
            <OpBtn active={op === "receive"} onClick={() => setOp(op === "receive" ? "" : "receive")} icon={ArrowDownToLine}>قبض</OpBtn>
            <OpBtn active={op === "spend"} onClick={() => setOp(op === "spend" ? "" : "spend")} icon={ArrowUpFromLine}>دفع</OpBtn>
            {box.children.length > 0 && <OpBtn active={op === "handover"} onClick={() => setOp(op === "handover" ? "" : "handover")} icon={ArrowLeftRight}>تسليم عهدة لوحدة</OpBtn>}
          </div>
          {op && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <LinesEditor lines={lines} setLines={setLines} />
              {op === "receive" && <Field label="من (مانح/جهة — اختياري)"><TextField value={who} onChange={(e) => setWho(e.target.value)} /></Field>}
              {op === "spend" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="فئة الصرف"><MSelect value={category} onValueChange={setCategory} options={box.categories.map((c) => ({ value: c.key, label: c.label }))} placeholder="اختر الفئة" /></Field>
                  <Field label="لمن (اختياري)"><TextField value={who} onChange={(e) => setWho(e.target.value)} /></Field>
                </div>
              )}
              {op === "handover" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="إلى وحدة"><MSelect value={toUnit} onValueChange={setToUnit} options={box.children.map((c) => ({ value: c.unitId, label: c.name }))} placeholder="اختر الوحدة" /></Field>
                  <Field label="الغرض"><MSelect value={purpose} onValueChange={setPurpose} options={PURPOSE} /></Field>
                </div>
              )}
              <Field label="ملاحظة (اختياري)"><TextField value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
              <button disabled={busy} onClick={() => {
                if (op === "receive") return run(() => boxReceive({ data: { unitId: box.unit.id, lines: parsed(), donorName: who || undefined, memo: memo || undefined } }));
                if (op === "spend") { if (!category) { toast.error("اختر فئة الصرف"); return; } return run(() => boxSpend({ data: { unitId: box.unit.id, category, lines: parsed(), payeeName: who || undefined, memo: memo || undefined } })); }
                if (!toUnit) { toast.error("اختر الوحدة المستلمة"); return; }
                return run(() => boxHandover({ data: { fromUnitId: box.unit.id, toUnitId: toUnit, purpose, lines: parsed(), note: memo || undefined } }));
              }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} تنفيذ {op === "receive" ? "القبض" : op === "spend" ? "الدفع" : "التسليم"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* صناديقُ ما تحتي — اطلاعٌ ونزول (السطرُ جملة) */}
      {box.children.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="border-b border-line bg-surface-2/60 px-5 py-3"><h3 className="font-display text-sm font-semibold text-ink">صناديق ما تحت {box.unit.name}</h3></div>
          <ul className="divide-y divide-line">
            {box.children.map((c) => (
              <li key={c.unitId}>
                <button onClick={() => setViewUnit(c.unitId)} className="flex w-full items-center gap-3 px-5 py-3 text-start transition hover:bg-surface-2/40">
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{c.name}</span>
                  <span className={cn("font-mono-nums text-sm font-bold", c.usd > 0 ? "text-emerald-800" : "text-ink-faint")}>≈ ${c.usd.toLocaleString()}</span>
                  <ChevronLeft className="size-4 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {viewUnit && <button onClick={() => setViewUnit(undefined)} className="text-xs font-semibold text-emerald-800 hover:underline">→ عودة لصندوقي</button>}

      {/* آخر الحركات */}
      {box.recent.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="border-b border-line bg-surface-2/60 px-5 py-3"><h3 className="font-display text-sm font-semibold text-ink">آخر حركات الصندوق</h3></div>
          <ul className="divide-y divide-line">
            {box.recent.map((e) => <li key={e.id} className="px-5 py-2.5 text-[13px] text-ink-soft">{e.memo ?? e.source ?? "قيد"}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition", active ? "bg-emerald-800 text-emerald-50 ring-emerald-900" : "bg-surface-2 text-ink ring-line hover:bg-surface")}>
      <Icon className="size-4" /> {children}
    </button>
  );
}
