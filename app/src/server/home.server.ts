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

// ===== الموزّع: رئيسيةُ الدور (البقيّة تسقط لبطاقات «مهامّي» حتى تُبنى دفعتُها) =====
export type HomeData =
  | AdminHome
  | AmirHome
  | { role: "generic"; cards: Array<{ key: string; label: string; count: number; to: string; tone: string }> }
  | null;

export async function homeData(): Promise<HomeData> {
  const u = await currentUser();
  if (!u) return null;
  if (isGlobalAdmin(u)) return adminHomeData();
  if (u.assignments.some((a) => a.role === "amir")) return amirHomeData();
  const { myTasksSummaryData } = await import("./myTasks.server");
  const { cards } = await myTasksSummaryData();
  return { role: "generic", cards };
}
