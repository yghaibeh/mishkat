import { useEffect, useState } from "react";
import { Package, Plus, Loader2, Car, Wrench, Laptop, ChevronDown, Fuel, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getAssets, saveAsset, setAssetStatus, saveAssetExpense } from "@/lib/api/assets";

// الأصول والعُهد (الوثيقة ٢٦ §ع): عُهدٌ شخصيّة + مركباتٌ وآليّاتٌ بمصروف محروقاتٍ شهريّ.

const KINDS = [
  { key: "personal_custody", label: "عُهدة شخصيّة", Icon: Laptop },
  { key: "vehicle", label: "مركبة", Icon: Car },
  { key: "equipment", label: "آليّة/تجهيز", Icon: Wrench },
];
const kindOf = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[2];

type Exp = { month: string; fuelAmount: number; otherAmount: number };
type Asset = { id: string; kind: string; name: string; details: string | null; status: string; unitName: string | null; holderName: string | null; expenses: Exp[]; totalFuel: number };

export function AssetsPanel() {
  const [items, setItems] = useState<Asset[] | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = () => { getAssets().then((r) => { if (!("error" in (r as object))) setItems((r as { items: Asset[] }).items); else setItems([]); }).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);
  if (!items) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
          <Package className="size-4 text-emerald-800" strokeWidth={1.75} /> الأصول والعُهد
        </h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
          <Plus className="size-3.5" /> أصلٌ جديد
        </button>
      </div>
      {open && <NewAssetForm onDone={() => { setOpen(false); load(); }} />}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {items.map((a) => {
          const K = kindOf(a.kind);
          return (
            <li key={a.id}>
              <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><K.Icon className="size-[18px]" strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", a.status !== "active" ? "text-ink-faint line-through" : "text-ink")}>
                    {a.name} <span className="text-[11px] font-normal text-ink-faint">· {K.label}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                    {a.unitName ?? "المؤسّسة"}{a.holderName ? ` · بحوزة ${a.holderName}` : ""}{a.details ? ` · ${a.details}` : ""}
                  </p>
                </div>
                {a.kind !== "personal_custody" && a.totalFuel > 0 && (
                  <span className="shrink-0 rounded-full bg-gold-50 px-2 py-0.5 font-mono-nums text-[10px] font-bold text-gold-800 ring-1 ring-gold-100">
                    محروقات ١٢ شهرًا: {a.totalFuel.toLocaleString("ar")}$
                  </span>
                )}
                <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition", expanded === a.id && "rotate-180")} />
              </button>
              {expanded === a.id && <AssetDetails asset={a} onChange={load} />}
            </li>
          );
        })}
        {!items.length && <li className="p-6 text-center text-sm text-ink-faint">لا أصول مسجّلةً بعد.</li>}
      </ul>
    </section>
  );
}

function AssetDetails({ asset, onChange }: { asset: Asset; onChange: () => void }) {
  const now = new Date();
  const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defMonth);
  const [fuel, setFuel] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  const saveExp = async () => {
    setBusy(true);
    try {
      const r = await saveAssetExpense({ data: { assetId: asset.id, month, fuelAmount: Number(fuel) || 0, otherAmount: Number(other) || 0 } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("سُجّل المصروف"); setFuel(""); setOther(""); onChange(); }
    } catch { toast.error("تعذّر الحفظ"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 border-t border-line bg-surface-2/30 px-4 py-3">
      {asset.kind !== "personal_custody" && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="الشهر"><TextField type="month" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" /></Field>
            <Field label="محروقات ($)"><TextField type="number" value={fuel} onChange={(e) => setFuel(e.target.value)} /></Field>
            <Field label="أخرى ($)"><TextField type="number" value={other} onChange={(e) => setOther(e.target.value)} /></Field>
            <button onClick={saveExp} disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Fuel className="size-3.5" />} حفظ
            </button>
          </div>
          {asset.expenses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {asset.expenses.map((e) => (
                <span key={e.month} className="rounded-lg bg-surface px-2 py-1 font-mono-nums text-[10px] text-ink-soft ring-1 ring-line" dir="ltr">
                  {e.month}: ⛽{e.fuelAmount}{e.otherAmount ? ` +${e.otherAmount}` : ""}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      <div className="flex gap-1.5">
        {asset.status === "active" ? (
          <>
            {asset.kind === "personal_custody" && (
              <button onClick={async () => { await setAssetStatus({ data: { id: asset.id, status: "returned" } }); onChange(); }}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line hover:bg-surface">أُعيدت العُهدة</button>
            )}
            <button onClick={async () => { await setAssetStatus({ data: { id: asset.id, status: "retired" } }); onChange(); }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-danger ring-1 ring-danger/30 hover:bg-danger-bg"><X className="size-3" /> إخراجٌ من الخدمة</button>
          </>
        ) : (
          <button onClick={async () => { await setAssetStatus({ data: { id: asset.id, status: "active" } }); onChange(); }}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">إعادة تفعيل</button>
        )}
      </div>
    </div>
  );
}

function NewAssetForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState("vehicle");
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [holderName, setHolderName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("اسم الأصل مطلوب"); return; }
    setBusy(true);
    try {
      const r = await saveAsset({ data: { kind: kind as never, name: name.trim(), details: details.trim() || undefined, holderName: holderName.trim() || undefined } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("أُضيف الأصل"); onDone(); }
    } catch { toast.error("تعذّرت الإضافة"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="grid grid-cols-2 gap-2">
        <Field label="نوع العُهدة/الأصل"><MSelect value={kind} onValueChange={setKind} options={KINDS.map((k) => ({ value: k.key, label: k.label }))} /></Field>
        <Field label="الاسم"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="سيارة هيونداي H1 / لابتوب Dell" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="تفاصيل (لوحة/رقم تسلسليّ…)"><TextField value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        <Field label="بحوزة (للعُهد الشخصية)"><TextField value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="اسم المستلم" /></Field>
      </div>
      <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة
      </button>
    </div>
  );
}
