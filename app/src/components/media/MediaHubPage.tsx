// مركزُ الإعلام — معرضُ صور الشبكة من ثلاثة روافد: تغطياتُ الإعلام (سجلُّ حدثٍ بعنوانه ونوعه
// ووحدته وناشره وألبومه) + صورُ سجلّات اليوم + صورُ دروس الحلقات. كلُّ بطاقةٍ تجيب: ماذا وأين
// ومتى ومَن (قاعدة الصورة المنسوبة ٣٤ — كانت الصورة تعرض وصفاً وتاريخاً بلا حدثٍ ولا صاحب).
// النشرُ لمسؤول الإعلام وحدَه (media.post)؛ والمديرُ يطَّلع ولا ينشر.
// «عُهدتي» تبويبٌ شخصيّ لمن بعُهدته أصل؛ وسجلُّ عُهد الشبكة مِلكُ «الصندوق» لا مرآةَ له هنا.
import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { Images, Loader2, MapPin, Building2, Package, Car, Briefcase, Camera, User, Plus, X, Trash2, ImagePlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { MTabs } from "@/components/ui/m-tabs";
import { MSelect } from "@/components/ui/m-select";
import { MTreeSelect } from "@/components/ui/m-tree-picker";
import { Field } from "@/components/ui/field";
import { fmtHijriShort } from "@/lib/format";
import { hasCap } from "@/lib/capabilities";
import { COVERAGE_KINDS, coverageKindLabel, coverageKindIcon } from "@/lib/media-kinds";
import { getMediaGallery, getMediaAssets, getCoverage, createCoverage, deleteCoverage } from "@/lib/api/mediaHub";
import { getOrgTree } from "@/lib/api/search";

type GalleryItem = {
  id: string; url: string; title: string; caption: string | null; createdAt: number;
  source: "daily" | "lesson" | "post"; kind: string | null; mosqueName: string; regionName: string;
  byName: string | null; photoCount: number; coverageId: string | null;
};
type Asset = { id: string; name: string; kind: string; details: string | null; holderName: string | null; unitName: string; createdAt: number };
type Coverage = {
  id: string; title: string; kind: string; body: string | null; occurredAt: number;
  unitName: string; regionName: string; byName: string | null; mine: boolean;
  photos: Array<{ id: string; url: string; caption: string | null }>;
};

// نسبةُ كلِّ رافدٍ لصاحبه: التغطيةُ ناشرُها، وسجلُّ اليوم مُدخِلُه، والدرسُ معلّمُه
const SOURCE_LABEL: Record<string, string> = { daily: "سجلّ اليوم", lesson: "درس حلقة", post: "تغطية إعلاميّة" };
const KIND_META: Record<string, { label: string; Icon: LucideIcon }> = {
  personal_custody: { label: "عهدة شخصية", Icon: Briefcase },
  vehicle: { label: "مركبة", Icon: Car },
  equipment: { label: "معدّات", Icon: Package },
};
const todayInput = () => new Date().toISOString().slice(0, 10);

// ===== ناشرُ التغطية: حدثٌ أوّلًا (عنوان/نوع/مكان/تاريخ) ثمّ صورُه =====
function Composer({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>(COVERAGE_KINDS[0].key);
  const [unitId, setUnitId] = useState(""); const [unitLbl, setUnitLbl] = useState("");
  const [date, setDate] = useState(todayInput());
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("اكتب عنوان التغطية");
    if (!unitId) return toast.error("اختر الوحدة المغطّاة");
    if (!files.length) return toast.error("أضف صورةً واحدةً على الأقل");
    setBusy(true);
    try {
      const r = await createCoverage({ data: { title: title.trim(), kind, orgUnitId: unitId, occurredAt: new Date(date).getTime(), body: body.trim() || undefined } }) as { id?: string; error?: string };
      if (!r.id) return toast.error(r.error ?? "تعذّر إنشاء التغطية");
      let ok = 0;
      for (const f of files) {
        const fd = new FormData();
        fd.set("file", f); fd.set("scope", "media_post"); fd.set("refId", r.id); fd.set("clientUuid", crypto.randomUUID());
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        if (res.ok) ok++;
      }
      if (!ok) return toast.error("تعذّر رفع الصور");
      toast.success(`نُشرت التغطية بـ${ok} صورة`);
      onDone(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-lg ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">تغطية جديدة</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="عنوان التغطية (ماذا حدث؟)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: افتتاح حلقة التحفيظ الجديدة"
              className="h-10 w-full rounded-xl bg-surface-2 px-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-emerald-700/40" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نوع الحدث"><MSelect value={kind} onValueChange={setKind} options={COVERAGE_KINDS.map((k) => ({ value: k.key, label: k.label }))} /></Field>
            <Field label="تاريخ الحدث">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-xl bg-surface-2 px-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-emerald-700/40" />
            </Field>
          </div>
          <Field label="أين؟ (الوحدة المغطّاة)">
            <MTreeSelect value={unitId} valueLabel={unitLbl} onChange={(v, l) => { setUnitId(v); setUnitLbl(l); }}
              loadTree={() => getOrgTree()} placeholder="اختر المسجد أو المنطقة…" title="اختر الوحدة المغطّاة" emptyText="لا وحدات ضمن نطاقك." />
          </Field>
          <Field label="نصُّ التغطية (اختياريّ)">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="سطران يشرحان الحدث لمن يقرؤه بعد سنة…"
              className="w-full rounded-xl bg-surface-2 p-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-emerald-700/40" />
          </Field>
          <Field label="الصور (يمكن اختيار عدّة صور)">
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-surface-2 text-ink-soft ring-1 ring-dashed ring-line hover:ring-emerald-700/40">
              <ImagePlus className="size-5" strokeWidth={1.5} />
              <span className="text-xs">{files.length ? `${files.length} صورة مختارة` : "اختر الصور"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
            </label>
          </Field>
          <button onClick={submit} disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} نشرُ التغطية
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== صفحةُ التغطية: ألبومُها كاملًا ونصُّها ونسبتُها =====
function CoverageView({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: () => void }) {
  const [c, setC] = useState<Coverage | null>(null);
  useEffect(() => { getCoverage({ data: { id } }).then((r) => setC(r as Coverage)).catch(() => { toast.error("تعذّر فتح التغطية"); onClose(); }); }, [id]);
  const remove = async () => {
    const r = await deleteCoverage({ data: { id } }) as { ok?: boolean; error?: string };
    if (!r.ok) return toast.error(r.error ?? "تعذّر الحذف");
    toast.success("حُذفت التغطية"); onDeleted(); onClose();
  };
  const KindIcon = c ? coverageKindIcon(c.kind) : Camera;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-lg ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        {!c ? <div className="grid place-items-center py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div> : (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-ink">{c.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-800 ring-1 ring-gold-100"><KindIcon className="size-3" strokeWidth={2} />{coverageKindLabel(c.kind)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100"><Building2 className="size-3" strokeWidth={2} />{c.unitName}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-soft ring-1 ring-line"><MapPin className="size-3" strokeWidth={2} />{c.regionName}</span>
                  <span className="font-mono-nums text-ink-faint">{fmtHijriShort(c.occurredAt)}</span>
                </div>
                {c.byName && <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-soft"><User className="size-3.5" strokeWidth={1.75} /> نشرها: {c.byName}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {c.mine && <button onClick={remove} className="rounded-lg p-2 text-red-700 hover:bg-red-50" title="حذف التغطية"><Trash2 className="size-4" /></button>}
                <button onClick={onClose} className="rounded-lg p-2 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
              </div>
            </div>
            {c.body && <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{c.body}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl ring-1 ring-line">
                  <img src={p.url} alt={p.caption ?? c.title} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-105" />
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  // النشرُ بقدرةٍ شخصيّة لا بدور: «*» المديرِ لا يمنحها (قاعدة المالك الواحد ٣٤)
  const ctxU = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const canPost = hasCap(ctxU.user?.caps ?? [], "media.post");
  const [officers, setOfficers] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (offset: number) => {
    setBusy(true);
    try {
      const r = await getMediaGallery({ data: { offset } }) as { items: GalleryItem[]; total: number; mediaOfficers: number };
      setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
      setTotal(r.total); setOfficers(r.mediaOfficers ?? 0);
    } catch { toast.error("تعذّر تحميل الصور"); } finally { setBusy(false); }
  };
  useEffect(() => { void load(0); }, []);
  if (total === null && busy) return <div className="grid place-items-center rounded-2xl bg-surface py-16 text-ink-faint ring-1 ring-line"><Loader2 className="size-5 animate-spin" /></div>;

  const postBtn = canPost && (
    <button onClick={() => setComposing(true)}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 hover:bg-emerald-900">
      <Plus className="size-4" strokeWidth={2} /> تغطية جديدة
    </button>
  );
  const dialogs = (
    <>
      {composing && <Composer onDone={() => load(0)} onClose={() => setComposing(false)} />}
      {openId && <CoverageView id={openId} onClose={() => setOpenId(null)} onDeleted={() => load(0)} />}
    </>
  );

  // فراغٌ يشرح سببَه (٣٤): للناشر دعوةٌ للعمل، وللمطَّلِع تشخيصٌ — أهو شغورُ الدور أم لم يُرفع بعد؟
  if (!items.length) return (
    <div className="space-y-4">
      {postBtn}
      <div className="grid place-items-center gap-2 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <Camera className="size-7 text-ink-faint" strokeWidth={1.25} />
        <p className="text-sm text-ink-soft">
          {canPost ? "لا صورَ بعد — انشر أول تغطية من الزر أعلاه."
            : officers === 0 ? "لا صورَ بعد — ولا مسؤولَ إعلامٍ معيَّنٌ في الشبكة يرفع التغطيات."
              : "لا صورَ مرفوعةً ضمن نطاقك بعد."}
        </p>
        <p className="text-[11px] text-ink-faint">
          {!canPost && officers === 0
            ? "عيِّن مسؤولَ إعلامٍ من «التهيئة ← المستخدمون» ليبدأ النشر؛ وتظهر هنا أيضًا صورُ سجلّات اليوم ودروس الحلقات حين يوثّقها أصحابُها."
            : "تظهر هنا صورُ توثيق سجلّات اليوم ودروس الحلقات وتغطياتُ الإعلام."}
        </p>
      </div>
      {dialogs}
    </div>
  );

  return (
    <div className="space-y-4">
      {postBtn}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const KindIcon = it.kind ? coverageKindIcon(it.kind) : null;
          const clickable = !!it.coverageId;
          const Inner = (
            <>
              <div className="relative">
                <img src={it.url} alt={it.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                {it.photoCount > 1 && (
                  <span className="absolute bottom-2 start-2 rounded-full bg-ink/70 px-2 py-0.5 font-mono-nums text-[10px] font-semibold text-white">
                    {it.photoCount} صور
                  </span>
                )}
              </div>
              <figcaption className="space-y-2 p-3">
                {/* ماذا: عنوانُ الحدث لا وصفٌ عائم */}
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{it.title}</p>
                {/* أين: الوحدة والمنطقة — ونوعُ الحدث للتغطيات */}
                <div className="flex flex-wrap items-center gap-1">
                  {KindIcon && <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-1.5 py-0.5 text-[10px] font-semibold text-gold-800 ring-1 ring-gold-100"><KindIcon className="size-3 shrink-0" strokeWidth={2} />{coverageKindLabel(it.kind!)}</span>}
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100"><Building2 className="size-3 shrink-0" strokeWidth={2} />{it.mosqueName}</span>
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line"><MapPin className="size-3 shrink-0" strokeWidth={2} />{it.regionName}</span>
                </div>
                {/* مَن ومتى: نسبةُ الصورة لصاحبها — لا صورةَ مجهولةَ المصدر */}
                <p className="flex flex-wrap items-center gap-1 text-[10px] text-ink-faint">
                  <span className="inline-flex items-center gap-1"><User className="size-3" strokeWidth={2} />{it.byName ?? "غير منسوبة"}</span>
                  <span>·</span><span>{SOURCE_LABEL[it.source]}</span>
                  <span>·</span><span className="font-mono-nums">{fmtHijriShort(it.createdAt)}</span>
                </p>
              </figcaption>
            </>
          );
          return clickable ? (
            <button key={it.id} onClick={() => setOpenId(it.coverageId!)} type="button"
              className="overflow-hidden rounded-2xl bg-surface text-start ring-1 ring-line transition hover:ring-emerald-700/40">
              {Inner}
            </button>
          ) : (
            <figure key={it.id} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-line-strong">
              <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label={it.title}>{Inner}</a>
            </figure>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="font-mono-nums text-[11px] text-ink-faint">{items.length} من {total ?? 0}</span>
        {total !== null && items.length < total && (
          <button onClick={() => load(items.length)} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-surface px-4 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800 disabled:opacity-60">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} عرضُ المزيد
          </button>
        )}
      </div>
      {dialogs}
    </div>
  );
}

function MyCustody({ items }: { items: Asset[] }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3">
        <h3 className="font-display text-sm font-semibold text-ink">عُهدتي</h3>
        <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{items.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((a) => {
          const meta = KIND_META[a.kind] ?? { label: a.kind, Icon: Package };
          return (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><meta.Icon className="size-4" strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.name}{a.details && <span className="ms-1.5 text-[11px] font-normal text-ink-faint">· {a.details}</span>}</p>
                <p className="truncate text-[11px] text-ink-faint">{a.unitName}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", a.kind === "vehicle" ? "bg-gold-50 text-gold-700 ring-gold-100" : "bg-emerald-50 text-emerald-800 ring-emerald-100")}>{meta.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MediaHubPage() {
  const [tab, setTab] = useState("gallery");
  // «عُهدتي» تبويبٌ شخصيّ: لا يُعرض لمن لا عُهدةَ باسمه (قاعدة المرآة ٣٤ — لا تبويبَ فارغٌ أبدًا)
  const [custody, setCustody] = useState<Asset[]>([]);
  useEffect(() => { getMediaAssets().then((r) => setCustody((r as { items: Asset[] }).items)).catch(() => setCustody([])); }, []);
  const hasCustody = custody.length > 0;
  const options = [{ value: "gallery", label: "معرضُ الصور" }, ...(hasCustody ? [{ value: "assets", label: "عُهدتي" }] : [])];
  return (
    <MishkatShell>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20"><Images className="size-5" strokeWidth={1.5} /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">الإعلام</h1>
            <p className="mt-1 text-sm text-ink-soft">أثرُ الشبكة موثَّقاً بالصورة — تغطياتٌ وسجلّاتُ يومٍ ودروس، كلٌّ بحدثها ومكانها وصاحبها</p>
          </div>
        </header>
        {options.length > 1 && <MTabs value={tab} onValueChange={setTab} options={options} />}
        {tab === "assets" && hasCustody ? <MyCustody items={custody} /> : <GalleryGrid />}
      </main>
    </MishkatShell>
  );
}
