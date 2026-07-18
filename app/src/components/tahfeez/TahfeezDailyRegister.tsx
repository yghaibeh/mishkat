// سجلّ التحفيظ اليوميّ — مكوّنٌ مشترك: تبويب التحفيظ في صفحة المسجد + «حلقاتي» للمعلّم
// (توجيه اللجنة: المعلّم مصدر ٩٠٪ من الإدخال — منفذُه كامل من صفحته).
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/escape-html";
import { cn } from "@/lib/utils";
import { MSelect } from "@/components/ui/m-select";
import { SURAH_OPTIONS, surahAyat } from "@/lib/quran";
import { CIRCLE_TYPE_OPTIONS } from "@/lib/circles";
import { getTahfeezSession, saveTahfeezDaily } from "@/lib/api/tahfeez";
import { enqueue } from "@/lib/offline/outbox";

type DailyRecord = {
  attendance: string;
  hifzMode: string; hifzSurah: number | null; hifzFrom: number | null; hifzTo: number | null; hifzGrade: number | null;
  reviewMode: string; reviewSurah: number | null; reviewFrom: number | null; reviewTo: number | null; reviewGrade: number | null;
  tajweedGrade: number | null; companionKind: string; companion: string; note: string;
};
type DailyStudent = { id: string; name: string; record: DailyRecord };
const ATT: Array<{ v: string; label: string; cls: string }> = [
  { v: "present", label: "حاضر", cls: "bg-emerald-600 text-white" },
  { v: "absent", label: "غائب", cls: "bg-danger text-white" },
  { v: "excused", label: "مستأذن", cls: "bg-warn text-white" },
  { v: "left", label: "تارك", cls: "bg-ink-faint text-white" },
];
const inputCls = "h-8 rounded-md bg-surface px-2 text-[12px] text-ink ring-1 ring-line outline-none focus:ring-emerald-400";
const numToStr = (n: number | null) => (n == null ? "" : String(n));

