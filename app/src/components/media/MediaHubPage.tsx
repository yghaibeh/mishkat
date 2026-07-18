// مركزُ الإعلام — معرضُ صور الشبكة (تغطياتُ الإعلام + سجلّاتُ اليوم + دروسُ الحلقات) مربوطةً
// بمسجدها ومنطقتها. النشرُ لمسؤول الإعلام وحدَه (media.post)؛ والمديرُ يطَّلع ولا ينشر.
// «عُهدتي» تبويبٌ شخصيّ لمن بعُهدته أصل؛ وسجلُّ عُهد الشبكة مِلكُ «الصندوق» لا مرآةَ له هنا.
import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { Images, Loader2, MapPin, Building2, Package, Car, Briefcase, Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { MTabs } from "@/components/ui/m-tabs";
import { fmtHijriShort } from "@/lib/format";
import { hasCap } from "@/lib/capabilities";
import { getMediaGallery, getMediaAssets } from "@/lib/api/mediaHub";

type GalleryItem = { id: string; url: string; caption: string | null; createdAt: number; source: "daily" | "lesson" | "post"; mosqueName: string; regionName: string };
type Asset = { id: string; name: string; kind: string; details: string | null; holderName: string | null; unitName: string; createdAt: number };

// لكلِّ مصدرٍ اسمُه — بلا اسمٍ كان سطرُ التغطية يبدأ بفاصلةٍ يتيمة «· ٤ صفر»
const SOURCE_LABEL: Record<string, string> = { daily: "سجلّ اليوم", lesson: "درس حلقة", post: "تغطية إعلامية" };
const KIND_META: Record<string, { label: string; Icon: LucideIcon }> = {
  personal_custody: { label: "عهدة شخصية", Icon: Briefcase },
  vehicle: { label: "مركبة", Icon: Car },
  equipment: { label: "معدّات", Icon: Package },
};

function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  // النشرُ بقدرةٍ شخصيّة لا بدور: «*» المديرِ لا يمنحها (قاعدة المالك الواحد ٣٤)
  const ctxU = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const canPost = hasCap(ctxU.user?.caps ?? [], "media.post");
  const [officers, setOfficers] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const filePick = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", f); fd.set("scope", "media_post"); fd.set("caption", postCaption); fd.set("clientUuid", crypto.randomUUID());
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) toast.error(j?.error ?? "تعذّر الرفع");
      else { toast.success("نُشرت التغطية"); setPostCaption(""); load(0); }
    } finally { setUploading(false); }
  };
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
  const uploaderBar = canPost && (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
      <input value={postCaption} onChange={(e) => setPostCaption(e.target.value)} placeholder="وصف التغطية (اختياري)…"
        className="h-10 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-emerald-700/40" />
      <label className={"inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 hover:bg-emerald-900 " + (uploading ? "opacity-60 pointer-events-none" : "")}>
        <Camera className="size-4" strokeWidth={1.75} /> {uploading ? "يرفع…" : "تغطية جديدة"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { filePick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      </label>
    </div>
  );
  // فراغٌ يشرح سببَه (٣٤): للناشر دعوةٌ للعمل، وللمطَّلِع تشخيصٌ — أهو شغورُ الدور أم لم يُرفع بعد؟
  if (!items.length) return (
    <div>{uploaderBar}
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
    </div>
  );
  return (
    <div className="space-y-4">
      {uploaderBar}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <figure key={it.id} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-line-strong">
            <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label={it.caption ?? "فتح الصورة"}>
              <img src={it.url} alt={it.caption ?? "صورة توثيقية"} loading="lazy" className="aspect-square w-full object-cover" />
            </a>
            <figcaption className="space-y-1.5 p-2.5">
              {it.caption && <p className="truncate text-[11px] text-ink" title={it.caption}>{it.caption}</p>}
              {/* وسمٌ لا يُعرض فارغًا (٣٤): التغطيةُ منشورُ شبكةٍ بلا مسجدٍ ولا منطقة */}
              {(it.mosqueName || it.regionName) && (
                <div className="flex flex-wrap items-center gap-1">
                  {it.mosqueName && <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100"><Building2 className="size-3 shrink-0" strokeWidth={2} />{it.mosqueName}</span>}
                  {it.regionName && <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line"><MapPin className="size-3 shrink-0" strokeWidth={2} />{it.regionName}</span>}
                </div>
              )}
              <p className="text-[10px] text-ink-faint">{SOURCE_LABEL[it.source]} · {fmtHijriShort(it.createdAt)}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="font-mono-nums text-[11px] text-ink-faint">{items.length} من {total ?? 0}</span>
        {total !== null && items.length < total && (
          <button onClick={() => load(items.length)} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-surface px-4 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800 disabled:opacity-60">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} عرضُ المزيد
          </button>
        )}
      </div>
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
            <p className="mt-1 text-sm text-ink-soft">صورُ الشبكة الموثَّقة بمسجدها ومنطقتها — تغطياتٌ وسجلّاتُ يومٍ ودروس</p>
          </div>
        </header>
        {options.length > 1 && <MTabs value={tab} onValueChange={setTab} options={options} />}
        {tab === "assets" && hasCustody ? <MyCustody items={custody} /> : <GalleryGrid />}
      </main>
    </MishkatShell>
  );
}
