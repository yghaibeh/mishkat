// المرحلة أ — السجل الإشرافيّ على الحلقات: يعبّئه المشرف (مربع/منطقة) ويرفعه للإدارة فيعتمده الأعلى.
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { useDb } from "./utils/db";
import { supervisionVisits, orgUnits, tahfeezCircles, halaqat, venues, notifications, roleAssignments, persons } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { ROLES } from "./utils/rbac";

const SUP_ROLES = [ROLES.SQUARE, ROLES.RABITA, ROLES.SECTION_HEAD] as string[];

// قراءةٌ بالمعرّفات على دفعاتٍ (≤ ٩٠) تفاديًا لحدّ متغيّرات SQLite في D1 (نحو ١٠٠ متغيّر).
async function selectByIdChunks<R>(ids: string[], run: (batch: string[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < ids.length; i += 90) out.push(...(await run(ids.slice(i, i + 90))));
  return out;
}

// معلومات الحلقة (اسم + مسجد + مسار) حسب نوعها
async function resolveCircle(db: ReturnType<typeof useDb>, kind: string, refId: string) {
  if (kind === "tahfeez") {
    const c = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, refId)).all())[0];
    if (!c) return null;
    const ou = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, c.mosqueId)).all())[0];
    return { name: c.name, mosqueId: c.mosqueId, unitPath: ou?.path ?? null };
  }
  const h = (await db.select().from(halaqat).where(eq(halaqat.id, refId)).all())[0];
  if (!h) return null;
  const v = (await db.select({ orgUnitId: venues.orgUnitId }).from(venues).where(eq(venues.id, h.venueId)).all())[0];
  const ou = v?.orgUnitId ? (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, v.orgUnitId)).all())[0] : undefined;
  return { name: h.name, mosqueId: v?.orgUnitId ?? null, unitPath: ou?.path ?? null };
}

export async function createSupervisionVisitData(input: {
  circleKind: "tahfeez" | "baseera"; circleRefId: string;
  visitDateHijri?: string; monthlyVisitNo?: number; studentCount?: number;
  finalScore?: number; notes?: string; details?: Record<string, unknown>;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const isAdmin = isGlobalAdmin(u);
  const circle = await resolveCircle(db, input.circleKind, input.circleRefId);
  if (!circle) return { error: "الحلقة غير موجودة" as const };
  // ق1-د (الوثيقة ٢٩): الزائرُ = «الطبقةُ الأقرب» للحلقة (NESSA)؛ submitterPath = مسارُ تلك الطبقة،
  // فيُعتمَد لاحقًا من الطبقة الأعلى منها. الإدارةُ تزور استثناءً (كسرُ زجاج، submitterPath="/").
  const { approverLayerFor } = await import("./services/approvalRouting");
  const layer = await approverLayerFor(db, circle.unitPath ?? "/");
  let covering: string | null;
  if (isAdmin) covering = layer.kind === "layer" ? layer.unitPath : "/";
  else if (layer.kind === "layer" && u.assignments.some((a) => a.orgUnitId === layer.unitId && SUP_ROLES.includes(a.role))) covering = layer.unitPath;
  else covering = null;
  if (!covering) return { error: "الإشراف على الحلقة للطبقة الأقرب المغطّية أو الإدارة" as const };

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(supervisionVisits).values({
    id, circleKind: input.circleKind, circleRefId: input.circleRefId, circleName: circle.name,
    mosqueId: circle.mosqueId, unitPath: circle.unitPath, submitterPath: covering,
    visitedBy: u.userId, visitedByName: u.fullName,
    visitDateHijri: input.visitDateHijri ?? null, monthlyVisitNo: input.monthlyVisitNo ?? null,
    studentCount: input.studentCount ?? null, finalScore: input.finalScore ?? null,
    notes: input.notes?.trim() || null, details: input.details ? JSON.stringify(input.details) : null,
    status: "draft", createdAt: now, updatedAt: now,
  }).run();
  return { ok: true as const, id };
}

// رفعُ الزيارة للإدارة ⇒ إشعار الطبقة المغطّية فوق المشرف (المدير للمنطقة)
export async function submitSupervisionVisitData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const v = (await db.select().from(supervisionVisits).where(eq(supervisionVisits.id, id)).all())[0];
  if (!v) return { error: "الزيارة غير موجودة" as const };
  if (v.visitedBy !== u.userId && !isGlobalAdmin(u)) return { error: "لا صلاحية" as const };
  if (v.status === "approved") return { error: "الزيارة معتمدة" as const };
  await db.update(supervisionVisits).set({ status: "submitted", updatedAt: Date.now() }).where(eq(supervisionVisits.id, id)).run();

  // ق1-د: يُشعَر «الطبقةُ الأقرب فوق المشرف» (NESSA لمسار المشرف) فقط؛ إن شغرت ⇒ كسرُ زجاجٍ للإدارة.
  const sp = v.submitterPath ?? "/";
  const { approverLayerFor } = await import("./services/approvalRouting");
  const layer = await approverLayerFor(db, sp);
  const now = Date.now();
  const targetPersonIds = layer.kind === "layer"
    ? layer.approverPersonIds
    : [...new Set((await db.select().from(roleAssignments).where(and(eq(roleAssignments.role, ROLES.ADMIN), eq(roleAssignments.approvalStatus, "approved"))).all()).filter((a) => !a.endDate).map((a) => a.personId))];
  for (const personId of targetPersonIds) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId, channel: layer.kind === "layer" ? "telegram" : "inapp", kind: "supervision_visit_submitted",
      payload: JSON.stringify({ visitId: id, circleName: v.circleName, breakGlass: layer.kind !== "layer" }), status: "queued", createdAt: now, sentAt: null,
    }).run();
  }
  return { ok: true as const };
}

