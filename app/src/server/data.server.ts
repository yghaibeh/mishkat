// منطق الخادم فقط (لاحقة .server.ts تمنع تسربه إلى حزمة العميل).
import { and, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { selectByIdChunks } from "./utils/chunks";
import { orgUnits, weeklyRecords, roleAssignments, users, monthlyEntitlements, halaqat, participants, circles, venues, persons, attachments, auditLog, notifications, activityTypes } from "./database/schema";
import { currentScheme } from "./utils/scheme";
import { monthlyMosqueReport } from "./services/reports";
import { syncEntries, approveRecord } from "./services/records";
import { queueLayerApprovalNeeded, queueRejectionNotice, queueFinalApproved } from "./services/notifications";
import { getMosqueOrThrow, getOrCreateWeeklyRecord } from "./utils/records";
import { weekStartSaturday, weekHijriRange } from "./utils/week";
import { currentUser } from "./auth.server";
import { isGlobalAdmin, type AuthUser } from "./utils/context";
import { ROLES } from "./utils/rbac";
import { ORG_TYPE_LABEL } from "@/lib/capabilities";

// القسم الافتراضي للإدارة العليا قبل اختيار قسم (مبدِّل القسم يأتي في م1)
const DEFAULT_SECTION_PREFIX = "/men/";

// نطاق المستخدم: بادئة المسار التي يراها (إدارة عليا = جذر القسم الافتراضي)
function scopePrefix(u: AuthUser | null): string {
  if (!u || isGlobalAdmin(u)) return DEFAULT_SECTION_PREFIX;
  return u.assignments[0]?.orgPath ?? DEFAULT_SECTION_PREFIX;
}

// مسجد المستخدم (أول تكليف كأمير) — فارغٌ لمن لا مسجد له (يُعالَج بأمان في المستدعي)
function userMosque(u: AuthUser | null): string {
  return u?.assignments.find((a) => a.role === ROLES.AMIR)?.orgUnitId ?? "";
}

export async function governorateData() {
  const db = useDb();
  const u = await currentUser();
  const prefix = scopePrefix(u);
  const mosques = await db.select().from(orgUnits).where(and(
    eq(orgUnits.type, "mosque"), like(orgUnits.path, `${prefix}%`), ne(orgUnits.status, "archived"), // ف٦
  )).all();
  const squares = await db.select().from(orgUnits).where(eq(orgUnits.type, "square")).all();
  const areaOf = new Map(squares.map((s) => [s.id, s.name]));

  const ids = mosques.map((m) => m.id);
  const recs = ids.length
    ? await db.select().from(weeklyRecords).where(inArray(weeklyRecords.mosqueId, ids)).all()
    : [];
  const now = Date.now();

  const list = mosques.map((m) => {
    const mine = recs.filter((r) => r.mosqueId === m.id).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    const r = mine[0];
    const points = r?.totalPoints ?? 0;
    const daysSinceUpdate = r?.lastEntryAt ? Math.floor((now - r.lastEntryAt) / 86_400_000) : 99;
    return { name: m.name, area: areaOf.get(m.parentId ?? "") ?? "—", points, daysSinceUpdate };
  });
  return { mosques: list, target: 70 };
}

// قدرات المستخدم على اعتماد سجل المسجد
// ق1 (المُحدَّث): الاعتماد متاحٌ دائمًا لأيّ جهةٍ أعلى تغطّي المسجد — مسؤول المربع أو المنطقة
// أو الإدارة العليا؛ كلٌّ منهم له صلاحية الاعتماد، ويُسجَّل اسم المُعتمِد في السجل.
async function reportRoleCaps(db: ReturnType<typeof useDb>, u: AuthUser | null, mosqueId: string, mosquePath: string) {
  if (!u) return { isAmir: false, isLayer: false, isAdmin: false, via: "none" as const };
  const isAdmin = isGlobalAdmin(u);
  const isAmir = u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === mosqueId);

  // ق1-د (الوثيقة ٢٩): المعتمِدُ = الطبقةُ الأقرب فقط (NESSA)، أو تدخّلٌ فوقيٌّ بقدرة، أو كسرُ زجاجٍ للإدارة.
  // الإدارةُ العليا لا تعتمد روتينيًّا — إلا كسرَ الزجاج عند شغور كلّ الطبقات.
  const { canApproveUnit } = await import("./services/approvalRouting");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, u.assignments.map((a) => a.role));
  const g = await canApproveUnit(db, u, caps, mosquePath);
  return { isAmir, isLayer: g.ok, isAdmin, via: g.via };
}

export async function monthlyReportData() {
  const u = await currentUser();
  return mosqueReportData(userMosque(u));
}

/* ---------- صندوق «بانتظار اعتمادك»: تقاريرُ قُدِّمت وتنتظر اعتماد الطبقة الأعلى ---------- */
// المبدأ: تقرير كلّ وحدةٍ يعتمده المشرف المغطّي مباشرةً فوقها؛ يظهر هنا لكلّ معتمِدٍ في نطاقه
// (المدير يرى كلّ المُقدَّم، والمشرف يرى ما يقع تحت نطاقه). status='amir_approved' = «مُقدَّم للاعتماد».
type PendingItem = { unitId: string; name: string; type: string; typeLabel: string; weeks: number; points: number; lastAt: number | null };
export async function pendingApprovalsData(): Promise<{ items: PendingItem[] }> {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const isAdmin = isGlobalAdmin(u);
  const hasSupervisory = u.assignments.some((a) => a.role === ROLES.SQUARE || a.role === ROLES.RABITA || a.role === ROLES.SECTION_HEAD);
  if (!isAdmin && !hasSupervisory) return { items: [] };

  // ق1-د (الوثيقة ٢٩): الصندوقُ الروتينيّ يعرض فقط ما هذا المستخدمُ هو «الطبقةُ الأقرب» لاعتماده (NESSA)
  // أو تدخّلٌ فوقيٌّ بقدرة. الإدارةُ لا ترى الصندوقَ الروتينيّ — لها صندوقُ «كسر الزجاج» المنفصل (pendingBreakGlassData).
  const { canApproveUnit } = await import("./services/approvalRouting");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, u.assignments.map((a) => a.role));
  const submitted = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.status, "amir_approved")).all());
  const scoped: typeof submitted = [];
  for (const r of submitted) {
    const p = r.unitPath || r.mosquePath;
    const g = await canApproveUnit(db, u, caps, p);
    // الصندوقُ الروتينيّ = الطبقةُ الأقرب فقط. التدخّلُ الفوقيّ (override) يُمارَس بالنزول لصفحة الوحدة لا بالإغراق هنا.
    if (g.ok && g.via === "nearest") scoped.push(r);
  }
  const inScope = scoped;
  if (!inScope.length) return { items: [] };

  // أسماء الوحدات + مقدّم التقرير (approvedByAmir) — لعرضٍ واضح
  const unitIds = [...new Set(inScope.map((r) => r.unitId || r.mosqueId))];
  const units = unitIds.length
    ? await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type }).from(orgUnits).where(inArray(orgUnits.id, unitIds)).all()
    : [];
  const uName = new Map(units.map((x) => [x.id, x]));

  // نجمع أسابيع كلّ وحدة/شهر في صفٍّ واحد (الاعتماد يتمّ للشهر كاملًا)
  const byUnit = new Map<string, PendingItem>();
  for (const r of inScope) {
    const id = r.unitId || r.mosqueId;
    const type = uName.get(id)?.type ?? "mosque";
    const cur = byUnit.get(id) ?? { unitId: id, name: uName.get(id)?.name ?? "—", type, typeLabel: ORG_TYPE_LABEL[type] ?? type, weeks: 0, points: 0, lastAt: null };
    cur.weeks++; cur.points += r.totalPoints; cur.lastAt = Math.max(cur.lastAt ?? 0, r.lastEntryAt ?? r.createdAt);
    byUnit.set(id, cur);
  }
  return { items: [...byUnit.values()].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0)) };
}

