import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookMarked, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGuardianView } from "@/lib/api/tahfeez";

// صفحة وليّ الأمر (غ٥ — المرحلة د): متابعةُ الطالب للقراءة فقط برمزٍ سرّيّ — بلا تسجيل دخول.
export const Route = createFileRoute("/student/$token")({
  head: () => ({ meta: [{ title: "متابعة الطالب — مشكاة" }] }),
  component: GuardianPage,
});

type View = {
  studentName: string; circleName: string; mosqueName: string;
  attendancePct: number; sessions: number; avgGrade: number | null;
  recent: Array<{ dateHijri: string; attendance: string; hifz: string | null; hifzGrade: number | null; review: string | null; reviewGrade: number | null; tajweedGrade: number | null; note: string | null }>;
};
const ATT_AR: Record<string, string> = { present: "حاضر", absent: "غائب", left: "تارك", excused: "مستأذن" };

function GuardianPage() {
  const { token } = Route.useParams();
  const [v, setV] = useState<View | { error: string } | null>(null);
  useEffect(() => { getGuardianView({ data: { token } }).then((r) => setV(r as never)).catch(() => setV({ error: "تعذّر التحميل" })); }, [token]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <BookMarked className="size-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">متابعة الطالب</h1>
            <p className="text-xs text-ink-soft">مِشكاة — منظومة المسجد المؤثر</p>
          </div>
        </div>

        {!v ? (
          <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>
        ) : "error" in v ? (
          <p className="rounded-2xl bg-danger-bg p-6 text-center text-sm font-semibold text-danger ring-1 ring-danger/20">{v.error}</p>
        ) : (
          <>
            <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <p className="font-display text-lg font-bold text-ink">{v.studentName}</p>
              <p className="mt-0.5 text-sm text-ink-soft">حلقة {v.circleName} · مسجد {v.mosqueName}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                  <p className={cn("font-mono-nums text-2xl font-bold", v.attendancePct >= 75 ? "text-emerald-800" : "text-warn")}>{v.attendancePct}٪</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">نسبة الحضور</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                  <p className="font-mono-nums text-2xl font-bold text-ink">{v.sessions}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">جلسةً مسجَّلة</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                  <p className="font-mono-nums text-2xl font-bold text-ink">{v.avgGrade ?? "—"}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">متوسّط العلامات</p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <div className="border-b border-line bg-surface-2/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">آخر الجلسات</h2>
              </div>
              <ul className="divide-y divide-line">
                {v.recent.map((r, i) => (
                  <li key={i} className="space-y-1 px-4 py-3">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-mono-nums text-ink-faint" dir="ltr">{r.dateHijri}</span>
                      <span className={cn("inline-flex items-center gap-1 font-semibold", r.attendance === "present" ? "text-emerald-800" : "text-danger")}>
                        {r.attendance === "present" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                        {ATT_AR[r.attendance] ?? r.attendance}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[12px] text-ink-soft">
                      {r.hifz && <span>التسميع: <b className="text-ink">{r.hifz}</b>{r.hifzGrade != null ? ` (${r.hifzGrade})` : ""}</span>}
                      {r.review && <span>المراجعة: {r.review}{r.reviewGrade != null ? ` (${r.reviewGrade})` : ""}</span>}
                      {r.tajweedGrade != null && <span>التجويد: {r.tajweedGrade}</span>}
                      {r.note && <span className="text-ink-faint">«{r.note}»</span>}
                    </div>
                  </li>
                ))}
                {!v.recent.length && <li className="p-6 text-center text-sm text-ink-faint">لا جلسات مسجَّلةً بعد.</li>}
              </ul>
            </div>
            <p className="text-center text-[11px] text-ink-faint">هذه الصفحة للاطّلاع فقط — احتفظوا بالرابط ولا تشاركوه خارج الأسرة.</p>
          </>
        )}
      </div>
    </div>
  );
}
