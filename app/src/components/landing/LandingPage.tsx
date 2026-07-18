// «البوابة» (قرار المالك ٢٠٢٦-٠٧-١٨): من يصل هنا كادرٌ جديدٌ وصله رابطٌ من مسؤوله — يريد أن
// يفهم في سطرين ويدخل أو ينضم. لا إحصائيات (رقمٌ تسويقيٌّ بلا مصدرٍ حي = تضليل — قاعدة الأربعة)
// ولا نشرةَ ميزات. المسجَّلُ يُؤخذ لرئيسيته فوراً.
import { Link, Navigate, useRouteContext } from "@tanstack/react-router";
import { LogIn, UserPlus, BookOpen, ChevronLeft } from "lucide-react";
import { firstAllowed } from "@/lib/access";

type Ctx = { user?: { caps?: string[] } };

const STEPS = [
  { n: "١", t: "سجّل بياناتك", d: "اسمك وجهتك وسبيل التواصل — دقيقة واحدة." },
  { n: "٢", t: "يعتمدك مسؤولك الأقرب", d: "أميرُ مسجدك أو مشرفُ منطقتك — يصله طلبك مباشرة." },
  { n: "٣", t: "تفتح رئيسيتك", d: "شاشةٌ على مقاس دورك: عملُك وما ينتظرك — لا أكثر." },
];

export function LandingPage() {
  const ctx = useRouteContext({ strict: false }) as Ctx;
  // المسجَّل لا شأن له بالبوابة — إلى رئيسيته
  if (ctx.user) return <Navigate to={firstAllowed(ctx.user.caps ?? []) as never} />;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
        {/* الهوية — الشعارُ وحده باللمسة التراثية (font-logo)، والبقيةُ حديثة */}
        <header className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <span className="font-logo text-2xl font-bold">مِ</span>
          </div>
          <h1 className="font-logo mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">مِشكاة</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">
            منظومةُ عمل «المسجد المؤثر» — تُنظّم عملَ المساجد والحلقات التعليميَّ والاجتماعيَّ والماليَّ،
            من سجلِّ اليوم حتى اعتماد الإدارة.
          </p>
        </header>

        {/* البابان */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link to="/login"
            className="group flex items-center justify-between rounded-2xl bg-emerald-800 px-6 py-5 text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
            <span className="flex items-center gap-3 text-lg font-semibold"><LogIn className="size-5" strokeWidth={1.75} /> تسجيل الدخول</span>
            <ChevronLeft className="size-5 opacity-60 transition group-hover:-translate-x-0.5" />
          </Link>
          <Link to="/register"
            className="group flex items-center justify-between rounded-2xl bg-surface px-6 py-5 text-ink shadow-soft ring-1 ring-line transition hover:ring-emerald-800/40">
            <span className="flex items-center gap-3 text-lg font-semibold"><UserPlus className="size-5 text-emerald-800" strokeWidth={1.75} /> اطلب الانضمام</span>
            <ChevronLeft className="size-5 text-ink-faint transition group-hover:-translate-x-0.5" />
          </Link>
        </section>

        {/* كيف تنضم — ثلاث خطوات حقيقية لا نشرة ميزات */}
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-sm font-semibold text-ink">كيف تنضم؟</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="space-y-1.5">
                <span className="grid size-8 place-items-center rounded-full bg-emerald-50 font-mono-nums text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{s.n}</span>
                <p className="text-sm font-semibold text-ink">{s.t}</p>
                <p className="text-[13px] leading-relaxed text-ink-soft">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* سطر ختامي — المنهاج للعموم */}
        <footer className="text-center text-sm text-ink-soft">
          <Link to="/manhaj" className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 hover:underline">
            <BookOpen className="size-4" strokeWidth={1.75} /> تصفّح منهاج «على بصيرة»
          </Link>
          <span className="mx-2 text-ink-faint">·</span>
          <span>للاستفسار تواصل مع مسؤولك المباشر</span>
        </footer>
      </main>
    </div>
  );
}
