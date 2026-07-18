import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Search, ChevronLeft, Check, Landmark, Grid3x3, Building2,
  FolderTree, ListTree, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// منتقي شجري (modal) للهيكلية التنظيمية — مطويّ افتراضيًا، فتح بالفروع + بحث + «فتح الكل».
export type TreeNode = { id: string; name: string; type: string; parentId: string | null };

const ICON: Record<string, typeof Building2> = { rabita: Landmark, square: Grid3x3, mosque: Building2 };
const TYPE_LABEL: Record<string, string> = { rabita: "منطقة", square: "مربع", mosque: "مسجد" };

interface Props {
  value?: string;
  valueLabel?: string;
  onChange: (id: string, label: string) => void;
  loadTree: () => Promise<TreeNode[]>;
  selectableTypes?: string[];          // غير محدّد = الكلّ قابل للاختيار
  placeholder?: string;
  title?: string;
  emptyText?: string;
  disabled?: boolean;
}

export function MTreeSelect({
  value, valueLabel, onChange, loadTree, selectableTypes,
  placeholder = "اختر من الهيكلية…", title = "اختر من الهيكلية التنظيمية", emptyText = "لا عناصر ضمن نطاقك.", disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [nodes, setNodes] = React.useState<TreeNode[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!open) return;
    setLoading(true); setQ(""); setExpanded(new Set());
    loadTree().then(setNodes).catch(() => setNodes([])).finally(() => setLoading(false));
  }, [open]);

  const childrenMap = React.useMemo(() => {
    const m = new Map<string | null, TreeNode[]>();
    for (const n of nodes ?? []) { const a = m.get(n.parentId) ?? []; a.push(n); m.set(n.parentId, a); }
    for (const a of m.values()) a.sort((x, y) => x.name.localeCompare(y.name, "ar"));
    return m;
  }, [nodes]);

  // البحث: تظهر المطابقات وأسلافها، وتُفتح تلقائيًا
  const { visible, autoExpand } = React.useMemo(() => {
    const term = q.trim();
    if (!term || !nodes) return { visible: null as Set<string> | null, autoExpand: null as Set<string> | null };
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const vis = new Set<string>(); const exp = new Set<string>();
    for (const n of nodes) {
      if (!n.name.includes(term)) continue;
      vis.add(n.id);
      let p = n.parentId;
      while (p) { vis.add(p); exp.add(p); p = byId.get(p)?.parentId ?? null; }
    }
    return { visible: vis, autoExpand: exp };
  }, [q, nodes]);

  const isExpanded = (id: string) => (autoExpand ? autoExpand.has(id) : expanded.has(id));
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setExpanded(new Set((nodes ?? []).map((n) => n.id)));
  const collapseAll = () => setExpanded(new Set());
  const canPick = (t: string) => !selectableTypes || selectableTypes.includes(t);
  const pick = (n: TreeNode) => { onChange(n.id, n.name); setOpen(false); };

  const renderNodes = (parentId: string | null, depth: number): React.ReactNode =>
    (childrenMap.get(parentId) ?? [])
      .filter((n) => !visible || visible.has(n.id))
      .map((n) => {
        const hasKids = (childrenMap.get(n.id)?.length ?? 0) > 0;
        const exp = isExpanded(n.id);
        const Icon = ICON[n.type] ?? Building2;
        const pickable = canPick(n.type);
        return (
          <div key={n.id}>
            <div className={cn("group flex items-center gap-1 rounded-lg", value === n.id && "bg-emerald-50 ring-1 ring-emerald-200")}
              style={{ paddingInlineStart: `${depth * 16}px` }}>
              <button type="button" onClick={() => hasKids && toggle(n.id)} aria-label={hasKids ? "فتح/طيّ الفرع" : undefined}
                className={cn("grid size-7 shrink-0 place-items-center rounded-md text-ink-faint transition", hasKids ? "hover:bg-surface-2 hover:text-ink" : "pointer-events-none opacity-0")}>
                <ChevronLeft className={cn("size-4 transition-transform", exp && "-rotate-90")} strokeWidth={2} />
              </button>
              <button type="button" onClick={() => (pickable ? pick(n) : hasKids && toggle(n.id))}
                className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pe-2 text-start transition hover:bg-surface-2", !pickable && "cursor-default")}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><Icon className="size-4" strokeWidth={1.75} /></span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{n.name}</span>
                <span className="shrink-0 text-[10px] text-ink-faint">{TYPE_LABEL[n.type] ?? n.type}</span>
                {value === n.id && <Check className="size-4 shrink-0 text-emerald-700" strokeWidth={2} />}
              </button>
            </div>
            {hasKids && exp && renderNodes(n.id, depth + 1)}
          </div>
        );
      });

  const roots = childrenMap.get(null) ?? [];

  return (
    <>
      <button type="button" onClick={() => !disabled && setOpen(true)} disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 text-sm ring-1 ring-line transition hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
        <span className={cn("truncate", valueLabel ? "text-ink" : "text-ink-faint")}>{valueLabel || placeholder}</span>
        <FolderTree className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content dir="rtl"
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface shadow-soft ring-1 ring-line data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <Dialog.Title className="font-display text-sm font-semibold text-ink">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-2 hover:text-ink"><X className="size-4" strokeWidth={2} /></button>
              </Dialog.Close>
            </div>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم…" autoFocus
                  className="h-9 w-full rounded-xl bg-surface-2 pr-9 pl-3 text-sm text-ink ring-1 ring-line outline-none transition focus:ring-2 focus:ring-emerald-600" />
              </div>
              <button type="button" onClick={() => (expanded.size ? collapseAll() : expandAll())}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-ink">
                <ListTree className="size-3.5" strokeWidth={1.75} /> {expanded.size ? "طيّ الكل" : "فتح الكل"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
              ) : roots.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-soft">{emptyText}</div>
              ) : (
                <div className="space-y-0.5">{renderNodes(null, 0)}</div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
