// مهامّ مجدولة (F2) — تُستدعى من scheduled() في src/server.ts عبر Cloudflare Cron.
// إدراجٌ مُتكرّر بلا تكرار (idempotent): مفتاح = personId|kind|weekStart|mosqueId.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { useDb } from "./utils/db";
import { orgUnits, weeklyRecords, roleAssignments, notifications, materials, materialProgress, mosqueLessons, activities, activityResponses, exams, examSubmissions, circles, circleStudents, tahfeezCircles, tahfeezStudents, tahfeezSessions } from "./database/schema";
import { hijriDateStr } from "./utils/week";
import { ROLES } from "./utils/rbac";
import { weekStartSaturday } from "./utils/week";
import { getCloudflareEnv } from "./utils/db";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";

// تشغيل يدوي (للإدارة العليا) — نفس منطق الكرون، للاختبار و«تشغيل الآن»
export async function runScheduledTasksManual() {
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) throw new Error("للإدارة العليا فقط");
  return runDueTasksData();
}

const DAY = 86_400_000;

export async function runDueTasksData() {
  const db = useDb();
  const now = Date.now();
  const weekStart = weekStartSaturday(new Date());

  // مفاتيح الإشعارات القائمة لتفادي التكرار (نقرأ أنواع المهامّ فقط)
  const existing = await db.select({ personId: notifications.personId, kind: notifications.kind, payload: notifications.payload })
    .from(notifications).where(inArray(notifications.kind, ["entry_reminder", "layer_approval_needed", "supervision_due", "material_reminder"])).all();
  const seen = new Set<string>();
  for (const n of existing) {
    let p: { weekStart?: string; mosqueId?: string; circleRefId?: string; materialId?: string } = {};
    try { p = n.payload ? JSON.parse(n.payload) : {}; } catch { /* */ }
    seen.add(`${n.personId}|${n.kind}|${p.weekStart ?? ""}|${p.mosqueId ?? p.circleRefId ?? p.materialId ?? ""}`);
  }
  const enqueue = (personId: string, kind: string, payload: { weekStart: string; mosqueId: string; mosqueName: string }) => {
    const key = `${personId}|${kind}|${payload.weekStart}|${payload.mosqueId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return db.insert(notifications).values({
      id: crypto.randomUUID(), personId, channel: "inapp", kind,
      payload: JSON.stringify(payload), status: "queued", createdAt: now, sentAt: null,
    }).run().then(() => true);
  };

  // العدّاداتُ مهوّتةٌ فوق العزل ليصل الإيصالُ (خطوة ٦) دومًا وإن تعثّرت خطوةُ توليد (تدقيق الرصد)
  let reminders = 0, escalations = 0, supervisionDue = 0, materialReminders = 0, relativeReminders = 0;
  try {

  // 1) تذكير الإدخال — مساجد لم تُدخل/تأخّرت (≥ يومين) لأسبوع الحالي (ق-11)
  const mosques = (await db.select().from(orgUnits).where(eq(orgUnits.type, "mosque")).all())
    .filter((m) => m.status !== "archived"); // ف٦: لا تذكير لمسجدٍ مؤرشف
  const recs = await db.select().from(weeklyRecords).where(eq(weeklyRecords.weekStart, weekStart)).all();
  const byMosque = new Map(recs.map((r) => [r.mosqueId, r]));
  // (مهوّت)
  for (const m of mosques) {
    const r = byMosque.get(m.id);
    const late = !r || !r.lastEntryAt || (now - r.lastEntryAt) > 2 * DAY;
    if (!late) continue;
    const amir = (await db.select().from(roleAssignments).where(and(
      eq(roleAssignments.role, ROLES.AMIR), eq(roleAssignments.orgUnitId, m.id), eq(roleAssignments.approvalStatus, "approved"),
      isNull(roleAssignments.endDate), // ف٥: لا تذكير لأميرٍ سابقٍ انتهى تكليفه
    )).all())[0];
    if (!amir) continue;
    if (await enqueue(amir.personId, "entry_reminder", { weekStart, mosqueId: m.id, mosqueName: m.name })) reminders++;
  }

  // 2) تصعيد الاعتماد — سجلّات «اعتمدها الأمير» وتأخّر اعتماد الطبقة > ٧ أيام (§14)
  const pending = await db.select().from(weeklyRecords).where(eq(weeklyRecords.status, "amir_approved")).all();
  const overdue = pending.filter((r) => r.amirApprovedAt && (now - r.amirApprovedAt) > 7 * DAY);
  // (مهوّت)
  for (const r of overdue) {
    const m = mosques.find((x) => x.id === r.mosqueId);
    if (!m) continue;
    // أعلى طبقة مفعّلة تغطّي المسجد (المربع ثم المنطقة)
    const covering = (await db.select().from(roleAssignments)
      .where(and(isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()) // ف٥
      .filter((a) => (a.role === "square" || a.role === "rabita") && m.path.startsWith(a.orgPath) && a.orgPath !== m.path);
    const squares = covering.filter((a) => a.role === "square");
    const targets = squares.length ? squares : covering.filter((a) => a.role === "rabita");
    for (const t of targets) {
      if (await enqueue(t.personId, "layer_approval_needed", { weekStart: r.weekStart, mosqueId: m.id, mosqueName: m.name })) escalations++;
    }
  }

  // 3) تذكير الإشراف الميدانيّ — حلقاتٌ لم تُزَر أو تجاوزت دورة الزيارة؛ نُنبّه المشرف المغطّي (§أ/ح٢)
  const { overdueCirclesForReminders } = await import("./supervision.server");
  const overdueCircles = await overdueCirclesForReminders(now);
  // (مهوّت)
  if (overdueCircles.length) {
    // طبقات الإشراف المفعّلة (مربع/منطقة/مسؤول قسم) لإسناد كلّ حلقةٍ لأقرب مشرفٍ يغطّيها
    const supRoles = ["square", "rabita", "section_head"];
    const supAssign = (await db.select().from(roleAssignments).where(and(
      inArray(roleAssignments.role, supRoles), eq(roleAssignments.approvalStatus, "approved"), isNull(roleAssignments.endDate),
    )).all());
    const enqueueSup = (personId: string, payload: { weekStart: string; circleRefId: string; circleKind: string; circleName: string; mosqueName: string; status: string; daysSince: number | null }) => {
      const key = `${personId}|supervision_due|${payload.weekStart}|${payload.circleRefId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return db.insert(notifications).values({
        id: crypto.randomUUID(), personId, channel: "inapp", kind: "supervision_due",
        payload: JSON.stringify(payload), status: "queued", createdAt: now, sentAt: null,
      }).run().then(() => true);
    };
    for (const c of overdueCircles) {
      if (!c.unitPath) continue;
      const covering = supAssign.filter((a) => c.unitPath!.startsWith(a.orgPath));
      if (!covering.length) continue;
      // أقرب طبقة: المربع ثمّ المنطقة ثمّ القسم (الأطول مسارًا أولًا)
      const deepest = covering.reduce((m, a) => (a.orgPath.length > m.orgPath.length ? a : m), covering[0]);
      const targets = covering.filter((a) => a.orgPath.length === deepest.orgPath.length);
      for (const t of targets) {
        if (await enqueueSup(t.personId, { weekStart, circleRefId: c.id, circleKind: c.kind, circleName: c.name, mosqueName: c.mosqueName, status: c.status, daysSince: c.daysSince })) supervisionDue++;
      }
    }
  }

  // 4) تذكير المكتبة التدريبيّة — مادّةٌ إلزاميّةٌ اسْتُلمت منذ ≥ ١٤ يومًا ولم تُنجَز ⇒ تذكيرٌ أسبوعيّ (§ت)
  const mandatoryMats = await db.select().from(materials)
    .where(and(eq(materials.status, "active"), eq(materials.mandatory, true))).all();
  // (مهوّت)
  if (mandatoryMats.length) {
    const matById = new Map(mandatoryMats.map((m) => [m.id, m]));
    const prog = await db.select().from(materialProgress)
      .where(inArray(materialProgress.materialId, mandatoryMats.map((m) => m.id))).all();
    for (const p of prog) {
      if (p.completedAt || !p.deliveredAt || (now - p.deliveredAt) < 14 * DAY) continue;
      const m = matById.get(p.materialId);
      if (!m) continue;
      const key = `${p.personId}|material_reminder|${weekStart}|${p.materialId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await db.insert(notifications).values({
        id: crypto.randomUUID(), personId: p.personId, channel: "inapp", kind: "material_reminder",
        payload: JSON.stringify({ weekStart, materialId: p.materialId, title: m.title, daysSince: Math.floor((now - p.deliveredAt) / DAY) }),
        status: "queued", createdAt: now, sentAt: null,
      }).run();
      materialReminders++;
    }
  }

  // 5) تذكيراتٌ نسبيّة (§ذ): درسٌ يبدأ خلال ≤ ٣ ساعات · نشاطٌ/اختبارٌ يستحقّ خلال ≤ ٢٤ ساعةً ولم يُجَب
  const HOUR = 3_600_000;
  // (مهوّت)
  const enqueueOnce = async (personId: string, kind: string, refId: string, payload: Record<string, unknown>) => {
    const key = `${personId}|${kind}|${refId}`;
    if (seen.has(key)) return;
    seen.add(key);
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId, channel: "inapp", kind,
      payload: JSON.stringify({ ...payload, refId }), status: "queued", createdAt: now, sentAt: null,
    }).run();
    relativeReminders++;
  };
  // مفاتيح النسبيّة القائمة (refId بدل weekStart — تذكيرٌ واحدٌ لكلّ حدث)
  const relExisting = await db.select({ personId: notifications.personId, kind: notifications.kind, payload: notifications.payload })
    .from(notifications).where(inArray(notifications.kind, ["lesson_reminder", "activity_due", "exam_due", "tahfeez_register_due"])).all();
  for (const n of relExisting) {
    let p: { refId?: string } = {};
    try { p = n.payload ? JSON.parse(n.payload) : {}; } catch { /* */ }
    seen.add(`${n.personId}|${n.kind}|${p.refId ?? ""}`);
  }
  // طلاب كلّ حلقةٍ الموصولون بهويّة — خريطةٌ واحدةٌ تخدم الثلاثة
  const activeCircles = await db.select({ id: circles.id, mosqueId: circles.mosqueId }).from(circles).where(eq(circles.status, "active")).all();
  const allMembers = await db.select({ circleId: circleStudents.circleId, personId: circleStudents.personId })
    .from(circleStudents).where(eq(circleStudents.status, "active")).all();
  const activeCircleIds = new Set(activeCircles.map((c) => c.id)); // ف٧: عضويّة حلقةٍ مؤرشفةٍ لا تجلب تذكيرات
  const byCircle = new Map<string, string[]>();
  for (const m of allMembers) if (m.personId && activeCircleIds.has(m.circleId)) { if (!byCircle.has(m.circleId)) byCircle.set(m.circleId, []); byCircle.get(m.circleId)!.push(m.personId); }
  const studentsByMosque = new Map<string, string[]>();
  for (const c of activeCircles) if (byCircle.has(c.id)) studentsByMosque.set(c.mosqueId, [...new Set([...(studentsByMosque.get(c.mosqueId) ?? []), ...byCircle.get(c.id)!])]);
  const scopePersons = (kind: string, id: string) => kind === "circle" ? (byCircle.get(id) ?? []) : (studentsByMosque.get(id) ?? []);

  // ٥-أ) درسٌ قريب: يبدأ خلال ٣ ساعات ⇒ تذكيرُ طلاب مسجد الدرس
  const soonLessons = (await db.select().from(mosqueLessons).all())
    .filter((l) => (l.status === "scheduled" || l.status === "confirmed") && l.startsAt > now && l.startsAt <= now + 3 * HOUR);
  const amirByMosque = new Map<string, string[]>();
  for (const a of (await db.select().from(roleAssignments).where(and(eq(roleAssignments.role, "amir"), eq(roleAssignments.approvalStatus, "approved"))).all())) {
    if (a.endDate) continue;
    if (!amirByMosque.has(a.orgUnitId)) amirByMosque.set(a.orgUnitId, []);
    amirByMosque.get(a.orgUnitId)!.push(a.personId);
  }
  for (const l of soonLessons) {
    // الطلاب المعروفو الهوية + أمير المسجد (المُلقي/المسؤول) — غ٦
    const targets = new Set([...(studentsByMosque.get(l.mosqueId) ?? []), ...(amirByMosque.get(l.mosqueId) ?? [])]);
    for (const pid of targets) {
      await enqueueOnce(pid, "lesson_reminder", l.id, { title: l.title, startsAt: l.startsAt, place: l.place });
    }
  }
  // ٥-ب) نشاطٌ يستحقّ خلال ٢٤ ساعة ولم يُجَب
  const dueActs = (await db.select().from(activities).all())
    .filter((a) => a.status === "active" && a.dueAt && a.dueAt > now && a.dueAt <= now + 24 * HOUR);
  for (const a of dueActs) {
    const responded = new Set((await db.select({ personId: activityResponses.personId }).from(activityResponses)
      .where(eq(activityResponses.activityId, a.id)).all()).map((r) => r.personId));
    for (const pid of scopePersons(a.scopeKind, a.scopeId)) {
      if (!responded.has(pid)) await enqueueOnce(pid, "activity_due", a.id, { title: a.title, dueAt: a.dueAt });
    }
  }
  // ٥-ج) اختبارٌ يُغلق خلال ٢٤ ساعة ولم يُسلَّم
  const dueExams = (await db.select().from(exams).all())
    .filter((e) => e.status === "published" && e.dueAt && e.dueAt > now && e.dueAt <= now + 24 * HOUR);
  for (const e of dueExams) {
    const submitted = new Set((await db.select({ personId: examSubmissions.personId }).from(examSubmissions)
      .where(eq(examSubmissions.examId, e.id)).all()).map((s) => s.personId));
    for (const pid of scopePersons(e.scopeKind, e.scopeId)) {
      if (!submitted.has(pid)) await enqueueOnce(pid, "exam_due", e.id, { title: e.title, kind: e.kind, dueAt: e.dueAt });
    }
  }

  // ٥-د) سجلُّ اليوم لم يُملأ (غ٦): حلقةُ تحفيظٍ لها طلابٌ ومعلّمٌ ولم تُنشأ جلسةُ اليوم ⇒ تذكيرٌ واحدٌ يوميًّا للمعلّم
  {
    const today = hijriDateStr(new Date(now));
    const allTC = await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.status, "active")).all();
    const withTeacher = allTC.filter((c) => c.teacherPersonId);
    if (withTeacher.length) {
      const counts = await db.select({ c: tahfeezStudents.circleId }).from(tahfeezStudents).where(eq(tahfeezStudents.status, "active")).all();
      const hasStudents = new Set(counts.map((x) => x.c));
      const todays = new Set((await db.select({ c: tahfeezSessions.circleId }).from(tahfeezSessions).where(eq(tahfeezSessions.dateHijri, today)).all()).map((x) => x.c));
      for (const c of withTeacher) {
        if (!hasStudents.has(c.id) || todays.has(c.id)) continue;
        await enqueueOnce(c.teacherPersonId!, "tahfeez_register_due", `${c.id}|${today}`, { circleName: c.name, dateHijri: today });
      }
    }
  }

  } catch (e) {
    console.error("[cron] فشلت خطوةُ توليد تذكيرٍ — يُكمَل الإيصال:", (e as Error)?.message ?? e);
  }

  // 6) إيصال الإشعارات عبر القناتين المكمّلتين: تيليغرام + Web Push (كلٌّ اختياريّ حسب توفّر أسراره)
  let telegram: { processed: number; sent: number; push?: number } | null = null;
  const env = getCloudflareEnv() as { TELEGRAM_BOT_TOKEN?: string; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string } | undefined;
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  const vapid = env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY
    ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || "mailto:admin@mishkat" }
    : undefined;
  if (botToken || vapid) {
    const { dispatchQueued } = await import("./services/notifications");
    telegram = await dispatchQueued(db, { botToken, vapid });
  }

  return { weekStart, reminders, escalations, supervisionDue, materialReminders, relativeReminders, telegram };
}