// ق1-د (الوثيقة ٢٩): صندوقُ «كسر الزجاج» للإدارة — تقاريرُ وحداتٍ لا طبقةَ إشرافيّةً مُكلَّفةً فوقها (NESSA شاغر).
// متميّزٌ عن الصندوق الروتينيّ؛ يذكّر الإدارةَ بتعيين مسؤولٍ ويتيح اعتمادًا استثنائيًّا موثَّقًا.
export async function pendingBreakGlassData(): Promise<{ items: PendingItem[] }> {
  const db = useDb();
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) return { items: [] };
  const { approverLayerFor } = await import("./services/approvalRouting");
  const submitted = await db.select().from(weeklyRecords).where(eq(weeklyRecords.status, "amir_approved")).all();
  const orphan: typeof submitted = [];
  for (const r of submitted) {
    const layer = await approverLayerFor(db, r.unitPath || r.mosquePath);
    if (layer.kind === "vacant") orphan.push(r);
  }
  if (!orphan.length) return { items: [] };
  const unitIds = [...new Set(orphan.map((r) => r.unitId || r.mosqueId))];
  const units = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type }).from(orgUnits).where(inArray(orgUnits.id, unitIds)).all();
  const uName = new Map(units.map((x) => [x.id, x]));
  const byUnit = new Map<string, PendingItem>();
  for (const r of orphan) {
    const id = r.unitId || r.mosqueId;
    const type = uName.get(id)?.type ?? "mosque";
    const cur = byUnit.get(id) ?? { unitId: id, name: uName.get(id)?.name ?? "—", type, typeLabel: ORG_TYPE_LABEL[type] ?? type, weeks: 0, points: 0, lastAt: null };
    cur.weeks++; cur.points += r.totalPoints; cur.lastAt = Math.max(cur.lastAt ?? 0, r.lastEntryAt ?? r.createdAt);
    byUnit.set(id, cur);
  }
  return { items: [...byUnit.values()].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0)) };
}

/* ---------- تقرير الطبقة (ح٢): يقدّمه المشرف على وحدته فيعتمده المستوى الأعلى ---------- */
const LAYER_TYPES = ["rabita", "square", "section"];
// حصيلة الطبقة لأسبوعٍ = مجموع نقاط تقارير الوحدات تحت مسارها (عدا الوحدة نفسها)
async function layerRollup(db: ReturnType<typeof useDb>, unitPath: string, unitId: string, weekStart: string) {
  const subs = await db.select({ p: weeklyRecords.totalPoints }).from(weeklyRecords)
    .where(and(like(weeklyRecords.unitPath, `${unitPath}%`), eq(weeklyRecords.weekStart, weekStart), ne(weeklyRecords.unitId, unitId))).all();
  return subs.reduce((s, r) => s + Number(r.p), 0);
}

// حالة تقرير الطبقة للوحدة المعروضة (للمالك فقط) — لعرض بطاقة التقديم
export async function layerReportStatusData(unitId: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { applicable: false as const };
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0] as Unit | undefined;
  if (!unit || !LAYER_TYPES.includes(unit.type)) return { applicable: false as const };
  // المالك = صاحب تكليفٍ على هذه الوحدة بعينها، أو الإدارة
  const isOwner = isGlobalAdmin(u) || u.assignments.some((a) => a.orgUnitId === unitId);
  if (!isOwner) return { applicable: false as const };
  const weekStart = weekStartSaturday(new Date(Date.now()));
  const rec = (await db.select().from(weeklyRecords).where(and(eq(weeklyRecords.unitId, unitId), eq(weeklyRecords.weekStart, weekStart))).all())[0];
  const rollup = await layerRollup(db, unit.path, unitId, weekStart);
  const status = !rec ? "none" : rec.status === "layer_approved" ? "approved" : rec.status === "amir_approved" ? "submitted" : "draft";
  return { applicable: true as const, unitName: unit.name, typeLabel: ORG_TYPE_LABEL[unit.type] ?? unit.type, status, rollup, weekStart };
}

// تقديم تقرير الطبقة للاعتماد: يُنشئ/يملأ سجلّ الوحدة بالحصيلة ويقدّمه (amir_approved) ويُشعر الأعلى
export async function submitLayerReportData(unitId: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0] as (typeof orgUnits.$inferSelect) | undefined;
  if (!unit || !LAYER_TYPES.includes(unit.type)) return { error: "التقرير الطبقيّ للمشرفين فقط" as const };
  const isOwner = isGlobalAdmin(u) || u.assignments.some((a) => a.orgUnitId === unitId);
  if (!isOwner) return { error: "تقدّم تقرير وحدتك فقط" as const };
  const weekStart = weekStartSaturday(new Date(Date.now()));
  const rec = await getOrCreateWeeklyRecord(db, unit, weekStart);
  if (rec.locked || rec.status === "layer_approved") return { error: "التقرير معتمدٌ نهائيًّا لهذا الأسبوع" as const };
  const rollup = await layerRollup(db, unit.path, unitId, weekStart);
  await db.update(weeklyRecords).set({
    totalPoints: rollup, status: "amir_approved", approvedByAmir: u.userId, amirApprovedAt: Date.now(),
    lastEntryAt: Date.now(), rejectionReason: null, rejectedByLayer: null,
  }).where(eq(weeklyRecords.id, rec.id)).run();
  // إشعار الطبقة المغطّية مباشرةً (المدير لتقرير المنطقة) — نفس مسار إشعار تقديم المسجد
  await queueLayerApprovalNeeded(db, unitId, unit.name, unit.path, weekStart);
  return { ok: true as const, rollup, weekStart };
}

