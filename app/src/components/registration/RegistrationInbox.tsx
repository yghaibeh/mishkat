// صندوق «طلبات الانضمام» — مكوّنٌ مشترك (غ٧): يظهر في الشبكة للمشرفين، وفي «المطلوب اليوم»
// ليصل الأميرَ أيضًا (لا يملك دخول الشبكة) — فلا يعلق طلبُ طالبٍ بلا معتمِد.
import { useEffect, useState } from "react";
import { UserPlus, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPendingRegistrations, approveRegistration, rejectRegistration } from "@/lib/api/registration";

// صندوق «طلبات الانضمام» — التسجيل الذاتيّ الهرميّ (الوثيقة ٢٦ §١): تظهر الطلبات لصاحب
// الطبقة المغطّية فوق الدور المطلوب؛ القبول ينشئ الهيكلية كاملةً (المسجد الجديد إن لُزم).
type RegItem = {
  id: string; kindLabel: string; fullName: string; login: string; phone: string | null; note: string | null;
  unitName: string | null; proposedUnitName: string | null; proposedParentName: string | null;
  circleName: string | null; targetInactive: boolean; createdAt: number;
};
export function RegistrationInbox() {
  const [items, setItems] = useState<RegItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = () => { getPendingRegistrations().then((r) => setItems((r as { items: RegItem[] }).items ?? [])).catch(() => {}); };
  useEffect(() => { load(); }, []);
  if (!items.length) return null;

  const approve = async (id: string) => {
    setBusy(id);
    try {
      const res = await approveRegistration({ data: { id } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("اعتُمد الانضمام — أُنشئ الحساب"); load(); }
    } catch { toast.error("تعذّر الاعتماد"); } finally { setBusy(null); }
  };
  const reject = async (id: string) => {
    if (!reason.trim()) { toast.error("سبب الرفض إلزاميّ"); return; }
    setBusy(id);
    try {
      const res = await rejectRegistration({ data: { id, reason: reason.trim() } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("رُفض الطلب"); setRejecting(null); setReason(""); load(); }
    } catch { toast.error("تعذّر الرفض"); } finally { setBusy(null); }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-emerald-200/70">
      <div className="flex items-center gap-2 border-b border-line bg-emerald-50/60 px-5 py-3.5">
        <UserPlus className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h3 className="font-display text-sm font-semibold text-ink">طلبات الانضمام</h3>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono-nums text-[11px] font-bold text-emerald-800">{items.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.id} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><UserPlus className="size-[18px]" strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {it.fullName} <span className="text-[11px] font-normal text-ink-faint">· {it.kindLabel}</span>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                  {it.proposedUnitName
                    ? <>مسجدٌ جديد: «{it.proposedUnitName}» تحت {it.proposedParentName ?? "—"} — يُنشأ عند الاعتماد</>
                    : <>{it.unitName ?? "—"}{it.circleName ? ` · حلقة ${it.circleName}` : ""}</>}
                  {it.phone ? ` · ${it.phone}` : ""}{it.note ? ` · «${it.note}»` : ""}
                </p>
                {it.targetInactive && <p className="mt-0.5 text-[11px] font-bold text-danger">الوحدة الهدف لم تعد نشطة</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => approve(it.id)} disabled={!!busy || it.targetInactive}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-50 shadow-soft transition hover:bg-emerald-900 disabled:opacity-60">
                  {busy === it.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" strokeWidth={2} />} قبول
                </button>
                <button onClick={() => { setRejecting(rejecting === it.id ? null : it.id); setReason(""); }} disabled={!!busy}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-danger ring-1 ring-danger/30 transition hover:bg-danger-bg disabled:opacity-60">رفض</button>
              </div>
            </div>
            {rejecting === it.id && (
              <div className="mt-2 flex items-center gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الرفض (إلزاميّ — يظهر للمتقدّم)"
                  className="h-9 min-w-0 flex-1 rounded-lg bg-surface-2 px-3 text-xs text-ink ring-1 ring-line outline-none focus:ring-emerald-700/40" />
                <button onClick={() => reject(it.id)} disabled={!!busy}
                  className="shrink-0 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">تأكيد الرفض</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

