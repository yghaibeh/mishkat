// «الرئيسية» لكل دور (الوثيقتان ٣٤/٣٦): تجميعاتٌ خادميّةٌ معدودةٌ تجيب أسئلة صباح الدور —
// لا قوائمَ كاملةً ولا حسابَ عميل (قيدُ عشرات الألوف). المواصفة: product/ui/home-*.md
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { currentUser } from "./auth.server";
import { useDb } from "./utils/db";
import {
  orgUnits, weeklyRecords, financeActions, roleAssignments, persons,
  halaqat, venues, lessonSessions, monthlyEntitlements, pointsSchemes,
} from "./database/schema"; // ساكنٌ حصرًا — الديناميكيّ يكسر النشر
import { weekStartSaturday, hijriMonthKey } from "./utils/week";
import { isGlobalAdmin } from "./utils/context";
import { approverLayerFor } from "./services/approvalRouting";

const WEEK_MS = 7 * 86_400_000;

// ===== رئيسية المدير العام (ع١ — home-admin) =====
export type AdminHome = {
  role: "admin";
  health: {
    mosquesTotal: number; entered: number; enteredPrev: number;
    chainsPending: number;   // قُدّمت وتنتظر طبقتها
    chainsStuck: number;     // تجاوزت ٧ أيام بلا بتّ (تصعيد)
  };
  decisions: { breakGlass: number; financeProposals: number };
  exceptions: Array<{ unitId: string; name: string; mosques: number; entered: number; leaderName: string | null }>;
  pulse: { newCadres30d: number; circles: number; mosques: number };
};

