import { useEffect, useMemo, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { BookOpen, CheckCircle2, Loader2, FileText, Headphones, Link2, Upload, Plus, ClipboardList, Download, BadgeCheck, CircleDashed, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hasCap } from "@/lib/capabilities";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MishkatShell } from "@/components/nav/MishkatShell";
import {
  getMyLibrary, markMaterialOpened, markMaterialCompleted,
  listMaterialsAdmin, createMaterial, updateMaterial, getMaterialTracking,
} from "@/lib/api/materials";

const CATEGORIES = [
  { key: "aqeedah", label: "عقيدة" }, { key: "fiqh", label: "فقه" }, { key: "seerah", label: "سيرة" },
  { key: "tarbiya", label: "تربية" }, { key: "admin_training", label: "تدريب إداريّ" }, { key: "other", label: "أخرى" },
  // بذرة المواد تستعمل هذه المفاتيح — كانت تظهر أكواداً إنجليزية خاماً فوق العناوين (تدقيق ٣٣ ب)
  { key: "supervision", label: "مهارات الإشراف" }, { key: "education", label: "التعليم والتربية" },
  { key: "tech", label: "تقنية وأمن معلومات" }, { key: "safety", label: "سلامة وإسعاف" }, { key: "media", label: "إعلام" },
];
const AUDIENCES = [
  { key: "amir", label: "مسؤولو المساجد" }, { key: "teacher", label: "المعلّمون" },
  { key: "supervisor", label: "المشرفون" }, { key: "all", label: "الجميع" },
];
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;
const audLabel = (k: string) => AUDIENCES.find((a) => a.key === k)?.label ?? k;
const KindIcon = ({ kind, className }: { kind: string; className?: string }) =>
  kind === "audio" ? <Headphones className={className} strokeWidth={1.75} /> : kind === "link" ? <Link2 className={className} strokeWidth={1.75} /> : <FileText className={className} strokeWidth={1.75} />;

type Item = {
  id: string; title: string; category: string; kind: string; url: string | null;
  description: string | null; mandatory: boolean; sizeBytes: number | null;
  deliveredAt: number | null; openedAt: number | null; completedAt: number | null;
};

export function LibraryPage() {
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx.user?.caps ?? [];
  const canManage = hasCap(caps, "*") || hasCap(caps, "library.manage");
  const [tab, setTab] = useState<"mine" | "manage" | "tracking">("mine");

  return (
    <MishkatShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <BookOpen className="size-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">المكتبة التدريبيّة</h1>
            <p className="mt-0.5 text-sm text-ink-soft">موادّ مصنّفة — والمطلوب منك إنجازُ الإلزاميّ منها</p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-1 border-b border-line">
            {([["mine", "مكتبتي"], ["manage", "إدارة الموادّ"], ["tracking", "متابعة الإنجاز"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("relative px-4 py-2.5 text-sm font-medium transition-colors", tab === k ? "text-emerald-800" : "text-ink-soft hover:text-ink")}>
                {l}
                {tab === k && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-800" />}
              </button>
            ))}
          </div>
        )}

        {tab === "mine" && <MyLibrary />}
        {tab === "manage" && canManage && <ManageMaterials />}
        {tab === "tracking" && canManage && <TrackingMatrix />}
      </div>
    </MishkatShell>
  );
}

