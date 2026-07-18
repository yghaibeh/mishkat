// رئيسيةٌ مؤقتة لبقية الأدوار (حتى تُبنى عدساتها في الدفعات ب–هـ): «المطلوب مني الآن»
// من بطاقات مهامّي — كلُّ بطاقة تنقر لعملها مباشرة (المواصفة ٣٦ §١).
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { CheckCircle2 } from "lucide-react";

type Card = { key: string; label: string; count: number; to: string; tone: string };

const TONE: Record<string, string> = {
  danger: "bg-danger-bg text-danger ring-danger/20",
  warn: "bg-gold-50 text-gold-700 ring-gold-100",
  info: "bg-surface-2/60 text-ink ring-line",
};

export function GenericHome({ cards }: { cards: Card[] }) {
  return (
    <MishkatShell>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">الرئيسية</h1>
        <p className="mt-1 text-sm text-ink-faint">المطلوب منك الآن — كل بطاقة تنقلك لمكان إنجازها.</p>
      </header>
      {cards.length === 0 ? (
        <section className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-3 text-sm font-semibold text-ink">لا شيء معلقاً عليك الآن</p>
          <p className="mt-1 text-sm text-ink-faint">أنجزتَ كل المطلوب — تصفح مكتبتك التدريبية إن شئت.</p>
        </section>
      ) : (
        <ul className="space-y-2">
          {cards.map((c) => (
            <li key={c.key}>
              <Link to={c.to} className={`flex items-center justify-between rounded-2xl px-5 py-4 ring-1 transition hover:brightness-95 ${TONE[c.tone] ?? TONE.info}`}>
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="font-mono-nums text-lg font-bold">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
    </MishkatShell>
  );
}