export async function adminHomeData(now = new Date()): Promise<AdminHome | null> {
  const db = useDb();
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) return null;

  const thisWeek = weekStartSaturday(now);
  const prevWeek = weekStartSaturday(new Date(now.getTime() - WEEK_MS));

  const mosques = await db.select({ id: orgUnits.id, path: orgUnits.path })
    .from(orgUnits).where(and(eq(orgUnits.type, "mosque"), eq(orgUnits.status, "active"))).all();

  const weekRows = await db.select({ mosqueId: weeklyRecords.mosqueId, weekStart: weeklyRecords.weekStart, status: weeklyRecords.status, amirApprovedAt: weeklyRecords.amirApprovedAt })
    .from(weeklyRecords).where(inArray(weeklyRecords.weekStart, [thisWeek, prevWeek])).all();
  const enteredSet = new Set(weekRows.filter((r) => r.weekStart === thisWeek).map((r) => r.mosqueId));
  const prevSet = new Set(weekRows.filter((r) => r.weekStart === prevWeek).map((r) => r.mosqueId));

  // سلاسل الاعتماد: المُقدَّم (amir_approved) عبر كلّ الأسابيع — والمتعطّل ما تجاوز ٧ أيام (حدُّ التصعيد)
  const pendingChains = await db.select({ at: weeklyRecords.amirApprovedAt })
    .from(weeklyRecords).where(eq(weeklyRecords.status, "amir_approved")).all();
  const nowMs = now.getTime();
  const chainsStuck = pendingChains.filter((r) => r.at != null && nowMs - (r.at as number) > WEEK_MS).length;

  // قرارات المدير حصراً: كسر الزجاج + مقترحات المسؤول الماليّ (لا اعتمادات روتينيّة — ق1-د)
  let breakGlass = 0;
  try {
    const { pendingBreakGlassData } = await import("./data.server");
    breakGlass = (await pendingBreakGlassData()).items.length;
  } catch { /* بيئة اختبارٍ جزئيّة */ }
  const financeProposals = (await db.select({ c: sql<number>`count(*)` })
    .from(financeActions).where(eq(financeActions.status, "pending")).all())[0]?.c ?? 0;

  // الاستثناءات: أسوأ ٥ مناطق إدخالًا هذا الأسبوع (تجميعٌ على مقطع المسار — المقاطع = معرّفات الوحدات)
  const byRegion = new Map<string, { mosques: number; entered: number }>();
  for (const m of mosques) {
    const seg = m.path.split("/").filter(Boolean)[1]; // /men/<region>/...
    if (!seg) continue;
    const agg = byRegion.get(seg) ?? { mosques: 0, entered: 0 };
    agg.mosques += 1;
    if (enteredSet.has(m.id)) agg.entered += 1;
    byRegion.set(seg, agg);
  }
  const regionIds = Array.from(byRegion.keys());
  const regionRows = regionIds.length
    ? await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, regionIds)).all()
    : [];
  const names = new Map(regionRows.map((r) => [r.id, r.name]));
  const leaders = regionIds.length
    ? await db.select({ unit: roleAssignments.orgUnitId, name: persons.fullName })
      .from(roleAssignments).innerJoin(persons, eq(roleAssignments.personId, persons.id))
      .where(and(inArray(roleAssignments.orgUnitId, regionIds), eq(roleAssignments.role, "rabita"),
        isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()
    : [];
  const leaderOf = new Map(leaders.map((l) => [l.unit, l.name]));
  const exceptions = Array.from(byRegion.entries())
    .map(([id, a]) => ({ unitId: id, name: names.get(id) ?? id, mosques: a.mosques, entered: a.entered, leaderName: leaderOf.get(id) ?? null }))
    .filter((r) => r.entered < r.mosques)
    .sort((a, b) => (a.entered / a.mosques) - (b.entered / b.mosques))
    .slice(0, 5);

  const newCadres30d = (await db.select({ c: sql<number>`count(*)` }).from(roleAssignments)
    .where(gte(roleAssignments.createdAt, nowMs - 30 * 86_400_000)).all())[0]?.c ?? 0;
  const circles = (await db.select({ c: sql<number>`count(*)` }).from(halaqat)
    .where(eq(halaqat.status, "active")).all())[0]?.c ?? 0;

  return {
    role: "admin",
    health: {
      mosquesTotal: mosques.length,
      entered: enteredSet.size,
      enteredPrev: prevSet.size,
      chainsPending: pendingChains.length,
      chainsStuck,
    },
    decisions: { breakGlass, financeProposals },
    exceptions,
    pulse: { newCadres30d, circles, mosques: mosques.length },
  };
}

// ===== رئيسية أمير المسجد (ع٥ — home-amir) =====
export type AmirHome = {
  role: "amir";
  mosqueId: string; mosqueName: string; genderTrack: string;
  week: { points: number; target: number; weekStart: string }; // نقاطٌ حقيقيّةٌ من السجل (إصلاح PRIOR_WEEK الوهميّ)
  chain:
    | { state: "none" }                                  // لم يبدأ الأسبوع
    | { state: "draft" }                                 // مسودة عنده
    | { state: "rejected"; reason: string }              // مردودٌ إليه بسبب
    | { state: "submitted"; approverName: string | null } // قُدّم — بانتظار الطبقة الأقرب
    | { state: "approved" };
  month: { points: number; target: number; month: string; entitlement: { amount: number; status: string } | null };
  circles: { active: number; sessions7d: number };
};

export async function amirHomeData(now = new Date()): Promise<AmirHome | null> {
  const db = useDb();
  const u = await currentUser();
  const at = u?.assignments.find((a) => a.role === "amir");
  if (!u || !at) return null;
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, at.orgUnitId)).all())[0];
  if (!mosque) return null;

  const thisWeek = weekStartSaturday(now);
  const recs = await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, mosque.id)).all();
  const cur = recs.find((r) => r.weekStart === thisWeek) ?? null;

  let target = 70;
  const schemeId = cur?.schemeId ?? recs[0]?.schemeId;
  if (schemeId) {
    const s = (await db.select({ t: pointsSchemes.weeklyTarget }).from(pointsSchemes).where(eq(pointsSchemes.id, schemeId)).all())[0];
    if (s) target = s.t;
  }

  let chain: AmirHome["chain"] = { state: "none" };
  if (cur) {
    if (cur.status === "layer_approved") chain = { state: "approved" };
    else if (cur.status === "amir_approved") {
      const layer = await approverLayerFor(db, mosque.path);
      let approverName: string | null = null;
      if (layer.kind === "layer") {
        const unit = (await db.select({ name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.id, layer.unitId)).all())[0];
        approverName = unit?.name ?? null;
      }
      chain = { state: "submitted", approverName };
    } else if (cur.rejectionReason) chain = { state: "rejected", reason: cur.rejectionReason };
    else chain = { state: "draft" };
  }

  const month = cur?.hijriMonth ?? hijriMonthKey(now);
  const monthPoints = recs.filter((r) => r.hijriMonth === month).reduce((s, r) => s + (r.totalPoints ?? 0), 0);
  // الاستحقاق يظهر بعد وجوده فقط — لا تقديراتٍ مضلّلة (قاموس ٣٥)
  const ent = (await db.select({ amount: monthlyEntitlements.grossAmount, status: monthlyEntitlements.status })
    .from(monthlyEntitlements)
    .where(and(eq(monthlyEntitlements.personId, u.personId), eq(monthlyEntitlements.month, month))).all())[0] ?? null;

  const vens = await db.select({ id: venues.id }).from(venues).where(eq(venues.orgUnitId, mosque.id)).all();
  const venueIds = vens.map((v) => v.id);
  const circleRows = venueIds.length
    ? await db.select({ id: halaqat.id }).from(halaqat)
      .where(and(inArray(halaqat.venueId, venueIds), eq(halaqat.status, "active"))).all()
    : [];
  const circleIds = circleRows.map((c) => c.id);
  const sessions7d = circleIds.length
    ? (await db.select({ c: sql<number>`count(*)` }).from(lessonSessions)
      .where(and(inArray(lessonSessions.halaqaId, circleIds), gte(lessonSessions.createdAt, now.getTime() - WEEK_MS))).all())[0]?.c ?? 0
    : 0;

  return {
    role: "amir",
    mosqueId: mosque.id, mosqueName: mosque.name, genderTrack: mosque.genderTrack ?? "male",
    week: { points: cur?.totalPoints ?? 0, target, weekStart: thisWeek },
    chain,
    month: { points: monthPoints, target: target * 4, month, entitlement: ent ? { amount: ent.amount, status: ent.status } : null },
    circles: { active: circleIds.length, sessions7d },
  };
}