export async function approveSupervisionVisitData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const v = (await db.select().from(supervisionVisits).where(eq(supervisionVisits.id, id)).all())[0];
  if (!v) return { error: "الزيارة غير موجودة" as const };
  if (v.status !== "submitted") return { error: "الزيارة ليست بانتظار الاعتماد" as const };
  if (v.visitedBy === u.userId) return { error: "لا يعتمد المشرفُ زيارتَه بنفسه" as const };
  const sp = v.submitterPath ?? "/";
  // ق1-د: يعتمدها «الطبقةُ الأقرب فوق المشرف» (NESSA لمسار المشرف)، أو تدخّلٌ فوقيّ، أو كسرُ زجاجٍ للإدارة.
  const { canApproveUnit } = await import("./services/approvalRouting");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, u.assignments.map((a) => a.role));
  const g = await canApproveUnit(db, u, caps, sp);
  if (!g.ok) return { error: "الاعتماد من الطبقة الأقرب فوق المشرف" as const };
  await db.update(supervisionVisits).set({ status: "approved", approvedBy: u.userId, approvedByName: u.fullName, updatedAt: Date.now() }).where(eq(supervisionVisits.id, id)).run();
  return { ok: true as const };
}

type VisitRow = typeof supervisionVisits.$inferSelect;
function shape(v: VisitRow) {
  return {
    id: v.id, circleKind: v.circleKind, circleName: v.circleName, visitedByName: v.visitedByName,
    visitDateHijri: v.visitDateHijri, monthlyVisitNo: v.monthlyVisitNo, studentCount: v.studentCount,
    finalScore: v.finalScore, notes: v.notes, details: v.details ? JSON.parse(v.details) : {},
    status: v.status, approvedByName: v.approvedByName, updatedAt: v.updatedAt,
  };
}

// سجلّي (زياراتي) + بانتظار اعتمادي (ضمن نطاقي)
export async function supervisionVisitsData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { mine: [], pending: [] };
  const isAdmin = isGlobalAdmin(u);
  // «المدير لا يزور» (ق1-د): لا سجلَّ زياراتٍ شخصيًّا له — حتى لو عَلِقت به زياراتُ بياناتٍ
  // قديمة/تجريبية (بلاغ المالك: «كيف زياراتي وهو المدير العام؟»). زياراتُ الشبكة تظهر له
  // مجمَّعةً في «تقييم الإشراف بحسب المنطقة».
  const mineRows = isAdmin ? [] : await db.select().from(supervisionVisits).where(eq(supervisionVisits.visitedBy, u.userId)).orderBy(desc(supervisionVisits.updatedAt)).all();
  const submitted = await db.select().from(supervisionVisits).where(eq(supervisionVisits.status, "submitted")).orderBy(desc(supervisionVisits.updatedAt)).all();
  // ق1-د: يظهر «بانتظار اعتمادي» فقط لمن هو الطبقةُ الأقرب فوق المشرف (أو تدخّلٌ فوقيّ) — لا كلُّ الآباء ولا الإدارة.
  const { canApproveUnit } = await import("./services/approvalRouting");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, u.assignments.map((a) => a.role));
  const pending = [] as typeof submitted;
  for (const v of submitted) {
    if (v.visitedBy === u.userId) continue;
    const g = await canApproveUnit(db, u, caps, v.submitterPath ?? "/");
    if (g.ok && g.via === "nearest") pending.push(v); // الأقربُ فقط في القائمة الروتينيّة
  }
  return { mine: mineRows.map(shape), pending: pending.map(shape) };
}

