import { useEffect, useMemo, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import {
  BookOpen, GraduationCap, Users, Clock, Library, Plus, Loader2,
  Building2, School, Home, MapPin, Search, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hasCap } from "@/lib/capabilities";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MTabs } from "@/components/ui/m-tabs";
import { fmtNum } from "@/lib/format";
import { MSelect } from "@/components/ui/m-select";
import { MAsyncCombobox, type AsyncOption } from "@/components/ui/m-async-combobox";
import { getAlaBaseera, getHalaqatTree, getUnitHalaqat, createVenue, createTeacher, createHalaqa, getCircleReport, getHalaqaAccess } from "@/lib/api/alaBaseera";
import { LessonsList, HalaqaStudents, RecordLesson } from "@/components/circles/MyCirclesPage";
import { CURRICULUM_OPTIONS } from "@/lib/curricula";
import { WomenActivityLog } from "@/components/circles/WomenActivityLog";
import { CurriculumMatrix } from "@/components/circles/CurriculumMatrix";
import { searchPersons, searchTeachers, searchVenues } from "@/lib/api/search";
import { UnitTree, type TreeUnit } from "@/components/ui/unit-tree";
import { SupervisionRegister } from "@/components/ala-baseera/SupervisionRegister";

type Kpis = { halaqat: number; teachers: number; students: number; hoursMonth: number; hoursValue: number };
type Halaqa = { id: string; name: string; teacherName: string; venueName: string; genderTrack: string; capacity: number; students: number; hours: number };
type TreeLeaf = { id: string; name: string; unitId: string; teacherName: string; genderTrack: string; capacity: number; students: number; hours: number };
type AB = { rate: number; month: string | null; kpis: Kpis };

const VENUE_TYPE: Record<string, { label: string; icon: LucideIcon }> = {
  mosque: { label: "مسجد", icon: Building2 }, institute: { label: "معهد", icon: School }, home: { label: "بيت", icon: Home },
};
const tile = "grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line";
const btn = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line";
const EMPTY_KPIS: Kpis = { halaqat: 0, teachers: 0, students: 0, hoursMonth: 0, hoursValue: 0 };

// محمّلات البحث على الخادم (لا تحمّل القوائم كاملة)
const loadPersons = (q: string): Promise<AsyncOption[]> => searchPersons({ data: { q } }).then((rs) => rs.map((r) => ({ value: r.id, label: r.name })));
const loadTeachers = (q: string): Promise<AsyncOption[]> => searchTeachers({ data: { q } }).then((rs) => rs.map((r) => ({ value: r.id, label: r.name, icon: GraduationCap })));
const loadVenues = (q: string): Promise<AsyncOption[]> => searchVenues({ data: { q } }).then((rs) => rs.map((r) => ({ value: r.id, label: r.name, hint: VENUE_TYPE[r.type]?.label })));

