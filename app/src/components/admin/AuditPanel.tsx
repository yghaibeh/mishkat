import { useEffect, useState } from "react";
import { Loader2, ScrollText, User2, ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuditLog } from "@/lib/api/network";

type Item = { id: string; action: string; entity: string; entityId: string; actorName: string; at: number; before: string | null; after: string | null };

// أفعالٌ شائعة بمسمّياتٍ عربية — البقيّة تُعرض كما هي
const ACTION_AR: Record<string, string> = {
  create: "إنشاء", update: "تعديل", delete: "حذف", approve: "اعتماد", reject: "رفض",
  grant: "منح", revoke: "حجب", assign: "إسناد", payout: "صرف",
};
const ENTITY_AR: Record<string, string> = {
  weekly_record: "سجل أسبوعيّ", org_unit: "وحدة تنظيمية", user: "مستخدم", role_assignment: "إسناد دور",
  lesson_session: "درس", entitlement: "مستحق", circle: "حلقة", halaqa: "حلقة على بصيرة",
};

function fmtTime(ms: number) {
  const d = new Date(ms);
  return `${d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" })} · ${d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}`;
}
function label(map: Record<string, string>, k: string) { return map[k] ?? k; }
function pretty(json: string | null): string {
  if (!json) return "—";
  try { return JSON.stringify(JSON.parse(json), null, 1); } catch { return json; }
}

// ر.٢ — عارض سجلّ التدقيق: قائمةٌ زمنية معزولةٌ بالنطاق (مَن/متى/الفعل/الكيان/قبل→بعد)
export function AuditPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = (off: number, append: boolean) => {
    setLoading(true);
    getAuditLog({ data: { action: action || undefined, entity: entity || undefined, offset: off } })
      .then((r) => {
        if ("error" in r) { setErr(r.error ?? "تعذّر التحميل"); return; }
        setErr(null);
        setItems((prev) => (append ? [...prev, ...r.items] : r.items));
        setHasMore(r.hasMore); setOffset(r.offset);
      })
      .catch(() => setErr("تعذّر التحميل"))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0, false); }, [action, entity]);

  if (err) return <div className="grid place-items-center rounded-2xl bg-surface px-6 py-16 text-center text-sm text-ink-soft ring-1 ring-line">{err}</div>;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ScrollText className="size-4 text-emerald-800" strokeWidth={1.75} /> سجلّ التدقيق
        </div>
        <div className="ms-auto flex gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-lg bg-surface px-3 text-xs text-ink ring-1 ring-line outline-none">
            <option value="">كل الأفعال</option>
            {Object.entries(ACTION_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="h-9 rounded-lg bg-surface px-3 text-xs text-ink ring-1 ring-line outline-none">
            <option value="">كل الكيانات</option>
            {Object.entries(ENTITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl bg-surface px-6 py-16 text-center text-sm text-ink-soft ring-1 ring-line">لا قيود مطابقة ضمن نطاقك.</div>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line divide-y divide-line">
          {items.map((it) => {
            const open = openId === it.id;
            return (
              <li key={it.id}>
                <button onClick={() => setOpenId(open ? null : it.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-surface-2/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><User2 className="size-4" strokeWidth={1.75} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-semibold">{it.actorName}</span>
                      <span className="text-ink-soft"> — {label(ACTION_AR, it.action)} </span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-soft">{label(ENTITY_AR, it.entity)}</span>
                    </p>
                    <p className="mt-0.5 font-mono-nums text-[11px] text-ink-faint">{fmtTime(it.at)}</p>
                  </div>
                  {open ? <ChevronDown className="size-4 shrink-0 text-ink-faint" strokeWidth={2} /> : <ChevronLeft className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />}
                </button>
                {open && (
                  <div className="grid gap-3 border-t border-line bg-surface-2/30 px-4 py-3 sm:grid-cols-2">
                    <Diff title="قبل" body={pretty(it.before)} tone="danger" />
                    <Diff title="بعد" body={pretty(it.after)} tone="ok" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="grid place-items-center">
          <button onClick={() => load(offset + items.length, true)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line hover:text-ink disabled:opacity-60">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null} تحميل المزيد
          </button>
        </div>
      )}
    </section>
  );
}

function Diff({ title, body, tone }: { title: string; body: string; tone: "danger" | "ok" }) {
  return (
    <div>
      <p className={cn("mb-1 text-[11px] font-semibold", tone === "ok" ? "text-emerald-800" : "text-danger")}>{title}</p>
      <pre className="max-h-40 overflow-auto rounded-lg bg-surface p-2 text-[11px] leading-relaxed text-ink-soft ring-1 ring-line" dir="ltr">{body}</pre>
    </div>
  );
}
