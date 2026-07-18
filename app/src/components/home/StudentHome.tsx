// رئيسية الطالب (ع١٠ — كانت عدسته غائبة كلياً): مطلوباتي، حلقتي وتقدمي، درجاتي.
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { CheckCircle2, BookOpen, GraduationCap } from "lucide-react";
import type { StudentHome as Data } from "@/server/home.server";

const TONE: Record<string, string> = {
  danger: "bg-danger-bg text-danger ring-danger/20",
  warn: "bg-gold-50 text-gold-700 ring-gold-100",
  info: "bg-surface-2/60 text-ink ring-line",
};

export function StudentHome({ data }: { data: Data }) {
  return (
    <MishkatShell>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">الرئيسية</h1>
        <p className="mt-1 text-sm text-ink-faint">المطلوب منك الآن، وأين وصلتَ في مسيرتك.</p>
      </header>

      {/* ١) مطلوباتي */}
      {data.cards.length === 0 ? (
        <section className="rounded-2xl bg-surface p-6 text-center ring-1 ring-line">
          <CheckCircle2 className="mx-auto size-7 text-success" />
          <p className="mt-2 text-sm font-semibold text-ink">لا شيء معلقاً عليك الآن — أحسنت</p>
        </section>
      ) : (
        <ul className="space-y-2">
          {data.cards.map((c) => (
            <li key={c.key}>
              <Link to={c.to} className={`flex items-center justify-between rounded-2xl px-5 py-4 ring-1 transition hover:brightness-95 ${TONE[c.tone] ?? TONE.info}`}>
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="font-mono-nums text-lg font-bold">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* ٢) حلقتي وتقدمي */}
      {data.circle && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <BookOpen className="size-4 text-brand" /> حلقتي: {data.circle.name}
          </h2>
          {data.circle.teacher && <p className="mt-1 text-sm text-ink-faint">معلّمي: {data.circle.teacher}</p>}
          {data.progress && (
            <p className="mt-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm text-ink">
              {data.progress.completed > 0
                ? <>أتممتَ <span className="font-bold text-brand font-mono-nums">{data.progress.completed}</span> مجلساً{data.progress.lastMajlis ? ` — آخرها: ${data.progress.lastMajlis}` : ""}</>
                : "لم تبدأ مجالس المنهج بعد — رحلتك تبدأ من الجلسة القادمة بإذن الله"}
            </p>
          )}
        </section>
      )}

      {/* ٣) درجاتي الأخيرة */}
      {data.lastScores.length > 0 && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <GraduationCap className="size-4 text-brand" /> آخر درجاتي
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.lastScores.map((s, i) => (
              <span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 font-mono-nums">
                {s.score} / {s.maxScore}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
    </MishkatShell>
  );
}
