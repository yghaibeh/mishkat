import { useEffect, useState, type ReactNode } from "react";
import {
  Search, Loader2, UserCog, KeyRound, Ban, CircleCheck, Save, Trash2, ShieldCheck, Users as UsersIcon,
  ChevronLeft, ListTree,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MTreeSelect } from "@/components/ui/m-tree-picker";
import { MDrawer } from "@/components/ui/m-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { listUsers, listUnitUsers, updateUser, setUserStatus, resetPassword, updateRole, approveRole, removeRole } from "@/lib/api/admin";
import { getOrgTree } from "@/lib/api/search";
import { ROLE_LABEL } from "@/lib/capabilities";
import { ROLE_ICON, ORG_TYPE_ICON, orgTypeIcon } from "@/lib/role-icons";

type OrgNode = { id: string; name: string; type: string; parentId: string | null };
const U_ICON = ORG_TYPE_ICON; // مركزيّ (lib/role-icons)

type RoleA = { id: string; role: string; scope: string; pending: boolean };
type U = { personId: string; userId: string; name: string; login: string; gender: string; status: string; statusReason?: string | null; lastLogin: number | null; roles: RoleA[] };
const STATUS_LABEL: Record<string, string> = { active: "نشط", disabled: "موقوف", deleted: "مُلغى" };

// مصدر الأدوار الوحيد: lib/capabilities (ROLE_LABEL) — لا تكرار محلّي حتى لا تتسرّب الأدوار
const ROLE_OPTS = Object.keys(ROLE_LABEL).map((r) => ({ value: r, label: ROLE_LABEL[r], icon: ROLE_ICON[r] }));
const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line";

