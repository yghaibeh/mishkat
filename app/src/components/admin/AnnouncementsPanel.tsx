import { useEffect, useState } from "react";
import { Megaphone, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { createAnnouncement, getAnnouncements, getAnnounceScopes } from "@/lib/api/announcements";

// إعلانات المنصّة (§ذ): تصل جرس كلّ من في النطاق + تيليغرام/Push لمن ربط.
type Ann = { id: string; title: string; body: string; audience: string; sentCount: number; createdByName: string | null; createdAt: number };
const AUD = [{ value: "all", label: "الجميع" }, { value: "leaders", label: "المسؤولون فقط" }, { value: "students", label: "الطلاب فقط" }];
const fmt = (ts: number) => new Date(ts).toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" });

export function AnnouncementsPanel() {
  const [items, setItems] = useState<Ann[]>([]);
  const [scopes, setScopes] = useState<Array<{ path: string; label: string }>>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scopePath, setScopePath] = useState("/");
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);

  const load = () => {
    getAnnouncements().then((r) => setItems((r as { items: Ann[] }).items ?? [])).catch(() => {});
    getAnnounceScopes().then((r) => { const s = (r as { items: Array<{ path: string; label: string }> }).items ?? []; setScopes(s); if (s[0]) setScopePath(s[0].path); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("العنوان والنصّ مطلوبان"); return; }
    setBusy(true);
    try {
      const r = await createAnnouncement({ data: { title: title.trim(), body: body.trim(), scopePath, audience: audience as never } });
      if (r && "error" in r && r.error) toast.error(r.error);
      else { toast.success(`أُرسل الإعلان إلى ${(r as { sent: number }).sent} شخصًا`); setTitle(""); setBody(""); load(); }
    } catch { toast.error("تعذّر الإرسال"); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Megaphone className="size-4 text-emerald-800" strokeWidth={1.75} />
          <h2 className="font-display text-sm font-semibold text-ink">إعلانٌ جديد</h2>
        </div>
        <Field label="العنوان"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="تهنئة / خبر / تعميم" /></Field>
        <Field label="النصّ">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
            className="w-full rounded-xl bg-surface-2 p-3 text-sm text-ink ring-1 ring-line outline-none focus:ring-emerald-700/40" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="النطاق"><MSelect value={scopePath} onValueChange={setScopePath} options={scopes.map((s) => ({ value: s.path, label: s.label }))} /></Field>
          <Field label="الجمهور"><MSelect value={audience} onValueChange={setAudience} options={AUD} /></Field>
        </div>
        <button onClick={submit} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} إرسال الإعلان
        </button>
      </div>

      <div className="lg:col-span-3">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {items.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-ink">📢 {a.title}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-ink-soft">{a.body}</p>
              <p className="mt-1 text-[11px] text-ink-faint">{fmt(a.createdAt)} · {AUD.find((x) => x.value === a.audience)?.label} · وصل {a.sentCount} شخصًا{a.createdByName ? ` · ${a.createdByName}` : ""}</p>
            </li>
          ))}
          {!items.length && <li className="p-6 text-center text-sm text-ink-faint">لا إعلانات بعد.</li>}
        </ul>
      </div>
    </div>
  );
}
