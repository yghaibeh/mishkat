import { useEffect, useState } from "react";
import {
  Wallet, HandCoins, Receipt, Scale, Loader2, Plus, Building2, Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MTreeSelect } from "@/components/ui/m-tree-picker";
import { getMosqueFinance, getMosqueTxns, addDonation, addExpense } from "@/lib/api/mosqueFinance";
import { getOrgTree } from "@/lib/api/search";
import { fmtHijriShort } from "@/lib/format";

type Totals = { donations: number; expenses: number; balance: number; donCount: number; expCount: number };
type MF = { error?: string; mosque?: { id: string; name: string } | null; totals?: Totals };
type Txn = { id: string; label: string; amount: number; note: string | null; at: number };
type Kind = "donation" | "expense";

const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FUNDS = [
  { value: "general", label: "الصندوق العامّ" }, { value: "zakat", label: "الزكاة" },
  { value: "sadaqah", label: "الصدقة" }, { value: "waqf", label: "الوقف" }, { value: "projects", label: "المشاريع" },
];
const EXP_CATS = ["كهرباء", "ماء", "صيانة", "تدفئة", "مستلزمات", "أخرى"];

export function MosqueFinancePage({ data }: { data?: MF }) {
  const [mf, setMf] = useState<MF>(data ?? {});
  const [mosqueId, setMosqueId] = useState<string>(data?.mosque?.id ?? "");
  const [mosqueLbl, setMosqueLbl] = useState<string>(data?.mosque?.name ?? "");

  const load = async (mid?: string) => {
    try { const r = (await getMosqueFinance({ data: { mosqueId: mid || undefined } })) as MF; setMf(r); if (r.mosque) { setMosqueId(r.mosque.id); setMosqueLbl(r.mosque.name); } return r.mosque?.id ?? null; }
    catch { return null; }
  };
  useEffect(() => { void load(mosqueId || undefined); }, []);

  const onPickMosque = async (v: string, l: string) => { setMosqueId(v); setMosqueLbl(l); await load(v); };

  const mosque = mf.mosque;
  const t = mf.totals ?? { donations: 0, expenses: 0, balance: 0, donCount: 0, expCount: 0 };

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
              <Wallet className="size-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">المالية الداخلية للمسجد</h1>
              <p className="mt-1 text-sm text-ink-soft">{mosque ? mosque.name : "تبرّعات وميزانية المسجد — لأمين الصندوق"}</p>
            </div>
          </div>
          <div className="w-full md:w-64">
            <MTreeSelect value={mosqueId} valueLabel={mosqueLbl} onChange={onPickMosque} loadTree={() => getOrgTree()} selectableTypes={["mosque"]} placeholder="اختر مسجداً…" title="اختر مسجداً من الهيكلية" emptyText="لا مساجد ضمن نطاقك." />
          </div>
        </header>

        {!mosque ? (
          <div className="grid place-items-center gap-2 rounded-2xl bg-surface px-6 py-20 text-center ring-1 ring-line">
            <Building2 className="size-8 text-ink-faint" strokeWidth={1.25} />
            <p className="text-sm text-ink-soft">اختر مسجداً لعرض ماليته الداخلية</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Kpi icon={HandCoins} value={`$${money(t.donations)}`} label="إجمالي التبرّعات" sub={`${t.donCount} تبرّع`} />
              <Kpi icon={Receipt} value={`$${money(t.expenses)}`} label="إجمالي المصروفات" sub={`${t.expCount} مصروف`} tone="warn" />
              <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
                <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
                <div className="flex items-center justify-between">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10"><Scale className="size-[18px]" strokeWidth={1.75} /></span>
                  <span className="text-[11px] font-medium text-emerald-100/70">الرصيد</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
                  <span className="text-sm font-medium text-emerald-100/80">$</span>
                  <span className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", t.balance < 0 ? "text-danger" : "text-gold-100")}>{money(t.balance)}</span>
                </div>
                <p className="mt-3 text-[11px] text-emerald-100/60">التبرّعات − المصروفات.</p>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <TxnPanel mosqueId={mosque.id} kind="donation" onChanged={() => load(mosque.id)} />
              <TxnPanel mosqueId={mosque.id} kind="expense" onChanged={() => load(mosque.id)} />
            </div>
          </>
        )}
      </main>
    </MishkatShell>
  );
}