// عتبة الزيارة الدوريّة: تُعتبر الحلقة «متأخّرة» إن مضى أكثر من هذا على آخر زيارة
export const VISIT_CADENCE_DAYS = 30;
const DAY_MS = 86_400_000;

// لوحة الإشراف الميدانيّ: حلقات المشرف + حالة آخر زيارةٍ لكلٍّ منها (لم تُزَر/حديثة/متأخّرة)
export async function supervisionDashboardData(mode: "tasking" | "scope" = "tasking") {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { circles: [], cadenceDays: VISIT_CADENCE_DAYS };
  const { items } = await supervisableCirclesData(mode);
  if (!items.length) return { circles: [], cadenceDays: VISIT_CADENCE_DAYS };

  // آخر زيارةٍ لكلّ حلقة (بأيّ مشرف) — للحالة الزمنيّة. نقرأ الجدول كاملًا مرتَّبًا (جدولٌ صغير)
  // بدل تمرير قائمة معرّفاتٍ ضخمةٍ في IN (يتجاوز حدّ متغيّرات SQLite في D1).
  const visits = await db.select({ ref: supervisionVisits.circleRefId, at: supervisionVisits.createdAt, by: supervisionVisits.visitedByName, score: supervisionVisits.finalScore })
    .from(supervisionVisits).orderBy(desc(supervisionVisits.createdAt)).all();
  const lastByRef = new Map<string, { at: number; by: string | null; score: number | null }>();
  for (const v of visits) if (!lastByRef.has(v.ref)) lastByRef.set(v.ref, { at: v.at, by: v.by, score: v.score });
  const now = Date.now();

  const circles = items.map((c) => {
    const last = lastByRef.get(c.id);
    const daysSince = last ? Math.floor((now - last.at) / DAY_MS) : null;
    const status = !last ? "never" : (daysSince ?? 0) > VISIT_CADENCE_DAYS ? "overdue" : "recent";
    return { ...c, lastVisitAt: last?.at ?? null, lastVisitBy: last?.by ?? null, lastScore: last?.score ?? null, daysSince, status };
  });
  // ترتيبٌ حسب الحاجة: لم تُزَر ثمّ الأقدم زيارةً أولًا
  const rank = { never: 0, overdue: 1, recent: 2 } as Record<string, number>;
  circles.sort((a, b) => (rank[a.status] - rank[b.status]) || ((b.daysSince ?? 0) - (a.daysSince ?? 0)));
  return {
    circles, cadenceDays: VISIT_CADENCE_DAYS,
    summary: {
      total: circles.length,
      never: circles.filter((c) => c.status === "never").length,
      overdue: circles.filter((c) => c.status === "overdue").length,
    },
  };
}