// تقرير مسجد بعينه (ورقة الشبكة) — مع عزل النطاق حسب تكليفات المستخدم
export async function mosqueReportData(mosqueId: string) {
  const db = useDb();
  const u = await currentUser();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque) return null;
  if (u && !isGlobalAdmin(u) && !u.assignments.some((a) => mosque.path.startsWith(a.orgPath))) return null;
  const recs = await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, mosqueId)).all();
  const month = recs.map((r) => r.hijriMonth).filter(Boolean).sort().reverse()[0] as string | undefined;
  if (!month) return null;
  const monthRecs = recs.filter((r) => r.hijriMonth === month);
  const rep = await monthlyMosqueReport(db, mosqueId, month);
  const recStatuses = rep.weeks.map((w) => w.status);
  const caps = await reportRoleCaps(db, u, mosqueId, mosque.path);

  // أسماء مَن اعتمد (أمير/طبقة) — تُعرَض في التقرير لتثبيت المسؤولية
  const approverIds = Array.from(new Set(
    monthRecs.flatMap((r) => [r.approvedByLayer, r.approvedByAmir]).filter(Boolean) as string[],
  ));
  const approverNames = new Map<string, string>();
  if (approverIds.length > 0) {
    const rows = await db.select({ uid: users.id, name: persons.fullName })
      .from(users).innerJoin(persons, eq(users.personId, persons.id))
      .where(inArray(users.id, approverIds)).all();
    for (const r of rows) approverNames.set(r.uid, r.name);
  }
  return {
    mosqueId,
    mosqueName: rep.mosque.name,
    hijriDate: rep.month,
    kpis: {
      total: rep.monthTotal, target: rep.monthlyTarget,
      percent: rep.achievementPct, amount: (rep.money ?? 0).toFixed(2),
    },
    allApproved: rep.allApproved,
    approval: {
      allApproved: rep.allApproved,
      canAmirApprove: caps.isAmir && !caps.isLayer && recStatuses.some((s) => s === "draft"),
      // جهةٌ أعلى تعتمد متى وُجد أسبوعٌ غير مُعتمَد نهائياً (مسودة أو مُقَرّ من الأمير)
      canLayerApprove: caps.isLayer && recStatuses.some((s) => s === "draft" || s === "amir_approved"),
    },
    weeklyRows: rep.weeks.map((w, i) => {
      const rec = monthRecs.find((r) => r.weekStart === w.weekStart);
      const layerName = rec?.approvedByLayer ? approverNames.get(rec.approvedByLayer) : undefined;
      const amirName = rec?.approvedByAmir ? approverNames.get(rec.approvedByAmir) : undefined;
      const note = w.status === "layer_approved" ? (layerName ? `معتمد — ${layerName}` : "معتمد")
        : w.status === "amir_approved" ? (amirName ? `اعتمده الأمير ${amirName}` : "اعتمده الأمير")
        : rec?.rejectionReason ? `مرفوض: ${rec.rejectionReason}`
        : "—";
      return {
        weeklyRecordId: rec?.id ?? null,
        week: `الأسبوع ${["الأول", "الثاني", "الثالث", "الرابع", "الخامس"][i] ?? i + 1}`,
        dateRange: weekHijriRange(w.weekStart),
        points: w.points, target: rep.weeklyTarget,
        status: (w.points >= rep.weeklyTarget ? "done" : "below") as "done" | "below",
        approvalStatus: w.status,
        canLayerReject: caps.isLayer && w.status === "amir_approved",
        approvedByName: layerName ?? amirName ?? null,
        note,
      };
    }),
    // لا نِسَبَ زائفة: كان target=points فتظهر 100% دائمًا (تدقيق ٣٣ §٥) — العدُّ والنقاطُ فقط
    activities: rep.activities.map((a) => ({ name: a.name, count: a.times, points: a.points })),
    // «آخر تحديث» الحقيقيّ (كان نصًّا جامدًا «منذ ساعتين»)
    lastEntryAt: monthRecs.reduce<number | null>((m, r) => (r.lastEntryAt && (!m || r.lastEntryAt > m) ? r.lastEntryAt : m), null),
  };
}

export async function approveMonthlyReportData() {
  const u = await currentUser();
  return approveMonthForMosque(userMosque(u));
}

// نظرة المسجد (تبويب «نظرة» في صفحة المسجد)
export async function mosqueOverviewData(mosqueId: string) {
  const db = useDb();
  const u = await currentUser();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque || mosque.type !== "mosque") return null;
  if (u && !isGlobalAdmin(u) && !u.assignments.some((a) => mosque.path.startsWith(a.orgPath))) return null;
  const recs = await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, mosqueId)).all();
  let latest: typeof recs[number] | null = null;
  for (const r of recs) if (!latest || r.weekStart.localeCompare(latest.weekStart) > 0) latest = r;
  const members = (await db.select({ c: sql<number>`count(*)` }).from(roleAssignments)
    .where(and(eq(roleAssignments.orgUnitId, mosqueId), isNull(roleAssignments.endDate))).all())[0]?.c ?? 0;
  const now = Date.now();
  const days = latest?.lastEntryAt ? Math.floor((now - latest.lastEntryAt) / 86_400_000) : null;
  const circleRows = await db.select().from(circles).where(and(eq(circles.mosqueId, mosqueId), ne(circles.status, "archived"))).all();
  return {
    mosque: {
      id: mosque.id, name: mosque.name, type: mosque.type, genderTrack: mosque.genderTrack,
      governorate: mosque.governorate, district: mosque.district,
    },
    breadcrumbs: await breadcrumbsFor(db, mosque as never, null),
    circles: circleRows.map((c) => ({ id: c.id, type: c.type, genderTrack: c.genderTrack, name: c.name })),
    members,
    week: latest ? {
      points: latest.totalPoints, target: 70, status: latest.status,
      hijriMonth: latest.hijriMonth, daysSince: days,
    } : null,
  };
}