// تقدُّم الأسبوع الحقيقيّ لمسجدٍ (يُغذّي «سجل اليوم» — إصلاحُ الثابت الوهميّ PRIOR_WEEK=41)
export async function weekProgressData(mosqueId: string, now = new Date()): Promise<{ points: number; target: number; weekStart: string }> {
  const db = useDb();
  const thisWeek = weekStartSaturday(now);
  const cur = (await db.select({ points: weeklyRecords.totalPoints, schemeId: weeklyRecords.schemeId })
    .from(weeklyRecords)
    .where(and(eq(weeklyRecords.mosqueId, mosqueId), eq(weeklyRecords.weekStart, thisWeek))).all())[0];
  let target = 70;
  if (cur?.schemeId) {
    const s = (await db.select({ t: pointsSchemes.weeklyTarget }).from(pointsSchemes).where(eq(pointsSchemes.id, cur.schemeId)).all())[0];
    if (s) target = s.t;
  }
  return { points: cur?.points ?? 0, target, weekStart: thisWeek };
}

// ===== رئيسية الطبقات الإشرافية (ع٢–ع٤ — home-supervisor): قائمةُ عملٍ لا لوحةُ أرقام =====
const SUPERVISOR_ROLES = ["square", "rabita", "section_head"] as const;
export type UnitWeekState = "none" | "draft" | "submitted" | "approved" | "rejected";
export type SupervisorHome = {
  role: "supervisor";
  supervisorRole: string; unitId: string; unitName: string;
  pendingApprovals: Array<{ unitId: string; name: string; typeLabel: string; weeks: number; points: number }>;
  children: { total: number; entered: number; items: Array<{ id: string; name: string; typeLabel: string; state: UnitWeekState; reason?: string }> };
  visits: { due: number; overdue: number } | null;
  registrations: number;
  layerReport: { status: string; points: number } | null;
};

const TYPE_LABEL: Record<string, string> = { mosque: "مسجد", square: "مربع", rabita: "منطقة", section: "قسم" };

export async function supervisorHomeData(now = new Date()): Promise<SupervisorHome | null> {
  const db = useDb();
  const u = await currentUser();
  const at = u?.assignments.find((a) => (SUPERVISOR_ROLES as readonly string[]).includes(a.role));
  if (!u || !at) return null;
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, at.orgUnitId)).all())[0];
  if (!unit) return null;
  const thisWeek = weekStartSaturday(now);

  // ١) بانتظار اعتمادي (NESSA — الدالة القائمة نفسها)
  let pendingApprovals: SupervisorHome["pendingApprovals"] = [];
  try {
    const { pendingApprovalsData } = await import("./data.server");
    pendingApprovals = (await pendingApprovalsData()).items
      .slice(0, 10)
      .map((i) => ({ unitId: i.unitId, name: i.name, typeLabel: i.typeLabel, weeks: i.weeks, points: i.points }));
  } catch { /* بيئة اختبار جزئية */ }

  // ٢) حالة وحداتي المباشرة هذا الأسبوع — قائمةُ عملٍ محدودة (٢٥)
  const children = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type })
    .from(orgUnits).where(and(eq(orgUnits.parentId, unit.id), eq(orgUnits.status, "active"))).all();
  const childIds = children.map((c) => c.id);
  const weekRows = childIds.length
    ? await db.select({ unitId: weeklyRecords.unitId, status: weeklyRecords.status, reason: weeklyRecords.rejectionReason })
      .from(weeklyRecords).where(and(inArray(weeklyRecords.unitId, childIds), eq(weeklyRecords.weekStart, thisWeek))).all()
    : [];
  const stateOf = new Map(weekRows.map((r) => [r.unitId, r]));
  const items = children.slice(0, 25).map((c) => {
    const r = stateOf.get(c.id);
    const state: UnitWeekState = !r ? "none"
      : r.status === "layer_approved" ? "approved"
      : r.status === "amir_approved" ? "submitted"
      : r.reason ? "rejected" : "draft";
    return { id: c.id, name: c.name, typeLabel: TYPE_LABEL[c.type] ?? c.type, state, ...(r?.reason ? { reason: r.reason } : {}) };
  });
  const entered = children.filter((c) => stateOf.has(c.id)).length;

  // ٣) زياراتي (إن كان مكلَّفًا بحلقات) + ٤) طلبات الانضمام (الأقرب)
  let visits: SupervisorHome["visits"] = null;
  try {
    const { supervisionDashboardData } = await import("./supervision.server");
    const d = await supervisionDashboardData();
    if ("summary" in d && d.summary) visits = { due: d.summary.never, overdue: d.summary.overdue };
  } catch { /* */ }
  let registrations = 0;
  try {
    const { pendingRegistrationsData } = await import("./registration.server");
    registrations = (await pendingRegistrationsData()).items.length;
  } catch { /* */ }

  // ٥) تقرير طبقتي — يظهر زرُّه فقط حين توجد حصيلة (قاعدة الصفر)
  let layerReport: SupervisorHome["layerReport"] = null;
  try {
    const { layerReportStatusData } = await import("./data.server");
    const lr = await layerReportStatusData(unit.id);
    if (lr.applicable) layerReport = { status: lr.status, points: (lr.rollup as { points?: number })?.points ?? 0 };
  } catch { /* */ }

  return {
    role: "supervisor", supervisorRole: at.role, unitId: unit.id, unitName: unit.name,
    pendingApprovals,
    children: { total: children.length, entered, items },
    visits, registrations, layerReport,
  };
}