export function AlaBaseeraPage({ data }: { data?: AB }) {
  const [kpis, setKpis] = useState<Kpis>(data?.kpis ?? EMPTY_KPIS);
  // دعم الدخول المباشر لتبويبٍ بعينه (?tab=supervision) — من «المطلوب اليوم» وبطاقات الشبكة
  const initialTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
  const [tab, setTab] = useState(initialTab === "supervision" || initialTab === "setup" ? initialTab : "halaqat");

  // الحلقات ضمن شجرة الهيكلية (تفادي اختلاط الأسماء المتشابهة)
  const [tree, setTree] = useState<{ units: TreeUnit[]; leaves: TreeLeaf[]; lazy: boolean; counts?: Record<string, number> }>({ units: [], leaves: [], lazy: false });
  const [hq, setHq] = useState("");
  const [listBusy, setListBusy] = useState(true);

  const [selected, setSelected] = useState<Halaqa | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // نماذج الإعداد
  const [vType, setVType] = useState("mosque");
  const [vName, setVName] = useState("");
  const [vGender, setVGender] = useState("male");
  const [tPerson, setTPerson] = useState(""); const [tPersonLbl, setTPersonLbl] = useState("");
  const [tQual, setTQual] = useState("");
  const [hName, setHName] = useState("");
  const [hVenue, setHVenue] = useState(""); const [hVenueLbl, setHVenueLbl] = useState("");
  const [hTeacher, setHTeacher] = useState(""); const [hTeacherLbl, setHTeacherLbl] = useState("");
  const [hGender, setHGender] = useState("male");
  const [hCap, setHCap] = useState("20");
  const [hCurriculum, setHCurriculum] = useState("baseera");
  // نمطُ المعلّم: قائمٌ (اختيار) أو جديدٌ (إنشاءُ حساب دخول للمعلّم ليدير الحلقة بنفسه)
  const [tMode, setTMode] = useState<"existing" | "new">("existing");
  const [ntName, setNtName] = useState(""); const [ntLogin, setNtLogin] = useState(""); const [ntPass, setNtPass] = useState("");
  // إجراءات الحلقة
  const [enrollPerson, setEnrollPerson] = useState(""); const [enrollLbl, setEnrollLbl] = useState("");
  const [lessonHours, setLessonHours] = useState("1");
  const [lessonTitle, setLessonTitle] = useState("");

  // مبدِّل القسم — للإدارة العليا فقط (ترى القسمين عبر التبديل؛ غيرها مُقيَّدٌ بقسمه تلقائيًّا)
  const ctx = useRouteContext({ strict: false }) as { user?: { caps?: string[] } };
  const isAdmin = hasCap(ctx.user?.caps ?? [], "*");
  const [section, setSection] = useState<"men" | "women">("men");

  const refetchKpis = async () => { try { setKpis(((await getAlaBaseera({ data: { section } })) as AB).kpis); } catch { /* dev */ } };
  const loadTree = async () => {
    setListBusy(true);
    try { const r = await getHalaqatTree({ data: { section } }); setTree({ units: r.units, leaves: r.halaqat as TreeLeaf[], lazy: !!(r as { lazy?: boolean }).lazy, counts: (r as { counts?: Record<string, number> }).counts }); }
    catch { /* dev */ } finally { setListBusy(false); }
  };

  useEffect(() => { void refetchKpis(); void loadTree(); }, [section]);

  const refreshAll = () => { void refetchKpis(); void loadTree(); };
  const unitName = useMemo(() => new Map(tree.units.map((u) => [u.id, u.name])), [tree.units]);

  const run = async (key: string, fn: () => Promise<{ error?: string } | { ok: true }>, okMsg: string, okDesc?: string, after?: () => void) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res && "error" in res && res.error) toast.error(res.error);
      else { toast.success(okMsg, okDesc ? { description: okDesc } : undefined); after?.(); refreshAll(); }
    } catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };

  // إنشاءُ حلقة: معلّمٌ قائمٌ (teacherId) أو معلّمٌ جديدٌ (يُوفَّر له حسابُ دخول). يعرض بيانات الحساب عند الإنشاء.
  const submitHalaqa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hName.trim().length < 2 || !hVenue) { toast.error("أكمل اسمَ الحلقة والمكان"); return; }
    const payload: { name: string; venueId: string; genderTrack: "male" | "female"; capacity: number; curriculum: "baseera" | "tahfeez" | "rashidi" | "general"; teacherId?: string; newTeacher?: { fullName: string; login: string; password: string } } = {
      name: hName.trim(), venueId: hVenue, genderTrack: hGender as "male" | "female", capacity: Number(hCap) || 20, curriculum: hCurriculum as "baseera" | "tahfeez" | "rashidi" | "general",
    };
    if (tMode === "new") {
      if (ntName.trim().length < 2 || ntLogin.trim().length < 3 || ntPass.length < 6) { toast.error("أكمل بيانات المعلّم الجديد (الاسم، دخول ٣ أحرف+، كلمة مرور ٦ أحرف+)"); return; }
      payload.newTeacher = { fullName: ntName.trim(), login: ntLogin.trim(), password: ntPass };
    } else {
      if (!hTeacher) { toast.error("اختر معلّمًا قائمًا أو أنشئ حسابًا جديدًا"); return; }
      payload.teacherId = hTeacher;
    }
    setBusy("halaqa");
    try {
      const res = await createHalaqa({ data: payload }) as { error?: string; ok?: boolean; newAccount?: { login: string } };
      if (res?.error) toast.error(res.error);
      else {
        if (res.newAccount) toast.success("أُنشئت الحلقة وحسابُ المعلّم", { description: `اسمُ الدخول: ${res.newAccount.login} — سلّمه للمعلّم مع كلمة المرور؛ يدخل من «حلقاتي» ويُدخل دروسَ الحلقة بنفسه.`, duration: 14000 });
        else toast.success("أُنشئت الحلقة", { description: hName });
        setHName(""); setNtName(""); setNtLogin(""); setNtPass(""); setHTeacher(""); setHTeacherLbl(""); refreshAll();
      }
    } catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };

  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <BookOpen className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">على بصيرة</h1>
            <p className="mt-1 text-sm text-ink-soft">التعليم الشبابي الأسري — محاسبة المعلّم بالساعة</p>
          </div>
          {isAdmin && (
            <div className="ms-auto w-56">
              <SegmentedControl size="sm" value={section} onValueChange={(v) => setSection(v as "men" | "women")}
                options={[{ value: "men", label: "قسم الذكور" }, { value: "women", label: "قسم النساء" }]} />
            </div>
          )}
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Library} value={kpis.halaqat} label="الحلقات" />
          <Kpi icon={GraduationCap} value={kpis.teachers} label="المعلّمون" />
          <Kpi icon={Users} value={kpis.students} label="الطلاب" />
          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5" />
            <div className="flex items-center justify-between">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50/10 text-gold-100 ring-1 ring-emerald-50/10"><Clock className="size-[18px]" strokeWidth={1.75} /></span>
              <span className="text-[11px] font-medium text-emerald-100/70">ساعات الشهر</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-3xl font-semibold tracking-tight text-gold-100 sm:text-4xl">{fmtNum(kpis.hoursMonth)}</span>
              <span className="text-sm text-emerald-100/80">ساعة</span>
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/60">قيمتها ${kpis.hoursValue.toFixed(2)} · تُضاف لمستحق المعلّم.</p>
          </div>
        </section>

        <MTabs value={tab} onValueChange={setTab}
          options={[{ value: "halaqat", label: "الحلقات" }, { value: "supervision", label: "السجل الإشرافيّ" }, { value: "setup", label: "الإعداد" }]} />

        {tab === "supervision" ? (
          <SupervisionRegister />
        ) : tab === "halaqat" ? (
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line lg:col-span-3">
              <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                <input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="ابحث في الشجرة…"
                  className="h-8 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
                {listBusy && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" />}
              </div>
              {listBusy && tree.leaves.length === 0 ? (
                <div className="grid place-items-center px-6 py-16 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
              ) : (
                <UnitTree
                  units={tree.units}
                  leaves={tree.leaves}
                  lazy={tree.lazy}
                  counts={tree.counts}
                  loadLeaves={tree.lazy ? async (unitId) => (await getUnitHalaqat({ data: { unitId } })).halaqat as TreeLeaf[] : undefined}
                  filter={hq.trim() ? (l) => l.name.includes(hq.trim()) : undefined}
                  emptyLabel={hq ? "لا حلقات مطابقة." : "لا حلقات ضمن نطاقك بعد — أنشئها من «الإعداد»."}
                  renderLeaf={(h) => {
                    const full = h.students >= h.capacity;
                    const pct = Math.min(100, Math.round((h.students / Math.max(1, h.capacity)) * 100));
                    return (
                      <button onClick={() => setSelected({ ...h, venueName: unitName.get(h.unitId) ?? "—" })}
                        className={cn("flex w-full items-center gap-3 py-2.5 pe-3 ps-2 text-right transition-colors hover:bg-surface-2/40", selected?.id === h.id && "bg-emerald-50/50")}>
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><BookOpen className="size-4" strokeWidth={1.75} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{h.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{h.teacherName}{h.genderTrack === "female" ? " · نساء" : ""}</span>
                        </span>
                        <span className="hidden w-20 shrink-0 sm:block">
                          <span className="flex items-center justify-between text-[11px] text-ink-soft"><span>الطلاب</span><span className="font-mono-nums font-semibold">{h.students}/{h.capacity}</span></span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2"><span className={cn("block h-full rounded-full", full ? "bg-warn" : "bg-emerald-700")} style={{ width: `${pct}%` }} /></span>
                        </span>
                        <span className="hidden w-12 shrink-0 text-end font-mono-nums text-sm font-bold text-ink sm:block">{h.hours}<span className="text-[11px] font-medium text-ink-faint"> س</span></span>
                      </button>
                    );
                  }}
                />
              )}
            </section>

            <aside className="lg:col-span-2">
              {!selected ? (
                <div className="grid place-items-center gap-2 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
                  <BookOpen className="size-7 text-ink-faint" strokeWidth={1.25} />
                  <p className="text-sm text-ink-soft">اختر حلقة لإدارتها</p>
                  <p className="text-[11px] text-ink-faint">تسجيل طالب أو جلسة درس.</p>
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">{selected.name}</h3>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{selected.teacherName} · {selected.students}/{selected.capacity} طالب · {selected.hours} ساعة</p>
                  </div>
                  <HalaqaAdminDetail halaqaId={selected.id} />
                  {selected.genderTrack === "female" && (selected as { unitId?: string }).unitId && (
                    <div className="border-t border-line pt-4">
                      <WomenActivityLog unitId={(selected as { unitId?: string }).unitId!} />
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <form onSubmit={(e) => { e.preventDefault(); run("venue", () => createVenue({ data: { type: vType as never, name: vName, genderTrack: vGender as never } }), "أُنشئ المكان", vName, () => setVName("")); }}
              className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center gap-2 border-b border-line pb-3"><MapPin className="size-4 text-emerald-800" strokeWidth={1.75} /><h2 className="font-display text-sm font-semibold text-ink">إضافة مكان</h2></div>
              <Field label="النوع"><MSelect value={vType} onValueChange={setVType} options={Object.keys(VENUE_TYPE).map((t) => ({ value: t, label: VENUE_TYPE[t].label, icon: VENUE_TYPE[t].icon }))} /></Field>
              <Field label="الاسم" required><TextField value={vName} onChange={(e) => setVName(e.target.value)} placeholder="مثال: معهد النور" /></Field>
              <Field label="المسار"><SegmentedControl value={vGender} onValueChange={setVGender} options={[{ value: "male", label: "رجال" }, { value: "female", label: "نساء" }]} /></Field>
              <button type="submit" disabled={busy === "venue" || vName.length < 2} className={btn}>{busy === "venue" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إنشاء</button>
            </form>

            <form onSubmit={(e) => { e.preventDefault(); run("teacher", () => createTeacher({ data: { personId: tPerson, qualification: tQual || undefined } }), "أُضيف المعلّم", tPersonLbl, () => { setTPerson(""); setTPersonLbl(""); setTQual(""); }); }}
              className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center gap-2 border-b border-line pb-3"><GraduationCap className="size-4 text-emerald-800" strokeWidth={1.75} /><h2 className="font-display text-sm font-semibold text-ink">إضافة معلّم</h2></div>
              <Field label="الشخص" required hint="ابحث في المسجّلين بالنظام."><MAsyncCombobox value={tPerson} valueLabel={tPersonLbl} onChange={(v, l) => { setTPerson(v); setTPersonLbl(l); }} loadOptions={loadPersons} placeholder="اختر الشخص…" searchPlaceholder="ابحث بالاسم…" emptyText="لا أشخاص." /></Field>
              <Field label="المؤهّل"><TextField value={tQual} onChange={(e) => setTQual(e.target.value)} placeholder="اختياري" /></Field>
              <button type="submit" disabled={busy === "teacher" || !tPerson} className={btn}>{busy === "teacher" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة</button>
            </form>

            <form onSubmit={submitHalaqa} className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center gap-2 border-b border-line pb-3"><BookOpen className="size-4 text-emerald-800" strokeWidth={1.75} /><h2 className="font-display text-sm font-semibold text-ink">إنشاء حلقة</h2></div>
              <Field label="الاسم" required><TextField value={hName} onChange={(e) => setHName(e.target.value)} placeholder="مثال: حلقة الفجر" /></Field>
              <Field label="المكان" required><MAsyncCombobox value={hVenue} valueLabel={hVenueLbl} onChange={(v, l) => { setHVenue(v); setHVenueLbl(l); }} loadOptions={loadVenues} placeholder="ابحث عن مكان…" searchPlaceholder="ابحث بالاسم…" emptyText="لا أماكن." /></Field>
              <Field label="المنهج"><MSelect value={hCurriculum} onValueChange={setHCurriculum} options={CURRICULUM_OPTIONS} /></Field>
              {/* المعلّم: قائمٌ أو جديدٌ بحساب دخول */}
              <Field label="المعلّم" required>
                <SegmentedControl size="sm" value={tMode} onValueChange={(v) => setTMode(v as "existing" | "new")} options={[{ value: "existing", label: "معلّم قائم" }, { value: "new", label: "معلّم جديد (حساب)" }]} />
              </Field>
              {tMode === "existing" ? (
                <MAsyncCombobox value={hTeacher} valueLabel={hTeacherLbl} onChange={(v, l) => { setHTeacher(v); setHTeacherLbl(l); }} loadOptions={loadTeachers} placeholder="ابحث عن معلّم…" searchPlaceholder="ابحث بالاسم…" emptyText="لا معلّمين." />
              ) : (
                <div className="space-y-3 rounded-xl bg-emerald-50/40 p-3 ring-1 ring-emerald-100">
                  <p className="text-[11px] text-emerald-800">يُنشأ للمعلّم حسابُ دخولٍ خاصٌّ به ليدير حلقته ويُدخل دروسَها بنفسه.</p>
                  <Field label="اسم المعلّم" required><TextField value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="الاسم الكامل" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="اسم الدخول" required><TextField value={ntLogin} onChange={(e) => setNtLogin(e.target.value)} placeholder="مثال: ahmad" className="font-mono-nums" /></Field>
                    <Field label="كلمة المرور" required><TextField value={ntPass} onChange={(e) => setNtPass(e.target.value)} placeholder="٦ أحرف فأكثر" /></Field>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="المسار"><SegmentedControl size="sm" value={hGender} onValueChange={setHGender} options={[{ value: "male", label: "رجال" }, { value: "female", label: "نساء" }]} /></Field>
                <Field label="السعة"><TextField inputMode="numeric" value={hCap} onChange={(e) => setHCap(e.target.value)} className="text-center font-mono-nums" /></Field>
              </div>
              <button type="submit" disabled={busy === "halaqa" || hName.length < 2 || !hVenue} className={btn}>{busy === "halaqa" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إنشاء الحلقة</button>
            </form>
          </div>
        )}
      </main>
    </MishkatShell>
  );
}

function Kpi({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
      <span className={tile}><Icon className="size-[18px]" strokeWidth={1.75} /></span>
      <div className="mt-3 font-mono-nums text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{fmtNum(value)}</div>
      <p className="mt-1.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}

// تفصيل الحلقة: إن كان المستخدمُ يُدير الحلقة (أمير المكان/المعلّم المالك) ظهر له إدخالُ الطلاب والدروس؛
// ويظهر للجميع التقريرُ العامّ (وللمشرف الموافقةُ/الرفض). يحلّ إشكالَ «من أين أُدخل الدروس».
function HalaqaAdminDetail({ halaqaId }: { halaqaId: string }) {
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { getHalaqaAccess({ data: { halaqaId } }).then((r) => setCanManage((r as { canManage: boolean }).canManage)).catch(() => setCanManage(false)); }, [halaqaId]);
  return (
    <div className="space-y-2">
      {canManage && (
        <div className="overflow-hidden rounded-xl ring-1 ring-line">
          <HalaqaStudents halaqaId={halaqaId} onChanged={() => setTick((x) => x + 1)} />
          <RecordLesson halaqaId={halaqaId} onSaved={() => setTick((x) => x + 1)} />
        </div>
      )}
      <SupervisorCircleDetail halaqaId={halaqaId} key={tick} />
    </div>
  );
}

type CircleReport = { name: string; curriculum: string; genderTrack: string; teacherName: string; students: number; lessonsTotal: number; lessonsApproved: number; lessonsPending: number; hoursApproved: number; avgSelfEval: number | null; avgAttendance: number | null };
// تفصيل الحلقة للمدير/المشرف: تقرير عامّ (بلا أسماء طلاب) + موافقة/رفض الدروس
function SupervisorCircleDetail({ halaqaId }: { halaqaId: string }) {
  const [rep, setRep] = useState<CircleReport | null>(null);
  const [k, setK] = useState(0);
  const loadRep = () => { getCircleReport({ data: { halaqaId } }).then((r) => setRep(r as CircleReport)).catch(() => setRep(null)); };
  useEffect(() => { loadRep(); setK((x) => x + 1); /* eslint-disable-next-line */ }, [halaqaId]);
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink"><BarChart3 className="size-3.5 text-emerald-800" strokeWidth={2} /> تقرير عامّ</div>
      {!rep ? (
        <div className="grid place-items-center py-3 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-center">
          {[["الطلاب", rep.students], ["الدروس المعتمدة", rep.lessonsApproved], ["بانتظار الموافقة", rep.lessonsPending], ["الساعات المعتمدة", rep.hoursApproved], ["متوسّط التقييم", rep.avgSelfEval ?? "—"], ["متوسّط الحضور", rep.avgAttendance ?? "—"]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface-2 p-2.5 ring-1 ring-line">
              <div className="font-mono-nums text-lg font-bold text-emerald-800">{typeof v === "number" ? fmtNum(v) : v}</div>
              <div className="mt-0.5 text-[10px] text-ink-faint">{l}</div>
            </div>
          ))}
        </div>
      )}
      {/* قائمة الدروس مع موافقة/رفض (تظهر الأزرار للمشرف تلقائياً) */}
      <div className="-mx-5">
        <LessonsList halaqaId={halaqaId} refreshKey={k} onChanged={loadRep} />
      </div>
      {/* تقدّم الطالبات في المنهج (يُحدَّث آليًّا عند اعتماد الدروس) */}
      <div className="border-t border-line pt-3">
        <CurriculumMatrix halaqaId={halaqaId} />
      </div>
    </div>
  );
}