// اعتماد تقرير مسجد بعينه: يقدّم كل أسابيع الشهر خطوةً واحدة بحسب دور المستخدم (ق1)
export async function approveMonthForMosque(mosqueId: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque) return { error: "المسجد غير موجود" as const };
  const all = await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, mosqueId)).all();
  const month = all.map((r) => r.hijriMonth).filter(Boolean).sort().reverse()[0] as string | undefined;
  if (!month) return { error: "لا سجلات لهذا الشهر" as const };
  const caps = await reportRoleCaps(db, u, mosqueId, mosque.path);
  if (!caps.isAmir && !caps.isLayer && !caps.isAdmin) return { error: "لا تملك صلاحية الاعتماد" as const };
  const records = all.filter((r) => r.hijriMonth === month);
  let advanced = 0;
  for (const rec0 of records) {
    // نقرأ السجلَّ طازجًا (لا من اللقطة) — نقرٌ مزدوجٌ/متزامنٌ لا يُطلق إشعارًا مكرَّرًا (ج٣)
    const rec = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, rec0.id)).all())[0];
    if (!rec) continue;
    const res = await approveRecord(db, rec, { isAmir: caps.isAmir, isLayer: caps.isLayer, isAdmin: caps.isAdmin, userId: u.userId, via: caps.via === "none" ? undefined : caps.via });
    if (!res.error && res.status !== rec.status) {
      advanced++;
      if (res.status === 'amir_approved') {
        await queueLayerApprovalNeeded(db, mosqueId, mosque.name, mosque.path, rec.weekStart);
      } else if (res.status === 'layer_approved') {
        await queueFinalApproved(db, mosqueId, mosque.name, rec.weekStart);
      }
    }
  }
  return { advanced };
}

// رفض أسبوع بعينه (ق1): يُعيده إلى المسودة مع تسجيل سبب الرفض
export async function rejectWeekForMosque(weeklyRecordId: string, reason: string) {
  if (!reason.trim()) return { error: "سبب الرفض مطلوب" as const };
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const record = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, weeklyRecordId)).all())[0];
  if (!record) return { error: "السجل غير موجود" as const };
  if (record.status !== 'amir_approved') return { error: "لا يمكن رفض أسبوع غير معتمد من الأمير" as const };
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, record.mosqueId)).all())[0];
  if (!mosque) return { error: "المسجد غير موجود" as const };
  const caps = await reportRoleCaps(db, u, record.mosqueId, mosque.path);
  if (!caps.isLayer && !caps.isAdmin) return { error: "لا تملك صلاحية الرفض" as const };
  const { rejectRecord } = await import("./services/records");
  await rejectRecord(db, record, { userId: u.userId }, reason.trim());
  await queueRejectionNotice(db, record.mosqueId, mosque.name, record.weekStart, reason.trim());
  return { rejected: 1 };
}

// «لا يُعتمد — بالتعليل» من صندوق بانتظار اعتمادك: يرفض كلَّ الأسابيع المُقدَّمة للوحدة
// (مسجدًا أو طبقة) بسببٍ إلزاميٍّ يعود لمُقدِّمها، ويُشعره ليصحّح ويعيد التقديم.
export async function rejectUnitPendingData(unitId: string, reason: string) {
  if (!reason.trim()) return { error: "التعليل إلزاميّ — اكتب سبب عدم الاعتماد" as const };
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!unit) return { error: "الوحدة غير موجودة" as const };
  // ق1-د: صلاحيةُ الرفض = صلاحيةُ الاعتماد = الطبقةُ الأقرب فقط (أو تدخّلٌ فوقيّ/كسرُ زجاجٍ للإدارة).
  const { canApproveUnit } = await import("./services/approvalRouting");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, u.assignments.map((a) => a.role));
  const g = await canApproveUnit(db, u, caps, unit.path);
  if (!g.ok) return { error: "الرفض لصاحب الطبقة الأقرب" as const };

  const submitted = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.status, "amir_approved")).all())
    .filter((r) => (r.unitId || r.mosqueId) === unitId);
  if (!submitted.length) return { error: "لا تقارير مُقدَّمةً لهذه الوحدة" as const };

  const { rejectRecord } = await import("./services/records");
  for (const rec of submitted) await rejectRecord(db, rec, { userId: u.userId }, reason.trim());

  // إشعار المُقدِّم: أمير المسجد، أو صاحب تكليف الوحدة الطبقيّة
  if (unit.type === "mosque") {
    await queueRejectionNotice(db, unitId, unit.name, submitted[0].weekStart, reason.trim());
  } else {
    const owners = (await db.select().from(roleAssignments)
      .where(and(eq(roleAssignments.orgUnitId, unitId), eq(roleAssignments.approvalStatus, "approved"))).all())
      .filter((a) => !a.endDate);
    const now = Date.now();
    for (const o of owners) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(), personId: o.personId, channel: "inapp", kind: "week_rejected",
        payload: JSON.stringify({ mosqueId: unitId, mosqueName: unit.name, weekStart: submitted[0].weekStart, reason: reason.trim() }),
        status: "queued", createdAt: now, sentAt: null,
      }).run();
    }
  }
  return { rejected: submitted.length };
}

export async function dailyActivitiesData(track: "male" | "female") {
  const db = useDb();
  const sc = await currentScheme(db, track);
  // قواعد اللجنة (0047) لكلّ نشاط — تُعرض وتُفرَض في الواجهة أيضًا (الخادم يفرضها قطعًا)
  const types = await db.select().from(activityTypes).all();
  const ruleBy = new Map(types.map((t) => [t.id, { maxPerDay: t.maxPerDay ?? null, minParticipationPct: t.minParticipationPct ?? null }]));
  return {
    weeklyTarget: sc?.scheme.weeklyTarget ?? 70,
    activities: (sc?.items ?? []).map((i) => ({
      activityTypeId: i.activityTypeId, name: i.name, pts: i.points,
      maxPerDay: ruleBy.get(i.activityTypeId)?.maxPerDay ?? null,
      minParticipationPct: ruleBy.get(i.activityTypeId)?.minParticipationPct ?? null,
    })),
  };
}

// طلاب الأسرة المسجّلون للمسجد (مرجع عتبة الالتزام 0047) — يضبطه الأمير أو من فوقه
export async function familyStudentsData(mosqueId?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const id = mosqueId ?? userMosque(u);
  if (!id) return { error: "لا مسجد" as const };
  const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, id)).all())[0];
  if (!m) return { error: "المسجد غير موجود" as const };
  return { mosqueId: id, familyStudents: m.familyStudents ?? null };
}

export async function setFamilyStudentsData(count: number, mosqueId?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!Number.isInteger(count) || count < 0 || count > 500) return { error: "عددٌ غير صالح" as const };
  const id = mosqueId ?? userMosque(u);
  if (!id) return { error: "لا مسجد" as const };
  const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, id)).all())[0];
  if (!m) return { error: "المسجد غير موجود" as const };
  const can = isGlobalAdmin(u)
    || u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === id)
    || u.assignments.some((a) => ["section_head", "rabita", "square"].includes(a.role) && m.path.startsWith(a.orgPath));
  if (!can) return { error: "الضبط لأمير المسجد أو من فوقه" as const };
  await db.update(orgUnits).set({ familyStudents: count || null }).where(eq(orgUnits.id, id)).run();
  return { ok: true as const };
}

