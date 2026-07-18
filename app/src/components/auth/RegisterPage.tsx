import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, Loader2, Info, ChevronRight, ChevronLeft, CheckCircle2, Copy, GraduationCap, BookOpen, Landmark, Grid2x2, Map as MapIcon, Clock3, XCircle } from "lucide-react";
import { toast, Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { getPublicOrgTree, submitRegistration, getRegistrationStatus } from "@/lib/api/registration";

type Unit = { id: string; parentId: string | null; type: string; name: string; section: string };
type Circle = { id: string; mosqueId: string; name: string };

const KINDS = [
  { k: "student", label: "طالب", desc: "في حلقةٍ أو مسجد", Icon: GraduationCap },
  { k: "teacher", label: "معلّم حلقة", desc: "محفّظ / مدرّس", Icon: BookOpen },
  { k: "amir", label: "مسؤول مسجد", desc: "أمير مسجد / مشرفة حلقة", Icon: Landmark },
  { k: "square", label: "مسؤول مربع", desc: "إشراف مربعٍ كامل", Icon: Grid2x2 },
  { k: "rabita", label: "مسؤول منطقة", desc: "إشراف منطقةٍ كاملة", Icon: MapIcon },
] as const;

// حالة الطلب (بالاستعلام برمز المتابعة)
function StatusCard({ token }: { token: string }) {
  const [st, setSt] = useState<{ status: string; kindLabel?: string; fullName?: string; rejectReason?: string | null } | { error: string } | null>(null);
  useEffect(() => { getRegistrationStatus({ data: { token } }).then((r) => setSt(r as never)).catch(() => setSt({ error: "تعذّر الاستعلام" })); }, [token]);
  if (!st) return <div className="flex justify-center p-8"><Loader2 className="size-5 animate-spin text-ink-faint" /></div>;
  if ("error" in st) return <p className="rounded-xl bg-danger-bg p-4 text-sm font-semibold text-danger ring-1 ring-danger/20">{st.error}</p>;
  const S = st.status === "approved"
    ? { Icon: CheckCircle2, cls: "text-emerald-800 bg-emerald-50 ring-emerald-100", t: "قُبل طلبك — يمكنك تسجيل الدخول الآن باسمك وكلمة مرورك." }
    : st.status === "rejected"
      ? { Icon: XCircle, cls: "text-danger bg-danger-bg ring-danger/20", t: `رُفض الطلب${st.rejectReason ? ` — السبب: ${st.rejectReason}` : ""}.` }
      : { Icon: Clock3, cls: "text-warn bg-warn-bg ring-warn/20", t: "طلبك قيد المراجعة لدى الجهة المشرفة — عُد لاحقًا بهذا الرابط نفسه." };
  return (
    <div className={cn("space-y-2 rounded-2xl p-5 ring-1", S.cls)}>
      <div className="flex items-center gap-2"><S.Icon className="size-5" strokeWidth={1.75} /><span className="font-display text-sm font-bold">{st.fullName} — {st.kindLabel}</span></div>
      <p className="text-sm leading-6">{S.t}</p>
      {st.status === "approved" && <Link to="/login" className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900">إلى تسجيل الدخول</Link>}
    </div>
  );
}

export function RegisterPage() {
  const statusToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState("");
  const [tree, setTree] = useState<{ units: Unit[]; circles: Circle[] } | null>(null);
  // الموقع
  const [section, setSection] = useState("");
  const [rabitaId, setRabitaId] = useState("");
  const [squareId, setSquareId] = useState("");
  const [mosqueId, setMosqueId] = useState("");
  const [circleId, setCircleId] = useState("");
  const [newMosque, setNewMosque] = useState(false);
  const [newMosqueName, setNewMosqueName] = useState("");
  // البيانات
  const [fullName, setFullName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [doneToken, setDoneToken] = useState("");

  useEffect(() => { if (!statusToken) getPublicOrgTree().then((r) => setTree(r as never)).catch(() => {}); }, [statusToken]);

  const U = tree?.units ?? [];
  const sections = U.filter((u) => u.type === "section");
  const rabitas = U.filter((u) => u.type === "rabita" && (!section || u.section === section));
  const squares = U.filter((u) => u.type === "square" && u.parentId === rabitaId);
  const mosques = U.filter((u) => (u.type === "mosque" || u.type === "halaqa") && (u.parentId === squareId || (!squareId && u.parentId === rabitaId)));
  const mosqueCircles = (tree?.circles ?? []).filter((c) => c.mosqueId === mosqueId);
  const gender = section === "women" ? "female" : "male";

  // الوحدة الهدف حسب الدور
  const targetUnitId = kind === "rabita" ? rabitaId : kind === "square" ? squareId : newMosque ? "" : mosqueId;
  const proposedParentId = newMosque ? (squareId || rabitaId) : "";
  const placeOk = kind === "rabita" ? !!rabitaId
    : kind === "square" ? !!squareId
    : kind === "amir" ? (newMosque ? !!(newMosqueName.trim().length > 2 && proposedParentId) : !!mosqueId)
    : !!mosqueId;
  const dataOk = fullName.trim().length >= 5 && /^[A-Za-z0-9_.-]{3,32}$/.test(loginId.trim()) && password.length >= 8;

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const res = await submitRegistration({ data: {
        kind: kind as never, fullName: fullName.trim(), gender,
        login: loginId.trim().toLowerCase(), password,
        phone: phone.trim() || undefined, note: note.trim() || undefined,
        targetUnitId: targetUnitId || undefined,
        proposedUnitName: newMosque ? newMosqueName.trim() : undefined,
        proposedParentId: proposedParentId || undefined,
        circleId: (kind === "student" || kind === "teacher") && circleId ? circleId : undefined,
        website: website || undefined,
      } });
      if ("error" in res && res.error) setErr(res.error);
      else setDoneToken((res as { token: string }).token);
    } catch { setErr("تعذّر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };

  const statusUrl = useMemo(() => doneToken && typeof window !== "undefined" ? `${window.location.origin}/register?status=${doneToken}` : "", [doneToken]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-emerald-800 text-emerald-100 shadow-soft ring-1 ring-emerald-900/20">
            <span className="font-display text-2xl font-bold">مِ</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">الانضمام إلى مشكاة</h1>
            <p className="mt-1 text-sm text-ink-soft">سجّل طلبك وتعتمده الجهة المشرفة عليك مباشرةً</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-surface p-6 ring-1 ring-line">
          {statusToken ? (
            <StatusCard token={statusToken} />
          ) : doneToken ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="size-5" strokeWidth={1.75} /><h2 className="font-display text-sm font-bold">قُدِّم طلبك بنجاح</h2></div>
              <p className="text-sm leading-6 text-ink-soft">سيراجعه المسؤول المباشر ويعتمده. احتفظ برابط المتابعة هذا — به تعرف قبول طلبك:</p>
              <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                <code className="min-w-0 flex-1 truncate text-[11px] text-ink" dir="ltr">{statusUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(statusUrl); toast.success("نُسخ الرابط"); }} aria-label="نسخ الرابط" className="shrink-0 rounded-lg bg-emerald-800 p-2 text-emerald-50 hover:bg-emerald-900"><Copy className="size-3.5" /></button>
              </div>
              <Link to="/login" className="block text-center text-xs font-semibold text-emerald-800 hover:underline">عودة لتسجيل الدخول</Link>
            </div>
          ) : (
            <>
              {/* مؤشر الخطوات */}
              <div className="flex items-center gap-1.5 border-b border-line pb-3">
                <UserPlus className="size-4 text-emerald-800" strokeWidth={1.75} />
                <h2 className="font-display text-sm font-semibold text-ink">طلب انضمام</h2>
                <span className="ms-auto text-[11px] text-ink-faint">الخطوة {step + 1} من ٣</span>
              </div>

              {step === 0 && (
                <div className="grid gap-2">
                  {KINDS.map(({ k, label, desc, Icon }) => (
                    <button key={k} onClick={() => { setKind(k); setStep(1); }}
                      className={cn("flex items-center gap-3 rounded-xl p-3.5 text-start ring-1 transition",
                        kind === k ? "bg-emerald-800 text-emerald-50 ring-emerald-900/30" : "bg-surface-2/50 text-ink ring-line hover:bg-surface-2")}>
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg ring-1", kind === k ? "bg-emerald-700/60 ring-emerald-600/30" : "bg-surface ring-line text-emerald-800")}>
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{label}</span>
                        <span className={cn("block text-[11px]", kind === k ? "text-emerald-100/80" : "text-ink-faint")}>{desc}</span>
                      </span>
                      <ChevronLeft className="ms-auto size-4 opacity-60" />
                    </button>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <Field label="القسم">
                    <MSelect value={section} onValueChange={(v) => { setSection(v); setRabitaId(""); setSquareId(""); setMosqueId(""); }} placeholder="اختر القسم…"
                      options={sections.map((s) => ({ value: s.section, label: s.name }))} />
                  </Field>
                  {section && (
                    <Field label="المنطقة">
                      <MSelect value={rabitaId} onValueChange={(v) => { setRabitaId(v); setSquareId(""); setMosqueId(""); }} placeholder="اختر المنطقة…"
                        options={rabitas.map((r) => ({ value: r.id, label: r.name }))} />
                    </Field>
                  )}
                  {kind !== "rabita" && rabitaId && (
                    <Field label="المربع">
                      <MSelect value={squareId} onValueChange={(v) => { setSquareId(v); setMosqueId(""); }} placeholder={squares.length ? "اختر المربع…" : "لا مربعات — تابع بالمنطقة"}
                        options={squares.map((s) => ({ value: s.id, label: s.name }))} />
                    </Field>
                  )}
                  {kind !== "rabita" && kind !== "square" && (squareId || rabitaId) && (
                    <>
                      {kind === "amir" && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2/60 p-3 text-xs font-semibold text-ink ring-1 ring-line">
                          <input type="checkbox" checked={newMosque} onChange={(e) => { setNewMosque(e.target.checked); setMosqueId(""); }} className="size-4 accent-emerald-800" />
                          مسجدي غير مدرجٍ في القائمة — أُنشئه عند الاعتماد
                        </label>
                      )}
                      {newMosque ? (
                        <Field label="اسم المسجد الجديد">
                          <TextField value={newMosqueName} onChange={(e) => setNewMosqueName(e.target.value)} placeholder="مسجد الأمة" />
                        </Field>
                      ) : (
                        <Field label={section === "women" ? "الحلقة (الوحدة)" : "المسجد"}>
                          <MSelect value={mosqueId} onValueChange={(v) => { setMosqueId(v); setCircleId(""); }} placeholder="اختر…"
                            options={mosques.map((m) => ({ value: m.id, label: m.name }))} />
                        </Field>
                      )}
                      {(kind === "student" || kind === "teacher") && mosqueId && mosqueCircles.length > 0 && (
                        <Field label="الحلقة (اختياري)">
                          <MSelect value={circleId} onValueChange={setCircleId} placeholder="بلا تحديد"
                            options={mosqueCircles.map((c) => ({ value: c.id, label: c.name }))} />
                        </Field>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <Field label="الاسم الكامل"><TextField value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الثلاثي" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="اسم الدخول"><TextField value={loginId} onChange={(e) => setLoginId(e.target.value)} dir="ltr" className="text-left" placeholder="user.name" autoComplete="username" /></Field>
                    <Field label="كلمة المرور (٨+)"><TextField type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" className="text-left" autoComplete="new-password" /></Field>
                  </div>
                  <Field label="رقم الهاتف (اختياري)"><TextField value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" inputMode="tel" placeholder="09…" /></Field>
                  <Field label="عرّف بنفسك باختصار (اختياري)"><TextField value={note} onChange={(e) => setNote(e.target.value)} placeholder="مَن زكّاك؟ ما خبرتك؟" /></Field>
                  {/* honeypot — مخفيّ عن البشر */}
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" placeholder="website" />
                </div>
              )}

              {err && (
                <div className="flex items-start gap-2 rounded-xl bg-danger-bg p-3 text-[11px] font-semibold text-danger ring-1 ring-danger/20">
                  <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />{err}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                {step > 0 ? (
                  <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line hover:bg-surface-2">
                    <ChevronRight className="size-3.5" /> السابق
                  </button>
                ) : <span />}
                {step === 1 && (
                  <button onClick={() => setStep(2)} disabled={!placeOk}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-50">
                    التالي <ChevronLeft className="size-3.5" />
                  </button>
                )}
                {step === 2 && (
                  <button onClick={submit} disabled={!dataOk || busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-900 disabled:opacity-50">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} قدِّم الطلب
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {!statusToken && !doneToken && (
          <p className="mt-4 text-center text-[11px] text-ink-faint">
            لديك حساب؟ <Link to="/login" className="font-semibold text-emerald-800 hover:underline">سجّل الدخول</Link>
          </p>
        )}
      </div>
    </div>
  );
}