// ===== رئيسية المسؤول المالي (ع٨): مقترحاتي + سلامة الدفتر =====
export type FinanceHome = {
  role: "finance";
  proposals: Array<{ id: string; summary: string; status: string; rejectReason?: string | null }>;
  pendingCount: number;
  ledgerBalanced: boolean;
};

export async function financeOfficerHomeData(): Promise<FinanceHome | null> {
  const db = useDb();
  const u = await currentUser();
  if (!u || !u.assignments.some((a) => a.role === "finance_officer")) return null;
  const { listFinanceActions } = await import("./services/financeActions");
  const proposals = (await listFinanceActions(db, { proposedBy: u.userId, limit: 10 })) as Array<{ id: string; summary: string; status: string; rejectReason?: string | null }>;
  const pendingCount = (await db.select({ c: sql<number>`count(*)` }).from(financeActions)
    .where(and(eq(financeActions.status, "pending"), eq(financeActions.proposedBy, u.userId))).all())[0]?.c ?? 0;
  let ledgerBalanced = true;
  try {
    const { trialBalance } = await import("./services/ledger");
    const tb = await trialBalance(db);
    const debit = tb.reduce((s, r) => s + r.debit, 0);
    const credit = tb.reduce((s, r) => s + r.credit, 0);
    ledgerBalanced = Math.abs(debit - credit) < 0.005;
  } catch { /* */ }
  return { role: "finance", proposals: proposals.map((p) => ({ id: p.id, summary: p.summary, status: p.status, rejectReason: p.rejectReason ?? null })), pendingCount, ledgerBalanced };
}

// ===== الموزّع: رئيسيةُ الدور (البقيّة تسقط لبطاقات «مهامّي» حتى تُبنى دفعتُها) =====
export type HomeData =
  | AdminHome
  | AmirHome
  | SupervisorHome
  | FinanceHome
  | { role: "redirect"; to: string }
  | { role: "generic"; cards: Array<{ key: string; label: string; count: number; to: string; tone: string }> }
  | null;

export async function homeData(): Promise<HomeData> {
  const u = await currentUser();
  if (!u) return null;
  if (isGlobalAdmin(u)) return adminHomeData();
  const roles = new Set(u.assignments.map((a) => a.role));
  if (roles.has("amir")) return amirHomeData();
  if ([...SUPERVISOR_ROLES].some((r) => roles.has(r))) return supervisorHomeData();
  if (roles.has("finance_officer")) return financeOfficerHomeData();
  // رئيسيات المعلم/اللجنة/الإعلام هي صفحاتُ عملهم نفسها (الوثيقة ٣٦ §٢)
  if (roles.has("teacher")) return { role: "redirect", to: "/my-circles" };
  if (roles.has("committee_head")) return { role: "redirect", to: "/my-committee" };
  if (roles.has("media")) return { role: "redirect", to: "/media-hub" };
  const { myTasksSummaryData } = await import("./myTasks.server");
  const { cards } = await myTasksSummaryData();
  return { role: "generic", cards };
}
