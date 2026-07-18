import { useEffect, useRef } from "react";
import { Link, useRouterState, useRouteContext, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { orderedNav, allowedNav } from "@/lib/access";
import { mosqueTabs } from "@/lib/mosque-tabs";
import { logout } from "@/lib/api/auth";
import { NotificationBell } from "./NotificationBell";

// الشريط العلوي = كل التنقّل في مكانٍ واحد بالأعلى:
//  - على صفحة المسجد: تبويبات المسجد (نظرة/سجل اليوم/…) مباشرةً هنا.
//  - الشاشات العامة المخوّلة (الشبكة/المالية/…).
export function TopTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as { t?: string };
  const ctx = useRouteContext({ strict: false }) as { user?: { fullName?: string; caps?: string[]; homeMosqueId?: string | null; features?: Record<string, boolean>; brand?: { name?: string; letter?: string } } };
  const user = ctx?.user;
  const brandName = user?.brand?.name || "مِشكاة";
  const brandLetter = user?.brand?.letter || "م";
  const navigate = useNavigate();

  const globalTabs = orderedNav(user?.caps ?? [], (user as { roles?: string[] })?.roles ?? []); // ترتيبٌ بأهمية الدور

  // الخلل المعماري (بلاغ المالك ٢٠٢٦-٠٧-١٨): تبويباتُ المسجد كانت تحلّ محلَّ قشرة التطبيق
  // لكلِّ زائرٍ — فيفقد المديرُ/المشرفُ تنقّلَه العامَّ بمجرد النزول لمسجد. القاعدة:
  // «قشرةُ التطبيق ثابتةٌ للدور» — تبويباتُ المسجد قشرةٌ لطاقمه (عالَمُهم) فقط؛
  // وللزائرِ تُعرض شريطاً ثانوياً داخل الصفحة (MosquePage).
  const onMosque = pathname.startsWith("/mosque/");
  const mosqueId = onMosque ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;
  const mTabs = onMosque ? mosqueTabs(user?.caps ?? [], user?.features ?? {}) : [];
  const isOwnMosque = !!mosqueId && user?.homeMosqueId === mosqueId;
  const defaultMTab = isOwnMosque && mTabs.some((t) => t.k === "daily") ? "daily" : mTabs[0]?.k;
  const activeMTab = mTabs.find((t) => t.k === search?.t)?.k ?? defaultMTab;

  const tabCls = (active: boolean) =>
    cn(
      "relative inline-flex h-14 shrink-0 items-center whitespace-nowrap px-3 text-[13px] font-medium transition-colors sm:text-sm sm:px-4",
      active ? "text-emerald-800" : "text-ink-soft hover:text-ink",
    );
  const underline = <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-800" />;

  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  const onLogout = async () => {
    await logout();
    await navigate({ to: "/login" });
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-emerald-800 text-emerald-100">
            <span className="font-display text-sm font-bold">{brandLetter}</span>
          </div>
          <div className="hidden font-logo text-base font-semibold tracking-tight text-ink sm:block">{brandName}</div>
        </Link>

        <div ref={tabsRef} className="flex h-14 items-center gap-0.5 overflow-x-auto">
          {onMosque && isOwnMosque && mosqueId && mTabs.map((t, i) => {
            const isActive = activeMTab === t.k;
            // فاصلٌ خفيف بين مساحات العمل الأربع (٣٦ §٢) — بدل ١١ تبويباً متراصّاً
            const newGroup = i > 0 && mTabs[i - 1].g !== t.g;
            return (
              <span key={t.k} className="inline-flex items-center">
                {newGroup && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />}
                <Link to="/mosque/$mosqueId" params={{ mosqueId }} search={{ t: t.k }} data-active={isActive} className={tabCls(isActive)}>
                  {t.l}
                  {isActive && underline}
                </Link>
              </span>
            );
          })}
          {!(onMosque && isOwnMosque) && globalTabs.map((t) => {
            const isActive = pathname === t.to;
            return (
              <Link key={t.to} to={t.to} data-active={isActive} className={tabCls(isActive)}>
                {t.label}
                {isActive && underline}
              </Link>
            );
          })}
        </div>

        {user ? (
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            <span className="hidden text-xs text-ink-soft sm:inline">{user.fullName}</span>
            <button
              onClick={onLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-soft ring-1 ring-line transition hover:bg-surface-2 hover:text-ink"
              aria-label="تسجيل الخروج"
            >
              <span className="hidden sm:inline">خروج</span>
              <LogOut className="size-4 -scale-x-100" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <span className="w-8 shrink-0" />
        )}
      </div>
    </nav>
  );
}
