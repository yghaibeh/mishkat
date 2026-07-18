// رئيسية المشرف (مربع/منطقة/قسم) — المواصفة: product/ui/home-supervisor.md (ع٢–ع٤):
// قائمةُ عملٍ لا لوحةُ أرقام: بانتظار اعتمادي، حالة وحداتي، زياراتي، طلباتي، تقرير نطاقي.
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { CheckCircle2, MapPin, UserPlus, ChevronLeft, Send } from "lucide-react";
import type { SupervisorHome as Data, UnitWeekState } from "@/server/home.server";

const ROLE_TITLE: Record<string, string> = { square: "مساجدي", rabita: "وحدات منطقتي", section_head: "مناطق قسمي" };
const STATE_UI: Record<UnitWeekState, { label: string; cls: string }> = {
  none: { label: "لم يُدخل بعد", cls: "bg-danger-bg text-danger" },
  draft: { label: "مسودة", cls: "bg-gold-50 text-gold-700" },
  submitted: { label: "قُدّم للاعتماد", cls: "bg-emerald-50 text-emerald-800" },
  approved: { label: "معتمد ✓", cls: "bg-success-bg text-success" },
  rejected: { label: "مرفوض — يُصحَّح", cls: "bg-danger-bg text-danger" },
};

export function SupervisorHome({ data }: { data: Data }) {
  const { children } = data;
  return (
    <MishkatShell>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">{data.unitName}</h1>
        <p className="mt-1 text-sm text-ink-faint">رئيسيتك: ما ينتظر اعتمادك، وحال {ROLE_TITLE[data.supervisorRole] ?? "وحداتك"} هذا الأسبوع.</p>
      </header>

      {/* ١) بانتظار اعتمادي */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="font-display text-base font-semibold text-ink">بانتظار اعتمادك</h2>
        {data.pendingApprovals.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> لا اعتمادات معلقةً عليك الآن
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.pendingApprovals.map((p) => (
              <li key={p.unitId}>
                <Link to="/network" className="flex items-center justify-between rounded-xl bg-gold-50 px-4 py-3 ring-1 ring-gold-100 transition hover:brightness-95">
                  <span className="text-sm font-semibold text-gold-700">{p.name.startsWith(p.typeLabel) ? p.name : `${p.typeLabel} ${p.name}`}</span>
                  <span className="text-xs text-gold-700 font-mono-nums">{p.weeks} أسبوع · {p.points} نقطة — اعتمد ←</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ٢) حالة وحداتي هذا الأسبوع — قائمة عمل */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">{ROLE_TITLE[data.supervisorRole] ?? "وحداتي"} هذا الأسبوع</h2>
          <span className="text-xs text-ink-faint font-mono-nums">أدخل {children.entered} من {children.total}</span>
        </div>
        {children.total === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">لا وحدات مباشرة تحتك بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {children.items.map((c) => (
              <li key={c.id}>
                <Link to="/network/$unitId" params={{ unitId: c.id }} className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-surface-2/50">
                  <span className="min-w-0 truncate text-sm text-ink">{c.name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATE_UI[c.state].cls}`}>
                    {STATE_UI[c.state].label}
                  </span>
                </Link>
                {c.reason && <p className="pb-2 pr-1 text-[11px] text-danger">سبب الرفض: {c.reason}</p>}
              </li>
            ))}
            {children.total > children.items.length && (
              <li className="pt-2 text-center">
                <Link to="/network" className="text-xs text-brand">عرض الكل ({children.total}) ←</Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ٣+٤) زياراتي وطلباتي */}
      <section className="grid gap-3 sm:grid-cols-2">
        {data.visits && (data.visits.due > 0 || data.visits.overdue > 0) && (
          <Link to="/ala-baseera" search={{ tab: "supervision" }} className="flex items-center justify-between rounded-2xl bg-surface px-5 py-4 ring-1 ring-line transition hover:bg-surface-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><MapPin className="size-4 text-brand" /> زياراتي الإشرافية</span>
            <span className="text-xs text-ink-faint font-mono-nums">{data.visits.due} لم تُزر · {data.visits.overdue} تجاوزت ٣٠ يوماً</span>
          </Link>
        )}
        {data.registrations > 0 && (
          <Link to="/network" className="flex items-center justify-between rounded-2xl bg-surface px-5 py-4 ring-1 ring-line transition hover:bg-surface-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><UserPlus className="size-4 text-brand" /> طلبات انضمام بانتظار بتّك</span>
            <span className="font-mono-nums text-lg font-bold text-brand">{data.registrations}</span>
          </Link>
        )}
      </section>

      {/* ٥) تقرير نطاقي — الزر فقط حين توجد حصيلة (قاعدة الصفر) */}
      {data.layerReport && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">تقرير نطاقي هذا الأسبوع</h2>
              <p className="mt-1 text-sm text-ink-faint">
                {data.layerReport.status === "approved" ? "معتمدٌ نهائياً ✓"
                  : data.layerReport.status === "submitted" ? "قُدِّم — بانتظار من فوقك"
                  : data.layerReport.points > 0 ? `حصيلة نطاقك حتى الآن: ${data.layerReport.points} نقطة`
                  : "لا إدخال بعد — ذكِّر وحداتك أولاً"}
              </p>
            </div>
            {data.layerReport.points > 0 && data.layerReport.status !== "approved" && data.layerReport.status !== "submitted" && (
              <Link to="/network" className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
                <Send className="size-4" /> تقديم للاعتماد <ChevronLeft className="size-4" />
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
    </MishkatShell>
  );
}