export function TxnPanel({ mosqueId, kind, onChanged }: { mosqueId: string; kind: Kind; onChanged: () => void }) {
  const isDon = kind === "donation";
  const [items, setItems] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [listBusy, setListBusy] = useState(true);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [cat, setCat] = useState(EXP_CATS[0]);
  const [fund, setFund] = useState("general");
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [currencies, setCurrencies] = useState<Array<{ code: string; symbol: string; name: string }>>([{ code: "USD", symbol: "$", name: "دولار" }]);
  useEffect(() => { import("@/lib/api/ledger").then((m) => m.getCurrencies()).then((r) => { const list = (r as { list: Array<{ code: string; symbol: string; name: string }> }).list; if (list?.length) setCurrencies(list); }).catch(() => {}); }, []);
  const curSym = currencies.find((c) => c.code === currency)?.symbol ?? "$";

  const load = async (offset: number, append: boolean) => {
    setListBusy(true);
    try { const r = await getMosqueTxns({ data: { mosqueId, kind, offset } }); setItems((p) => (append ? [...p, ...r.items] : r.items)); setTotal(r.total); }
    catch { /* dev */ } finally { setListBusy(false); }
  };
  useEffect(() => { void load(0, false); }, [mosqueId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("مبلغ غير صالح"); return; }
    setBusy(true);
    try {
      if (isDon) {
        const r = await addDonation({ data: { mosqueId, donorName: name || undefined, amount: amt, fund: fund as never, currency } }) as { error?: string; receiptNo?: string; queued?: boolean; message?: string };
        if (r && "error" in r && r.error) { toast.error(r.error); setBusy(false); return; }
        // الاعتمادُ الثنائيّ: المسؤولُ الماليُّ يُقيَّد اقتراحُه ولا يُرحَّل قبل اعتماد المدير
        if (r?.queued) { toast.info("بانتظار اعتماد المدير ⏳", { description: r.message, duration: 8000 }); setAmount(""); setName(""); return; }
        toast.success("سُجّل التبرّع", { description: r?.receiptNo ? `سند القبض ${r.receiptNo} · ${amt.toLocaleString()} ${curSym}` : `${amt.toLocaleString()} ${curSym}` });
      } else {
        const r = await addExpense({ data: { mosqueId, category: cat, amount: amt, fund: fund as never, currency } }) as { error?: string; budgetWarning?: string | null; queued?: boolean; message?: string };
        if (r && "error" in r && r.error) { toast.error(r.error); setBusy(false); return; }
        if (r?.queued) { toast.info("بانتظار اعتماد المدير ⏳", { description: r.message, duration: 8000 }); setAmount(""); return; }
        toast.success("سُجّل المصروف", { description: `${amt.toLocaleString()} ${curSym}` });
        if (r?.budgetWarning) toast.warning("تنبيه الموازنة", { description: r.budgetWarning }); // ز٢
      }
      setAmount(""); setName(""); await load(0, false); onChanged();
    } catch { toast.error("تعذّرت العملية"); } finally { setBusy(false); }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {isDon ? <HandCoins className="size-4 text-emerald-800" strokeWidth={1.75} /> : <Receipt className="size-4 text-warn" strokeWidth={1.75} />}
          <h3 className="font-display text-sm font-semibold text-ink">{isDon ? "التبرّعات" : "المصروفات"}</h3>
        </div>
        <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{total}</span>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
        {isDon ? (
          <div className="min-w-0 flex-1"><Field label="المتبرّع"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اختياري" /></Field></div>
        ) : (
          <div className="min-w-0 flex-1">
            <Field label="البند">
              <MSelect value={cat} onValueChange={setCat} options={EXP_CATS.map((c) => ({ value: c, label: c }))} />
            </Field>
          </div>
        )}
        <div className="w-32"><Field label="الصندوق"><MSelect value={fund} onValueChange={setFund} options={FUNDS} /></Field></div>
        {currencies.length > 1 && <div className="w-24"><Field label="العملة"><MSelect value={currency} onValueChange={setCurrency} options={currencies.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))} /></Field></div>}
        <div className="w-28"><Field label={`المبلغ ${curSym}`}><TextField inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-mono-nums" /></Field></div>
        <button type="submit" disabled={busy || !(Number(amount) > 0)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة
        </button>
      </form>

      {listBusy && items.length === 0 ? (
        <div className="grid place-items-center px-6 py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">{isDon ? "لا تبرّعات بعد." : "لا مصروفات بعد."}</div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                <span className={tile}>{isDon ? <HandCoins className="size-4" strokeWidth={1.75} /> : <Receipt className="size-4" strokeWidth={1.75} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{x.label}</p>
                  <p className="truncate text-[11px] text-ink-faint">{fmtHijriShort(x.at)}{x.note ? ` · ${x.note}` : ""}</p>
                </div>
                <span className={cn("shrink-0 font-mono-nums text-sm font-bold", isDon ? "text-emerald-800" : "text-warn")}>${money(x.amount)}</span>
              </li>
            ))}
          </ul>
          {items.length < total && (
            <button onClick={() => load(items.length, true)} disabled={listBusy}
              className="w-full border-t border-line py-3 text-xs font-semibold text-emerald-800 transition hover:bg-surface-2/40 disabled:opacity-60">
              تحميل المزيد ({total - items.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Kpi({ icon: Icon, value, label, sub, tone }: { icon: LucideIcon; value: string; label: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
      <div className="flex items-center justify-between">
        <span className={tile}><Icon className="size-[18px]" strokeWidth={1.75} /></span>
        {sub && <span className="text-[11px] font-semibold text-ink-faint">{sub}</span>}
      </div>
      <div className={cn("mt-3 font-mono-nums text-3xl font-semibold tracking-tight sm:text-4xl", tone === "warn" ? "text-warn" : "text-ink")}>{value}</div>
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
