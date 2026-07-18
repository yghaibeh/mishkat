import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  WifiOff,
  CheckCircle2,
  Save,
  CalendarDays,
  ClipboardList,
  Info,
  Eye,
  Users2,
  ImagePlus,
  Loader2,
  Trash2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { TextArea } from "@/components/ui/field";
import { fmtHijri } from "@/lib/format";
import { getFamilyStudents, setFamilyStudents, getDailyAttachments, deleteDailyAttachment } from "@/lib/api/functions";
import { enqueue, newClientUuid } from "@/lib/offline/outbox";

type Attachment = { id: string; url: string; caption: string | null };
type AttState = { weeklyRecordId: string | null; canUpload: boolean; items: Attachment[] };

type Track = "m" | "w";
type Activity = { activityTypeId?: string; name: string; pts: number; hint?: string; maxPerDay?: number | null; minParticipationPct?: number | null };
type DailyData = { tracks: Record<Track, Activity[]>; weekTarget: number };

// أنشطة المسارين تأتي من قاعدة البيانات (مخطط النقاط — seed_points.sql) — لا بيانات وهمية في الكود.
const PRIOR_WEEK = 41;
const RATE = 50 / 280;

export function DailyLogPage({ data, embedded, readOnly, mosqueId, genderTrack }: { data?: DailyData; embedded?: boolean; readOnly?: boolean; mosqueId?: string; genderTrack?: string }) {
  const SETS: Record<Track, Activity[]> = data?.tracks ?? { m: [], w: [] };
  const WEEK_TARGET = data?.weekTarget ?? 70;
  // المسار يُشتقّ من جنس المستخدم/المسجد — لا اختيار يدويّ (الفصل التام بين القسمين)
  const track: Track = genderTrack === "female" ? "w" : "m";
  const [counts, setCounts] = useState<number[]>(() => SETS[track].map(() => 0));
  const [participants, setParticipants] = useState<number[]>(() => SETS[track].map(() => 1));
  const [shura, setShura] = useState(false);
  const [note, setNote] = useState("");

  // توثيق أنشطة اليوم (صور) — تُحمَّل لسجل الأسبوع الجاري ويطّلع عليها الإشراف
  // طلاب الأسرة المسجّلون (0047) — مرجع عتبة التزام الصلوات؛ يضبطه الأمير
  const [familySize, setFamilySize] = useState<number | null>(null);
  useEffect(() => {
    getFamilyStudents({ data: { mosqueId } })
      .then((r) => { const d = r as { familyStudents?: number | null }; setFamilySize(d.familyStudents ?? null); })
      .catch(() => {});
  }, [mosqueId]);
  const saveFamilySize = async (n: number) => {
    setFamilySize(n || null);
    try { await setFamilyStudents({ data: { count: n, mosqueId } }); } catch { /* */ }
  };

  const [att, setAtt] = useState<AttState | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let alive = true;
    getDailyAttachments({ data: { mosqueId } })
      .then((r) => { if (alive) setAtt(r as AttState | null); })
      .catch(() => { if (alive) setAtt(null); });
    return () => { alive = false; };
  }, [mosqueId]);

  const reloadAtt = async () => {
    try { setAtt((await getDailyAttachments({ data: { mosqueId } })) as AttState | null); } catch { /* */ }
  };
  const onUpload = async (files: FileList | null) => {
    const recId = att?.weeklyRecordId;
    if (!files || files.length === 0 || !recId) return;
    setUploading(true);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    let failed = 0, queued = 0;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { failed++; continue; }
      try {
        if (offline) {
          // دون اتصال: يُصفّ ويُرفَع لاحقًا (idempotent بـclient_uuid). يحتاج معرّف سجل الأسبوع المُخبَّأ.
          await enqueue("media", { scope: "daily_record", refId: recId }, { blob: f, filename: f.name, clientUuid: newClientUuid() });
          queued++;
        } else {
          const fd = new FormData();
          fd.append("file", f); fd.append("scope", "daily_record"); fd.append("refId", recId); fd.append("clientUuid", newClientUuid());
          const r = await fetch("/api/media/upload", { method: "POST", body: fd });
          if (!r.ok) throw new Error("upload");
        }
      } catch { failed++; }
    }
    setUploading(false);
    if (!offline) await reloadAtt();
    if (failed) toast.error(`تعذّر رفع ${failed} صورة`);
    else if (offline) toast.message(`${queued} صورة في قائمة المزامنة — تُرفَع عند عودة الاتصال`);
    else toast.success("رُفعت صور التوثيق");
  };
  const onDeleteAtt = async (id: string) => {
    const res = await deleteDailyAttachment({ data: { id } });
    if (res && "error" in res && res.error) { toast.error(res.error); return; }
    setAtt((a) => (a ? { ...a, items: a.items.filter((x) => x.id !== id) } : a));
  };

  const activities = SETS[track];
  const todayPts = useMemo(
    () => activities.reduce((sum, a, i) => sum + a.pts * (counts[i] ?? 0), 0),
    [activities, counts],
  );
  const totalActions = useMemo(
    () => counts.reduce((s, n) => s + (n ?? 0), 0),
    [counts],
  );
  const weekPts = PRIOR_WEEK + todayPts;
  const weekPct = Math.min(100, Math.round((weekPts / WEEK_TARGET) * 100));
  const money = (weekPts * RATE).toFixed(2);

  const bump = (i: number, d: number) => {
    if (readOnly) return;
    setCounts((c) => {
      const next = [...c];
      let v = Math.max(0, (next[i] ?? 0) + d);
      const cap = SETS[track][i]?.maxPerDay ?? null;
      if (cap != null) v = Math.min(v, cap);
      next[i] = v;
      return next;
    });
  };
  const bumpParticipants = (i: number, d: number) => {
    if (readOnly) return;
    setParticipants((p) => {
      const next = [...p];
      next[i] = Math.max(1, (next[i] ?? 1) + d);
      return next;
    });
  };
  // الكتابة اليدوية للأرقام (لا تقتصر الإضافة على زرّي +/−) — بسقف النشاط اليوميّ إن وُجد (0047)
  const capOf = (i: number) => SETS[track][i]?.maxPerDay ?? null;
  const setCountAt = (i: number, val: string) => {
    if (readOnly) return;
    const digits = val.replace(/[^\d]/g, "");
    let n = digits === "" ? 0 : parseInt(digits, 10);
    const cap = capOf(i);
    if (cap != null) n = Math.min(n, cap);
    setCounts((c) => { const next = [...c]; next[i] = Number.isFinite(n) ? n : 0; return next; });
  };
  const setParticipantsAt = (i: number, val: string) => {
    if (readOnly) return;
    const digits = val.replace(/[^\d]/g, "");
    const n = digits === "" ? 1 : parseInt(digits, 10);
    setParticipants((p) => { const next = [...p]; next[i] = Number.isFinite(n) && n >= 1 ? n : 1; return next; });
  };

  const onSave = async () => {
    // معرّف دفعةٍ ثابت لهذا الحفظ؛ كل إدخالٍ يحمل uuidًا مشتقًّا منه (idempotency لكل نشاط عبر إعادة الإرسال)
    const batch = newClientUuid();
    const recordedAt = Date.now();
    const entries = activities
      .map((a, i) => ({ activityTypeId: a.activityTypeId, count: counts[i] ?? 0, participantCount: participants[i] ?? 1 }))
      .filter((e): e is { activityTypeId: string; count: number; participantCount: number } => !!e.activityTypeId && e.count > 0)
      .map((e) => ({ ...e, clientUuid: `${batch}:${e.activityTypeId}`, recordedAt }));

    if (!entries.length) {
      toast.message("لا إدخالات لحفظها", { description: "أضِف عمليةً واحدة على الأقل." });
      return;
    }

    // يُحفَظ في طابور محلّيّ (يعمل دون اتصال) ثم يُزامَن تلقائيًّا فور توفّر الشبكة
    await enqueue("daily_entry", { track: track === "m" ? "male" : "female", entries, shura }, { clientUuid: batch });

    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline) {
      toast.message("حُفظ محلّيًّا — سيُزامَن تلقائيًّا", { description: "تعمل دون اتصال." });
    } else if (shura) {
      toast.success("تم اعتماد سجل اليوم", { description: `أُضيف ${todayPts} نقطة لمجموع الأسبوع.` });
    } else {
      toast.message("حُفظ كمسودة", { description: "لم تُحتسب النقاط — مطلوب إقرار الشورى." });
    }
  };

  const body = (
      <main className={embedded ? "space-y-6" : "mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12"}>
        {/* مضمّن داخل صفحة المسجد: شريط إجراءات نحيف بدل الترويسة الكبيرة (اسم المسجد معروض أعلى الصفحة أصلاً) */}
        {embedded ? (
          !readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-100">
                  <span className="size-1.5 animate-pulse rounded-full bg-gold-600" />
                  مسودة — بانتظار الاعتماد
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                  <WifiOff className="size-3" strokeWidth={2} />
                  يعمل دون اتصال
                </span>
              </div>
              <DesktopSave shura={shura} onSave={onSave} />
            </div>
          )
        ) : (
        /* Header — يطابق نمط ReportHeader */
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
                <ClipboardList className="size-5" strokeWidth={1.5} />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                سجل اليوم
              </h1>
              {readOnly ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line">
                  <Eye className="size-3.5" strokeWidth={2} />
                  عرض فقط
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-100">
                    <span className="size-1.5 animate-pulse rounded-full bg-gold-600" />
                    مسودة — بانتظار الاعتماد
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                    <WifiOff className="size-3" strokeWidth={2} />
                    يعمل دون اتصال
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-ink-faint" strokeWidth={1.5} />
                {fmtHijri(Date.now())}
              </span>
            </div>
          </div>

          {/* Desktop save */}
          {!readOnly && (
            <div className="hidden md:block">
              <DesktopSave shura={shura} onSave={onSave} />
            </div>
          )}
        </header>
        )}

        {readOnly && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2 p-4 text-xs text-ink-soft ring-1 ring-line">
            <Eye className="mt-0.5 size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
            <p className="leading-relaxed">عرض أنشطة هذا المسجد المعتمَدة وأوزانها (للاطّلاع الإشرافي). النتائج المجمّعة والنقاط تظهر في تبويب «التقرير الشهري».</p>
          </div>
        )}

        {/* KPI row — يطابق نمط بطاقات التقرير */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
            <p className="text-xs font-medium text-ink-soft">نقاط اليوم</p>
            <div className="mt-3 flex items-baseline gap-1.5 font-mono-nums">
              <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {todayPts}
              </span>
              <span className="text-base text-ink-faint">نقطة</span>
            </div>
            <p className="mt-4 text-[11px] text-ink-faint">
              {totalActions} عملية مُدخلة في {activities.length} نشاطاً
            </p>
          </div>

          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-line-strong">
            <p className="text-xs font-medium text-ink-soft">مجموع الأسبوع</p>
            <div className="mt-3 flex items-baseline gap-1.5 font-mono-nums">
              <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {weekPts}
              </span>
              <span className="text-base text-ink-faint">/ {WEEK_TARGET}</span>
              <span className="ms-auto text-xs font-semibold text-emerald-700 font-mono-nums">
                {weekPct}%
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-emerald-700 transition-[width] duration-700"
                style={{ width: `${weekPct}%` }}
              />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-5 text-emerald-50 ring-1 ring-emerald-900">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full border-[10px] border-emerald-50/5"
            />
            <p className="text-xs font-medium text-emerald-100/70">
              القيمة التقديرية للأسبوع
            </p>
            <div className="mt-3 flex items-baseline gap-1 font-mono-nums">
              <span className="text-sm font-medium text-emerald-100/80">$</span>
              <span className="text-3xl font-semibold tracking-tight text-gold-100 sm:text-4xl">
                {money}
              </span>
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/60">
              تُحتسب بعد اعتماد التقرير الشهري من الأمير العام.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Activities — قسم بنفس بنية WeeklyTable */}
          <div className="space-y-6 lg:col-span-3">
            <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
                <h3 className="font-display text-sm font-semibold text-ink">
                  أنشطة اليوم
                </h3>
                {/* مرجع عتبة الالتزام (0047): عدد طلاب الأسرة المسجّلين — يضبطه الأمير مرّةً */}
                <label className="flex items-center gap-2 text-[11px] text-ink-soft">
                  {familySize == null && !readOnly && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200" title="حتى تحدّده، تُحسب الصلوات دون التحقّق من نسبة الحضور">
                      قاعدة ٧٠٪ معطّلة — حدّد العدد
                    </span>
                  )}
                  طلاب الأسرة المسجّلون
                  <input
                    type="text" inputMode="numeric" disabled={readOnly}
                    value={familySize ?? ""}
                    onChange={(e) => { const n = parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10); saveFamilySize(Number.isFinite(n) ? n : 0); }}
                    placeholder="؟"
                    className="h-7 w-12 rounded-lg bg-surface text-center font-mono-nums text-xs font-bold text-ink ring-1 ring-line outline-none focus:ring-emerald-300 disabled:opacity-60"
                    title="مرجع نسبة الالتزام — لا تُحسب نقطة الصلوات إن صلّى أقلّ من ٧٠٪ منهم"
                  />
                </label>
              </div>
              <ul className="divide-y divide-line">
                {activities.map((a, i) => {
                  const c = counts[i] ?? 0;
                  const p = participants[i] ?? 1;
                  const earned = c * a.pts;
                  return (
                    <li
                      key={a.name + i}
                      className={cn(
                        "flex flex-col gap-3 px-5 py-4 transition-colors",
                        c > 0 && "bg-emerald-50/40",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {a.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-faint font-mono-nums">
                            {a.pts} {a.pts === 1 ? "نقطة" : "نقاط"} للمرة
                            {a.maxPerDay != null && <span className="text-gold-700"> · بحدّ {a.maxPerDay === 1 ? "نقطةٍ واحدةٍ" : `${a.maxPerDay}`} في اليوم</span>}
                            {a.minParticipationPct != null && <span className="text-gold-700"> · تُحسب إن شارك ≥{a.minParticipationPct}٪ من طلاب الأسرة{familySize ? ` (${Math.ceil((a.minParticipationPct / 100) * familySize)} من ${familySize})` : ""}</span>}
                            {a.minParticipationPct != null && !familySize && <span className="font-bold text-danger"> · لن تُحسب حتى تحدّد عدد طلاب الأسرة أعلاه</span>}
                            {a.hint ? <span> · {a.hint}</span> : null}
                          </p>
                        </div>

                        <span
                          className={cn(
                            "hidden w-14 shrink-0 text-end font-mono-nums text-xs font-semibold sm:inline-block",
                            earned > 0 ? "text-emerald-800" : "text-ink-faint",
                          )}
                        >
                          +{earned}
                        </span>

                        <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-line">
                          <CounterBtn
                            onClick={() => bump(i, -1)}
                            disabled={readOnly || c === 0 || (a.minParticipationPct != null && !familySize)}
                            aria-label="إنقاص"
                          >
                            <Minus className="size-4" strokeWidth={2} />
                          </CounterBtn>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={c}
                            disabled={readOnly}
                            onChange={(e) => setCountAt(i, e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            aria-label="عدد العمليات (اكتب الرقم)"
                            className="min-w-8 w-12 rounded-md bg-transparent text-center font-mono-nums text-base font-bold text-ink outline-none focus:bg-surface focus:ring-1 focus:ring-emerald-200 disabled:opacity-60"
                          />
                          <CounterBtn onClick={() => bump(i, 1)} disabled={readOnly || (a.minParticipationPct != null && !familySize)} aria-label="زيادة">
                            <Plus className="size-4" strokeWidth={2} />
                          </CounterBtn>
                        </div>
                      </div>

                      {c > 0 && (
                        <div className="flex items-center gap-2 pr-0.5">
                          <Users2 className="size-3.5 shrink-0 text-ink-faint" strokeWidth={1.75} />
                          <span className="text-[11px] text-ink-soft">عدد المشاركين من الطلاب</span>
                          <div className="mr-auto flex items-center gap-1 rounded-lg bg-surface p-0.5 ring-1 ring-line">
                            <CounterBtn onClick={() => bumpParticipants(i, -1)} disabled={readOnly || p <= 1} aria-label="إنقاص المشاركين">
                              <Minus className="size-3" strokeWidth={2} />
                            </CounterBtn>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={p}
                              disabled={readOnly}
                              onChange={(e) => setParticipantsAt(i, e.target.value)}
                              onFocus={(e) => e.currentTarget.select()}
                              aria-label="عدد المشاركين (اكتب الرقم)"
                              className="min-w-6 w-10 rounded-md bg-transparent text-center font-mono-nums text-sm font-bold text-ink outline-none focus:bg-surface-2 focus:ring-1 focus:ring-emerald-200 disabled:opacity-60"
                            />
                            <CounterBtn onClick={() => bumpParticipants(i, 1)} disabled={readOnly} aria-label="زيادة المشاركين">
                              <Plus className="size-3" strokeWidth={2} />
                            </CounterBtn>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Formula note — gold callout */}
            <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-100">
              <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                <Info className="size-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-1">
                <h4 className="text-sm font-semibold text-gold-700">
                  معادلة احتساب النقاط
                </h4>
                <p className="text-xs leading-relaxed text-gold-700/80">
                  الهدف الأسبوعي{" "}
                  <span className="font-mono-nums font-semibold">{WEEK_TARGET}</span> نقطة ·
                  المعدّل الشهري{" "}
                  <span className="font-mono-nums font-semibold">280 نقطة = 50$</span>{" "}
                  · يُنسب الاستحقاق لأمير المسجد بعد اعتماد الشورى.
                </p>
              </div>
            </div>
          </div>

          {/* Side: Shura + notes */}
          <aside className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl bg-surface ring-1 ring-line">
              <div className="border-b border-line px-5 py-3.5">
                <h3 className="font-display text-sm font-semibold text-ink">
                  إقرار الشورى
                </h3>
              </div>
              <div className="space-y-4 p-5">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition",
                    shura
                      ? "bg-emerald-50 ring-emerald-200"
                      : "bg-surface-2 ring-line hover:ring-line-strong",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={shura}
                    disabled={readOnly}
                    onChange={(e) => setShura(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-emerald-700 disabled:opacity-50"
                  />
                  <span className="text-sm font-semibold text-ink">
                    أُقرّ أنّ هذه الأنشطة تمّت بإشراك أسرة المسجد وبالشورى.
                  </span>
                </label>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
                    ملاحظات اليوم
                  </label>
                  <TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظات اختيارية تُرفق مع السجل…"
                  />
                </div>

                {!shura && (
                  <div className="flex items-start gap-2 rounded-xl bg-warn-bg p-3 text-[11px] font-semibold text-warn ring-1 ring-warn/20">
                    <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                    دون الإقرار يُحفظ السجل كمسودة ولا تُحتسب النقاط.
                  </div>
                )}
              </div>
            </section>

            {/* توثيق أنشطة اليوم (صور) — يطّلع عليها الإشراف والإعلام */}
            {att && (
              <section className="rounded-2xl bg-surface ring-1 ring-line">
                <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
                  <h3 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
                    <Camera className="size-4 text-ink-faint" strokeWidth={1.75} />
                    توثيق أنشطة اليوم
                  </h3>
                  <span className="text-[11px] text-ink-faint font-mono-nums">{att.items.length} صورة</span>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-[11px] leading-relaxed text-ink-soft">
                    أرفِق صوراً للنشاط المُنفَّذ ليطّلع عليها الإشراف والإعلام — توثيقٌ مرئيّ يُكمّل التقرير الكتابي.
                  </p>

                  {att.items.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {att.items.map((im) => (
                        <div key={im.id} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-line">
                          <a href={im.url} target="_blank" rel="noreferrer">
                            <img src={im.url} alt={im.caption ?? "توثيق"} className="size-full object-cover transition group-hover:scale-105" />
                          </a>
                          {att.canUpload && (
                            <button
                              onClick={() => onDeleteAtt(im.id)}
                              aria-label="حذف الصورة"
                              className="absolute end-1 top-1 grid size-6 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                            >
                              <Trash2 className="size-3.5" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !att.canUpload && (
                      <p className="rounded-xl bg-surface-2 p-3 text-center text-[11px] text-ink-faint ring-1 ring-line">
                        لا صور توثيق لهذا الأسبوع بعد.
                      </p>
                    )
                  )}

                  {att.canUpload && (
                    <label
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40",
                        (uploading || !att.weeklyRecordId) && "pointer-events-none opacity-60",
                      )}
                    >
                      {uploading ? (
                        <Loader2 className="size-5 animate-spin text-emerald-700" strokeWidth={1.75} />
                      ) : (
                        <ImagePlus className="size-5 text-emerald-700" strokeWidth={1.75} />
                      )}
                      <span className="text-xs font-semibold text-ink">{uploading ? "جارٍ الرفع…" : "إضافة صور"}</span>
                      <span className="text-[10px] text-ink-faint">صور فقط · حتى ٥ ميغابايت للصورة</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploading || !att.weeklyRecordId}
                        onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ""; }}
                      />
                    </label>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
  );
  if (embedded) return body;
  return (
    <MishkatShell stickyFooter={readOnly ? undefined : <StickyActions shura={shura} todayPts={todayPts} onSave={onSave} />}>
      {body}
    </MishkatShell>
  );
}

/* ---------- helpers ---------- */

function CounterBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="grid size-9 place-items-center rounded-lg bg-surface text-ink ring-1 ring-line transition hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink"
    >
      {children}
    </button>
  );
}

function DesktopSave({ shura, onSave }: { shura: boolean; onSave: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSave}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-surface-2"
      >
        <Save className="size-4" strokeWidth={1.75} />
        حفظ مسودة
      </button>
      <button
        onClick={onSave}
        disabled={!shura}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line"
      >
        <CheckCircle2 className="size-4" strokeWidth={1.75} />
        اعتماد السجل
      </button>
    </div>
  );
}

function StickyActions({
  shura,
  todayPts,
  onSave,
}: {
  shura: boolean;
  todayPts: number;
  onSave: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-5xl items-center gap-2">
      <div className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-3 ring-1 ring-line">
        <span className="text-[11px] font-semibold text-ink-soft">اليوم</span>
        <span className="font-mono-nums text-base font-bold text-ink">
          +{todayPts}
        </span>
      </div>
      <button
        onClick={onSave}
        className={cn(
          "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-[0.99]",
          shura
            ? "bg-emerald-800 text-emerald-50 shadow-soft"
            : "bg-surface-2 text-ink-soft ring-1 ring-line",
        )}
      >
        {shura ? (
          <>
            <CheckCircle2 className="size-5" strokeWidth={1.75} />
            اعتماد السجل
          </>
        ) : (
          <>
            <Save className="size-5" strokeWidth={1.75} />
            حفظ كمسودة
          </>
        )}
      </button>
    </div>
  );
}
