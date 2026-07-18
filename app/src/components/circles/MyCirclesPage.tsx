import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Clock, CalendarDays, Loader2, Plus, ChevronLeft, UserPlus, Users2, Archive, Pencil, Save, CheckCircle2, XCircle, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { TahfeezDaily } from "@/components/tahfeez/TahfeezDailyRegister";
import { getMyTahfeezCircles, getTahfeezStudents, addTahfeezStudent, removeTahfeezStudent, getGuardianLink } from "@/lib/api/tahfeez";
import { BookMarked, X } from "lucide-react";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WeeklyHalaqaPanel } from "@/components/circles/WeeklyHalaqaPanel";
import { CURRICULUM_OPTIONS, curriculumLabel } from "@/lib/curricula";
import {
  getMyCircles, getHalaqaStudents, addHalaqaStudent, removeHalaqaStudent, recordLesson,
  getHalaqaLessons, updateMyHalaqa, archiveMyHalaqa, addGroupActivity, setLessonStatus, getHalaqaRoster,
} from "@/lib/api/alaBaseera";
import { enqueue, newClientUuid } from "@/lib/offline/outbox";

type AttState = "present" | "absent" | "excused";
const ATT_META: Record<AttState, { label: string; cls: string }> = {
  present: { label: "حاضرة", cls: "bg-emerald-700 text-emerald-50" },
  absent: { label: "غائبة", cls: "bg-red-600 text-white" },
  excused: { label: "مستأذنة", cls: "bg-gold-500 text-white" },
};

type Circle = { id: string; name: string; curriculum: string; genderTrack: string; venueName: string; capacity: number; students: number; lessons: number; hours: number };
type Kpis = { circles: number; students: number; lessons: number; hours: number };

function KpiTile({ Icon, value, label, loading }: { Icon: typeof BookOpen; value: number; label: string; loading: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><Icon className="size-4" strokeWidth={1.75} /></span>
        {loading ? <Loader2 className="size-4 animate-spin text-ink-faint" /> : <span className="font-mono-nums text-2xl font-bold text-ink">{value}</span>}
      </div>
      <p className="mt-2 text-sm text-ink-soft">{label}</p>
    </div>
  );
}