// «كيف تقوم كلُّ وحدةٍ بواجب الإشراف؟» — عرضُ المطّلع القياديّ (ع١/ع٢، بلاغ المالك ٢٠٢٦-٠٧-١٨):
// المديرُ ورأسُ القسم لا يُعرَض لهما ١٢٨ حلقةً بأزرار «سجّل زيارة» (ليسا مُكلَّفَين — قاعدة المالك
// الواحد)، بل تقييمٌ مجمَّعٌ بحسب المنطقة: التغطية في الدورة، المتأخّر، متوسّط النتائج، والمسؤول.
export async function supervisionOverviewData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return null;
  const isAdmin = isGlobalAdmin(u);
  const isSectionHead = u.assignments.some((a) => a.role === "section_head");
  if (!isAdmin && !isSectionHead) return null; // المُكلَّفون (مربع/منطقة) لهم اللوحةُ التشغيلية
  const d = await supervisionDashboardData("scope");
  if (!("summary" in d) || !d.summary || !d.circles.length) return { rows: [], cadenceDays: VISIT_CADENCE_DAYS };

  const units = await db.select({ id: orgUnits.id, path: orgUnits.path, name: orgUnits.name, section: orgUnits.section }).from(orgUnits).all();
  const byId = new Map(units.map((x) => [x.id, x]));
  type Row = { unitId: string; name: string; section: string | null; total: number; due: number; scores: number[] };
  const groups = new Map<string, Row>();
  for (const c of d.circles) {
    const unit = c.mosqueId ? byId.get(c.mosqueId) : null;
    if (!unit) continue;
    const segs = unit.path.split("/").filter(Boolean); // [القسم، المنطقة، ...]
    const regionId = segs[1] ?? segs[0];
    const region = byId.get(regionId);
    const row = groups.get(regionId) ?? { unitId: regionId, name: region?.name ?? regionId, section: region?.section ?? unit.section, total: 0, due: 0, scores: [] };
    row.total++;
    if (c.status !== "recent") row.due++;
    if (c.lastScore != null) row.scores.push(c.lastScore);
    groups.set(regionId, row);
  }

  // مسؤولُ كلّ وحدةٍ — ليُعرَف من يُسأل (قاعدة النزول السؤالي)
  const leaders = (await db.select({ orgUnitId: roleAssignments.orgUnitId, name: persons.fullName })
    .from(roleAssignments).innerJoin(persons, eq(roleAssignments.personId, persons.id))
    .where(and(inArray(roleAssignments.role, SUP_ROLES), isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all());
  const leaderByUnit = new Map(leaders.map((l) => [l.orgUnitId, l.name]));

  const rows = [...groups.values()]
    .map((r) => ({
      unitId: r.unitId, name: r.name, section: r.section,
      total: r.total, visited: r.total - r.due, due: r.due,
      avgScore: r.scores.length ? Math.round(r.scores.reduce((a, b) => a + b, 0) / r.scores.length) : null,
      leaderName: leaderByUnit.get(r.unitId) ?? null,
    }))
    .sort((a, b) => (b.due / Math.max(b.total, 1)) - (a.due / Math.max(a.total, 1))); // الأسوأ تغطيةً أولاً
  return { rows, cadenceDays: VISIT_CADENCE_DAYS };
}

// قائمة الحلقات المتاحة للمشرف لإنشاء زيارة (تحفيظ + على‑بصيرة ضمن نطاقه)
export async function supervisableCirclesData(mode: "tasking" | "scope" = "tasking") {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] as Array<{ kind: string; id: string; name: string; mosqueName: string; mosqueId: string | null }> };
  const isAdmin = isGlobalAdmin(u);
  // ق1-د: الحلقةُ تُسنَد لزيارة «الطبقة الأقرب» لها (NESSA) فقط — لا كلّ الآباء. الإدارةُ ترى الكلَّ (إشرافٌ/كسرُ زجاج).
  // كفاءةٌ: نحمّل التكليفاتِ الإشرافيّةَ النشطةَ مرّةً، ونحسب الأقربَ لكلّ مسارٍ بلا استعلامٍ لكلّ حلقة.
  const { ancestorIds } = await import("./utils/orgPath");
  const activeSup = (await db.select({ orgUnitId: roleAssignments.orgUnitId, endDate: roleAssignments.endDate })
    .from(roleAssignments).where(and(inArray(roleAssignments.role, SUP_ROLES), eq(roleAssignments.approvalStatus, "approved"))).all()).filter((a) => !a.endDate);
  const staffedUnits = new Set(activeSup.map((a) => a.orgUnitId));
  const myUnits = new Set(u.assignments.filter((a) => SUP_ROLES.includes(a.role)).map((a) => a.orgUnitId));
  const covers = (path: string | null): boolean => {
    if (isAdmin) return true;
    if (!path) return false;
    // scope: للمطّلع القيادي — كلُّ نطاقه لا المُسندُ له فقط (رأسُ القسم يقيّم قسمَه كلَّه)
    if (mode === "scope") return u.assignments.some((a) => path.startsWith(a.orgPath));
    const parents = ancestorIds(path).reverse(); // الأقربُ أوّلًا
    const nearest = parents.find((id) => staffedUnits.has(id));
    return nearest != null && myUnits.has(nearest);
  };

  const items: Array<{ kind: string; id: string; name: string; mosqueName: string; mosqueId: string | null }> = [];
  // تحفيظ
  const tc = await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.status, "active")).all();
  const mosqueIds = [...new Set(tc.map((c) => c.mosqueId))];
  const mos = await selectByIdChunks(mosqueIds, (b) => db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path, status: orgUnits.status }).from(orgUnits).where(inArray(orgUnits.id, b)).all());
  const mById = new Map(mos.map((m) => [m.id, m]));
  for (const c of tc) { const m = mById.get(c.mosqueId); if (m?.status === "archived") continue; if (covers(m?.path ?? null)) items.push({ kind: "tahfeez", id: c.id, name: c.name, mosqueName: m?.name ?? "—", mosqueId: c.mosqueId }); } // ف٦: مسجدٌ مؤرشف ⇒ حلقاته خارج الإشراف
  // على‑بصيرة
  const hs = await db.select({ id: halaqat.id, name: halaqat.name, venueId: halaqat.venueId }).from(halaqat).where(eq(halaqat.status, "active")).all();
  const vIds = [...new Set(hs.map((h) => h.venueId))];
  const vs = await selectByIdChunks(vIds, (b) => db.select({ id: venues.id, orgUnitId: venues.orgUnitId }).from(venues).where(inArray(venues.id, b)).all());
  const vById = new Map(vs.map((v) => [v.id, v]));
  const ouIds = [...new Set(vs.map((v) => v.orgUnitId).filter(Boolean))] as string[];
  const ous = await selectByIdChunks(ouIds, (b) => db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path, status: orgUnits.status }).from(orgUnits).where(inArray(orgUnits.id, b)).all());
  const ouById = new Map(ous.map((o) => [o.id, o]));
  for (const h of hs) { const v = vById.get(h.venueId); const o = v?.orgUnitId ? ouById.get(v.orgUnitId) : undefined; if (o?.status === "archived") continue; if (covers(o?.path ?? null)) items.push({ kind: "baseera", id: h.id, name: h.name, mosqueName: o?.name ?? "—", mosqueId: v?.orgUnitId ?? null }); } // ف٦
  return { items };
}

