import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldQuestion, LogOut, Loader2 } from "lucide-react";
import { logout } from "@/lib/api/auth";

// صفحةٌ طرفيّةٌ محايدة: مُصادَقٌ لكن بلا صلاحيات بعد (حسابٌ حديثٌ أو بلا دورٍ مُسنَد).
// ليست إيقافًا — رسالةٌ هادئة + مخرجٌ واضح (خروج). تكسر أيّ احتمال علوق.
export function NoAccessPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const onLogout = async () => {
    setBusy(true);
    try { await logout(); } finally { await navigate({ to: "/login" }); }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-soft ring-1 ring-line">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-emerald-800 ring-1 ring-line">
          <ShieldQuestion className="size-7" strokeWidth={1.5} />
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-ink">لا صلاحيات لحسابك بعد</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          حسابك فعّالٌ لكن لم يُسنَد إليه دورٌ بعد — تواصل مع الإدارة لتفعيل صلاحياتك.
        </p>
        <button onClick={onLogout} disabled={busy}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" strokeWidth={1.75} />}
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
