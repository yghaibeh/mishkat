import { useMemo, useState } from "react";
import { useRouter, useRouteContext } from "@tanstack/react-router";
import {
  Network, UserPlus, Loader2, Plus,
  KeyRound, Pencil, ChevronLeft, ChevronDown, FoldVertical, UnfoldVertical,
} from "lucide-react";
import { hasCap, ROLE_LABEL } from "@/lib/capabilities";
import { ROLE_ICON, ORG_TYPE_ICON, orgTypeIcon } from "@/lib/role-icons";
import { cn } from "@/lib/utils";
import { MTabs } from "@/components/ui/m-tabs";
import { toast } from "sonner";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MTreeSelect } from "@/components/ui/m-tree-picker";
import { GOV_OPTIONS, districtsOf } from "@/lib/syria-regions";
import { getOrgTree } from "@/lib/api/search";
import { createOrgUnit, createUserWithRole } from "@/lib/api/admin";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { OrgUnitEditor } from "@/components/admin/OrgUnitEditor";
import { PermissionsPanel } from "@/components/admin/PermissionsPanel";
import { RatesPanel } from "@/components/admin/RatesPanel";
import { GeneralSettingsPanel } from "@/components/admin/GeneralSettingsPanel";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { AnnouncementsPanel } from "@/components/admin/AnnouncementsPanel";

type OrgUnit = { id: string; name: string; type: string; parentId: string | null; genderTrack: string; path?: string; governorate?: string | null; district?: string | null };

const TYPE_LABEL: Record<string, string> = { section: "قسم", rabita: "منطقة", square: "مربع", mosque: "مسجد", halaqa: "حلقة نسائية" };
const TYPE_ICON = ORG_TYPE_ICON; // مركزيّ (lib/role-icons)

const btnPrimary =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line";