// جردٌ مستقلٌّ عن المستخدم (للكرون): كلّ الحلقات المُشرَف عليها + مسارها + آخر زيارة،
// مُرشَّحًا على المتأخّرة (لم تُزَر أو تجاوزت الدورة). يُستعمَل في تذكيرات الإشراف المجدولة.
export async function overdueCirclesForReminders(now: number = Date.now()) {
  const db = useDb();
  const all: Array<{ kind: string; id: string; name: string; unitPath: string | null; mosqueName: string }> = [];
  // تحفيظ
  const tc = await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.status, "active")).all();
  const mosqueIds = [...new Set(tc.map((c) => c.mosqueId))];
  const mos = await selectByIdChunks(mosqueIds, (b) => db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path, status: orgUnits.status }).from(orgUnits).where(inArray(orgUnits.id, b)).all());
  const mById = new Map(mos.map((m) => [m.id, m]));
  for (const c of tc) { const m = mById.get(c.mosqueId); if (m?.status === "archived") continue; all.push({ kind: "tahfeez", id: c.id, name: c.name, unitPath: m?.path ?? null, mosqueName: m?.name ?? "—" }); } // ف٦
  // على‑بصيرة
  const hs = await db.select({ id: halaqat.id, name: halaqat.name, venueId: halaqat.venueId }).from(halaqat).where(eq(halaqat.status, "active")).all();
  const vIds = [...new Set(hs.map((h) => h.venueId))];
  const vs = await selectByIdChunks(vIds, (b) => db.select({ id: venues.id, orgUnitId: venues.orgUnitId }).from(venues).where(inArray(venues.id, b)).all());
  const vById = new Map(vs.map((v) => [v.id, v]));
  const ouIds = [...new Set(vs.map((v) => v.orgUnitId).filter(Boolean))] as string[];
  const ous = await selectByIdChunks(ouIds, (b) => db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path, status: orgUnits.status }).from(orgUnits).where(inArray(orgUnits.id, b)).all());
  const ouById = new Map(ous.map((o) => [o.id, o]));
  for (const h of hs) { const v = vById.get(h.venueId); const o = v?.orgUnitId ? ouById.get(v.orgUnitId) : undefined; if (o?.status === "archived") continue; all.push({ kind: "baseera", id: h.id, name: h.name, unitPath: o?.path ?? null, mosqueName: o?.name ?? "—" }); } // ف٦

  if (!all.length) return [];
  // آخر زيارةٍ لكلّ حلقة — نقرأ الجدول كاملًا مرتَّبًا (بدل IN بقائمةٍ ضخمة تتجاوز حدّ D1)
  const visits = await db.select({ ref: supervisionVisits.circleRefId, at: supervisionVisits.createdAt })
    .from(supervisionVisits).orderBy(desc(supervisionVisits.createdAt)).all();
  const lastByRef = new Map<string, number>();
  for (const v of visits) if (!lastByRef.has(v.ref)) lastByRef.set(v.ref, v.at);

  return all.map((c) => {
    const last = lastByRef.get(c.id) ?? null;
    const daysSince = last ? Math.floor((now - last) / DAY_MS) : null;
    const status = !last ? "never" : (daysSince ?? 0) > VISIT_CADENCE_DAYS ? "overdue" : "recent";
    return { ...c, lastVisitAt: last, daysSince, status };
  }).filter((c) => c.status !== "recent");
}