// قسم نطاق (حفظ/مراجعة): مبدّل سورة/صفحة + منسدلة السور أو أرقام الصفحات + من/إلى + علامة
function ScopeSection({ label, tone, prefix, mode, surah, from, to, grade, onChange }: {
  label: string; tone: "emerald" | "gold"; prefix: "hifz" | "review";
  mode: string; surah: number | null; from: number | null; to: number | null; grade: number | null;
  onChange: (p: Partial<DailyRecord>) => void;
}) {
  const num = (v: string): number | null => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const set = (k: string, v: unknown) => onChange({ [`${prefix}${k}`]: v } as Partial<DailyRecord>);
  const isSurah = mode !== "page";
  const maxAyah = isSurah && surah ? surahAyat(surah) : undefined;
  const wrap = tone === "emerald" ? "bg-emerald-50/40" : "bg-gold-50/40";
  const head = tone === "emerald" ? "text-emerald-800" : "text-gold-800";
  const seg = (active: boolean) => cn("rounded px-1.5 py-0.5 text-[9px] font-semibold transition", active ? "bg-emerald-800 text-emerald-50" : "bg-surface-2 text-ink-soft ring-1 ring-line");
  return (
    <div className={cn("rounded-lg p-2", wrap)}>
      <div className="mb-1 flex items-center justify-between">
        <p className={cn("text-[10px] font-bold", head)}>{label}</p>
        <div className="flex gap-0.5">
          <button type="button" onClick={() => set("Mode", "surah")} className={seg(isSurah)}>سورة</button>
          <button type="button" onClick={() => set("Mode", "page")} className={seg(!isSurah)}>صفحة</button>
        </div>
      </div>
      <div className="flex gap-1">
        {isSurah ? (
          <select value={numToStr(surah)} onChange={(e) => set("Surah", num(e.target.value))} className={cn(inputCls, "min-w-0 flex-1")}>
            <option value="">السورة…</option>
            {SURAH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : null}
        <input value={numToStr(from)} onChange={(e) => set("From", num(e.target.value))}
          placeholder={isSurah ? "من آية" : "من صفحة"} title={maxAyah ? `١–${maxAyah}` : undefined} className={cn(inputCls, "w-16 text-center", isSurah ? "" : "flex-1")} />
        <input value={numToStr(to)} onChange={(e) => set("To", num(e.target.value))}
          placeholder="إلى" className={cn(inputCls, "w-16 text-center", isSurah ? "" : "flex-1")} />
        <input value={numToStr(grade)} onChange={(e) => set("Grade", num(e.target.value))}
          placeholder="علامة" className={cn(inputCls, "w-14 text-center")} />
      </div>
    </div>
  );
}

export function TahfeezDaily({ circleId, circleName, mosqueName }: { circleId: string; circleName?: string; mosqueName?: string }) {
  const [sessionId, setSessionId] = useState("");
  const [dateHijri, setDateHijri] = useState("");
  const [rows, setRows] = useState<DailyStudent[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadSession = () => {
    setBusy(true); setErr(false);
    getTahfeezSession({ data: { circleId } }).then((r) => {
      const d = r as { sessionId: string; dateHijri: string; students: DailyStudent[] };
      setSessionId(d.sessionId); setDateHijri(d.dateHijri); setRows(d.students);
    }).catch(() => setErr(true)).finally(() => setBusy(false));
  };
  useEffect(() => { loadSession(); /* eslint-disable-next-line */ }, [circleId]);

  const patch = (id: string, p: Partial<DailyRecord>) => setRows((rs) => rs.map((s) => s.id === id ? { ...s, record: { ...s.record, ...p } } : s));
  const num = (v: string): number | null => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

  const save = async () => {
    setSaving(true);
    try {
      const records = rows.map((s) => {
        const r = s.record;
        return {
          studentId: s.id, attendance: r.attendance as "present" | "absent" | "left" | "excused",
          hifzMode: (r.hifzMode as "surah" | "page") || "surah", hifzSurah: r.hifzSurah ?? undefined, hifzFrom: r.hifzFrom ?? undefined, hifzTo: r.hifzTo ?? undefined, hifzGrade: r.hifzGrade ?? undefined,
          reviewMode: (r.reviewMode as "surah" | "page") || "surah", reviewSurah: r.reviewSurah ?? undefined, reviewFrom: r.reviewFrom ?? undefined, reviewTo: r.reviewTo ?? undefined, reviewGrade: r.reviewGrade ?? undefined,
          tajweedGrade: r.tajweedGrade ?? undefined, companionKind: r.companionKind || undefined, companion: r.companion || undefined, note: r.note || undefined,
        };
      });
      const res = await saveTahfeezDaily({ data: { sessionId, records } });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success("حُفظ سجلّ اليوم");
    } catch {
      // انقطاعُ الشبكة (الميدان): يُصفُّ الحفظُ ويُزامَن تلقائيًّا عند عودة الاتصال (غ٤)
      try {
        await enqueue("tahfeez_daily", { circleId, dateHijri, records: rows.map((s) => {
          const r = s.record;
          return {
            studentId: s.id, attendance: r.attendance,
            hifzMode: r.hifzMode || "surah", hifzSurah: r.hifzSurah ?? undefined, hifzFrom: r.hifzFrom ?? undefined, hifzTo: r.hifzTo ?? undefined, hifzGrade: r.hifzGrade ?? undefined,
            reviewMode: r.reviewMode || "surah", reviewSurah: r.reviewSurah ?? undefined, reviewFrom: r.reviewFrom ?? undefined, reviewTo: r.reviewTo ?? undefined, reviewGrade: r.reviewGrade ?? undefined,
            tajweedGrade: r.tajweedGrade ?? undefined, companionKind: r.companionKind || undefined, companion: r.companion || undefined, note: r.note || undefined,
          };
        }) });
        toast.message("لا اتصال — حُفظ محليًّا", { description: "سيُزامَن سجلُّ اليوم تلقائيًّا عند عودة الشبكة." });
      } catch { toast.error("تعذّر الحفظ"); }
    } finally { setSaving(false); }
  };

  // كشفٌ رسميٌّ قابلٌ للطباعة/الحفظ صورةً (ملاحظة المجرِّب: يُرسَل لمجموعات الأهالي ويطّلع عليه المسؤول)
  const printRoster = () => {
    const att = (a: string) => a === "present" ? "حاضر ✓" : a === "absent" ? "غائب ✗" : a === "left" ? "تارك" : a === "excused" ? "مستأذن" : "—";
    const surahName = (n: number | null | undefined) => (n ? (SURAH_OPTIONS.find((o) => Number(o.value) === n)?.label ?? String(n)) : "");
    const scope = (mode: string | null | undefined, surah: number | null | undefined, from: number | null | undefined, to: number | null | undefined) => {
      if (!surah && !from && !to) return "—";
      const range = from || to ? ` ${from ?? ""}${to ? `–${to}` : ""}` : "";
      return mode === "page" ? `ص${range}` : `${surahName(surah)}${range}`;
    };
    const trs = rows.map((s, i) => `<tr>
      <td>${i + 1}</td><td class="n">${escapeHtml(s.name)}</td><td>${att(s.record.attendance ?? "")}</td>
      <td>${scope(s.record.hifzMode, s.record.hifzSurah, s.record.hifzFrom, s.record.hifzTo)}</td><td>${s.record.hifzGrade ?? "—"}</td>
      <td>${scope(s.record.reviewMode, s.record.reviewSurah, s.record.reviewFrom, s.record.reviewTo)}</td><td>${s.record.reviewGrade ?? "—"}</td>
      <td>${s.record.tajweedGrade ?? "—"}</td><td class="n">${escapeHtml(s.record.note ?? "")}</td>
    </tr>`).join("");
    const presentCount = rows.filter((s) => s.record.attendance === "present").length;
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف ${escapeHtml(circleName ?? "")} — ${escapeHtml(dateHijri)}</title>
      <style>
        body{font-family:'IBM Plex Sans Arabic',system-ui;padding:1.5rem;color:#1a2e28}
        .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #14532d;padding-bottom:.6rem;margin-bottom:1rem}
        h1{font-size:1.15rem;margin:0;color:#14532d} .sub{font-size:.8rem;color:#555}
        table{width:100%;border-collapse:collapse;font-size:.82rem}
        th,td{border:1px solid #9ca3af;padding:.35rem .5rem;text-align:center} th{background:#ecfdf5;color:#14532d}
        td.n{text-align:right} tfoot td{background:#fafaf5;font-weight:700}
        .sig{display:flex;justify-content:space-between;margin-top:2rem;font-size:.8rem}
        @media print{.no-print{display:none}}
      </style></head><body>
      <div class="head">
        <div><h1>سجلّ التفقّد والمتابعة — حلقة ${escapeHtml(circleName ?? "")}</h1>
        <div class="sub">${mosqueName ? `مسجد ${escapeHtml(mosqueName)} · ` : ""}التاريخ: ${escapeHtml(dateHijri)} هـ</div></div>
        <div class="sub">مِشكاة — منظومة المسجد المؤثر</div>
      </div>
      <table><thead><tr><th>م</th><th>الطالب</th><th>التفقّد</th><th>الحفظ (التسميع)</th><th>علامة</th><th>المراجعة</th><th>علامة</th><th>التجويد</th><th>ملاحظات</th></tr></thead>
      <tbody>${trs}</tbody>
      <tfoot><tr><td colspan="2">الحضور: ${presentCount} من ${rows.length}</td><td colspan="7"></td></tr></tfoot></table>
      <div class="sig"><span>توقيع المعلّم: ــــــــــــــــ</span><span>توقيع مسؤول المسجد: ــــــــــــــــ</span></div>
      <button class="no-print" onclick="print()" style="margin-top:1rem;padding:.5rem 1.5rem">طباعة / حفظ PDF</button>
      </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  if (busy) return <div className="grid place-items-center border-t border-line py-6 text-ink-faint"><Loader2 className="size-4 animate-spin" /></div>;
  if (err) return (
    <div className="flex items-center justify-center gap-3 border-t border-line py-5 text-sm text-ink-soft">
      تعذّر تحميل سجلّ اليوم.
      <button onClick={loadSession} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface"><RefreshCw className="size-3.5" /> إعادة المحاولة</button>
    </div>
  );
  return (
    <div className="border-t border-line bg-surface-2/30 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink"><CalendarDays className="size-3.5 text-emerald-800" strokeWidth={1.75} /> سجلّ اليوم · <span className="font-mono-nums text-ink-soft">{dateHijri}</span></span>
        <div className="flex items-center gap-1.5">
          <button onClick={printRoster} disabled={!rows.length}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-60">
            <Printer className="size-3.5" /> طباعة الكشف
          </button>
          <button onClick={save} disabled={saving || !rows.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900 disabled:opacity-60">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} حفظ سجلّ اليوم
          </button>
        </div>
      </div>
      {!rows.length ? <p className="py-3 text-center text-[11px] text-ink-faint">لا طلاب في الحلقة — أضِفهم من «طالب».</p> : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const present = s.record.attendance === "present";
            const otherComp = s.record.companionKind === "other";
            return (
              <li key={s.id} className="rounded-xl bg-surface p-2.5 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.name}</span>
                  <div className="flex gap-1">
                    {ATT.map((a) => (
                      <button key={a.v} onClick={() => patch(s.id, { attendance: a.v })}
                        className={cn("rounded-md px-2 py-1 text-[10px] font-semibold transition", s.record.attendance === a.v ? a.cls : "bg-surface-2 text-ink-soft ring-1 ring-line")}>{a.label}</button>
                    ))}
                  </div>
                </div>
                {present && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <ScopeSection label="الحفظ (الإنجاز)" tone="emerald" prefix="hifz" mode={s.record.hifzMode} surah={s.record.hifzSurah} from={s.record.hifzFrom} to={s.record.hifzTo} grade={s.record.hifzGrade} onChange={(p) => patch(s.id, p)} />
                    <ScopeSection label="المراجعة" tone="gold" prefix="review" mode={s.record.reviewMode} surah={s.record.reviewSurah} from={s.record.reviewFrom} to={s.record.reviewTo} grade={s.record.reviewGrade} onChange={(p) => patch(s.id, p)} />
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <input value={numToStr(s.record.tajweedGrade)} onChange={(e) => patch(s.id, { tajweedGrade: num(e.target.value) })} placeholder="التجويد (علامة)" className={cn(inputCls, "w-32")} />
                      <select value={s.record.companionKind} onChange={(e) => patch(s.id, { companionKind: e.target.value })} className={cn(inputCls, "w-40")}>
                        <option value="">المنهج المصاحب…</option>
                        {CIRCLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        <option value="other">أخرى…</option>
                      </select>
                      {otherComp && <input value={s.record.companion} onChange={(e) => patch(s.id, { companion: e.target.value })} placeholder="حدّد المصاحب…" className={cn(inputCls, "min-w-0 flex-1")} />}
                    </div>
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

