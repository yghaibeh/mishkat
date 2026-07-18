import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Gavel, AlertTriangle, CalendarClock, CheckCircle2, Info, Send, Loader2, BellRing, BellOff, MapPin, ClipboardCheck, UserPlus, BookOpen, ListTodo, MessageSquare, FileQuestion, GraduationCap, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtHijriShort } from "@/lib/format";
import { getMyNotifications, markNotificationsRead, linkTelegram, getTelegramStatus } from "@/lib/api/notifications";
import { pushSupported, pushSubscribed, subscribePush, unsubscribePush } from "@/lib/push";

type Item = { id: string; kind: string; text: string; to?: string | null; createdAt: number; read: boolean };

const ICON: Record<string, LucideIcon> = {
  layer_approval_needed: Gavel,
  week_approved: CheckCircle2,
  week_rejected: AlertTriangle,
  entry_reminder: CalendarClock,
  supervision_visit_submitted: ClipboardCheck,
  supervision_due: MapPin,
  registration_pending: UserPlus,
  material_reminder: BookOpen,
  activity_new: ListTodo,
  activity_response: MessageSquare,
  exam_published: FileQuestion,
  exam_submitted: GraduationCap,
  announcement: Megaphone,
  lesson_reminder: CalendarClock,
  activity_due: AlertTriangle,
  exam_due: AlertTriangle,
  tahfeez_register_due: BookOpen,
};

// جرس الإشعارات داخل الموقع — يقرأ إشعارات المستخدم ويعرضها مع عدّاد غير المقروء.
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [tgLinked, setTgLinked] = useState<boolean | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const r = (await getMyNotifications()) as { unread: number; items: Item[] };
      setItems(r.items); setUnread(r.unread);
    } catch { /* تجاهل: قد لا يكون المستخدم جاهزاً */ }
  };

  const linkTg = async () => {
    setTgBusy(true);
    try {
      const r = (await linkTelegram()) as { url: string | null; botConfigured: boolean };
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast.message("بوت تيليغرام غير مُهيَّأ", { description: "يلزم ضبط إعداد البوت من الإدارة." });
    } catch { toast.error("تعذّر توليد رابط الربط"); } finally { setTgBusy(false); }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) { await unsubscribePush(); setPushOn(false); toast.message("أُوقفت إشعارات المتصفّح على هذا الجهاز"); }
      else {
        const r = await subscribePush();
        if (r.ok) { setPushOn(true); toast.success("فُعّلت إشعارات المتصفّح على هذا الجهاز"); }
        else toast.message("تعذّر التفعيل", { description: r.reason });
      }
    } finally { setPushBusy(false); }
  };

  useEffect(() => {
    void load();
    void getTelegramStatus().then((r) => setTgLinked((r as { linked: boolean }).linked)).catch(() => {});
    if (pushSupported()) void pushSubscribed().then(setPushOn).catch(() => setPushOn(false));
    else setPushOn(null);
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // إغلاق عند النقر خارج اللوحة
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // فتحُ اللوحة لا يمسح العدّاد — القراءة فعلٌ صريح: نقرُ الإشعار يقرؤه، وزرٌّ يقرأ الكلّ
  const toggle = () => setOpen((v) => !v);

  const markOne = async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try { await markNotificationsRead({ data: { ids: [id] } }); } catch { /* */ }
  };
  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try { await markNotificationsRead({ data: {} }); } catch { /* */ }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label="الإشعارات"
        className="relative grid size-9 place-items-center rounded-lg text-ink-soft ring-1 ring-line transition hover:bg-surface-2 hover:text-ink">
        <Bell className="size-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-line">
          <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">الإشعارات{unread > 0 && <span className="ms-1.5 rounded-full bg-danger px-1.5 py-0.5 font-mono-nums text-[10px] font-bold text-white">{unread}</span>}</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-emerald-800 hover:underline">تعيين الكلّ مقروءًا</button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-6 py-10 text-center text-sm text-ink-soft">
              <Bell className="size-6 text-ink-faint" strokeWidth={1.25} />
              لا إشعارات بعد.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.kind] ?? Info;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        if (!n.read) void markOne(n.id);
                        // النقر يُفضي لمكان الإنجاز (ف١٠) — «كلّ عملٍ له امتداد»
                        if (n.to) {
                          const [path, query] = n.to.split("?");
                          setOpen(false);
                          void navigate({ to: path as never, search: (query ? Object.fromEntries(new URLSearchParams(query)) : undefined) as never });
                        }
                      }}
                      title={n.to ? "انقر للانتقال إلى مكان الإنجاز" : n.read ? undefined : "انقر لتمييزه مقروءًا"}
                      className={cn("flex w-full items-start gap-3 px-4 py-3 text-start transition", !n.read && "bg-emerald-50/40 hover:bg-emerald-50/70")}>
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-emerald-800 ring-1 ring-line">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-relaxed text-ink">{n.text}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">{fmtHijriShort(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* قنوات الإيصال خارج الموقع — تيليغرام + إشعارات المتصفّح (مكمّلتان) */}
          <div className="space-y-2 border-t border-line bg-surface-2/40 px-4 py-2.5">
            {tgLinked ? (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-800">
                <Send className="size-3.5" strokeWidth={1.75} /> تيليغرام مربوط — تصلك الإشعارات هناك
              </span>
            ) : (
              <button onClick={linkTg} disabled={tgBusy}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 transition hover:text-emerald-900 disabled:opacity-60">
                {tgBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" strokeWidth={1.75} />}
                ربط تيليغرام لاستقبال الإشعارات
              </button>
            )}
            {pushOn !== null && (
              <button onClick={togglePush} disabled={pushBusy}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 transition hover:text-emerald-900 disabled:opacity-60">
                {pushBusy ? <Loader2 className="size-3.5 animate-spin" /> : pushOn ? <BellOff className="size-3.5" strokeWidth={1.75} /> : <BellRing className="size-3.5" strokeWidth={1.75} />}
                {pushOn ? "إيقاف إشعارات المتصفّح على هذا الجهاز" : "تفعيل إشعارات المتصفّح على هذا الجهاز"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
