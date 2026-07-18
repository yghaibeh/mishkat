// إشعارات داخل الموقع (خادم فقط) — تقرأ إشعارات المستخدم الحالي من جدول الإشعارات
// المملوء عند الأحداث (اعتماد الأمير ← الطبقة، الرفض ← الأمير، التذكيرات…). بلا حاجة لمجدول.
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { useDb, getCloudflareEnv } from "./utils/db";
import { notifications, personContacts, pushSubscriptions } from "./database/schema";
import { currentUser } from "./auth.server";

// FR2.4 — Web Push: مفتاح VAPID العموميّ للاشتراك من العميل + حفظ/حذف الاشتراك
export async function pushPublicKeyData() {
  const key = (getCloudflareEnv() as { VAPID_PUBLIC_KEY?: string } | undefined)?.VAPID_PUBLIC_KEY ?? null;
  return { key, configured: !!key };
}

export async function savePushSubscriptionData(input: { endpoint: string; p256dh: string; auth: string }) {
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const db = useDb();
  // فريدٌ بالـendpoint: إن وُجد نُحدّث مالكه ومفاتيحه (قد يتغيّر الجهاز/المستخدم)
  const existing = (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint)).all())[0];
  if (existing) {
    await db.update(pushSubscriptions).set({ personId: u.personId, p256dh: input.p256dh, auth: input.auth }).where(eq(pushSubscriptions.endpoint, input.endpoint)).run();
  } else {
    await db.insert(pushSubscriptions).values({ id: crypto.randomUUID(), personId: u.personId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, createdAt: Date.now() }).run();
  }
  return { ok: true as const };
}

export async function deletePushSubscriptionData(input: { endpoint: string }) {
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const db = useDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, input.endpoint), eq(pushSubscriptions.personId, u.personId))).run();
  return { ok: true as const };
}

// ربط تيليغرام: يولّد رمزًا مؤقّتًا ويعيد رابط deep-link؛ الويبهوك يلتقط chat_id عند /start.
export async function linkTelegramData() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const token = crypto.randomUUID();
  const expires = Date.now() + 15 * 60_000; // ١٥ دقيقة
  const existing = (await db.select().from(personContacts).where(eq(personContacts.personId, u.personId)).all())[0];
  if (existing) await db.update(personContacts).set({ linkToken: token, linkExpires: expires }).where(eq(personContacts.personId, u.personId)).run();
  else await db.insert(personContacts).values({ personId: u.personId, linkToken: token, linkExpires: expires }).run();
  const bot = (getCloudflareEnv() as { TELEGRAM_BOT_USERNAME?: string } | undefined)?.TELEGRAM_BOT_USERNAME ?? "";
  return { url: bot ? `https://t.me/${bot}?start=${token}` : null, botConfigured: !!bot };
}

export async function telegramStatusData() {
  const u = await currentUser();
  if (!u) return { linked: false };
  const db = useDb();
  const pc = (await db.select({ tg: personContacts.telegram }).from(personContacts).where(eq(personContacts.personId, u.personId)).all())[0];
  return { linked: !!pc?.tg };
}