export async function saveDailyLogData(input: {
  track: "male" | "female";
  entries: Array<{ activityTypeId: string; count: number; participantCount?: number; clientUuid?: string; recordedAt?: number }>;
  shura: boolean;
}) {
  const db = useDb();
  const u = await currentUser();
  const isAdmin = u && isGlobalAdmin(u);
  const isAmir = u?.assignments.some((a) => a.role === ROLES.AMIR);
  if (!isAdmin && !isAmir) throw new Error("يحتاج دور أمير المسجد");
  const mosque = await getMosqueOrThrow(db, userMosque(u));
  const now = Date.now();
  const weekStart = weekStartSaturday(new Date(now));
  const entries = input.entries
    .filter((e) => e.count > 0)
    .map((e) => ({
      // معرّفٌ ثابتٌ من العميل إن مُرِّر (ثابتٌ عبر إعادة إرسال نفس الحفظ ⇒ idempotent دون اتصال).
      // وإلا (نداءٌ مباشر) يُولَّد فريدًا لكل حفظٍ حتى يعمل التعديل عبر المفتاح الطبيعي (مسجد،يوم،نشاط).
      clientUuid: e.clientUuid || `${mosque.id}:${weekStart}:${e.activityTypeId}:${now}`,
      weekStart, day: "sat", activityTypeId: e.activityTypeId,
      count: e.count, participantCount: e.participantCount ?? 1,
      shuraConfirmed: input.shura, recordedAt: e.recordedAt ?? now,
    }));
  if (!entries.length) return { applied: 0, totalPoints: 0 };
  const res = await syncEntries(db, mosque, { userId: u?.userId ?? "demo", canEditLocked: false, committee: null }, entries);
  return { applied: res.applied, totalPoints: res.records[0]?.totalPoints ?? 0 };
}

// سجلّ أنشطة النساء — يُنسَب لوحدةٍ نسائية (حلقة/مربع) بمخطط النساء (scheme-female)، لا لمسجد.
export async function saveWomenActivityData(input: {
  unitId: string;
  entries: Array<{ activityTypeId: string; count: number; participantCount?: number; clientUuid?: string; recordedAt?: number }>;
  shura: boolean;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.unitId)).all())[0];
  if (!unit || unit.section !== "women") return { error: "وحدةٌ نسائية غير صالحة" as const };
  // صلاحية الإدخال: مشرفة الوحدة (amir عليها) أو جهةٌ أعلى تغطّيها
  const isMushrifa = u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === unit.id);
  const isLayer = isGlobalAdmin(u) || u.assignments.some((a) =>
    (a.role === ROLES.SQUARE || a.role === ROLES.RABITA || a.role === ROLES.SECTION_HEAD) &&
    unit.path.startsWith(a.orgPath) && a.orgPath !== unit.path);
  if (!isMushrifa && !isLayer) return { error: "لا صلاحية" as const };

  const now = Date.now();
  const weekStart = weekStartSaturday(new Date(now));
  const entries = input.entries
    .filter((e) => e.count > 0)
    .map((e) => ({
      clientUuid: e.clientUuid || `${unit.id}:${weekStart}:${e.activityTypeId}:${now}`,
      weekStart, day: "sat", activityTypeId: e.activityTypeId,
      count: e.count, participantCount: e.participantCount ?? 1,
      shuraConfirmed: input.shura, recordedAt: e.recordedAt ?? now,
    }));
  if (!entries.length) return { applied: 0, totalPoints: 0 };
  // syncEntries يختار scheme-female آليًّا من unit.genderTrack ويتكفّل بـidempotency/القفل
  const res = await syncEntries(db, unit, { userId: u.userId, canEditLocked: false, committee: null }, entries);
  return { applied: res.applied, totalPoints: res.records[0]?.totalPoints ?? 0 };
}

/* ---------- توثيق أنشطة اليوم (صور) ---------- */
// قسمٌ في سجل اليوم لرفع صور النشاط المُنفَّذ — تُحفَظ في R2 ويطّلع عليها الإشراف والإعلام.
// المرجع: سجل الأسبوع الجاري للمسجد (refId). الرفع لأمير المسجد أو جهةٍ أعلى تغطّيه.

// صلاحيات المستخدم على توثيق مسجدٍ بعينه (اطّلاع/رفع)
function dailyAttachCaps(u: AuthUser, mosquePath: string, mosqueId: string) {
  const isAdmin = isGlobalAdmin(u);
  const isAmir = u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === mosqueId);
  const isLayer = isAdmin || u.assignments.some((a) =>
    (a.role === ROLES.SQUARE || a.role === ROLES.RABITA) &&
    mosquePath.startsWith(a.orgPath) && a.orgPath !== mosquePath);
  const canView = isAmir || isLayer || u.assignments.some((a) => mosquePath.startsWith(a.orgPath));
  return { canUpload: isAmir || isLayer, canView };
}

export async function dailyAttachmentsData(mosqueId?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const id = mosqueId ?? userMosque(u);
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, id)).all())[0];
  if (!mosque || mosque.type !== "mosque") return null;
  const caps = dailyAttachCaps(u, mosque.path, mosque.id);
  if (!caps.canView) return null;

  const weekStart = weekStartSaturday(new Date(Date.now()));
  // المُدخِل (أمير/أعلى) يُنشئ سجل الأسبوع عند الحاجة؛ الزائر للاطّلاع لا يُنشئ سجلاً
  let recId: string | null = null;
  if (caps.canUpload) {
    recId = (await getOrCreateWeeklyRecord(db, mosque, weekStart)).id;
  } else {
    recId = (await db.select({ id: weeklyRecords.id }).from(weeklyRecords)
      .where(and(eq(weeklyRecords.mosqueId, mosque.id), eq(weeklyRecords.weekStart, weekStart))).all())[0]?.id ?? null;
  }
  const items = recId
    ? (await db.select().from(attachments)
        .where(and(eq(attachments.scope, "daily_record"), eq(attachments.refId, recId))).all())
        .map((a) => ({ id: a.id, url: `/media/${a.r2Key}`, caption: a.caption }))
    : [];
  return { weeklyRecordId: recId, canUpload: caps.canUpload, items };
}

export async function deleteDailyAttachmentData(input: { id: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const att = (await db.select().from(attachments).where(eq(attachments.id, input.id)).all())[0];
  if (!att || att.scope !== "daily_record") return { error: "المرفق غير موجود" as const };
  const rec = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, att.refId)).all())[0];
  if (!rec) return { error: "السجل غير موجود" as const };
  const caps = dailyAttachCaps(u, rec.mosquePath, rec.mosqueId);
  if (!caps.canUpload) return { error: "لا صلاحية" as const };
  await db.delete(attachments).where(eq(attachments.id, input.id)).run();
  return { ok: true as const };
}

/* ---------- الشبكة: التنقّل الهرمي ولوحة القيادة (حسب نطاق المستخدم) ---------- */

