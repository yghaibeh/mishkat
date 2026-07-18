import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, Loader2, Info } from "lucide-react";
import { toast, Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { login } from "@/lib/api/auth";

export function LoginPage() {
  const nav = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [mfa, setMfa] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await login({ data: { login: loginId, password, totp: totp || undefined } });
      if ("error" in res && res.error) {
        if ((res as { mfaRequired?: boolean }).mfaRequired) setMfa(true);
        setErr(res.error);
      } else {
        toast.success("مرحباً بك", { description: (res as { fullName?: string }).fullName });
        await nav({ to: "/" });
      }
    } catch {
      setErr("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-[10vh]">
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-sm">
        {/* العلامة — يطابق نمط ترويسة الصفحات */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <span className="font-display text-2xl font-bold">مِ</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">مشكاة</h1>
            <p className="mt-1 text-sm text-ink-soft">نظام إدارة المسجد المؤثر</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl bg-surface p-6 ring-1 ring-line"
        >
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <LogIn className="size-4 text-emerald-800" strokeWidth={1.75} />
            <h2 className="font-display text-sm font-semibold text-ink">تسجيل الدخول</h2>
          </div>

          <Field label="اسم الدخول">
            <TextField
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              dir="ltr"
              className="text-left"
              placeholder="admin"
            />
          </Field>

          <Field label="كلمة المرور">
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              className="text-left"
              placeholder="••••••••"
            />
          </Field>

          {mfa && (
            <Field label="رمز التحقق الثنائي">
              <TextField
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                inputMode="numeric"
                className="text-center font-mono-nums text-base tracking-[0.4em]"
                placeholder="000000"
              />
            </Field>
          )}

          {err && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-bg p-3 text-[11px] font-semibold text-danger ring-1 ring-danger/20">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !loginId || !password}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.99]",
              "bg-emerald-800 text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 hover:bg-emerald-900",
              "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                جارٍ الدخول…
              </>
            ) : (
              <>
                <LogIn className="size-4 -scale-x-100" strokeWidth={1.75} />
                دخول
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-ink-faint">
          ليس لديك حساب؟{" "}
          <Link to="/register" className="font-semibold text-emerald-800 hover:underline">سجّل طلب انضمام</Link>
          {" "}· يعتمده مسؤولك المباشر
        </p>
      </div>
    </div>
  );
}