/* ===== مكتبتي ===== */
function MyLibrary() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => { getMyLibrary().then((r) => { const d = r as { items?: Item[] }; setItems(d.items ?? []); }).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);

  if (!items) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;
  if (!items.length) return <p className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-line">لا موادّ في مكتبتك بعد.</p>;

  const open = async (it: Item) => {
    if (it.url) window.open(it.url, "_blank");
    if (!it.openedAt) { await markMaterialOpened({ data: { id: it.id } }).catch(() => {}); load(); }
  };
  const complete = async (it: Item) => {
    setBusy(it.id);
    try {
      const r = await markMaterialCompleted({ data: { id: it.id } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success("بارك الله فيك — سُجّل الإنجاز"); load(); }
    } catch { toast.error("تعذّر التسجيل"); } finally { setBusy(null); }
  };

  const mandatory = items.filter((i) => i.mandatory);
  const doneCount = mandatory.filter((i) => i.completedAt).length;
  const byCat = new Map<string, Item[]>();
  for (const it of items) { if (!byCat.has(it.category)) byCat.set(it.category, []); byCat.get(it.category)!.push(it); }

  return (
    <div className="space-y-6">
      {mandatory.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <BadgeCheck className="size-5 shrink-0 text-emerald-800" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">إنجازك للموادّ الإلزاميّة</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
              <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${mandatory.length ? Math.round((doneCount / mandatory.length) * 100) : 0}%` }} />
            </div>
          </div>
          <span className="shrink-0 font-mono-nums text-sm font-bold text-emerald-800">{doneCount}/{mandatory.length}</span>
        </div>
      )}

      {[...byCat.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-ink">{catLabel(cat)}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((it) => (
              <li key={it.id} className={cn("flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 transition", it.completedAt ? "ring-emerald-200" : "ring-line")}>
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", it.completedAt ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-surface-2 text-emerald-800 ring-line")}>
                  <KindIcon kind={it.kind} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {it.title}
                    {it.mandatory && !it.completedAt && <span className="ms-1.5 rounded-full bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold text-warn ring-1 ring-warn/20">إلزاميّ</span>}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                    {it.description ?? ""}{it.sizeBytes ? ` · ${(it.sizeBytes / 1048576).toFixed(1)} م.ب` : ""}
                    {it.completedAt ? " · مُنجَز ✓" : it.openedAt ? " · مفتوح" : " · لم يُفتح بعد"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => open(it)} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-ink ring-1 ring-line hover:bg-surface">
                    <Download className="size-3" /> فتح
                  </button>
                  {!it.completedAt && (
                    <button onClick={() => complete(it)} disabled={!!busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
                      {busy === it.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} أتممتُه
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ===== إدارة الموادّ ===== */
type AdminItem = { id: string; title: string; category: string; kind: string; audience: string; mandatory: boolean; status: string; sortOrder: number };
function ManageMaterials() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [open, setOpen] = useState(false);
  const load = () => { listMaterialsAdmin().then((r) => setItems((r as { items: AdminItem[] }).items ?? [])).catch(() => {}); };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink">موادّ المكتبة ({items.length})</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">
          <Plus className="size-3.5" /> مادّةٌ جديدة
        </button>
      </div>
      {open && <NewMaterialForm onDone={() => { setOpen(false); load(); }} />}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <KindIcon kind={m.kind} className="size-4 shrink-0 text-emerald-800" />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-semibold", m.status === "archived" ? "text-ink-faint line-through" : "text-ink")}>{m.title}</p>
              <p className="text-[11px] text-ink-faint">{catLabel(m.category)} · {audLabel(m.audience)}{m.mandatory ? " · إلزاميّ" : ""}</p>
            </div>
            <button onClick={async () => { await updateMaterial({ data: { id: m.id, mandatory: !m.mandatory } }); load(); }}
              className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1", m.mandatory ? "bg-warn-bg text-warn ring-warn/20" : "bg-surface-2 text-ink-soft ring-line")}>
              {m.mandatory ? "إلزاميّ" : "اختياريّ"}
            </button>
            <button onClick={async () => { await updateMaterial({ data: { id: m.id, status: m.status === "archived" ? "active" : "archived" } }); load(); }}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line hover:bg-surface-2">
              {m.status === "archived" ? "تفعيل" : "أرشفة"}
            </button>
          </li>
        ))}
        {!items.length && <li className="p-6 text-center text-sm text-ink-faint">لا موادّ بعد — أضف أولى الموادّ التدريبيّة.</li>}
      </ul>
    </div>
  );
}

function NewMaterialForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("admin_training");
  const [kind, setKind] = useState<"pdf" | "audio" | "link">("pdf");
  const [audience, setAudience] = useState("amir");
  const [mandatory, setMandatory] = useState(true);
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    setBusy(true);
    try {
      let r2Key: string | undefined, contentType: string | undefined, sizeBytes: number | undefined;
      if (kind !== "link") {
        if (!file) { toast.error("اختر الملفّ"); setBusy(false); return; }
        const fd = new FormData();
        fd.set("scope", "training_material"); fd.set("file", file);
        const up = await fetch("/api/media/upload", { method: "POST", body: fd });
        const uj = await up.json() as { ok?: boolean; error?: string; r2Key?: string; contentType?: string; sizeBytes?: number };
        if (!up.ok || !uj.ok) { toast.error(uj.error ?? "فشل الرفع"); setBusy(false); return; }
        r2Key = uj.r2Key; contentType = uj.contentType; sizeBytes = uj.sizeBytes;
      }
      const res = await createMaterial({ data: { title: title.trim(), category, kind, audience, mandatory, description: description.trim() || undefined, r2Key, contentType, sizeBytes, externalUrl: kind === "link" ? externalUrl.trim() : undefined } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success("أُضيفت المادّة"); onDone(); }
    } catch { toast.error("تعذّرت الإضافة"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Field label="العنوان"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="كتاب فقه العبادات" /></Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="التصنيف"><MSelect value={category} onValueChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} /></Field>
        <Field label="النوع"><MSelect value={kind} onValueChange={(v) => setKind(v as never)} options={[{ value: "pdf", label: "PDF" }, { value: "audio", label: "صوت" }, { value: "link", label: "رابط" }]} /></Field>
        <Field label="الجمهور"><MSelect value={audience} onValueChange={setAudience} options={AUDIENCES.map((a) => ({ value: a.key, label: a.label }))} /></Field>
        <Field label="الإلزام"><MSelect value={mandatory ? "1" : "0"} onValueChange={(v) => setMandatory(v === "1")} options={[{ value: "1", label: "إلزاميّ (يُتابَع)" }, { value: "0", label: "اختياريّ" }]} /></Field>
      </div>
      <Field label="وصفٌ مختصر (اختياري)"><TextField value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {kind === "link" ? (
        <Field label="الرابط"><TextField value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} dir="ltr" className="text-left" placeholder="https://…" /></Field>
      ) : (
        <Field label={kind === "pdf" ? "ملفّ PDF (≤ ٣٠ م.ب)" : "ملفّ صوتيّ (≤ ٣٠ م.ب)"}>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-soft ring-1 ring-line hover:bg-surface">
            <Upload className="size-4 text-emerald-800" />
            {file ? file.name : "اختر الملفّ…"}
            <input type="file" accept={kind === "pdf" ? "application/pdf" : "audio/*"} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
      )}
      <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة المادّة
      </button>
    </div>
  );
}

/* ===== متابعة الإنجاز ===== */
type TrackMat = { id: string; title: string; audience: string };
type TrackRow = { personId: string; fullName: string; unitName: string | null; perMaterial: Array<{ materialId: string; state: string }>; completed: number; total: number };
const STATE_ICON: Record<string, { Icon: typeof CheckCircle2; cls: string; label: string }> = {
  completed: { Icon: CheckCircle2, cls: "text-emerald-700", label: "أنجز" },
  opened: { Icon: Eye, cls: "text-gold-700", label: "فتح ولم يُقرّ" },
  delivered: { Icon: CircleDashed, cls: "text-ink-faint", label: "استلم فقط" },
  none: { Icon: CircleDashed, cls: "text-danger/60", label: "لم يستلم" },
};
function TrackingMatrix() {
  const [data, setData] = useState<{ materials: TrackMat[]; rows: TrackRow[] } | null>(null);
  useEffect(() => { getMaterialTracking().then((r) => { if (!("error" in (r as object))) setData(r as never); }).catch(() => {}); }, []);
  const csv = useMemo(() => {
    if (!data) return "";
    const head = ["الاسم", "الوحدة", ...data.materials.map((m) => m.title), "المُنجَز"].join(",");
    const lines = data.rows.map((r) => [r.fullName, r.unitName ?? "", ...r.perMaterial.map((p) => STATE_ICON[p.state]?.label ?? p.state), `${r.completed}/${r.total}`].join(","));
    return "﻿" + [head, ...lines].join("\n");
  }, [data]);

  if (!data) return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;
  if (!data.materials.length) return <p className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-line">لا موادّ إلزاميّةً بعد — اجعل مادّةً «إلزاميّة» لتظهر المتابعة.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><ClipboardList className="size-4 text-emerald-800" /> إنجاز الأفراد للموادّ الإلزاميّة</h2>
        <button onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "متابعة-المكتبة.csv"; a.click(); }}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line hover:bg-surface-2">CSV</button>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-right text-[11px] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">الاسم</th>
              <th className="px-3 py-2.5 font-medium">الوحدة</th>
              {data.materials.map((m) => <th key={m.id} className="px-3 py-2.5 text-center font-medium">{m.title}</th>)}
              <th className="px-3 py-2.5 text-center font-medium">المُنجَز</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.map((r) => (
              <tr key={r.personId}>
                <td className="px-4 py-2.5 font-semibold text-ink">{r.fullName}</td>
                <td className="px-3 py-2.5 text-[12px] text-ink-soft">{r.unitName ?? "—"}</td>
                {r.perMaterial.map((p) => {
                  const s = STATE_ICON[p.state] ?? STATE_ICON.none;
                  return <td key={p.materialId} className="px-3 py-2.5 text-center" title={s.label}><s.Icon className={cn("mx-auto size-4", s.cls)} strokeWidth={2} /></td>;
                })}
                <td className={cn("px-3 py-2.5 text-center font-mono-nums text-xs font-bold", r.completed === r.total ? "text-emerald-700" : "text-ink-soft")}>{r.completed}/{r.total}</td>
              </tr>
            ))}
            {!data.rows.length && <tr><td colSpan={3 + data.materials.length} className="p-6 text-center text-sm text-ink-faint">لا أفراد ضمن نطاقك في جمهور الموادّ.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
