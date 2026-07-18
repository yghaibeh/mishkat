// رئيسية أمير المسجد (المواصفة: product/ui/home-amir.md — العدسة ع٥):
// هدفُ الأسبوع الحقيقيّ، «بقي عليّ»، سجلُ اليوم مضمّنًا، وحالُ مسجدي — بلا أرقامٍ وهميّة.
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { CircleAlert, ChevronLeft, BookOpen } from "lucide-react";
import { DailyLogPage } from "@/components/daily-log/DailyLogPage";
import type { AmirHome as AmirHomeData } from "@/server/home.server";
import type { TaskCard } from "@/server/myTasks.server";

const CHAIN_LABEL: Record<string, (d: AmirHomeData) => string> = {
  none: () => "لم يبدأ إدخال هذا الأسبوع بعد — ابدأ بسجل اليوم ↓",
  draft: () => "سجلّك مسودة عندك — أكمل الإدخال ثم اعتمده بالشورى",
  rejected: (d) => d.chain.state === "rejected" ? `أُعيد إليك أسبوعٌ للمراجعة — السبب: ${d.chain.reason}` : "",
  submitted: (d) => d.chain.state === "submitted" ? `قُدّم سجلّك — بانتظار اعتماد ${d.chain.approverName ?? "طبقتك الأقرب"}` : "",
  approved: () => "سجلّ هذا الأسبوع معتمدٌ نهائياً ✓",
};

type DailyData = { tracks: { m: unknown[]; w: unknown[] }; weekTarget: number };

export function AmirHome({ data, daily, genderTrack, tasks }: { data: AmirHomeData; daily: DailyData | null; genderTrack?: string; tasks: TaskCard[] }) {
  const remaining = Math.max(0, data.week.target - data.week.points);
  const weekPct = Math.min(100, Math.round((data.week.points / data.week.target) * 100));
  // «بقي عليّ»: بطاقات مهامّي التي تخصّ الأمير فعلاً (لا قناة مكررة — قاعدة القناة الواحدة)
  const myPending = tasks.filter((t) => ["family-students", "library", "exams", "duties"].includes(t.key));

  return (
    <MishkatShell>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{data.mosqueName}</h1>
          <p className="mt-1 text-sm text-ink-faint">رئيسيتك: هدف الأسبوع، وما بقي عليك اليوم.</p>
        </div>
        <Link to="/mosque/$mosqueId" params={{ mosqueId: data.mosqueId }} className="flex items-center gap-1 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-brand ring-1 ring-line transition hover:bg-surface-2">
          لوحة مسجدي الكاملة <ChevronLeft className="size-4" />
        </Link>
      </header>

      {/* ١) هدفي هذا الأسبوع — نقاطٌ حقيقيّة من السجل */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-faint">هدفي هذا الأسبوع</h2>
            <p className="mt-1 font-display text-4xl font-bold text-ink font-mono-nums">
              {data.week.points}<span className="text-xl text-ink-faint"> / {data.week.target}</span>
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {remaining > 0 ? `بقي لك ${remaining} نقطة لبلوغ الهدف` : "بلغتَ هدف الأسبوع — أحسنت 🎉"}
            </p>
          </div>
          <div className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2 sm:w-64">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${weekPct}%` }} />
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-surface-2/60 px-4 py-3 text-sm text-ink-faint">
          {CHAIN_LABEL[data.chain.state]?.(data) ?? ""}
        </p>
      </section>

      {/* ٢) بقي عليّ — يُطوى إن لم يوجد شيء */}
      {(myPending.length > 0 || data.chain.state === "rejected") && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-base font-semibold text-ink">بقي عليّ</h2>
          <ul className="mt-3 space-y-2">
            {data.chain.state === "rejected" && (
              <li className="flex items-center gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
                <CircleAlert className="size-4 shrink-0" />
                راجع الأسبوع المرفوض وصحّحه ثم أعد اعتماده
              </li>
            )}
            {myPending.map((t) => (
              <li key={t.key}>
                <Link to={t.to} className="flex items-center justify-between rounded-xl bg-surface-2/60 px-4 py-3 text-sm text-ink transition hover:bg-surface-2">
                  <span>{t.label}</span>
                  <span className="font-mono-nums font-bold text-brand">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ٣) سجل اليوم — مضمّنٌ مباشرة، لا نقرة وسيطة */}
      <section className="rounded-2xl bg-surface ring-1 ring-line">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">سجل اليوم</h2>
        </div>
        <div className="p-2 sm:p-4">
          <DailyLogPage
            data={(daily ?? undefined) as never}
            embedded
            mosqueId={data.mosqueId}
            genderTrack={genderTrack}
            priorWeekPoints={data.week.points}
          />
        </div>
      </section>

      {/* ٤) مسجدي هذا الأسبوع */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint"><BookOpen className="size-3.5" /> حلقات مسجدنا</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink font-mono-nums">{data.circles.active}</p>
          <p className="text-xs text-ink-faint">{data.circles.sessions7d} جلسة خلال ٧ أيام</p>
        </div>
        <div className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
          <p className="text-xs text-ink-faint">نقاط الشهر ({data.month.month})</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink font-mono-nums">
            {data.month.points}<span className="text-sm text-ink-faint"> / {data.month.target}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
          <p className="text-xs text-ink-faint">استحقاق الشهر</p>
          {data.month.entitlement ? (
            <p className="mt-1 font-display text-2xl font-bold text-ink font-mono-nums">
              ${data.month.entitlement.amount.toFixed(2)}
              <span className="block text-xs font-normal text-ink-faint">
                {data.month.entitlement.status === "paid" ? "مصروف" : data.month.entitlement.status === "approved" ? "معتمد — بانتظار الصرف" : "مُرشَّح"}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">يُحتسب بعد اعتماد تقريرك الشهري.</p>
          )}
        </div>
      </section>
    </main>
    </MishkatShell>
  );
}
