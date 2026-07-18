import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Plus, ListChecks, Users2 } from "lucide-react";
import { Field, TextField, TextArea } from "@/components/ui/field";
import { getWeeklyHalaqa, saveWeeklyNotes, addGroupActivity, removeGroupActivity, setStudentEvaluation } from "@/lib/api/alaBaseera";

// لوحة التقييم الأسبوعي لحلقة «على بصيرة»/المدرّس — مشتركة بين صفحة المسجد وصفحة «حلقاتي».
type WeeklyData = {
  weekStart: string; weekLabel: string;
  notes: { supervisorNotes: string; adminNotes: string };
  activities: { id: string; seq: number; description: string; dateHijri: string | null }[];
  lastLesson: { id: string; title: string; dateHijri: string | null } | null;
  students: { enrollmentId: string; name: string; score: number | null; note: string | null; externalActivities?: string | null }[];
};
export function WeeklyHalaqaPanel({ halaqaId }: { halaqaId: string }) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [busy, setBusy] = useState(true);
  const [sup, setSup] = useState("");
  const [adm, setAdm] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [act, setAct] = useState("");
  const [addingAct, setAddingAct] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      const r = await getWeeklyHalaqa({ data: { halaqaId } }) as WeeklyData;
      setData(r); setSup(r.notes.supervisorNotes); setAdm(r.notes.adminNotes);
    } catch { /* */ } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [halaqaId]);
  const saveNotes = async () => {
    setSavingNotes(true);
    try { await saveWeeklyNotes({ data: { halaqaId, supervisorNotes: sup, adminNotes: adm } }); toast.success("حُفظت الملاحظات"); }
    catch { toast.error("تعذّر الحفظ"); } finally { setSavingNotes(false); }
  };
  const addAct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (act.trim().length < 2) { toast.error("وصف غير صالح"); return; }
    setAddingAct(true);
    try {
      const res = await addGroupActivity({ data: { halaqaId, description: act.trim() } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else { setAct(""); await load(); }
    } catch { toast.error("تعذّرت الإضافة"); } finally { setAddingAct(false); }
  };
  const delAct = async (id: string) => {
    try { await removeGroupActivity({ data: { id } }); await load(); } catch { toast.error("تعذّر الحذف"); }
  };
  if (busy && !data) return <div className="grid place-items-center border-t border-line bg-surface-2/30 py-6 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>;
  if (!data) return null;
  return (
    <div className="space-y-4 border-t border-line bg-surface-2/30 px-5 py-4">
      <p className="text-[11px] font-semibold text-ink-faint">أسبوع <span className="font-mono-nums">{data.weekLabel}</span></p>

      {/* ملاحظات الإشراف والإدارة */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="ملاحظات المشرف"><TextArea value={sup} onChange={(e) => setSup(e.target.value)} rows={2} placeholder="ملاحظات إشرافية على سير الحلقة…" /></Field>
        <Field label="ملاحظات الإدارة"><TextArea value={adm} onChange={(e) => setAdm(e.target.value)} rows={2} placeholder="ملاحظات إدارية…" /></Field>
      </div>
      <button onClick={saveNotes} disabled={savingNotes} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{savingNotes ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ الملاحظات</button>

      {/* الأنشطة الجماعية (حتى ٥) */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5"><ListChecks className="size-3.5 text-emerald-800" strokeWidth={1.75} /><span className="text-xs font-semibold text-ink">الأنشطة الجماعية</span><span className="font-mono-nums text-[10px] text-ink-faint">{data.activities.length}/5</span></div>
        {data.activities.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {data.activities.map((a) => (
              <li key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs text-ink ring-1 ring-line">
                {a.description}
                <button onClick={() => delAct(a.id)} aria-label="حذف النشاط" className="text-sm leading-none text-ink-faint transition hover:text-danger">✕</button>
              </li>
            ))}
          </ul>
        )}
        {data.activities.length < 5 && (
          <form onSubmit={addAct} className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><TextField value={act} onChange={(e) => setAct(e.target.value)} placeholder="نشاط جماعي…" /></div>
            <button type="submit" disabled={addingAct || act.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{addingAct ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إضافة</button>
          </form>
        )}
      </div>

      {/* تقييم الطلاب في آخر درس */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5"><Users2 className="size-3.5 text-emerald-800" strokeWidth={1.75} /><span className="text-xs font-semibold text-ink">تقييم الطلاب</span></div>
        {!data.lastLesson ? (
          <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-faint ring-1 ring-line">سجّل درساً أولاً ليُمكن تقييم الطلاب فيه.</p>
        ) : !data.students.length ? (
          <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-faint ring-1 ring-line">لا طلاب مسجّلون في هذه الحلقة بعد.</p>
        ) : (
          <>
            <p className="mb-2 text-[10px] text-ink-faint">آخر درس مُسجّل: <span className="font-medium text-ink-soft">{data.lastLesson.title}</span>{data.lastLesson.dateHijri ? ` · ${data.lastLesson.dateHijri}` : ""}</p>
            <ul className="space-y-1.5">
              {data.students.map((s) => (
                <StudentEvalRow key={s.enrollmentId} halaqaId={halaqaId} lessonSessionId={data.lastLesson!.id} student={s} onSaved={load} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
function StudentEvalRow({ halaqaId, lessonSessionId, student, onSaved }: { halaqaId: string; lessonSessionId: string; student: { enrollmentId: string; name: string; score: number | null; note: string | null; externalActivities?: string | null }; onSaved: () => void }) {
  const [score, setScore] = useState(student.score != null ? String(student.score) : "");
  const [note, setNote] = useState(student.note ?? "");
  const [ext, setExt] = useState(student.externalActivities ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const n = score.trim() === "" ? undefined : parseInt(score, 10);
    if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 100)) { toast.error("الدرجة من 0 إلى 100"); return; }
    setSaving(true);
    try { await setStudentEvaluation({ data: { halaqaId, enrollmentId: student.enrollmentId, lessonSessionId, score: n, note: note.trim() || undefined, externalActivities: ext.trim() || undefined } }); toast.success("حُفظ التقييم"); onSaved(); }
    catch { toast.error("تعذّر الحفظ"); } finally { setSaving(false); }
  };
  return (
    <li className="space-y-1.5 rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[6rem] flex-1 truncate text-xs font-medium text-ink">{student.name}{student.score != null && <span className="ms-1.5 font-mono-nums text-[10px] text-emerald-800">({student.score})</span>}</span>
        <div className="w-16"><TextField type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="٠-١٠٠" dir="ltr" className="text-center" /></div>
        <div className="min-w-[8rem] flex-1"><TextField value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة…" /></div>
        <button onClick={save} disabled={saving} aria-label="حفظ التقييم" className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-800 text-emerald-50 ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:bg-surface-2 disabled:text-ink-faint disabled:ring-line">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}</button>
      </div>
      <TextField value={ext} onChange={(e) => setExt(e.target.value)} placeholder="نشاطات تربوية أداها خارج الحلقة…" />
    </li>
  );
}
