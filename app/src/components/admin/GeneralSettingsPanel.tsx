import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Target, Loader2, Save, Lock, Blocks, Sparkles, BellRing, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { getGeneralSettings, setWeeklyTarget, setFeature, setBrand } from "@/lib/api/settings";
import { runScheduledTasks } from "@/lib/api/scheduled";

type Feature = { key: string; label: string; hint: string; enabled: boolean };
type Brand = { name: string; letter: string; currency: string };
type General = { weeklyTargets: { male: number | null; female: number | null }; features: Feature[]; brand: Brand };

export function GeneralSettingsPanel({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<General | null>(null);
  const [busy, setBusy] = useState(true);
  const load = async () => {
    setBusy(true);
    try { setData((await getGeneralSettings()) as General); } catch { toast.error("تعذّر تحميل الإعدادات"); } finally { setBusy(false); }
  };
  // بعد الحفظ: أعد تحميل اللوحة وأبطِل سياق التوجيه ليلتقط الشريط العلوي (العلامة) القيمَ الجديدة فورًا
  const refresh = async () => { await load(); await router.invalidate(); };
  useEffect(() => { void load(); }, []);

  if (busy && !data) return <div className="grid place-items-center rounded-2xl bg-surface py-16 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>;
  const g = data ?? { weeklyTargets: { male: null, female: null }, features: [], brand: { name: "مِشكاة", letter: "م", currency: "USD" } };

  return (
    <div className="space-y-6">
      {!canManage && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink-soft ring-1 ring-line"><Lock className="size-3.5" /> لديك صلاحية الاطّلاع على الإعدادات فقط.</div>
      )}

      <BrandSection brand={g.brand} canManage={canManage} onSaved={refresh} />

      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <Target className="size-4 text-emerald-800" strokeWidth={1.75} />
          <h2 className="font-display text-sm font-semibold text-ink">الهدف الأسبوعي للنقاط</h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-ink-soft">الحدّ الذي يُقاس به تحقيق المسجد أسبوعيًّا في التقرير الشهري — لكلّ مسار على حدة. يؤثّر مباشرةً في «نسبة تحقيق الهدف» وحالة الأسابيع.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TargetRow track="male" label="مسار الرجال" value={g.weeklyTargets.male} canManage={canManage} onSaved={refresh} />
            <TargetRow track="female" label="مسار النساء" value={g.weeklyTargets.female} canManage={canManage} onSaved={refresh} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
          <Blocks className="size-4 text-emerald-800" strokeWidth={1.75} />
          <h2 className="font-display text-sm font-semibold text-ink">تفعيل الوحدات</h2>
        </div>
        <ul className="divide-y divide-line">
          {g.features.map((f) => <FeatureRow key={f.key} f={f} canManage={canManage} onSaved={refresh} />)}
        </ul>
      </section>

      {canManage && <ScheduledTasksSection />}
    </div>
  );
}

// F2: المهامّ المجدولة — تعمل تلقائياً كل ساعة عبر Cloudflare Cron؛ وهنا تشغيلٌ يدويّ فوري.
function ScheduledTasksSection() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ reminders: number; escalations: number } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const r = await runScheduledTasks() as { reminders: number; escalations: number };
      setLast(r);
      toast.success("شُغّلت المهامّ المجدولة", { description: `تذكيرات: ${r.reminders} · تصعيد: ${r.escalations}` });
    } catch { toast.error("تعذّر التشغيل"); } finally { setBusy(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <BellRing className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">المهامّ المجدولة</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">تذكيرات الإدخال المتأخّر + تصعيد الاعتماد بعد ٧ أيام. تعمل تلقائياً كل ساعة (Cloudflare Cron)، ويمكنك تشغيلها الآن يدوياً.{last && <span className="ms-1 font-semibold text-ink">آخر تشغيل: تذكيرات {last.reminders} · تصعيد {last.escalations}.</span>}</p>
        <button onClick={run} disabled={busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} تشغيل الآن</button>
      </div>
    </section>
  );
}

