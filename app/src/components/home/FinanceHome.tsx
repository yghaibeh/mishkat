// رئيسية المسؤول المالي (ع٨): مقترحاتي أولاً، ثم سلامة الدفتر ودورة العمل — الاعتماد للمدير حصراً.
import { Link } from "@tanstack/react-router";
import { MishkatShell } from "@/components/nav/MishkatShell";
import { Wallet, CheckCircle2, CircleAlert, ChevronLeft } from "lucide-react";
import type { FinanceHome as Data } from "@/server/home.server";

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  pending: { label: "بانتظار اعتماد المدير", cls: "bg-gold-50 text-gold-700" },
  approved: { label: "اعتُمد", cls: "bg-emerald-50 text-emerald-800" },
  executed: { label: "اعتُمد ونُفِّذ ✓", cls: "bg-success-bg text-success" },
  rejected: { label: "مرفوض", cls: "bg-danger-bg text-danger" },
  cancelled: { label: "أُلغي", cls: "bg-surface-2 text-ink-faint" },
  failed: { label: "فشل التنفيذ", cls: "bg-danger-bg text-danger" },
};

export function FinanceHome({ data }: { data: Data }) {
  return (
    <MishkatShell>
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">الرئيسية</h1>
        <p className="mt-1 text-sm text-ink-faint">مقترحاتك المالية وحالها، وسلامة الدفتر — الاعتماد عند المدير.</p>
      </header>

      <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Wallet className="size-4 text-brand" /> مقترحاتي المالية
          </h2>
          {data.pendingCount > 0 && (
            <span className="rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 font-mono-nums">{data.pendingCount} بانتظار الاعتماد</span>
          )}
        </div>
        {data.proposals.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">لا مقترحات بعد — أنشئ أول فعل مالي من الملف المالي.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.proposals.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{p.summary}</p>
                  {p.rejectReason && <p className="text-[11px] text-danger">سبب الرفض: {p.rejectReason}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${(STATUS_UI[p.status] ?? STATUS_UI.pending).cls}`}>
                  {(STATUS_UI[p.status] ?? STATUS_UI.pending).label}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/finance" className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand">
          الملف المالي الكامل <ChevronLeft className="size-4" />
        </Link>
      </section>

      <section className={`flex items-center gap-3 rounded-2xl px-5 py-4 ring-1 ${data.ledgerBalanced ? "bg-success-bg text-success ring-success/20" : "bg-danger-bg text-danger ring-danger/20"}`}>
        {data.ledgerBalanced ? <CheckCircle2 className="size-5" /> : <CircleAlert className="size-5" />}
        <p className="text-sm font-semibold">
          {data.ledgerBalanced ? "الدفتر متوازن — لا فروقات في القيود" : "الدفتر غير متوازن — راجع القيود فوراً"}
        </p>
      </section>
    </main>
    </MishkatShell>
  );
}