export function MyCirclesPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [items, setItems] = useState<Circle[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Circle | null>(null);
  // ملاحظة: إنشاءُ الحلقات صار من صلاحية أمير المسجد (لا المعلّم) — المعلّم يدير حلقاته المُسنَدة فقط.

  const load = async () => {
    setBusy(true);
    try { const r = await getMyCircles() as { kpis: Kpis; items: Circle[] }; setKpis(r.kpis); setItems(r.items); }
    catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const k = kpis ?? { circles: 0, students: 0, lessons: 0, hours: 0 };
  return (
    <MishkatShell>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20"><BookOpen className="size-5" strokeWidth={1.5} /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">حلقاتي</h1>
            <p className="mt-1 text-sm text-ink-soft">حلقات المدرّس/المحفّظ — الطلاب والدروس والمتابعة الأسبوعية</p>
          </div>
        </header>

        {/* تقرير موجز */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile Icon={BookOpen} value={k.circles} label="حلقاتي" loading={kpis === null} />
          <KpiTile Icon={GraduationCap} value={k.students} label="إجمالي الطلاب" loading={kpis === null} />
          <KpiTile Icon={CalendarDays} value={k.lessons} label="الدروس المسجّلة" loading={kpis === null} />
          <KpiTile Icon={Clock} value={k.hours} label="إجمالي الساعات" loading={kpis === null} />
        </section>

        <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
            <div className="flex items-center gap-2"><BookOpen className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">الحلقات</h3></div>
            <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{k.circles}</span>
          </div>
          {busy && !items.length ? (
            <div className="grid place-items-center py-12 text-ink-faint"><Loader2 className="size-5 animate-spin" /></div>
          ) : !items.length ? (
            <div className="grid place-items-center px-6 py-12 text-center text-sm text-ink-soft">لم تُسنَد إليك حلقاتٌ بعد — يتولّى أميرُ المسجد إنشاءَ الحلقات وإسنادَها.</div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><BookOpen className="size-4" strokeWidth={1.75} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.name}{c.genderTrack === "female" && <span className="ms-1.5 rounded-full bg-gold-50 px-1.5 text-[10px] text-gold-700">نسائية</span>}</p>
                      <p className="truncate text-[11px] text-ink-faint">{curriculumLabel(c.curriculum)} · {c.students} طالب · {c.lessons} درس{c.hours ? ` · ${c.hours} ساعة` : ""}</p>
                    </div>
                    <button onClick={() => setOpen(open === c.id ? null : c.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                      إدارة
                      <ChevronLeft className={cn("size-3.5 transition", open === c.id && "-rotate-90")} strokeWidth={2} />
                    </button>
                    <button onClick={() => setArchiving(c)} aria-label="أرشفة الحلقة" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-danger-bg hover:text-danger"><Archive className="size-4" strokeWidth={1.75} /></button>
                  </div>
                  {open === c.id && (
                    <div>
                      <EditHalaqa circle={c} onSaved={load} />
                      {/* ترتيبُ أسئلة المعلّم (ع٦ — ن٣): ماذا أسجّل الآن؟ ← طلابي ← ما درّسته ← لوحتي الأسبوعية */}
                      <RecordLesson halaqaId={c.id} onSaved={load} />
                      <HalaqaStudents halaqaId={c.id} onChanged={load} />
                      <LessonsList halaqaId={c.id} refreshKey={c.lessons} />
                      <WeeklyHalaqaPanel halaqaId={c.id} notesReadOnly />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* حلقات التحفيظ التي أعلّمها — منفذ المعلّم الكامل (توجيه اللجنة: ٩٠٪ من الإدخال عنده) */}
        <MyTahfeezSection />
      </main>
      {archiving && (
        <ConfirmDialog
          open={!!archiving}
          onOpenChange={(o) => { if (!o) setArchiving(null); }}
          title="أرشفة الحلقة"
          description={`ستُؤرشَف «${archiving.name}» ولن تظهر في حلقاتك. لا تُحذف بياناتها.`}
          confirmLabel="أرشفة"
          onConfirm={async () => {
            try { await archiveMyHalaqa({ data: { id: archiving.id } }); toast.success("أُرشفت الحلقة"); setArchiving(null); await load(); }
            catch { toast.error("تعذّرت الأرشفة"); }
          }}
        />
      )}
    </MishkatShell>
  );
}

// تعديل الحلقة: الاسم/المنهج/السعة
function EditHalaqa({ circle, onSaved }: { circle: Circle; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(circle.name);
  const [curriculum, setCurriculum] = useState(circle.curriculum);
  const [capacity, setCapacity] = useState(String(circle.capacity ?? ""));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (name.trim().length < 2) { toast.error("اسم غير صالح"); return; }
    setSaving(true);
    try {
      const cap = capacity ? parseInt(capacity, 10) : undefined;
      await updateMyHalaqa({ data: { id: circle.id, name: name.trim(), curriculum: curriculum as "baseera" | "tahfeez" | "rashidi" | "general", capacity: Number.isFinite(cap) ? cap : undefined } });
      toast.success("حُفظت التعديلات"); setEditing(false); onSaved();
    } catch { toast.error("تعذّر الحفظ"); } finally { setSaving(false); }
  };
  if (!editing) return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-2">
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft transition hover:text-emerald-800"><Pencil className="size-3.5" strokeWidth={1.75} /> تعديل بيانات الحلقة</button>
    </div>
  );
  return (
    <div className="grid gap-2 border-t border-line bg-surface-2/30 px-5 py-3 sm:grid-cols-[1fr_9rem_6rem_auto]">
      <Field label="الاسم"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="المنهج"><MSelect value={curriculum} onValueChange={setCurriculum} options={CURRICULUM_OPTIONS} /></Field>
      <Field label="السعة"><TextField type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} dir="ltr" className="text-center" /></Field>
      <div className="flex items-end gap-1.5">
        <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ</button>
        <button onClick={() => setEditing(false)} className="inline-flex h-10 items-center rounded-xl px-3 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface-2">إلغاء</button>
      </div>
    </div>
  );
}

type Attach = { id: string; url: string; caption: string | null };
type Lesson = { id: string; title: string; majlis: string | null; dateHijri: string | null; durationHours: number; attendanceCount: number | null; selfEval: number | null; companionActivities: string | null; status: string; rejectionReason: string | null; attachments: Attach[]; attendance: { present: number; absent: number; excused: number } | null; approvedByName: string | null };
const LESSON_STATUS: Record<string, { label: string; cls: string }> = {
  recorded: { label: "بانتظار الموافقة", cls: "bg-gold-50 text-gold-700 ring-gold-100" },
  approved: { label: "معتمد", cls: "bg-success-bg text-success ring-success/20" },
  rejected: { label: "مرفوض", cls: "bg-danger-bg text-danger ring-danger/20" },
};
export function LessonsList({ halaqaId, refreshKey, onChanged }: { halaqaId: string; refreshKey: number; onChanged?: () => void }) {
  const [items, setItems] = useState<Lesson[]>([]);
  const [canSupervise, setCanSupervise] = useState(false);
  const [busy, setBusy] = useState(true);
  const load = () => {
    setBusy(true);
    getHalaqaLessons({ data: { halaqaId } }).then((r) => { const d = r as { canSupervise: boolean; items: Lesson[] }; setItems(d.items); setCanSupervise(d.canSupervise); }).catch(() => {}).finally(() => setBusy(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [halaqaId, refreshKey]);
  const decide = async (id: string, status: "approved" | "rejected") => {
    const reason = status === "rejected" ? (prompt("سبب الرفض:") || "") : undefined;
    if (status === "rejected" && !reason) return;
    try { await setLessonStatus({ data: { lessonId: id, status, reason } }); load(); onChanged?.(); } catch { toast.error("تعذّر الإجراء"); }
  };
  return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-3">
      <div className="mb-1.5 flex items-center gap-1.5"><CalendarDays className="size-3.5 text-emerald-800" strokeWidth={1.75} /><span className="text-xs font-semibold text-ink">الدروس المُسجّلة (ما درّسه)</span></div>
      {busy ? (
        <div className="grid place-items-center py-2 text-ink-faint"><Loader2 className="size-3.5 animate-spin" /></div>
      ) : !items.length ? (
        <p className="py-1 text-center text-[10px] text-ink-faint">لا دروس مُسجّلة بعد.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((l) => {
            const st = LESSON_STATUS[l.status] ?? LESSON_STATUS.recorded;
            return (
              <li key={l.id} className="rounded-lg bg-surface px-3 py-2 text-[12px] ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{l.title}{l.majlis ? <span className="ms-1 text-ink-faint">· {l.majlis}</span> : ""}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", st.cls)}>{st.label}</span>
                  <span className="shrink-0 font-mono-nums text-[10px] text-emerald-800">{l.durationHours} س</span>
                  {l.dateHijri && <span className="shrink-0 font-mono-nums text-[9px] text-ink-faint">{l.dateHijri}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink-soft">
                  {l.attendance ? (
                    <span>الحضور: <span className="font-mono-nums text-emerald-800">{toAr(l.attendance.present)} حاضرة</span>{l.attendance.absent > 0 && <span className="font-mono-nums text-red-600"> · {toAr(l.attendance.absent)} غائبة</span>}{l.attendance.excused > 0 && <span className="font-mono-nums text-gold-700"> · {toAr(l.attendance.excused)} مستأذنة</span>}</span>
                  ) : l.attendanceCount != null && <span>الحضور: <span className="font-mono-nums">{toAr(l.attendanceCount)}</span></span>}
                  {l.selfEval != null && <span className="text-gold-700">تقييم المعلّم: ★{toAr(l.selfEval)}</span>}
                  {l.companionActivities && <span>نشاطات: {l.companionActivities}</span>}
                </div>
                {l.status === "approved" && l.approvedByName && <p className="mt-1 text-[10px] text-success">اعتمده: {l.approvedByName}</p>}
                {l.status === "rejected" && l.rejectionReason && <p className="mt-1 text-[10px] text-danger">سبب الرفض: {l.rejectionReason}</p>}
                {l.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.attachments.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" title={a.caption ?? "مرفق"}>
                        <img src={a.url} alt={a.caption ?? ""} loading="lazy" className="size-14 rounded-md object-cover ring-1 ring-line transition hover:ring-emerald-700" />
                      </a>
                    ))}
                  </div>
                )}
                {canSupervise && l.status === "recorded" && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => decide(l.id, "approved")} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-800 px-3 text-[11px] font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900"><CheckCircle2 className="size-3.5" /> موافقة</button>
                    <button onClick={() => decide(l.id, "rejected")} className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[11px] font-semibold text-danger ring-1 ring-danger/30 transition hover:bg-danger-bg"><XCircle className="size-3.5" /> رفض</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
const toAr = (n: number | string) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

type Student = { id: string; name: string };
export function HalaqaStudents({ halaqaId, onChanged }: { halaqaId: string; onChanged: () => void }) {
  const [items, setItems] = useState<Student[]>([]);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const r = await getHalaqaStudents({ data: { halaqaId } }) as Student[]; setItems(r); } catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [halaqaId]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (nm.length < 2) { toast.error("اسم غير صالح"); return; }
    setAdding(true);
    try {
      // دون اتصال: يُصفّ الطالب ويُضاف تفاؤليًّا للقائمة؛ يُزامَن لاحقًا (idempotent بـclient_uuid).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const cid = newClientUuid();
        await enqueue("student", { halaqaId, name: nm }, { clientUuid: cid });
        setItems((prev) => [...prev, { id: `pending:${cid}`, name: nm }]);
        setName(""); onChanged();
        toast.message("حُفظ محلّيًّا — سيُضاف عند المزامنة");
        return;
      }
      await addHalaqaStudent({ data: { halaqaId, name: nm } }); setName(""); await load(); onChanged();
    }
    catch { toast.error("تعذّرت الإضافة"); } finally { setAdding(false); }
  };
  const del = async (id: string) => {
    try { await removeHalaqaStudent({ data: { id } }); await load(); onChanged(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-3">
      <div className="mb-1.5 flex items-center gap-1.5"><Users2 className="size-3.5 text-emerald-800" strokeWidth={1.75} /><span className="text-xs font-semibold text-ink">الطلاب</span></div>
      <form onSubmit={add} className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الطالب…" /></div>
        <button type="submit" disabled={adding || name.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{adding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} إضافة طالب</button>
      </form>
      {busy ? (
        <div className="grid place-items-center py-3 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>
      ) : !items.length ? (
        <p className="py-2 text-center text-[11px] text-ink-faint">لا طلاب مسجّلون بعد.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs text-ink ring-1 ring-line">
              {s.name}
              <button onClick={() => del(s.id)} aria-label="حذف الطالب" className="text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function uploadAttachment(file: File, lessonId: string) {
  const fd = new FormData();
  fd.append("file", file); fd.append("lessonId", lessonId);
  const r = await fetch("/api/media/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("upload");
}
const EVAL_OPTS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `★ ${n}` }));
export function RecordLesson({ halaqaId, onSaved }: { halaqaId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("");
  const [attendance, setAttendance] = useState("");
  const [selfEval, setSelfEval] = useState("");
  const [companion, setCompanion] = useState("");
  const [circleAct, setCircleAct] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  // كشف الحضور لكل طالبة (حاضرة افتراضيًا)
  const [roster, setRoster] = useState<Array<{ id: string; name: string }>>([]);
  const [att, setAtt] = useState<Record<string, AttState>>({});
  useEffect(() => {
    let alive = true;
    getHalaqaRoster({ data: { halaqaId } }).then((r) => {
      if (!alive) return;
      const list = (r as { students: Array<{ id: string; name: string }> }).students ?? [];
      setRoster(list);
      setAtt(Object.fromEntries(list.map((s) => [s.id, "present" as AttState])));
    }).catch(() => {});
    return () => { alive = false; };
  }, [halaqaId]);
  const cycle: AttState[] = ["present", "absent", "excused"];
  const setStudentAtt = (id: string, s: AttState) => setAtt((m) => ({ ...m, [id]: s }));
  const presentN = roster.filter((s) => att[s.id] === "present").length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(hours);
    if (!Number.isFinite(h) || h <= 0) { toast.error("مدة غير صالحة"); return; }
    if (title.trim().length < 2) { toast.error("اكتب عنوان الدرس"); return; }
    setSaving(true);
    try {
      const manualAtt = attendance ? parseInt(attendance, 10) : undefined;
      const ev = selfEval ? parseInt(selfEval, 10) : undefined;
      const attendanceList = roster.length ? roster.map((s) => ({ enrollmentId: s.id, state: att[s.id] ?? "present" })) : undefined;
      const clientUuid = newClientUuid();
      const payload = { halaqaId, durationHours: h, lessonTitle: title.trim(), attendanceCount: roster.length ? undefined : (Number.isFinite(manualAtt as number) ? manualAtt : undefined), selfEval: ev, companionActivities: companion.trim() || undefined, attendance: attendanceList, clientUuid };
      const resetForm = () => { setTitle(""); setHours(""); setAttendance(""); setSelfEval(""); setCompanion(""); setCircleAct(""); setFiles([]); setAtt(Object.fromEntries(roster.map((s) => [s.id, "present" as AttState]))); };

      // دون اتصال: يُصفّ الدرس (بحضوره) ثمّ صوره تباعًا مرتبطةً بـclient_uuid للدرس؛
      // الطابور يرسل الدرس أوّلًا (أقدم) ثمّ الصور، والخادم يحلّ معرّف الجلسة عبر client_uuid.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await enqueue("lesson", payload, { clientUuid });
        for (const f of files) {
          if (!f.type.startsWith("image/")) continue;
          await enqueue("media", { scope: "lesson", lessonClientUuid: clientUuid }, { blob: f, filename: f.name, clientUuid: newClientUuid() });
        }
        toast.message("حُفظ محلّيًّا — سيُزامَن تلقائيًّا", { description: files.length ? `الدرس و${files.length} صورة في قائمة المزامنة.` : "تعمل دون اتصال." });
        resetForm(); onSaved(); return;
      }

      // أونلاين: تسجيلٌ مباشر (idempotent بـclientUuid) + مرفقات + النشاط الجماعيّ
      const res = await recordLesson({ data: payload });
      if (res && "error" in res && res.error) { toast.error(res.error); return; }
      const lessonId = (res as { id: string }).id;
      let failed = 0;
      for (const f of files) { try { await uploadAttachment(f, lessonId); } catch { failed++; } }
      if (circleAct.trim().length >= 2) { try { await addGroupActivity({ data: { halaqaId, description: circleAct.trim() } }); } catch { /* */ } }
      toast.success("سُجّل الدرس" + (failed ? ` (تعذّر رفع ${failed} صورة)` : ""));
      resetForm(); onSaved();
    } catch { toast.error("تعذّر التسجيل"); } finally { setSaving(false); }
  };
  return (
    <div className="border-t border-line bg-surface-2/30 px-5 py-3">
      <div className="mb-2 flex items-center gap-1.5"><CalendarDays className="size-3.5 text-emerald-800" strokeWidth={1.75} /><span className="text-xs font-semibold text-ink">تسجيل درس</span></div>
      <form onSubmit={save} className="space-y-2.5">
        <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem]">
          <Field label="عنوان الدرس"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: المجلس الثالث" /></Field>
          <Field label="المدّة (ساعات)"><TextField type="number" value={hours} onChange={(e) => setHours(e.target.value)} dir="ltr" className="text-center" /></Field>
          {roster.length === 0 && <Field label="عدد الحضور"><TextField type="number" value={attendance} onChange={(e) => setAttendance(e.target.value)} dir="ltr" className="text-center" /></Field>}
        </div>

        {roster.length > 0 && (
          <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink">كشف الحضور ({toAr(roster.length)} طالبة)</span>
              <span className="text-[11px] text-emerald-800 font-mono-nums">حاضرات: {toAr(presentN)}</span>
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {roster.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{s.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {cycle.map((st) => (
                      <button key={st} type="button" onClick={() => setStudentAtt(s.id, st)}
                        className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold transition", att[s.id] === st ? ATT_META[st].cls : "bg-surface-2 text-ink-soft ring-1 ring-line hover:bg-surface")}>
                        {ATT_META[st].label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
          <Field label="تقييم الدرس"><MSelect value={selfEval} onValueChange={setSelfEval} options={EVAL_OPTS} placeholder="★ —" /></Field>
          <Field label="النشاطات المصاحبة للدرس"><TextField value={companion} onChange={(e) => setCompanion(e.target.value)} placeholder="مثال: مسابقة قصيرة، سؤال وجواب…" /></Field>
        </div>
        <Field label="النشاط العملي المنجز على مستوى الحلقة (اختياري)"><TextField value={circleAct} onChange={(e) => setCircleAct(e.target.value)} placeholder="مثال: رحلة، زيارة، حملة…" /></Field>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink-soft">مرفقات (صور توثيقية)</label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-surface px-3 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2">
              <ImagePlus className="size-4" strokeWidth={1.75} /> اختيار صور
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>
            {files.length > 0 && <span className="text-[11px] text-ink-soft">{toAr(files.length)} صورة مُختارة</span>}
          </div>
        </div>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} تسجيل الدرس</button>
      </form>
    </div>
  );
}


/* ===== حلقات التحفيظ التي أعلّمها: طلابي + سجلّ اليوم + طباعة الكشف ===== */
type MyTC = { id: string; name: string; mosqueId: string; mosqueName: string; students: number };
function MyTahfeezSection() {
  const [items, setItems] = useState<MyTC[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => { getMyTahfeezCircles().then((r) => setItems((r as { items: MyTC[] }).items ?? [])).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);
  if (!items || !items.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
        <div className="flex items-center gap-2"><BookMarked className="size-4 text-emerald-800" strokeWidth={1.75} /><h3 className="font-display text-sm font-semibold text-ink">حلقات التحفيظ التي أعلّمها</h3></div>
        <span className="font-mono-nums text-[11px] font-semibold text-ink-soft">{items.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((c) => (
          <li key={c.id}>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line"><BookMarked className="size-4" strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                <p className="truncate text-[11px] text-ink-faint">تحفيظ · {c.mosqueName} · {c.students} طالب</p>
              </div>
              <button onClick={() => setOpen(open === c.id ? null : c.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-emerald-800">
                سجلّ اليوم والطلاب
                <ChevronLeft className={cn("size-3.5 transition", open === c.id && "-rotate-90")} strokeWidth={2} />
              </button>
            </div>
            {open === c.id && (
              <div>
                <MyTahfeezStudents circleId={c.id} onChanged={load} />
                <TahfeezDaily circleId={c.id} circleName={c.name} mosqueName={c.mosqueName} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyTahfeezStudents({ circleId, onChanged }: { circleId: string; onChanged: () => void }) {
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const load = () => { getTahfeezStudents({ data: { circleId } }).then((r) => setStudents(r as Array<{ id: string; name: string }>)).catch(() => {}); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [circleId]);
  const add = async () => {
    if (name.trim().length < 2) return;
    try { await addTahfeezStudent({ data: { circleId, name: name.trim() } }); setName(""); load(); onChanged(); toast.success("أُضيف الطالب"); }
    catch { toast.error("تعذّرت الإضافة"); }
  };
  const remove = async (id: string) => {
    try { await removeTahfeezStudent({ data: { id } }); load(); onChanged(); } catch { toast.error("تعذّر الحذف"); }
  };
  return (
    <div className="space-y-2 border-t border-line bg-surface-2/20 px-5 py-3">
      <div className="flex items-center gap-2">
        <UserPlus className="size-3.5 shrink-0 text-emerald-800" strokeWidth={1.75} />
        <span className="text-xs font-semibold text-ink">طلابي ({students.length})</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="اسم طالبٍ جديد…" className="h-8 min-w-0 flex-1 rounded-lg bg-surface px-3 text-xs text-ink ring-1 ring-line outline-none focus:ring-emerald-300" />
        <button onClick={add} disabled={name.trim().length < 2}
          className="shrink-0 rounded-lg bg-emerald-800 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-50">إضافة</button>
      </div>
      {students.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {students.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-ink ring-1 ring-line">
              {s.name}
              <button onClick={async () => {
                try {
                  const r = await getGuardianLink({ data: { studentId: s.id } });
                  if (r && "error" in r && r.error) { toast.error(r.error); return; }
                  const url = `${window.location.origin}/student/${(r as { token: string }).token}`;
                  await navigator.clipboard.writeText(url);
                  toast.success("نُسخ رابط وليّ الأمر", { description: "أرسله عبر واتساب — صفحة متابعةٍ للقراءة فقط." });
                } catch { toast.error("تعذّر التوليد"); }
              }} className="text-ink-faint hover:text-emerald-800" title="نسخ رابط وليّ الأمر">🔗</button>
              <button onClick={() => remove(s.id)} className="text-ink-faint hover:text-danger" title="إزالة"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
