import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronDown, FolderTree, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORG_TYPE_ICON } from "@/lib/role-icons";

// شجرة الوحدات التنظيمية مع أوراقٍ منسوبة لوحداتها (venue.orgUnitId ونحوه).
// تُستخدم حيثما تعدّدت عناصرٌ تابعة لوحدات مختلفة — لتفادي اختلاط الأسماء المتشابهة
// (قد يوجد مسجدان بالاسم نفسه)؛ الوصول عبر الشجرة يوضّح المسار الكامل.

export type TreeUnit = { id: string; name: string; type: string; parentId: string | null };
type Leaf = { id: string; unitId: string };

const TYPE_ICON = ORG_TYPE_ICON; // مركزيّ (lib/role-icons)
const TYPE_LABEL: Record<string, string> = { section: "قسم", rabita: "منطقة", square: "مربع", mosque: "مسجد", halaqa: "حلقة نسائية" };

export function UnitTree<L extends Leaf>({
  units, leaves, renderLeaf, filter, emptyLabel = "لا عناصر ضمن نطاقك.",
  lazy = false, loadLeaves, counts,
}: {
  units: TreeUnit[];
  leaves: L[];
  renderLeaf: (leaf: L) => ReactNode;
  filter?: (leaf: L) => boolean;   // ترشيح البحث — تُعرَض الأوراق المطابقة وفروعها فقط
  emptyLabel?: string;
  // الوضع الكسول (لآلاف الأوراق): لا تُمرَّر الأوراق مقدّمًا؛ تُحمَّل عند فتح الوحدة.
  // `counts` = عدد أوراق الشجرة الفرعية لكل وحدة (من الخادم) للشارات والتشذيب.
  lazy?: boolean;
  loadLeaves?: (unitId: string) => Promise<L[]>;
  counts?: Record<string, number>;
}) {
  // خزائن الوضع الكسول: الأوراق المُحمَّلة لكل وحدة + الوحدات قيد التحميل
  const [loaded, setLoaded] = useState<Map<string, L[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const shown = useMemo(() => (filter && !lazy ? leaves.filter(filter) : leaves), [leaves, filter, lazy]);

  const leavesByUnit = useMemo(() => {
    if (lazy) return loaded;               // في الوضع الكسول تأتي الأوراق من الخزينة المُحمَّلة
    const m = new Map<string, L[]>();
    for (const l of shown) { const a = m.get(l.unitId) ?? []; a.push(l); m.set(l.unitId, a); }
    return m;
  }, [shown, lazy, loaded]);

  const childUnits = useMemo(() => {
    const m = new Map<string | null, TreeUnit[]>();
    for (const u of units) { const a = m.get(u.parentId) ?? []; a.push(u); m.set(u.parentId, a); }
    return m;
  }, [units]);

  const unitIds = useMemo(() => new Set(units.map((u) => u.id)), [units]);
  const roots = useMemo(
    () => units.filter((u) => !u.parentId || !unitIds.has(u.parentId)).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [units, unitIds],
  );

  // عدد الأوراق في الشجرة الفرعية (للتشذيب + الشارة).
  // في الوضع الكسول تأتي الأعداد من الخادم (`counts`) لا من الأوراق المُحمَّلة.
  const subtreeCount = useMemo(() => {
    const memo = new Map<string, number>();
    if (lazy) {
      const own = (id: string) => counts?.[id] ?? 0; // counts = عدد أوراق الشجرة الفرعية مباشرةً
      for (const u of units) memo.set(u.id, own(u.id));
      return memo;
    }
    const walk = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      memo.set(id, 0); // حارس ضد الدوران
      let n = (leavesByUnit.get(id) ?? []).length;
      for (const c of childUnits.get(id) ?? []) n += walk(c.id);
      memo.set(id, n);
      return n;
    };
    for (const u of units) walk(u.id);
    return memo;
  }, [units, childUnits, leavesByUnit, lazy, counts]);

  const filtering = !!filter && !lazy;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => filtering || open.has(id); // عند البحث: تُفتح الفروع المطابقة تلقائيًّا

  // في الوضع الكسول: عند فتح وحدةٍ تحوي أوراقًا مباشرةً ولم تُحمَّل بعد، تُجلَب من الخادم وتُخبّأ.
  const ensureLoaded = (id: string) => {
    if (!lazy || !loadLeaves || loaded.has(id) || loading.has(id)) return;
    setLoading((prev) => new Set(prev).add(id));
    loadLeaves(id)
      .then((rows) => setLoaded((prev) => new Map(prev).set(id, rows)))
      .catch(() => setLoaded((prev) => new Map(prev).set(id, [])))
      .finally(() => setLoading((prev) => { const n = new Set(prev); n.delete(id); return n; }));
  };
  const toggle = (id: string) => {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else { n.add(id); ensureLoaded(id); }
      return n;
    });
  };

  const total = lazy
    ? roots.reduce((s, r) => s + (subtreeCount.get(r.id) ?? 0), 0)
    : shown.length;
  const allBranchIds = useMemo(() => units.filter((u) => (subtreeCount.get(u.id) ?? 0) > 0).map((u) => u.id), [units, subtreeCount]);

  if (total === 0) return <div className="grid place-items-center px-6 py-14 text-center text-sm text-ink-soft">{emptyLabel}</div>;

  const renderUnit = (u: TreeUnit, depth: number): ReactNode => {
    if ((subtreeCount.get(u.id) ?? 0) === 0) return null; // شذّب الفروع الفارغة
    const kids = (childUnits.get(u.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, "ar"));
    const own = leavesByUnit.get(u.id) ?? [];
    const opened = isOpen(u.id);
    const Icon = TYPE_ICON[u.type] ?? FolderTree;
    return (
      <li key={u.id}>
        <button
          onClick={() => toggle(u.id)}
          className="flex w-full items-center gap-2 py-2.5 pe-3 text-right transition-colors hover:bg-surface-2/50"
          style={{ paddingInlineStart: `${depth * 16 + 12}px` }}
        >
          {opened ? <ChevronDown className="size-4 shrink-0 text-ink-faint" strokeWidth={2} /> : <ChevronLeft className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />}
          <Icon className="size-4 shrink-0 text-emerald-800" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{u.name}</span>
          <span className="shrink-0 text-[10px] text-ink-faint">{TYPE_LABEL[u.type] ?? u.type}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono-nums text-[10px] font-semibold text-ink-soft ring-1 ring-line">{subtreeCount.get(u.id)}</span>
        </button>
        {opened && (
          <div>
            {kids.length > 0 && <ul>{kids.map((c) => renderUnit(c, depth + 1))}</ul>}
            {lazy && loading.has(u.id) && (
              <div className="flex items-center gap-2 py-2 text-[11px] text-ink-faint" style={{ paddingInlineStart: `${(depth + 1) * 16 + 12}px` }}>
                <Loader2 className="size-3.5 animate-spin" /> جارٍ التحميل…
              </div>
            )}
            {own.length > 0 && (
              <ul>
                {own.map((l) => (
                  <li key={l.id} style={{ paddingInlineStart: `${(depth + 1) * 16 + 12}px` }} className="border-s border-line/60">
                    {renderLeaf(l)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-4 py-2 text-[11px] text-ink-faint">
        <span className="font-mono-nums font-semibold">{total} عنصر ضمن الشجرة</span>
        {!filtering && !lazy && (
          <div className="flex gap-1">
            <button onClick={() => setOpen(new Set(allBranchIds))} className="rounded px-2 py-0.5 font-semibold text-emerald-800 hover:bg-surface-2">توسيع الكل</button>
            <button onClick={() => setOpen(new Set())} className="rounded px-2 py-0.5 font-semibold text-ink-soft hover:bg-surface-2">طيّ الكل</button>
          </div>
        )}
      </div>
      <ul className="divide-y divide-line/50">{roots.map((r) => renderUnit(r, 0))}</ul>
    </div>
  );
}
