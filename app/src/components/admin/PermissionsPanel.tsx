import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MSelect } from "@/components/ui/m-select";
import {
  CAP_CATALOG, ROLE_LABEL, ALL_ROLES, roleEffective, roleDefaultHas, type Override,
} from "@/lib/capabilities";
import { getPermissionMatrix, setPermission } from "@/lib/api/permissions";

export function PermissionsPanel() {
  const [role, setRole] = useState("square");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try { const r = await getPermissionMatrix(); setOverrides((r.overrides as Override[]) ?? []); } catch { /* dev */ }
  };
  useEffect(() => { void load(); }, []);

  const isAdmin = role === "admin";
  const roleOpts = useMemo(() => ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })), []);

  const toggle = async (cap: string) => {
    const current = roleEffective(role, cap, overrides);
    const desired = !current;
    const def = roleDefaultHas(role, cap);
    const state = desired === def ? "default" : desired ? "grant" : "revoke";
    setBusy(cap);
    // تحديث متفائل
    setOverrides((prev) => {
      const rest = prev.filter((o) => !(o.role === role && o.capability === cap));
      return state === "default" ? rest : [...rest, { role, capability: cap, effect: state }];
    });
    try {
      const res = await setPermission({ data: { role, capability: cap, state } }) as { error?: string };
      if (res?.error) { toast.error(res.error); await load(); }
    } catch { toast.error("تعذّر الحفظ"); await load(); } finally { setBusy(null); }
  };

  const resetRole = async (cap: string) => { await setPermissionDefault(cap); };
  const setPermissionDefault = async (cap: string) => {
    setBusy(cap);
    setOverrides((prev) => prev.filter((o) => !(o.role === role && o.capability === cap)));
    try { await setPermission({ data: { role, capability: cap, state: "default" } }); } catch { /* */ } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <aside className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <ShieldCheck className="size-4 text-emerald-800" strokeWidth={1.75} />
            <h2 className="font-display text-sm font-semibold text-ink">مصفوفة الصلاحيات</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            اختر دورًا ثم امنح/احجب القدرات فوق الافتراضي. مثال: امنح «مسؤول المربع» قدرة «عرض الملف المالي» فيظهر له التبويب فورًا.
          </p>
          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-faint">الدور</label>
            <MSelect value={role} onValueChange={setRole} options={roleOpts} />
          </div>
          <p className="mt-3 text-[11px] text-gold-700">تُطبَّق التغييرات على كل من يحمل هذا الدور (عند دخوله التالي).</p>
        </div>
      </aside>

      <div className="space-y-4 lg:col-span-3">
        {isAdmin ? (
          <div className="grid place-items-center gap-2 rounded-2xl bg-surface px-6 py-16 text-center ring-1 ring-line">
            <ShieldCheck className="size-8 text-emerald-700" strokeWidth={1.25} />
            <p className="text-sm font-semibold text-ink">الإدارة العليا تملك كل الصلاحيات</p>
            <p className="text-[11px] text-ink-faint">لا يمكن تقييد الإدارة العليا.</p>
          </div>
        ) : (
          CAP_CATALOG.map((g) => (
            <section key={g.module} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <div className="border-b border-line bg-surface-2/60 px-5 py-3">
                <h3 className="font-display text-sm font-semibold text-ink">{g.module}</h3>
              </div>
              <ul className="divide-y divide-line">
                {g.caps.map((c) => {
                  const on = roleEffective(role, c.key, overrides);
                  const def = roleDefaultHas(role, c.key);
                  const overridden = overrides.some((o) => o.role === role && o.capability === c.key);
                  return (
                    <li key={c.key} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{c.label}</p>
                        <p className="font-mono-nums text-[10px] text-ink-faint">{c.key}{overridden && <span className="ms-1.5 text-gold-700">· مُعدَّل</span>}{!overridden && def && <span className="ms-1.5 text-ink-faint">· افتراضي</span>}</p>
                      </div>
                      {overridden && (
                        <button onClick={() => resetRole(c.key)} aria-label="إرجاع للافتراضي" className="grid size-7 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-2 hover:text-ink">
                          <RotateCcw className="size-3.5" strokeWidth={1.75} />
                        </button>
                      )}
                      <button
                        role="switch" aria-checked={on} disabled={busy === c.key}
                        onClick={() => toggle(c.key)}
                        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60", on ? "bg-emerald-700" : "bg-surface-2 ring-1 ring-line")}
                      >
                        <span className={cn("absolute size-[18px] rounded-full bg-white shadow-soft transition-all", on ? "right-1" : "left-1")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
