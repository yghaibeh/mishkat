// رئيسية المدير العام (المواصفة: product/ui/home-admin.md — العدسة ع١):
// صحةٌ واتجاه، «ينتظر قراري»، استثناءات، نبض — بلا أيّ تشغيلٍ روتينيّ (ق1-د).
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { ShieldAlert, Wallet, TrendingUp, TrendingDown, Minus, ChevronLeft, Sparkles } from "lucide-react";
import type { AdminHome as AdminHomeData } from "@/server/home.server";

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function AdminHome({ data }: { data: AdminHomeData }) {
  const { health, decisions, exceptions, pulse } = data;
  const entryPct = pct(health.entered, health.mosquesTotal);
  const prevPct = pct(health.enteredPrev, health.mosquesTotal);
  const delta = entryPct - prevPct;
  const decisionsTotal = decisions.breakGlass + decisions.financeProposals;

  return (
    <MishkatShell>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">الرئيسية</h1>
        <p className="mt-1 text-sm text-ink-faint">صحة الشبكة، وما ينتظر قرارك — لا أكثر.</p>
      </header>

      {/* ١) صحة الشبكة */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-faint">إدخال هذا الأسبوع</h2>
            <p className="mt-1 font-display text-4xl font-bold text-ink font-mono-nums">
              {entryPct}<span className="text-xl">٪</span>
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              أدخل {health.entered} من {health.mosquesTotal} مسجداً سجلَّ هذا الأسبوع
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm">
            {delta > 0 ? <TrendingUp className="size-4 text-success" /> : delta < 0 ? <TrendingDown className="size-4 text-danger" /> : <Minus className="size-4 text-ink-faint" />}
            <span className="text-ink-faint">
              {delta === 0 ? "كما الأسبوع الماضي" : `${delta > 0 ? "+" : ""}${delta} نقطة عن الأسبوع الماضي`}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2/60 px-4 py-3 text-sm">
            <span className="font-semibold text-ink font-mono-nums">{health.chainsPending}</span>
            <span className="text-ink-faint"> تقريراً مُقدَّماً يسير في سلسلة اعتماده</span>
          </div>
          <div className={`rounded-xl px-4 py-3 text-sm ${health.chainsStuck > 0 ? "bg-danger-bg text-danger" : "bg-surface-2/60 text-ink-faint"}`}>
            <span className="font-semibold font-mono-nums">{health.chainsStuck}</span>
            <span> سلسلة تجاوزت ٧ أيام بلا بتّ{health.chainsStuck > 0 ? " — تحتاج نظرك" : ""}</span>
          </div>
        </div>
      </section>

      {/* ٢) ينتظر قراري — يُطوى كلّه إن لم يوجد شيء */}
      {decisionsTotal > 0 && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-base font-semibold text-ink">ينتظر قرارك</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {decisions.breakGlass > 0 && (
              <Link to="/network" className="flex items-center justify-between rounded-xl bg-danger-bg px-4 py-3 ring-1 ring-danger/20 transition hover:brightness-95">
                <span className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <ShieldAlert className="size-4" /> وحدات بلا معتمِد (كسر الزجاج)
                </span>
                <span className="font-mono-nums text-lg font-bold text-danger">{decisions.breakGlass}</span>
              </Link>
            )}
            {decisions.financeProposals > 0 && (
              <Link to="/finance" className="flex items-center justify-between rounded-xl bg-gold-50 px-4 py-3 ring-1 ring-gold-100 transition hover:brightness-95">
                <span className="flex items-center gap-2 text-sm font-semibold text-gold-700">
                  <Wallet className="size-4" /> مقترحات مالية بانتظار اعتمادك
                </span>
                <span className="font-mono-nums text-lg font-bold text-gold-700">{decisions.financeProposals}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ٣) استثناءات الأسبوع */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="font-display text-base font-semibold text-ink">خارج المسار هذا الأسبوع</h2>
        {exceptions.length === 0 ? (
          <p className="mt-3 rounded-xl bg-success-bg px-4 py-3 text-sm text-success">كل الوحدات على المسار هذا الأسبوع ✓</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {exceptions.map((e) => (
              <li key={e.unitId}>
                <Link to="/network/$unitId" params={{ unitId: e.unitId }} className="flex items-center justify-between gap-3 py-3 transition hover:bg-surface-2/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
                    <p className="text-xs text-ink-faint">
                      أدخل {e.entered} من {e.mosques} مسجداً{e.leaderName ? ` · قائدها: ${e.leaderName}` : " · لا قائد مكلَّف"}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-brand">لماذا؟ <ChevronLeft className="size-3.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ٤) نبض الشبكة */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "كوادر انضمّت آخر ٣٠ يوماً", value: pulse.newCadres30d },
          { label: "حلقة نشطة", value: pulse.circles },
          { label: "مسجداً في الشبكة", value: pulse.mosques },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
            <p className="flex items-center gap-1.5 text-xs text-ink-faint"><Sparkles className="size-3.5" />{k.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink font-mono-nums">{k.value}</p>
          </div>
        ))}
      </section>
    </main>
    </MishkatShell>
  );
}