// نصٌّ عربيٌّ مقروء لكل نوع إشعار من حمولته
function notifText(kind: string, payload: Record<string, unknown>): string {
  const mosque = (payload.mosqueName as string) ?? "";
  const week = (payload.weekStart as string) ?? "";
  switch (kind) {
    case "layer_approval_needed":
      return `يحتاج مسجد «${mosque}» اعتمادكم لأسبوعٍ اعتمده الأمير.`;
    case "week_approved":
      return `اعتُمد أسبوع مسجدك${mosque ? ` «${mosque}»` : ""} نهائياً. أحسنتم.`;
    case "week_rejected":
      return `رُفض أسبوع مسجدك${mosque ? ` «${mosque}»` : ""} — السبب: ${(payload.reason as string) ?? ""}. راجِع وأعد الاعتماد.`;
    case "entry_reminder":
      return `تذكير: لم يُدخَل سجل «${mosque}» لهذا الأسبوع.`;
    case "supervision_visit_submitted":
      return `زيارةٌ إشرافيّة على «${(payload.circleName as string) ?? ""}» بانتظار اعتمادك.`;
    case "tahfeez_register_due":
      return `لم يُسجَّل سجلُّ اليوم لحلقة «${(payload.circleName as string) ?? ""}» — افتح «حلقاتي» وسجّل التفقّد والتسميع.`;
    case "announcement":
      return `📢 ${(payload.title as string) ?? ""}: ${(payload.body as string) ?? ""}${payload.by ? ` — ${payload.by as string}` : ""}`;
    case "lesson_reminder": {
      const t = new Date((payload.startsAt as number) ?? 0).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
      return `تذكير بدرس اليوم: «${(payload.title as string) ?? ""}» الساعة ${t}${payload.place ? ` في ${payload.place as string}` : ""}.`;
    }
    case "activity_due":
      return `يستحقّ غدًا: نشاط «${(payload.title as string) ?? ""}» ولم تُرسل ردّك بعد — بادر.`;
    case "exam_due":
      return `ينتهي وقت تسليم «${(payload.title as string) ?? ""}» خلال يومٍ — سلِّم قبل الإغلاق.`;
    case "exam_published": {
      const k = payload.kind === "homework" ? "واجبٌ" : "اختبارٌ";
      return `${k} جديدٌ: «${(payload.title as string) ?? ""}» — افتح «المطلوب اليوم» وسلِّم قبل انتهاء الوقت.`;
    }
    case "exam_submitted":
      return `سلّم ${(payload.student as string) ?? "طالب"} «${(payload.title as string) ?? ""}» — الدرجة ${payload.score}/${payload.maxScore}.`;
    case "activity_new":
      return `نشاطٌ جديدٌ مطلوبٌ منك: «${(payload.title as string) ?? ""}» — افتح «المطلوب اليوم» وأرسل ردّك.`;
    case "activity_response":
      return `ردٌّ جديدٌ من ${(payload.student as string) ?? "طالب"} على نشاط «${(payload.title as string) ?? ""}».`;
    case "material_reminder": {
      const t = (payload.title as string) ?? "";
      const d = payload.daysSince as number | undefined;
      return `تذكير المكتبة: مادّة «${t}» إلزاميّةٌ لم تُنجَز بعد${d ? ` (منذ ${d} يومًا)` : ""} — أتمّها وأقرّ بذلك.`;
    }
    case "registration_pending": {
      const who = (payload.fullName as string) ?? "";
      const role = (payload.roleLabel as string) ?? "";
      const unit = payload.unitName ? ` لمسجدٍ جديد «${payload.unitName as string}»` : "";
      return `طلب انضمامٍ جديد: ${who} — ${role}${unit}. بانتظار بتّك.`;
    }
    case "supervision_due": {
      const c = (payload.circleName as string) ?? "";
      const days = payload.daysSince as number | null | undefined;
      return payload.status === "never"
        ? `حلقةٌ لم تُزَر بعد: «${c}» — يلزمها زيارةٌ إشرافيّة.`
        : `زيارةٌ إشرافيّة متأخّرة لحلقة «${c}»${days != null ? ` (آخر زيارة قبل ${days} يومًا)` : ""}.`;
    }
    case "finance_proposal": {
      const amt = payload.amountUsd ? ` (بقيمة $${payload.amountUsd})` : "";
      return `اقتراحٌ ماليٌّ ينتظر اعتمادك: «${(payload.summary as string) ?? ""}»${amt} — افتح الملفَّ الماليَّ للبتّ.`;
    }
    case "finance_decision": {
      const s = (payload.summary as string) ?? "";
      if (payload.outcome === "approved") return `اعتُمد ونُفِّذ اقتراحك الماليّ: «${s}».`;
      if (payload.outcome === "failed") return `تعذّر تنفيذُ اقتراحك بعد اعتماده: «${s}» — ${(payload.error as string) ?? ""}.`;
      return `رُفض اقتراحك الماليّ: «${s}» — السبب: ${(payload.reason as string) ?? ""}. عدِّل وأعد التقديم.`;
    }
    default:
      return `لديك إشعارٌ جديد.${week ? ` (${week})` : ""}`;
  }
}

export async function myNotificationsData(limit = 30) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const rows = await db.select().from(notifications)
    .where(eq(notifications.personId, u.personId))
    .orderBy(desc(notifications.createdAt)).limit(limit).all();
  const unread = await db.select({ c: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.personId, u.personId), isNull(notifications.readAt))).all();
  // وجهة كلّ نوعٍ داخل الموقع (ف١٠): النقر يقرأ ويُفضي لمكان الإنجاز — «كلّ عملٍ له امتداد»
  const toOf = (kind: string, p: Record<string, unknown>): string | null => {
    if (kind === "layer_approval_needed" || kind === "week_approved" || kind === "week_rejected" || kind === "entry_reminder")
      return p.mosqueId ? `/mosque/${p.mosqueId as string}?t=report` : null;
    if (kind === "supervision_due" || kind === "supervision_visit_submitted") return "/ala-baseera?tab=supervision";
    if (kind === "registration_pending") return "/duties";
    if (kind === "material_reminder") return "/library";
    if (kind === "tahfeez_register_due") return "/my-circles";
    if (kind === "lesson_reminder") return p.mosqueId ? `/mosque/${p.mosqueId as string}?t=lessons` : null;
    if (["activity_new", "activity_due", "activity_response", "exam_published", "exam_due", "exam_submitted"].includes(kind)) return "/duties";
    if (kind === "finance_proposal" || kind === "finance_decision") return "/finance"; // الملفُّ الماليّ (صندوقُ الاعتماد / مقترحاتي)
    return null;
  };
  return {
    unread: unread[0]?.c ?? 0,
    items: rows.map((n) => {
      const p = n.payload ? (JSON.parse(n.payload) as Record<string, unknown>) : {};
      return {
        id: n.id,
        kind: n.kind,
        text: notifText(n.kind, p),
        to: toOf(n.kind, p),
        createdAt: n.createdAt,
        read: n.readAt != null,
      };
    }),
  };
}

// وسم إشعاراتٍ مقروءة (الكلّ إن لم تُحدَّد معرّفات) — للمستخدم الحالي فقط
export async function markNotificationsReadData(ids?: string[]) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const now = Date.now();
  const scope = ids && ids.length
    ? and(eq(notifications.personId, u.personId), inArray(notifications.id, ids))
    : and(eq(notifications.personId, u.personId), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: now }).where(scope).run();
  return { ok: true as const };
}