function BrandSection({ brand, canManage, onSaved }: { brand: Brand; canManage: boolean; onSaved: () => void }) {
  const [name, setName] = useState(brand.name);
  const [letter, setLetter] = useState(brand.letter);
  const [currency, setCurrency] = useState(brand.currency);
  const [saving, setSaving] = useState(false);
  const dirty = name !== brand.name || letter !== brand.letter || currency !== brand.currency;
  const valid = name.trim().length >= 2 && letter.trim().length >= 1 && currency.trim().length >= 1;
  const save = async () => {
    if (!valid) { toast.error("قيم غير صالحة"); return; }
    setSaving(true);
    try { await setBrand({ data: { name: name.trim(), letter: letter.trim(), currency: currency.trim() } }); toast.success("حُفظت هوية العلامة", { description: "تظهر في الشريط العلوي" }); onSaved(); }
    catch { toast.error("تعذّر الحفظ"); } finally { setSaving(false); }
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <Sparkles className="size-4 text-emerald-800" strokeWidth={1.75} />
        <h2 className="font-display text-sm font-semibold text-ink">العلامة والهوية</h2>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs leading-relaxed text-ink-soft">اسم المنظومة وحرف الشعار يظهران في الشريط العلوي لكل الشاشات. العملة الافتراضية تُستعمل للمعدّلات الجديدة.</p>
        <div className="flex items-end gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 font-display text-base font-bold text-emerald-100" aria-hidden>{letter || "م"}</span>
          <div className="min-w-0 flex-1"><Field label="اسم المنظومة"><TextField value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></Field></div>
          <div className="w-20"><Field label="حرف الشعار"><TextField value={letter} onChange={(e) => setLetter(e.target.value)} disabled={!canManage} maxLength={2} className="text-center" /></Field></div>
          <div className="w-24"><Field label="العملة"><TextField value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!canManage} dir="ltr" className="text-center" /></Field></div>
          {canManage && (
            <button onClick={save} disabled={saving || !dirty || !valid}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function TargetRow({ track, label, value, canManage, onSaved }: { track: "male" | "female"; label: string; value: number | null; canManage: boolean; onSaved: () => void }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const n = Number(v);
  const dirty = String(value ?? "") !== v;
  const valid = Number.isInteger(n) && n > 0;
  const save = async () => {
    if (!valid) { toast.error("هدف غير صالح"); return; }
    setSaving(true);
    try { await setWeeklyTarget({ data: { track, target: n } }); toast.success("حُفظ الهدف", { description: label }); onSaved(); }
    catch { toast.error("تعذّر الحفظ"); } finally { setSaving(false); }
  };
  return (
    <Field label={label}>
      <div className="flex items-end gap-2">
        <TextField inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} disabled={!canManage} className="text-center font-mono-nums" />
        {canManage && (
          <button onClick={save} disabled={saving || !dirty || !valid}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ
          </button>
        )}
      </div>
    </Field>
  );
}

function FeatureRow({ f, canManage, onSaved }: { f: Feature; canManage: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!canManage) return;
    setBusy(true);
    try { await setFeature({ data: { key: f.key, enabled: !f.enabled } }); toast.success(!f.enabled ? "فُعّلت الوحدة" : "عُطّلت الوحدة", { description: f.label }); onSaved(); }
    catch { toast.error("تعذّر التغيير"); } finally { setBusy(false); }
  };
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{f.label}</p>
        <p className="truncate text-[11px] text-ink-faint">{f.hint}</p>
      </div>
      <button onClick={toggle} disabled={!canManage || busy} role="switch" aria-checked={f.enabled} aria-label={f.label}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", f.enabled ? "bg-emerald-700" : "bg-surface-2 ring-1 ring-line", !canManage && "cursor-default opacity-70")}>
        {busy
          ? <Loader2 className="absolute left-1/2 size-3.5 -translate-x-1/2 animate-spin text-emerald-50" />
          : <span className={cn("inline-block size-4 transform rounded-full bg-white shadow transition", f.enabled ? "translate-x-1" : "translate-x-6")} />}
      </button>
    </li>
  );
}