const DONE_AT = 56;  // مكتمل (≥80% من هدف 70)
const BELOW_AT = 40; // دون الهدف؛ وأقل منها = متعثّر

function aggregateUnit(mosques: Array<{ id: string }>, latest: Map<string, { totalPoints: number; lastEntryAt: number | null }>, now: number) {
  let entered = 0, sum = 0, late = 0, done = 0, below = 0, struggling = 0;
  for (const m of mosques) {
    const r = latest.get(m.id);
    const pts = r?.totalPoints ?? 0;
    const days = r?.lastEntryAt ? Math.floor((now - r.lastEntryAt) / 86_400_000) : 99;
    if (days <= 6) entered++;
    if (days >= 2) late++;
    if (pts >= DONE_AT) done++;
    else if (pts >= BELOW_AT) below++;
    else struggling++;
    sum += pts;
  }
  const count = mosques.length;
  return {
    mosques: count,
    enteredPct: count ? Math.round((entered / count) * 100) : 0,
    avgPoints: count ? Math.round(sum / count) : 0,
    late, done, below, struggling,
  };
}

// أعلى وحدة في نطاق المستخدم (null = كل الشبكة للإدارة العليا)
async function userScopeUnit(db: ReturnType<typeof useDb>, u: AuthUser | null) {
  if (!u || isGlobalAdmin(u)) return null;
  const sup = u.assignments
    .filter((a) => ["rabita", "square"].includes(a.role))
    .sort((a, b) => a.orgPath.length - b.orgPath.length)[0];
  const target = sup ?? u.assignments.find((a) => a.role === ROLES.AMIR) ?? u.assignments[0];
  if (!target) return null;
  return (await db.select().from(orgUnits).where(eq(orgUnits.id, target.orgUnitId)).all())[0] ?? null;
}

type Unit = { id: string; name: string; type: string; parentId: string | null; path: string };
const CHILD_LABEL: Record<string, string> = { root: "المناطق", rabita: "المربعات", square: "المساجد" };
// تسمية أبناء الوحدة حسب القسم: للنساء تُستبدل «المساجد» بـ«الحلقات النسائية»
function childLabelFor(type: string, section: "men" | "women") {
  if (section === "women" && type === "square") return "الحلقات النسائية";
  return CHILD_LABEL[type] ?? "الوحدات";
}

async function breadcrumbsFor(db: ReturnType<typeof useDb>, unit: Unit | null, scope: Unit | null) {
  const crumbs: Array<{ id: string | null; name: string }> = [];
  let cur: Unit | null = unit;
  while (cur) {
    crumbs.unshift({ id: cur.id, name: cur.name });
    if (scope && cur.id === scope.id) break;
    if (!cur.parentId) break;
    cur = (await db.select().from(orgUnits).where(eq(orgUnits.id, cur.parentId)).all())[0] as Unit | undefined ?? null;
  }
  if (!scope) crumbs.unshift({ id: null, name: "كل الشبكة" });
  return crumbs;
}

