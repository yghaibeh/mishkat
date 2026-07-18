import { useEffect, useRef, useState } from "react";
import { Link, useRouteContext } from "@tanstack/react-router";
import {
  ClipboardCheck, Layers, Wallet, BookOpen, GraduationCap, Trophy, BellRing, Sparkles,
  ShieldCheck, ArrowLeft, LogIn, LayoutDashboard, CheckCircle2, MoonStar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { firstAllowed } from "@/lib/access";
import { Reveal } from "./Reveal";

type Ctx = { user?: { caps?: string[]; homeMosqueId?: string | null; fullName?: string; brand?: { name?: string; letter?: string } } };

const FEATURES = [
  { Icon: ClipboardCheck, title: "سجل اليوم والتقرير الشهري", desc: "إدخالٌ يوميّ بسيط للأنشطة، واحتساب نقاطٍ تلقائيّ مقابل الهدف الأسبوعي، وتقريرٌ شهريّ غنيّ بالتفصيل." },
  { Icon: ShieldCheck, title: "سلسلة اعتمادٍ موثوقة", desc: "إقرار الأمير بالشورى، ثم اعتماد أعلى طبقةٍ مفعّلة (مربع/منطقة)، مع رفضٍ بسببٍ وتصعيدٍ زمنيّ عادل." },
  { Icon: Wallet, title: "المالية والمستحقات", desc: "احتساب المستحقات الشهرية (نقاط/ساعات/مقطوع) واعتمادها وتسجيل الصرف، بخصوصيةٍ وعزلِ نطاقٍ صارم." },
  { Icon: BookOpen, title: "الحلقات وعلى بصيرة والتحفيظ", desc: "إدارة حلقات المسجد و«على بصيرة» وحلقات التحفيظ، مع تقييمٍ أسبوعيّ ومتابعةٍ لتقدّم الطلاب." },
  { Icon: GraduationCap, title: "دور المدرّس/المحفّظ", desc: "حلقاتٌ يملكها المدرّس (ولو بلا مسجد) بمناهج متعددة: على بصيرة، تحفيظ القرآن، منهج الرشيدي." },
  { Icon: Trophy, title: "المسابقة السنوية", desc: "مسابقة «المسجد المؤثر» بلوحة ترتيبٍ متوسّعة، تسجيلٍ للمشاركين، وبرامجَ واختباراتٍ مركزية." },
  { Icon: BellRing, title: "الإشعارات والتذكيرات", desc: "مركز إشعاراتٍ داخل الموقع، وتذكيراتٌ وتصعيدٌ مجدولان تلقائياً عبر مهامّ دورية." },
  { Icon: Sparkles, title: "«المسجد المؤثر»", desc: "تصنيفٌ مُكتسَبٌ بالإنجاز مقابل الهدف (متميّز/دون الهدف/متعثّر) مع تقديرٍ معنويّ ولوحة شرف." },
];

const STEPS = [
  { n: "١", title: "إدخال يومي", desc: "يُدخل طاقم المسجد أنشطة اليوم بسهولة — حتى دون اتصال." },
  { n: "٢", title: "إقرار الشورى", desc: "يُقرّ الأمير أنّ الأنشطة تمّت بإشراك أسرة المسجد وبالشورى." },
  { n: "٣", title: "اعتماد طبقي", desc: "تعتمد أعلى طبقةٍ مفعّلة الأسبوع، أو تردّه بسببٍ للمراجعة." },
  { n: "٤", title: "احتساب واستحقاق", desc: "تُحتسَب النقاط والمستحقات شهرياً، ويُنسَب الأثر لمن أنجزه." },
];

const STATS = [
  { value: 26, label: "وحدة في منهاج على بصيرة", suffix: "" },
  { value: 4, label: "أدوار + دور المدرّس", suffix: "" },
  { value: 100, label: "هجريّ بالكامل", suffix: "٪" },
  { value: 24, label: "نوع نشاطٍ قابل للقياس", suffix: "+" },
];

function useCountUp(target: number, run: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const start = performance.now(); const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

function StatCard({ value, label, suffix }: { value: number; label: string; suffix: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((e) => e.forEach((x) => { if (x.isIntersecting) { setRun(true); io.disconnect(); } }), { threshold: 0.5 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const n = useCountUp(value, run);
  return (
    <div ref={ref} className="rounded-2xl bg-surface/70 p-5 text-center ring-1 ring-line backdrop-blur">
      <div className="font-mono-nums text-3xl font-bold text-emerald-800 sm:text-4xl">{n.toLocaleString("ar-EG")}{suffix}</div>
      <p className="mt-1.5 text-xs text-ink-soft sm:text-sm">{label}</p>
    </div>
  );
}

export function LandingPage() {
  const ctx = useRouteContext({ strict: false }) as Ctx;
  const user = ctx?.user;
  const brandName = user?.brand?.name || "مِشكاة";
  const brandLetter = user?.brand?.letter || "م";
  const dashHref = user ? (user.homeMosqueId ? `/mosque/${user.homeMosqueId}` : firstAllowed(user.caps ?? [])) : null;

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* شريط علوي عام */}
      <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-800 font-display text-base font-bold text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">{brandLetter}</span>
            <span className="font-display text-lg font-semibold text-ink">{brandName}</span>
          </a>
          <nav className="hidden items-center gap-1 text-sm text-ink-soft md:flex">
            <a href="#features" className="rounded-lg px-3 py-2 transition hover:bg-surface-2 hover:text-ink">الميزات</a>
            <a href="#how" className="rounded-lg px-3 py-2 transition hover:bg-surface-2 hover:text-ink">كيف يعمل</a>
            <Link to="/manhaj" className="rounded-lg px-3 py-2 transition hover:bg-surface-2 hover:text-ink">منهاج على بصيرة</Link>
          </nav>
          {dashHref ? (
            <a href={dashHref} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
              <LayoutDashboard className="size-4" strokeWidth={1.75} /> لوحتي
            </a>
          ) : (
            <Link to="/login" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
              <LogIn className="size-4" strokeWidth={1.75} /> تسجيل الدخول
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="hero-gradient relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-gold-100/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:px-6 md:py-28">
          <div className="text-center md:text-right" style={{ animation: "mishkat-fade-up .8s ease both" }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
              <MoonStar className="size-3.5" strokeWidth={1.75} /> منظومة إدارة المسجد المؤثر
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              {brandName} — حيث يُقاس <span className="text-emerald-800">الأثر</span> ويُنسَب لأهله
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg md:mx-0">
              منصّةٌ متكاملة لإدارة شبكة المساجد المؤثرة: سجلٌّ يوميّ، اعتمادٌ شوريّ طبقيّ، ماليةٌ وحلقاتٌ ومسابقة — كلّها بالتقويم الهجريّ وبخصوصيةٍ وعزلِ نطاق.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {dashHref ? (
                <a href={dashHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-800 px-6 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
                  <LayoutDashboard className="size-5" strokeWidth={1.75} /> الذهاب إلى لوحتي
                </a>
              ) : (
                <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-800 px-6 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900">
                  <LogIn className="size-5" strokeWidth={1.75} /> ابدأ الآن
                </Link>
              )}
              <Link to="/manhaj" className="inline-flex h-12 items-center gap-2 rounded-xl bg-surface px-6 text-sm font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2">
                <BookOpen className="size-5" strokeWidth={1.75} /> تصفّح منهاج على بصيرة
              </Link>
            </div>
          </div>
          {/* لوحة Hero بصرية */}
          <div className="relative hidden md:block">
            <div className="animate-float rounded-3xl bg-surface/80 p-6 shadow-soft ring-1 ring-line backdrop-blur">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="font-display text-sm font-semibold text-ink">تقرير مسجد الفاروق</span>
                <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">مسجد مؤثر — متميّز</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[["٢٨٠", "نقاط الشهر"], ["١٠٠٪", "تحقيق الهدف"], ["٥٠$", "المستحق"]].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                    <div className="font-mono-nums text-xl font-bold text-emerald-800">{v}</div>
                    <div className="mt-1 text-[10px] text-ink-faint">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {["أسرة المسجد", "على بصيرة", "الدروس", "الإعلام"].map((a, i) => (
                  <div key={a} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-ink-soft">{a}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gradient-to-l from-emerald-700 to-emerald-500" style={{ width: `${[92, 78, 100, 64][i]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* أرقام */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      {/* الميزات */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">كل ما يحتاجه المسجد المؤثر — في مكانٍ واحد</h2>
          <p className="mt-3 text-ink-soft">منظومةٌ مصمّمة من واقع دليل العمل، تُقاس بالأثر لا بالنوايا.</p>
        </Reveal>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal as="li" delay={((i % 3) + 1) as 1 | 2 | 3} key={f.title} className="group rounded-2xl bg-surface p-6 ring-1 ring-line transition hover:-translate-y-1 hover:shadow-soft hover:ring-line-strong">
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 transition group-hover:bg-emerald-800 group-hover:text-emerald-50">
                <f.Icon className="size-5" strokeWidth={1.6} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.desc}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* كيف يعمل */}
      <section id="how" className="border-y border-line bg-surface-2/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">كيف يعمل؟</h2>
            <p className="mt-3 text-ink-soft">من الإدخال اليومي إلى الاستحقاق الشهري — سلسلةٌ واضحة وعادلة.</p>
          </Reveal>
          <ol className="mt-12 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" delay={((i % 3) + 1) as 1 | 2 | 3} key={s.n} className="relative rounded-2xl bg-surface p-6 ring-1 ring-line">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-800 font-mono-nums text-lg font-bold text-emerald-50">{s.n}</span>
                <h3 className="mt-4 font-display text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
                {i < STEPS.length - 1 && <ArrowLeft aria-hidden className="absolute -left-3 top-9 hidden size-5 text-line-strong md:block" strokeWidth={2} />}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* قسم المنهاج */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <Reveal className="overflow-hidden rounded-3xl bg-emerald-900 text-emerald-50 ring-1 ring-emerald-900">
          <div className="grid items-center gap-8 p-8 md:grid-cols-2 md:p-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/10 px-3 py-1 text-xs font-semibold text-gold-100 ring-1 ring-emerald-50/15">
                <BookOpen className="size-3.5" strokeWidth={1.75} /> محتوى تعليميّ مفتوح
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">منهاج «على بصيرة»</h2>
              <p className="mt-3 max-w-md leading-relaxed text-emerald-100/80">
                منهاجٌ تربويّ للشباب والأسرة في ٢٦ وحدة — دروسٌ غنيّة بالآيات والأحاديث والفوائد، بقارئٍ أنيقٍ بحثيّ بتصميم {brandName}.
              </p>
              <Link to="/manhaj" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gold-500 px-5 text-sm font-semibold text-emerald-950 shadow-soft transition hover:bg-gold-600">
                افتح المنهاج <ArrowLeft className="size-4" strokeWidth={2} />
              </Link>
            </div>
            <ul className="grid gap-2.5">
              {["وحدات ودروس مرتّبة مع بحثٍ فوري", "تمييز الآيات والأحاديث وعبارات التعظيم", "فوائد وأنشطة وأسئلة تقويم", "متاحٌ للجميع بلا تسجيل دخول"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 rounded-xl bg-emerald-50/5 px-4 py-2.5 text-sm text-emerald-50 ring-1 ring-emerald-50/10">
                  <CheckCircle2 className="size-4 shrink-0 text-gold-100" strokeWidth={1.75} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* خاتمة CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <Reveal className="rounded-3xl border border-line bg-surface p-10 text-center shadow-soft">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">ابدأ بإدارة مسجدك المؤثر اليوم</h2>
          <p className="mx-auto mt-3 max-w-lg text-ink-soft">سجّل الدخول للوصول إلى لوحتك، أو تصفّح المنهاج التعليمي المفتوح.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {dashHref ? (
              <a href={dashHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-800 px-6 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900"><LayoutDashboard className="size-5" strokeWidth={1.75} /> لوحتي</a>
            ) : (
              <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-800 px-6 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900"><LogIn className="size-5" strokeWidth={1.75} /> تسجيل الدخول</Link>
            )}
            <Link to="/manhaj" className="inline-flex h-12 items-center gap-2 rounded-xl bg-surface px-6 text-sm font-semibold text-emerald-800 ring-1 ring-line transition hover:bg-surface-2"><BookOpen className="size-5" strokeWidth={1.75} /> منهاج على بصيرة</Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line bg-surface-2/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-ink-soft md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-800 font-display text-xs font-bold text-emerald-100">{brandLetter}</span>
            <span className="font-display font-semibold text-ink">{brandName}</span>
          </div>
          <p className="text-xs text-ink-faint">منظومة إدارة المسجد المؤثر — بالتقويم الهجريّ</p>
        </div>
      </footer>
    </div>
  );
}