export function AdminPage({ orgUnits = [] }: { orgUnits?: OrgUnit[] }) {
  const router = useRouter();
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const caps = ctx?.user?.caps ?? [];
  const canSettings = hasCap(caps, "settings.view");
  const canManageSettings = hasCap(caps, "settings.manage");
  const canManageUsers = hasCap(caps, "user.manage");
  const canManageOrg = hasCap(caps, "orgUnit.manage");
  const canManagePerms = hasCap(caps, "permissions.manage");
  const canAudit = hasCap(caps, "audit.view");
  const isAdmin = caps.includes("*");
  const [tab, setTab] = useState("structure");
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);

  const mosques = orgUnits.filter((o) => o.type === "mosque");
  const countUnder = (path?: string) => (path ? mosques.filter((m) => m.path && m.path.startsWith(path!)).length : 0);

  // شجرة هرمية قابلة للطي — أبناء كل وحدة + الجذور + معرّفات الوحدات التي لها أبناء
  const { roots, childrenOf, parentIds } = useMemo(() => {
    const byParent = new Map<string | null, OrgUnit[]>();
    for (const u of orgUnits) {
      const k = u.parentId ?? null;
      const arr = byParent.get(k) ?? [];
      arr.push(u);
      byParent.set(k, arr);
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    const pIds = new Set<string>();
    for (const u of orgUnits) if ((byParent.get(u.id)?.length ?? 0) > 0) pIds.add(u.id);
    return { roots: byParent.get(null) ?? [], childrenOf: (id: string) => byParent.get(id) ?? [], parentIds: pIds };
  }, [orgUnits]);
  // مطويّة افتراضياً (الجذور فقط)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleNode = (id: string) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setOpenIds(new Set(parentIds));
  const collapseAll = () => setOpenIds(new Set());

  // نموذج الوحدة
  const [ouName, setOuName] = useState("");
  const [ouType, setOuType] = useState("mosque");
  const [ouParent, setOuParent] = useState(""); const [ouParentLbl, setOuParentLbl] = useState("");
  const [ouGender, setOuGender] = useState<"male" | "female">("male");
  const [ouGov, setOuGov] = useState(""); const [ouDistrict, setOuDistrict] = useState("");
  const [ouBusy, setOuBusy] = useState(false);

  // نموذج المستخدم
  const [uName, setUName] = useState("");
  const [uLogin, setULogin] = useState("");
  const [uPass, setUPass] = useState("");
  const [uGender, setUGender] = useState<"male" | "female">("male");
  const [uRole, setURole] = useState("amir");
  const [uOrg, setUOrg] = useState(""); const [uOrgLbl, setUOrgLbl] = useState("");
  const [uBusy, setUBusy] = useState(false);

  const submitOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOuBusy(true);
    try {
      const res = await createOrgUnit({ data: {
        parentId: ouParent || null, type: ouType as never,
        section: ouGender === "female" ? "women" : "men", genderTrack: ouGender, name: ouName,
        ...(ouType === "mosque" ? { governorate: ouGov || undefined, district: ouDistrict || undefined } : {}),
      } });
      if ("error" in res && res.error) toast.error(res.error);
      else { toast.success("أُنشئت الوحدة", { description: ouName }); setOuName(""); setOuParent(""); setOuParentLbl(""); setOuGov(""); setOuDistrict(""); await router.invalidate(); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setOuBusy(false); }
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUBusy(true);
    try {
      const res = await createUserWithRole({ data: { fullName: uName, login: uLogin, password: uPass, gender: uGender, role: uRole, orgUnitId: uOrg } });
      if ("error" in res && res.error) toast.error(res.error);
      else { toast.success("أُنشئ المستخدم ومُنح الدور", { description: uLogin }); setUName(""); setULogin(""); setUPass(""); setUOrg(""); setUOrgLbl(""); await router.invalidate(); }
    } catch { toast.error("تعذّر الإنشاء"); } finally { setUBusy(false); }
  };

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <Network className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">الإدارة</h1>
            <p className="mt-1 text-sm text-ink-soft">الهيكلية والمستخدمون والأدوار والإعلانات</p>
            {/* أدواتُ إعداد التعليم (أماكن/معلمون/حلقات) إداريةٌ استثنائية — موضعها هنا لا تبويبٌ روتيني (بلاغ المالك) */}
            <a href="/ala-baseera?tab=setup" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">إعداد التعليم: أماكن · معلمون · حلقات ←</a>
          </div>
          <div className="ms-auto hidden gap-5 sm:flex">
            <Stat label="وحدة" value={orgUnits.length} />
            <Stat label="مسجد" value={mosques.length} />
          </div>
        </header>

        <MTabs
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "structure", label: "الهيكلية" },
            ...(canManageUsers ? [{ value: "users", label: "المستخدمون" }] : []),
            ...(canManagePerms ? [{ value: "permissions", label: "الصلاحيات" }] : []),
            ...(canSettings ? [{ value: "general", label: "عامة" }, { value: "rates", label: "المعدّلات" }] : []),
            { value: "announce", label: "الإعلانات" },
            ...(canAudit ? [{ value: "audit", label: "التدقيق" }] : []),
          ]}
        />

        {tab === "structure" ? (
          <div className="grid gap-6 lg:grid-cols-5">
            {canManageOrg && (
            <form onSubmit={submitOrg} className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <Plus className="size-4 text-emerald-800" strokeWidth={1.75} />
                <h2 className="font-display text-sm font-semibold text-ink">إضافة وحدة تنظيمية</h2>
              </div>
              <Field label="الاسم" required>
                <TextField value={ouName} onChange={(e) => setOuName(e.target.value)} placeholder="مثال: منطقة محافظة حلب" />
              </Field>
              <Field label="القسم" hint="الذكور: مسجد يحوي حلقات · النساء: حلقة نسائية تتبع المربع (لا مسجد).">
                <SegmentedControl value={ouGender} onValueChange={(v) => { setOuGender(v as "male" | "female"); setOuType(v === "female" ? "halaqa" : "mosque"); }}
                  options={[{ value: "male", label: "قسم الذكور" }, { value: "female", label: "قسم النساء" }]} />
              </Field>
              <Field label="النوع">
                <MSelect value={ouType} onValueChange={setOuType}
                  options={(ouGender === "female" ? ["rabita", "square", "halaqa"] : ["rabita", "square", "mosque"]).map((t) => ({ value: t, label: TYPE_LABEL[t], icon: TYPE_ICON[t] }))} />
              </Field>
              {ouType === "mosque" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="المحافظة" hint="الموقع الجغرافي للمسجد">
                    <MSelect value={ouGov} onValueChange={(v) => { setOuGov(v); setOuDistrict(""); }}
                      options={GOV_OPTIONS} placeholder="اختر المحافظة…" />
                  </Field>
                  <Field label="المنطقة/البلدة">
                    <TextField value={ouDistrict} onChange={(e) => setOuDistrict(e.target.value)} disabled={!ouGov}
                      list={`ou-districts-${ouGov}`} placeholder={ouGov ? "اكتب أو اختر البلدة/القرية…" : "اختر المحافظة أولاً"} />
                    <datalist id={`ou-districts-${ouGov}`}>
                      {districtsOf(ouGov).map((d) => <option key={d.code} value={d.name} />)}
                    </datalist>
                  </Field>
                </div>
              )}
              {/* الجذرُ للإدارة العليا وحدَها: كان يُعرض لمسؤول المنطقة فيُنشئ ثمّ يُردّ «لا يمكنك
                  إنشاء وحدة جذرية» — عرضُ فعلٍ لا يملكه (قاعدة المالك الواحد ٣٤). */}
              <Field label="الوحدة الأب" hint={isAdmin ? "اتركها فارغة لإنشاء جذر (منطقة)." : "الوحدة الجديدة تُنشأ داخل نطاقك."}>
                <MTreeSelect value={ouParent} valueLabel={ouParentLbl} onChange={(v, l) => { setOuParent(v); setOuParentLbl(l); }}
                  loadTree={() => getOrgTree()} placeholder={isAdmin ? "— بلا أب (جذر) —" : "اختر الوحدة الأب…"} title="اختر الوحدة الأب من الهيكلية" />
              </Field>
              <button type="submit" disabled={ouBusy || ouName.length < 2 || (!isAdmin && !ouParent)} className={btnPrimary}>
                {ouBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                إنشاء الوحدة
              </button>
            </form>
            )}

            <section className={cn("overflow-hidden rounded-2xl bg-surface ring-1 ring-line", canManageOrg ? "lg:col-span-3" : "lg:col-span-5")}>
              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
                <h3 className="font-display text-sm font-semibold text-ink">الهيكلية التنظيمية</h3>
                <div className="flex items-center gap-3">
                  {roots.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button onClick={expandAll} aria-label="فتح الكل" title="فتح الكل"
                        className="grid size-7 place-items-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-emerald-800"><UnfoldVertical className="size-4" strokeWidth={1.75} /></button>
                      <button onClick={collapseAll} aria-label="طيّ الكل" title="طيّ الكل"
                        className="grid size-7 place-items-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-emerald-800"><FoldVertical className="size-4" strokeWidth={1.75} /></button>
                    </div>
                  )}
                  <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{orgUnits.length} وحدة</span>
                </div>
              </div>
              {roots.length === 0 ? (
                <div className="grid place-items-center px-6 py-16 text-center text-sm text-ink-soft">لا وحدات بعد — أنشئ منطقة أولاً.</div>
              ) : (
                <ul className="py-2">
                  {roots.map((u) => (
                    <OrgTreeNode key={u.id} unit={u} depth={0} childrenOf={childrenOf} openIds={openIds}
                      onToggle={toggleNode} canManage={canManageOrg} onEdit={setEditUnit} countUnder={countUnder} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : tab === "users" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-5">
            <form onSubmit={submitUser} className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-3">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <UserPlus className="size-4 text-emerald-800" strokeWidth={1.75} />
                <h2 className="font-display text-sm font-semibold text-ink">إنشاء مستخدم ومنحه دوراً</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الاسم الكامل" required><TextField value={uName} onChange={(e) => setUName(e.target.value)} /></Field>
                <Field label="اسم الدخول" required><TextField value={uLogin} onChange={(e) => setULogin(e.target.value)} dir="ltr" className="text-left" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="كلمة المرور" hint="٦ أحرف على الأقل" required>
                  <TextField type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} dir="ltr" className="text-left" />
                </Field>
                <Field label="الجنس">
                  <SegmentedControl value={uGender} onValueChange={(v) => setUGender(v as "male" | "female")}
                    options={[{ value: "male", label: "ذكر" }, { value: "female", label: "أنثى" }]} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الدور">
                  <MSelect value={uRole} onValueChange={setURole}
                    options={Object.keys(ROLE_LABEL).filter((r) => isAdmin || r !== "admin").map((r) => ({ value: r, label: ROLE_LABEL[r], icon: ROLE_ICON[r] }))} />
                </Field>
                <Field label="النطاق (وحدة)" required>
                  <MTreeSelect value={uOrg} valueLabel={uOrgLbl} onChange={(v, l) => { setUOrg(v); setUOrgLbl(l); }}
                    loadTree={() => getOrgTree()} placeholder="— اختر الوحدة —" title="اختر النطاق من الهيكلية" />
                </Field>
              </div>
              <button type="submit" disabled={uBusy || uName.length < 3 || uLogin.length < 3 || uPass.length < 6 || !uOrg} className={btnPrimary}>
                {uBusy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                إنشاء المستخدم ومنحه الدور
              </button>
            </form>

            <aside className="space-y-3 rounded-2xl bg-gold-50 p-5 ring-1 ring-gold-100 lg:col-span-2">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-gold-700" strokeWidth={1.75} />
                <h3 className="font-display text-sm font-semibold text-gold-700">منح الأدوار</h3>
              </div>
              <p className="text-xs leading-relaxed text-gold-700/80">
                يُنشأ المستخدم ويُمنح الدور ضمن النطاق المحدّد مباشرةً (معتمَد من الإدارة العليا). أمير المسجد يديره ضمن مسجده،
                ومسؤول المربع/المنطقة يُشرف على نطاقه. اختر النطاق بدقّة فهو يحدّد ما يراه المستخدم.
              </p>
            </aside>
            </div>
            <UsersPanel />
          </div>
        ) : tab === "permissions" ? (
          <PermissionsPanel />
        ) : tab === "general" ? (
          <GeneralSettingsPanel canManage={canManageSettings} />
        ) : tab === "announce" ? (
          <AnnouncementsPanel />
        ) : tab === "audit" ? (
          <AuditPanel />
        ) : (
          <RatesPanel canManage={canManageSettings} />
        )}
      </main>
      {editUnit && <OrgUnitEditor unit={editUnit} onClose={() => setEditUnit(null)} onChanged={() => router.invalidate()} />}
    </MishkatShell>
  );
}

// عقدة شجرة الهيكلية — قابلة للطي مع إزاحة بالعمق (نمط نظام الملفات، RTL)
function OrgTreeNode({ unit, depth, childrenOf, openIds, onToggle, canManage, onEdit, countUnder }: {
  unit: OrgUnit; depth: number; childrenOf: (id: string) => OrgUnit[]; openIds: Set<string>;
  onToggle: (id: string) => void; canManage: boolean; onEdit: (u: OrgUnit) => void; countUnder: (path?: string) => number;
}) {
  const Icon = orgTypeIcon(unit.type);
  const kids = childrenOf(unit.id);
  const hasKids = kids.length > 0;
  const open = openIds.has(unit.id);
  const under = unit.type !== "mosque" ? countUnder(unit.path) : 0;
  return (
    <li>
      <div className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2/40"
        style={{ paddingInlineStart: `${12 + depth * 20}px` }}>
        {hasKids ? (
          <button onClick={() => onToggle(unit.id)} aria-label={open ? "طيّ" : "فتح"} aria-expanded={open}
            className="grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition hover:bg-surface hover:text-emerald-800">
            {open ? <ChevronDown className="size-4" strokeWidth={2} /> : <ChevronLeft className="size-4" strokeWidth={2} />}
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
          <span className="truncate pe-1 text-sm font-medium text-ink">{unit.name}</span>
          <span className="shrink-0 text-[11px] text-ink-faint">{TYPE_LABEL[unit.type]}{unit.genderTrack === "female" ? " · نساء" : ""}</span>
        </div>
        {unit.type !== "mosque" && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono-nums text-[10px] font-semibold text-ink-soft ring-1 ring-line">
            {under} مسجد
          </span>
        )}
        {canManage && (
          <button onClick={() => onEdit(unit)} aria-label="تحرير الوحدة"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-emerald-800">
            <Pencil className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
      {hasKids && open && (
        <ul>
          {kids.map((k) => (
            <OrgTreeNode key={k.id} unit={k} depth={depth + 1} childrenOf={childrenOf} openIds={openIds}
              onToggle={onToggle} canManage={canManage} onEdit={onEdit} countUnder={countUnder} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-mono-nums text-xl font-bold text-ink">{value}</div>
      <div className="text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}