export function UsersPanel() {
  const [items, setItems] = useState<U[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [sel, setSel] = useState<U | null>(null);

  const load = async (query: string, offset: number, append: boolean) => {
    setListBusy(true);
    try { const r = await listUsers({ data: { q: query || undefined, offset } }); setItems((p) => (append ? [...p, ...r.items] : r.items)); setTotal(r.total); }
    catch { /* dev */ } finally { setListBusy(false); }
  };
  useEffect(() => { const t = setTimeout(() => void load(q, 0, false), 250); return () => clearTimeout(t); }, [q]);
  const refresh = () => load(q, 0, false);

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <UsersIcon className="size-4 shrink-0 text-emerald-800" strokeWidth={1.75} />
        <h3 className="font-display text-sm font-semibold text-ink">المستخدمون</h3>
        <div className="relative ms-2 flex flex-1 items-center gap-2">
          <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الدخول…"
            className="h-8 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
          {listBusy && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" />}
        </div>
        <span className="shrink-0 font-mono-nums text-[11px] font-semibold text-ink-soft">{total}</span>
      </div>

      {!q ? (
        <UsersTree onSelect={setSel} />
      ) : items.length === 0 ? (
        <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لا مستخدم مطابق.</div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((u) => (
              <li key={u.userId}>
                <button onClick={() => setSel(u)} className="flex w-full items-center gap-3 px-5 py-3 text-right transition-colors hover:bg-surface-2/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-sm font-semibold text-emerald-800 ring-1 ring-line">
                    {u.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{u.name}</span>
                      {u.status !== "active" && <span className="shrink-0 rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger ring-1 ring-danger/20">{STATUS_LABEL[u.status] ?? u.status}</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                      <span dir="ltr" className="font-mono-nums">{u.login}</span>
                      {u.roles.slice(0, 2).map((r) => (
                        <span key={r.id} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-emerald-800 ring-1 ring-line">{ROLE_LABEL[r.role] ?? r.role} · {r.scope}{r.pending ? " (معلّق)" : ""}</span>
                      ))}
                      {u.roles.length > 2 && <span>+{u.roles.length - 2}</span>}
                    </span>
                  </span>
                  <UserCog className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
          {items.length < total && (
            <button onClick={() => load(q, items.length, true)} disabled={listBusy}
              className="w-full border-t border-line py-3 text-xs font-semibold text-emerald-800 transition hover:bg-surface-2/40 disabled:opacity-60">
              تحميل المزيد ({total - items.length})
            </button>
          )}
        </>
      )}

      {sel && <UserDrawer user={sel} onClose={() => setSel(null)} onChanged={() => { refresh(); }} />}
    </section>
  );
}

// عرض المستخدمين بهرمية الهيكلية — فروع مطويّة افتراضيًا، كلّ فرع يُفتح بزرّه ويحمّل مستخدميه كسولًا.
function UsersTree({ onSelect }: { onSelect: (u: U) => void }) {
  const [nodes, setNodes] = useState<OrgNode[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [usersByUnit, setUsersByUnit] = useState<Record<string, U[]>>({});
  const [loadingUnit, setLoadingUnit] = useState<Set<string>>(new Set());

  useEffect(() => { getOrgTree().then((n) => setNodes(n as OrgNode[])).catch(() => setNodes([])); }, []);

  const childrenMap = (() => {
    const m = new Map<string | null, OrgNode[]>();
    for (const n of nodes ?? []) { const a = m.get(n.parentId) ?? []; a.push(n); m.set(n.parentId, a); }
    for (const a of m.values()) a.sort((x, y) => x.name.localeCompare(y.name, "ar"));
    return m;
  })();

  const toggle = async (id: string) => {
    const willOpen = !expanded.has(id);
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    if (willOpen && !usersByUnit[id]) {
      setLoadingUnit((s) => new Set(s).add(id));
      try { const us = await listUnitUsers({ data: { unitId: id } }); setUsersByUnit((m) => ({ ...m, [id]: us as U[] })); }
      catch { /* */ } finally { setLoadingUnit((s) => { const n = new Set(s); n.delete(id); return n; }); }
    }
  };

  const renderUnit = (parentId: string | null, depth: number): ReactNode =>
    (childrenMap.get(parentId) ?? []).map((n) => {
      const exp = expanded.has(n.id);
      const Icon = orgTypeIcon(n.type);
      const us = usersByUnit[n.id];
      const loading = loadingUnit.has(n.id);
      const childUnits = childrenMap.get(n.id) ?? [];
      return (
        <div key={n.id}>
          <div className="group flex items-center gap-1 rounded-lg hover:bg-surface-2/40" style={{ paddingInlineStart: `${depth * 16}px` }}>
            <button type="button" onClick={() => toggle(n.id)} aria-label="فتح/طيّ الفرع"
              className="grid size-7 shrink-0 place-items-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink">
              <ChevronLeft className={cn("size-4 transition-transform", exp && "-rotate-90")} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => toggle(n.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pe-2 text-start">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><Icon className="size-4" strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{n.name}</span>
              {us && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono-nums text-[10px] font-semibold text-ink-soft ring-1 ring-line">{us.length}</span>}
            </button>
          </div>
          {exp && (
            <div>
              {renderUnit(n.id, depth + 1)}
              {loading && <div className="py-2" style={{ paddingInlineStart: `${(depth + 1) * 16 + 28}px` }}><Loader2 className="size-4 animate-spin text-ink-faint" /></div>}
              {us && us.length === 0 && childUnits.length === 0 && (
                <p className="py-1.5 text-[11px] text-ink-faint" style={{ paddingInlineStart: `${(depth + 1) * 16 + 28}px` }}>لا مستخدمين في هذه الوحدة.</p>
              )}
              {us?.map((u) => (
                <button key={u.userId} onClick={() => onSelect(u)} style={{ paddingInlineStart: `${(depth + 1) * 16 + 8}px` }}
                  className="flex w-full items-center gap-2.5 rounded-lg py-2 pe-3 text-start transition hover:bg-surface-2/60">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-xs font-semibold text-emerald-800 ring-1 ring-line">{u.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-ink">{u.name}</span>
                      {u.status !== "active" && <span className="shrink-0 rounded-full bg-danger-bg px-1.5 py-0.5 text-[9px] font-semibold text-danger ring-1 ring-danger/20">{STATUS_LABEL[u.status] ?? u.status}</span>}
                    </span>
                    <span className="truncate text-[10px] text-ink-faint">{u.roles.map((r) => ROLE_LABEL[r.role] ?? r.role).join("، ") || "—"}</span>
                  </span>
                  <UserCog className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });

  if (!nodes) return <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>;
  const roots = childrenMap.get(null) ?? [];
  if (roots.length === 0) return <div className="px-6 py-12 text-center text-sm text-ink-soft">لا وحدات ضمن نطاقك.</div>;
  return (
    <div className="space-y-0.5 p-3">
      <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-ink-faint"><ListTree className="size-3.5" strokeWidth={1.75} /> تصفّح الهيكلية — افتح فرعًا لعرض مستخدميه، أو ابحث بالاسم أعلاه.</p>
      {renderUnit(null, 0)}
    </div>
  );
}

function UserDrawer({ user, onClose, onChanged }: { user: U; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(user.name);
  const [login, setLogin] = useState(user.login);
  const [gender, setGender] = useState(user.gender);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<null | "active" | "disabled" | "deleted">(null);
  const active = user.status === "active";

  const run = async (key: string, fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, after?: () => void) => {
    setBusy(key);
    try { const r = await fn(); if (r && "error" in r && r.error) toast.error(r.error); else { toast.success(ok); after?.(); onChanged(); } }
    catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };

  return (
    <>
      <MDrawer open onOpenChange={(v) => !v && onClose()} title={user.name} description={`@${user.login}`}>
        <div className="space-y-6">
          {/* المعلومات */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">المعلومات</h4>
            <Field label="الاسم الكامل"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="اسم الدخول"><TextField value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" className="text-left" /></Field>
            <Field label="الجنس"><SegmentedControl value={gender} onValueChange={setGender} options={[{ value: "male", label: "ذكر" }, { value: "female", label: "أنثى" }]} /></Field>
            <button disabled={busy === "info" || name.length < 3 || login.length < 3}
              onClick={() => run("info", () => updateUser({ data: { personId: user.personId, fullName: name, login, gender: gender as "male" | "female" } }), "حُفظت المعلومات")} className={cn(btn, "w-full")}>
              {busy === "info" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ المعلومات
            </button>
          </div>

          {/* الأدوار */}
          <div className="space-y-3 border-t border-line pt-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">الأدوار والنطاقات</h4>
            {user.roles.length === 0 ? <p className="text-xs text-ink-soft">لا أدوار.</p> : user.roles.map((r) => (
              <RoleRow key={r.id} r={r} onChanged={onChanged} />
            ))}
          </div>

          {/* الأمان */}
          <div className="space-y-3 border-t border-line pt-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">الأمان</h4>
            <Field label="إعادة تعيين كلمة المرور" hint="٦ أحرف على الأقل">
              <div className="flex gap-2">
                <TextField type="text" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" className="text-left" placeholder="كلمة مرور جديدة" />
                <button disabled={busy === "pw" || pw.length < 6}
                  onClick={() => run("pw", () => resetPassword({ data: { personId: user.personId, password: pw } }), "أُعيد تعيين كلمة المرور", () => setPw(""))}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-surface-2 disabled:opacity-60">
                  {busy === "pw" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} تعيين
                </button>
              </div>
            </Field>
            {/* حالة الحساب — التجميد يُنهي كلّ الجلسات فورًا (session_epoch)؛ الإلغاء حذفٌ ناعم */}
            <div className="rounded-xl bg-surface-2/50 p-3 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-soft">حالة الحساب</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  active ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-danger-bg text-danger ring-danger/20")}>
                  {STATUS_LABEL[user.status] ?? user.status}
                </span>
              </div>
              {!active && user.statusReason && <p className="mt-1.5 text-[11px] text-ink-soft">السبب: {user.statusReason}</p>}
              {active ? (
                <div className="mt-3 space-y-2">
                  <TextField value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التجميد/الإلغاء (اختياري)" />
                  <div className="flex gap-2">
                    <button onClick={() => setConfirm("disabled")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-warn-bg px-3 text-sm font-semibold text-warn ring-1 ring-warn/20 transition hover:opacity-90">
                      <Ban className="size-4" /> تجميد
                    </button>
                    <button onClick={() => setConfirm("deleted")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger-bg px-3 text-sm font-semibold text-danger ring-1 ring-danger/20 transition hover:opacity-90">
                      <Trash2 className="size-4" /> إلغاء الحساب
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirm("active")}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 transition hover:bg-emerald-100">
                  <CircleCheck className="size-4" /> إعادة التفعيل
                </button>
              )}
            </div>
          </div>
        </div>
      </MDrawer>

      <ConfirmDialog
        open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === "active" ? "إعادة تفعيل الحساب؟" : confirm === "deleted" ? "إلغاء الحساب؟" : "تجميد الحساب؟"}
        description={confirm === "active"
          ? `سيتمكّن «${user.name}» من الدخول مجدّداً.`
          : confirm === "deleted"
            ? `سيُلغى حساب «${user.name}» (حذفٌ ناعم) ويُمنع دخوله وتُنهى كلّ جلساته فورًا.`
            : `سيُجمَّد «${user.name}»: يُمنع دخوله وتُنهى كلّ جلساته فورًا. قابلٌ للعكس.`}
        confirmLabel={confirm === "active" ? "تفعيل" : confirm === "deleted" ? "إلغاء الحساب" : "تجميد"}
        tone={confirm === "active" ? "emerald" : "danger"} busy={busy === "status"}
        onConfirm={() => confirm && run("status",
          () => setUserStatus({ data: { personId: user.personId, status: confirm, reason: reason.trim() || undefined } }),
          confirm === "active" ? "أُعيد التفعيل" : confirm === "deleted" ? "أُلغي الحساب" : "جُمّد الحساب",
          () => { setConfirm(null); setReason(""); })}
      />
    </>
  );
}

function RoleRow({ r, onChanged }: { r: RoleA; onChanged: () => void }) {
  const [role, setRole] = useState(r.role);
  const [scopeId, setScopeId] = useState("");
  const [scopeLbl, setScopeLbl] = useState(r.scope);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (key: string, fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, after?: () => void) => {
    setBusy(key);
    try { const x = await fn(); if (x && "error" in x && x.error) toast.error(x.error); else { toast.success(ok); after?.(); onChanged(); } }
    catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line">
      <div className="grid grid-cols-2 gap-2">
        <MSelect value={role} onValueChange={setRole} options={ROLE_OPTS} />
        <MTreeSelect value={scopeId} valueLabel={scopeLbl} onChange={(v, l) => { setScopeId(v); setScopeLbl(l); }} loadTree={() => getOrgTree()} placeholder={r.scope} title="اختر النطاق من الهيكلية" />
      </div>
      <div className="flex items-center gap-2">
        <button disabled={busy === "save" || !scopeId}
          onClick={() => run("save", () => updateRole({ data: { assignmentId: r.id, role, orgUnitId: scopeId } }), "حُدّث الدور")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 hover:bg-emerald-900 disabled:opacity-50">
          {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ
        </button>
        {r.pending && (
          <button disabled={busy === "approve"} onClick={() => run("approve", () => approveRole({ data: { assignmentId: r.id } }), "اعتُمد الدور")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100 disabled:opacity-50">
            <ShieldCheck className="size-3.5" /> اعتماد
          </button>
        )}
        <button onClick={() => setConfirmRemove(true)}
          className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger-bg px-3 text-xs font-semibold text-danger ring-1 ring-danger/20 hover:opacity-90">
          <Trash2 className="size-3.5" /> إنهاء
        </button>
      </div>
      <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} title="إنهاء التكليف؟"
        description="سيُنهى هذا الدور (لا يُحذف نهائيًا، بل يُؤرشَف بتاريخ نهاية)." confirmLabel="إنهاء" tone="danger" busy={busy === "remove"}
        onConfirm={() => run("remove", () => removeRole({ data: { assignmentId: r.id } }), "أُنهي التكليف", () => setConfirmRemove(false))} />
    </div>
  );
}