export async function networkData(unitId?: string, sectionParam?: "men" | "women") {
  const db = useDb();
  const u = await currentUser();
  const scope = (await userScopeUnit(db, u)) as Unit | null;

  let unit: (Unit & { section?: string | null }) | null = scope as (Unit & { section?: string | null }) | null;
  if (unitId) {
    const found = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0] as (Unit & { section?: string | null }) | undefined;
    if (found && (!scope || found.path.startsWith(scope.path))) unit = found;
  }

  // القسم يحدّد نوع الورقة: رجال ⇐ مسجد، نساء ⇐ حلقة نسائية.
  // للإدارة العليا على الجذر: القسمُ من مبدّل الواجهة (sectionParam) — كان يثبت على «men» فلا سبيلَ لقسم النساء.
  const section = (unit?.section ?? (scope as (Unit & { section?: string | null }) | null)?.section ?? sectionParam ?? "men") as "men" | "women";
  const leafType = section === "women" ? "halaqa" : "mosque";

  // ورقة المسجد (leaf) — للرجال فقط تُفتح في صفحة المسجد المتبوّبة؛
  // للنساء تبقى الحلقة عقدةً في التصفّح (لا توجد صفحة مسجد للنساء)
  if (unit && unit.type === "mosque" && leafType === "mosque") {
    return { leaf: true as const, mosqueId: unit.id, mosqueName: unit.name, breadcrumbs: await breadcrumbsFor(db, unit, scope) };
  }

  // بادئةُ القسم على الجذر (كانت «""» للرجال فتختلط وحداتُ القسمين في قوائم الإدارة)
  const prefix = unit ? unit.path : (section === "women" ? "/women/" : "/men/");
  const prefixLike = `${prefix}%`;
  // أوراق النطاق فقط (مساجد للرجال / حلقات نسائية للنساء) — ترشيح بالمسار في SQL، لا تحميل عالمي
  const allMosques = (await db.select({ id: orgUnits.id, path: orgUnits.path, governorate: orgUnits.governorate, district: orgUnits.district }).from(orgUnits)
    .where(and(eq(orgUnits.type, leafType), like(orgUnits.path, prefixLike), ne(orgUnits.status, "archived"))).all()) as Array<{ id: string; path: string; governorate: string | null; district: string | null }>;
  // أحدث سجل لكل مسجد عبر نافذة SQL — لا يحمّل كل السجلات التاريخية (نموّ غير محدود)
  const latestRows = (await db.all(sql`
    SELECT mosque_id, total_points, last_entry_at FROM (
      SELECT mosque_id, total_points, last_entry_at,
             ROW_NUMBER() OVER (PARTITION BY mosque_id ORDER BY week_start DESC) AS rn
      FROM weekly_records WHERE mosque_path LIKE ${prefixLike}
    ) WHERE rn = 1
  `)) as Array<{ mosque_id: string; total_points: number; last_entry_at: number | null }>;
  const latest = new Map<string, { totalPoints: number; lastEntryAt: number | null }>();
  for (const r of latestRows) latest.set(r.mosque_id, { totalPoints: r.total_points, lastEntryAt: r.last_entry_at ?? null });
  const now = Date.now();

  // حلقات النطاق (انضمام للمسار) — لعدّها لكل مسجد ولكل نوع وحسب المنطقة
  const circleRows = (await db.select({ mosqueId: circles.mosqueId, type: circles.type })
    .from(circles).innerJoin(orgUnits, eq(circles.mosqueId, orgUnits.id))
    .where(and(like(orgUnits.path, prefixLike), ne(circles.status, "archived"))).all()) as Array<{ mosqueId: string; type: string }>;
  const circlesByMosque = new Map<string, number>();
  const circleStats: Record<string, number> = {};
  for (const c of circleRows) {
    circlesByMosque.set(c.mosqueId, (circlesByMosque.get(c.mosqueId) ?? 0) + 1);
    circleStats[c.type] = (circleStats[c.type] ?? 0) + 1;
  }

  // حلقات «على بصيرة» ضمن النطاق (عبر مكان الحلقة venue.orgUnitId) — لتظهر في قسم الشبكة
  const baseeraRows = (await db.select({ path: orgUnits.path })
    .from(halaqat).innerJoin(venues, eq(halaqat.venueId, venues.id)).innerJoin(orgUnits, eq(venues.orgUnitId, orgUnits.id))
    .where(and(like(orgUnits.path, prefixLike), ne(halaqat.status, "archived"))).all()) as Array<{ path: string }>;

  // جذرُ الإدارة: مناطقُ القسم المختار فقط (كانت تُجلب مناطقُ القسمين مختلطةً فتظهر النسائيّةُ بأصفار)
  const childUnits = (unit
    ? await db.select().from(orgUnits).where(and(eq(orgUnits.parentId, unit.id), ne(orgUnits.status, "archived"))).all()
    : await db.select().from(orgUnits).where(and(eq(orgUnits.type, "rabita"), like(orgUnits.path, prefixLike), ne(orgUnits.status, "archived"))).all()) as Array<Unit & { governorate: string | null; district: string | null }>;

  const children = childUnits
    .map((c) => {
      const isLeaf = c.type === leafType;
      const sub = allMosques.filter((m) => m.path.startsWith(c.path));
      const circleCount = isLeaf
        ? (circlesByMosque.get(c.id) ?? 0)
        : sub.reduce((s, m) => s + (circlesByMosque.get(m.id) ?? 0), 0);
      const baseeraCount = baseeraRows.filter((r) => r.path.startsWith(c.path)).length;
      return {
        id: c.id, name: c.name, type: c.type, ...aggregateUnit(sub, latest, now),
        circles: circleCount, baseera: baseeraCount,
        governorate: isLeaf ? c.governorate ?? null : null,
        district: isLeaf ? c.district ?? null : null,
      };
    })
    .sort((a, b) => b.mosques - a.mosques);

  // ملخّص المناطق: كل محافظة وعدد مساجدها وحلقاتها (ماذا في كل منطقة)
  const regionMap = new Map<string, { mosques: number; circles: number }>();
  for (const m of allMosques) {
    const g = m.governorate ?? "_none";
    const cur = regionMap.get(g) ?? { mosques: 0, circles: 0 };
    cur.mosques++; cur.circles += circlesByMosque.get(m.id) ?? 0;
    regionMap.set(g, cur);
  }
  const regions = [...regionMap.entries()]
    .map(([gov, v]) => ({ governorate: gov === "_none" ? null : gov, ...v }))
    .sort((a, b) => b.mosques - a.mosques);

  const kpis = aggregateUnit(allMosques, latest, now);

  let attention: { late: number; struggling: number; roleRequests: number } | null = null;
  let glimpses: { users: number; halaqat: number; participants: number; financeTotal: number; financeMonth: string | null } | null = null;
  if (!unit && u && isGlobalAdmin(u)) {
    const pending = await db.select().from(roleAssignments).where(eq(roleAssignments.approvalStatus, "pending")).all();
    attention = { late: kpis.late, struggling: kpis.struggling, roleRequests: pending.length };

    const allUsers = await db.select().from(users).all();
    const allHalaqat = await db.select().from(halaqat).all();
    const allParticipants = await db.select().from(participants).all();
    const ents = await db.select().from(monthlyEntitlements).all();
    const finMonth = ents.map((e) => e.month).filter(Boolean).sort().reverse()[0] as string | undefined;
    const financeTotal = finMonth
      ? Math.round(ents.filter((e) => e.month === finMonth).reduce((s, e) => s + e.grossAmount, 0) * 100) / 100
      : 0;
    glimpses = {
      users: allUsers.length, halaqat: allHalaqat.length, participants: allParticipants.length,
      financeTotal, financeMonth: finMonth ?? null,
    };
  }

  const curType = unit ? unit.type : "root";
  return {
    leaf: false as const,
    section,
    scopeName: unit ? unit.name : "كل الشبكة",
    scopeType: curType,
    childLabel: childLabelFor(curType, section),
    childCount: children.length,
    breadcrumbs: await breadcrumbsFor(db, unit, scope),
    kpis,
    children,
    regions,
    circleStats,
    circlesTotal: circleRows.length,
    attention,
    glimpses,
  };
}

