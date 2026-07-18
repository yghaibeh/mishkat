import { useEffect, useState } from "react";
import { Coins, Loader2, Save, History, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { getRates, setRate } from "@/lib/api/settings";

type Rate = {
  kind: "point_rate" | "hourly_rate" | "fixed_salary" | string;
  label: string; hint: string; hasPerUnit: boolean;
  amount: number | null; perUnit: number | null; currency: string; validFrom: number | null; versions: number;
};

export function RatesPanel({ canManage }: { canManage: boolean }) {
  const [rates, setRates] = useState<Rate[]>([]);
  const [busy, setBusy] = useState(true);
  const load = async () => {
    setBusy(true);
    try { setRates((await getRates()) as Rate[]); } catch { toast.error("تعذّر تحميل المعدّلات"); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-5 ring-1 ring-gold-100">
        <Coins className="mt-0.5 size-5 shrink-0 text-gold-700" strokeWidth={1.75} />
        <div>
          <h2 className="font-display text-sm font-semibold text-gold-700">المعدّلات المالية</h2>
          <p className="mt-1 text-xs leading-relaxed text-gold-700/80">
            تحكم هذه المعدّلات في احتساب المستحقات في «الملف المالي» و«على بصيرة». كل تعديل يُنشئ <strong>نسخة جديدة مؤرّخة</strong> ولا يمسّ النسخ السابقة (يُحفظ التاريخ للتدقيق).
            {!canManage && <span className="mt-1 flex items-center gap-1 font-semibold"><Lock className="size-3" /> لديك صلاحية الاطّلاع فقط.</span>}
          </p>
        </div>
      </div>

      {busy ? (
        <div className="grid place-items-center rounded-2xl bg-surface py-16 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rates.map((r) => <RateCard key={r.kind} r={r} canManage={canManage} onSaved={load} />)}
        </div>
      )}
    </div>
  );
}

function RateCard({ r, canManage, onSaved }: { r: Rate; canManage: boolean; onSaved: () => void }) {
  const [amount, setAmount] = useState(r.amount != null ? String(r.amount) : "");
  const [perUnit, setPerUnit] = useState(r.perUnit != null ? String(r.perUnit) : "");
  const [saving, setSaving] = useState(false);

  const num = Number(amount);
  const per = Number(perUnit);
  const perPoint = r.hasPerUnit && num > 0 && per > 0 ? (num / per) : null;
  const dirty = String(r.amount ?? "") !== amount || (r.hasPerUnit && String(r.perUnit ?? "") !== perUnit);
  const valid = num >= 0 && amount !== "" && (!r.hasPerUnit || per > 0);

  const save = async () => {
    if (!valid) { toast.error("قيمة غير صالحة"); return; }
    setSaving(true);
    try {
      await setRate({ data: { kind: r.kind as "point_rate", amount: num, perUnit: r.hasPerUnit ? per : null } });
      toast.success("حُفظ المعدّل", { description: r.label });
      onSaved();
    } catch { toast.error("تعذّر الحفظ"); } finally { setSaving(false); }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-emerald-800" strokeWidth={1.75} />
          <h3 className="font-display text-sm font-semibold text-ink">{r.label}</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint"><History className="size-3" />{r.versions} نسخة</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs leading-relaxed text-ink-soft">{r.hint}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32"><Field label={`المبلغ (${r.currency})`}><TextField inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canManage} className="text-center font-mono-nums" /></Field></div>
          {r.hasPerUnit && (
            <>
              <span className="pb-2.5 text-sm text-ink-faint">مقابل</span>
              <div className="w-24"><Field label="نقطة"><TextField inputMode="numeric" value={perUnit} onChange={(e) => setPerUnit(e.target.value)} disabled={!canManage} className="text-center font-mono-nums" /></Field></div>
            </>
          )}
          {canManage && (
            <button onClick={save} disabled={saving || !dirty || !valid}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
            </button>
          )}
        </div>
        {perPoint != null && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-ink-soft ring-1 ring-line">
            المعدّل الفعلي: <span className="font-mono-nums font-semibold text-emerald-800">{perPoint.toFixed(4)} {r.currency}</span> لكل نقطة.
          </p>
        )}
        {r.amount == null && <p className={cn("text-[11px]", "text-warn")}>لم يُضبط هذا المعدّل بعد.</p>}
      </div>
    </section>
  );
}