/* ---------- ر.١ رولّ-أب قياديّ + تصدير ---------- */
// تجميعٌ بالنطاق مطابقٌ للوحة الشبكة: أوراق/حلقات، نسبة الإدخال، متوسّط النقاط، المتعثّرون،
// تفصيلٌ لكل وحدةٍ ابنة، وإجماليّة ماليّة للشهر. يخدم تصدير PDF/CSV القياديّ.
export type NetworkRollup = Awaited<ReturnType<typeof networkRollupData>>;
export async function networkRollupData(input: { section?: "men" | "women"; month?: string; unitId?: string }) {
  const db = useDb();
  const u = await currentUser();
  const scope = (await userScopeUnit(db, u)) as (Unit & { section?: string | null }) | null;

  let unit: (Unit & { section?: string | null }) | null = scope;
  if (input.unitId) {
    const found = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.unitId)).all())[0] as (Unit & { section?: string | null }) | undefined;
    if (found && (!scope || found.path.startsWith(scope.path))) unit = found;
  }
  const section = (unit?.section ?? scope?.section ?? input.section ?? "men") as "men" | "women";
  const leafType = section === "women" ? "halaqa" : "mosque";
  const leafNoun = section === "women" ? "حلقة نسائية" : "مسجد";
  const prefix = unit ? unit.path : (section === "women" ? "/women/" : "/men/");
  const prefixLike = `${prefix}%`;

  const allLeaves = (await db.select({ id: orgUnits.id, path: orgUnits.path, governorate: orgUnits.governorate }).from(orgUnits)
    .where(and(eq(orgUnits.type, leafType), like(orgUnits.path, prefixLike), ne(orgUnits.status, "archived"))).all()) as Array<{ id: string; path: string; governorate: string | null }>;
  const latestRows = (await db.all(sql`
    SELECT mosque_id, total_points, last_entry_at FROM (
      SELECT mosque_id, total_points, last_entry_at,
             ROW_NUMBER() OVER (PARTITION BY mosque_id ORDER BY week_start DESC) AS rn
      FROM weekly_records WHERE mosque_path LIKE ${prefixLike}
    ) WHERE rn = 1
  `)) as Array<{ mosque_id: string; total_points: number; last_entry_at: number | null }>;
  const latest = new Map<string, { totalPoints: number; lastEntryAt: number | null }>();
  for (const r of latestRows) latest.set(r.mosque_id, { totalPoints: r.total_points, lastEntryAt: r.last_entry_at ?? null });
  const now = Date.now();

  const circleRows = (await db.select({ mosqueId: circles.mosqueId }).from(circles).innerJoin(orgUnits, eq(circles.mosqueId, orgUnits.id))
    .where(and(like(orgUnits.path, prefixLike), ne(circles.status, "archived"))).all()) as Array<{ mosqueId: string }>;
  const circlesByLeaf = new Map<string, number>();
  for (const c of circleRows) circlesByLeaf.set(c.mosqueId, (circlesByLeaf.get(c.mosqueId) ?? 0) + 1);

  const childUnits = (unit
    ? await db.select().from(orgUnits).where(and(eq(orgUnits.parentId, unit.id), ne(orgUnits.status, "archived"))).all()
    : await db.select().from(orgUnits).where(and(eq(orgUnits.type, "rabita"), like(orgUnits.path, prefixLike), ne(orgUnits.status, "archived"))).all()) as Array<Unit & { governorate: string | null }>;

  const rows = childUnits.map((c) => {
    const sub = allLeaves.filter((m) => m.path.startsWith(c.path));
    const circleCount = sub.reduce((s, m) => s + (circlesByLeaf.get(m.id) ?? 0), 0) + (circlesByLeaf.get(c.id) ?? 0);
    return { id: c.id, name: c.name, type: c.type, typeLabel: ORG_TYPE_LABEL[c.type] ?? c.type, ...aggregateUnit(sub, latest, now), circles: circleCount };
  }).sort((a, b) => b.mosques - a.mosques);

  const totals = aggregateUnit(allLeaves, latest, now);

  // إجماليّة ماليّة للشهر (إجماليّة الشبكة للإدارة — كما تظهر في لمحات اللوحة)
  const ents = await db.select().from(monthlyEntitlements).all();
  const finMonth = input.month || (ents.map((e) => e.month).filter(Boolean).sort().reverse()[0] as string | undefined) || null;
  const financeTotal = finMonth
    ? Math.round(ents.filter((e) => e.month === finMonth).reduce((s, e) => s + e.grossAmount, 0) * 100) / 100
    : 0;

  return {
    section, leafType, leafNoun,
    scopeName: unit ? unit.name : (section === "women" ? "كل شبكة النساء" : "كل الشبكة"),
    month: finMonth, generatedAt: now,
    totals: { ...totals, circles: circleRows.length },
    rows, financeTotal, financeMonth: finMonth,
    breadcrumbs: await breadcrumbsFor(db, unit, scope),
  };
}

// بناء CSV من الرولّ-أب — أرقامٌ صِرفة للتحليل (فاصلة، مع BOM لدعم Excel العربيّ)
export function networkRollupCsv(r: NetworkRollup): string {
  // تحييد حقن الصيغ في Excel: بادئة =+-@ تُسبَق بفاصلةٍ عليا، ثم التنصيص المعتاد (ق٤)
  const esc = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["الوحدة", "النوع", r.leafNoun, "نسبة الإدخال٪", "متوسط النقاط", "مكتمل", "دون الهدف", "متعثّر", "حلقات"];
  const lines = [head.map(esc).join(",")];
  for (const x of r.rows) lines.push([x.name, x.typeLabel, x.mosques, x.enteredPct, x.avgPoints, x.done, x.below, x.struggling, x.circles].map(esc).join(","));
  lines.push(["الإجمالي", "", r.totals.mosques, r.totals.enteredPct, r.totals.avgPoints, r.totals.done, r.totals.below, r.totals.struggling, r.totals.circles].map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

/* ---------- ر.٢ سجلّ التدقيق (معزولٌ بالنطاق) ---------- */
// الإدارة ترى الكلّ؛ المشرف (منطقة/رأس قسم) يرى قيود مَن يقع نطاقه ضمن نطاقه (عبر تكاليف الفاعل).
export async function auditLogData(input: { action?: string; entity?: string; offset?: number } = {}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const isAdmin = isGlobalAdmin(u);
  const scopePrefixes = isAdmin ? [] : u.assignments
    .filter((a) => [ROLES.RABITA, ROLES.SQUARE, ROLES.SECTION_HEAD].includes(a.role as never))
    .map((a) => a.orgPath);
  if (!isAdmin && scopePrefixes.length === 0) return { error: "لا صلاحية" as const };

  const PAGE = 40;
  const offset = Math.max(0, input.offset ?? 0);
  const conds = [] as ReturnType<typeof eq>[];
  if (input.action) conds.push(eq(auditLog.action, input.action));
  if (input.entity) conds.push(eq(auditLog.entity, input.entity));

  // نطاق الفاعل: تكاليفه (orgPath) ⇐ شخصه ⇐ حسابه؛ نُبقي القيود التي يقع فاعلها ضمن نطاق المشرف
  let inScopeUserIds: Set<string> | null = null;
  if (!isAdmin) {
    const asg = await db.select({ personId: roleAssignments.personId, orgPath: roleAssignments.orgPath })
      .from(roleAssignments).where(isNull(roleAssignments.endDate)).all();
    const inScopePersons = new Set(asg.filter((a) => scopePrefixes.some((p) => a.orgPath.startsWith(p))).map((a) => a.personId));
    const us = await selectByIdChunks([...inScopePersons], (b) =>
      db.select({ id: users.id, personId: users.personId }).from(users).where(inArray(users.personId, b)).all()); // ف٨
    inScopeUserIds = new Set(us.map((x) => x.id));
  }

  const where = conds.length ? and(...conds) : undefined;
  const raw = await db.select().from(auditLog).where(where).orderBy(sql`${auditLog.at} DESC`).limit(PAGE * 3 + offset).all();
  const filtered = (inScopeUserIds ? raw.filter((r) => r.actorUserId && inScopeUserIds!.has(r.actorUserId)) : raw).slice(offset, offset + PAGE + 1);
  const hasMore = filtered.length > PAGE;
  const page = filtered.slice(0, PAGE);

  // أسماء الفاعلين
  const actorIds = [...new Set(page.map((r) => r.actorUserId).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await db.select({ userId: users.id, name: persons.fullName }).from(users).leftJoin(persons, eq(users.personId, persons.id)).where(inArray(users.id, actorIds)).all()
    : [];
  const actorName = new Map(actors.map((a) => [a.userId, a.name ?? "—"]));

  return {
    items: page.map((r) => ({
      id: r.id, action: r.action, entity: r.entity, entityId: r.entityId,
      actorName: r.actorUserId ? (actorName.get(r.actorUserId) ?? "مستخدم") : "النظام",
      at: r.at, before: r.before, after: r.after,
    })),
    offset, hasMore, pageSize: PAGE,
  };
}
