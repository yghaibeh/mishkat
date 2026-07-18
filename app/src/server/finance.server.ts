// منطق الملف المالي (خادم فقط) — للإدارة العليا حصراً (ق2/ق7/ق8، بلا خصومات ق4-ب).
import { and, desc, eq, isNull, inArray, like, ne, or, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import {
  persons, roleAssignments, rateSchemes, teachers, orgUnits,
  monthlyEntitlements, entitlementTracks, payouts, weeklyRecords, lessonSessions,
} from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { ROLES } from "./utils/rbac";

const SUPERVISOR_ROLES = ["rabita", "square"];

// عرض الملف المالي: يتطلّب finance.view؛ يُرجع بادئات النطاق (null = الإدارة العليا = الكلّ).
async function requireFinanceView(): Promise<string[] | null> {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, "finance.view")) throw new Error("لا تملك صلاحية الملف المالي");
  return isGlobalAdmin(u) ? null : [...new Set(u.assignments.filter((a) => SUPERVISOR_ROLES.includes(a.role)).map((a) => a.orgPath))];
}

// شرط عزل النطاق على المستحقات: شخصٌ له تكليف ضمن شجرة المستخدم (استعلام فرعي SQL — يتوسّع).
function entitlementScopeCond(db: ReturnType<typeof useDb>, prefixes: string[] | null) {
  if (prefixes === null) return undefined;
  // نطاقٌ فارغ (مستخدمٌ بلا تكليفٍ إشرافي) ⇒ لا يرى شيئاً — لا تسريب لكامل الشبكة.
  if (prefixes.length === 0) return sql`1 = 0`;
  // ق٣: يقتصر على أصحاب التكاليف النشطة المعتمَدة — كان يسرّب مستحقّاتِ مَن انتهى/عُلِّق تكليفُه في النطاق
  const scopeOr = or(...prefixes.map((p) => like(roleAssignments.orgPath, `${p}%`)));
  return inArray(monthlyEntitlements.personId, db.select({ id: roleAssignments.personId }).from(roleAssignments)
    .where(and(scopeOr, isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))));
}
import { buildTracks, computeMonthlyEntitlement, approveEntitlement, recordPayout } from "./services/finance";

// استعلام IN مُقطّع — يتجنّب حدّ معاملات SQLite/D1 ويتوسّع لأي عدد معرّفات
async function inChunks<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>, size = 80): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await fn(ids.slice(i, i + size))));
  return out;
}

async function requireFinanceAdmin() {
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) throw new Error("الملف المالي للإدارة العليا فقط");
  return u;
}

// الأشهر الهجرية المتاحة (من السجلات الأسبوعية وجلسات «على بصيرة») — الأحدث أولاً
async function availableMonths(db: ReturnType<typeof useDb>) {
  const recs = await db.select({ m: weeklyRecords.hijriMonth }).from(weeklyRecords).all();
  const lessons = await db.select({ m: lessonSessions.hijriMonth }).from(lessonSessions).all();
  const months = [...recs, ...lessons].map((r) => r.m).filter(Boolean) as string[];
  return [...new Set(months)].sort().reverse();
}

// الأشخاص المؤهّلون للمستحق في الشهر: إدارة عليا (مقطوع) + أمراء (نقاط) + معلّمون (ساعات)
async function eligiblePersonIds(db: ReturnType<typeof useDb>): Promise<string[]> {
  const asg = await db.select().from(roleAssignments).where(and(
    isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"),
  )).all();
  const ids = new Set<string>();
  for (const a of asg) if (a.role === ROLES.ADMIN || a.role === ROLES.AMIR) ids.add(a.personId);
  const ts = await db.select().from(teachers).where(eq(teachers.active, true)).all();
  for (const t of ts) ids.add(t.personId);
  return [...ids];
}

const KIND_RATE: Record<string, string> = { point_rate: "نقاط", fixed_salary: "مقطوع", hourly_rate: "ساعة" };

export async function financeData(monthArg?: string) {
  const prefixes = await requireFinanceView();
  const db = useDb();
  const months = await availableMonths(db);
  const month = monthArg && months.includes(monthArg) ? monthArg : months[0];

  // المعدّلات السارية للعرض
  const rates = await db.select().from(rateSchemes).where(eq(rateSchemes.active, true)).orderBy(desc(rateSchemes.validFrom)).all();
  const seen = new Set<string>();
  const rateRows = rates.filter((r) => (seen.has(r.kind) ? false : (seen.add(r.kind), true)))
    .map((r) => ({ kind: r.kind, label: KIND_RATE[r.kind] ?? r.kind, amount: r.amount, perUnit: r.perUnit }));

  const empty = { totals: { gross: 0, approved: 0, paid: 0, beneficiaries: 0 }, dist: { proposed: 0, approved: 0, paid: 0 } };
  if (!month) return { month: null, months, rates: rateRows, eligibleCount: 0, ...empty };

  // المؤشرات والتوزيع عبر SUM/COUNT في SQL — لا تحمّل أي صفوف. يتوسّع لأي عدد مستحقات.
  const scopeC = entitlementScopeCond(db, prefixes);
  const whereC = scopeC ? and(eq(monthlyEntitlements.month, month), scopeC) : eq(monthlyEntitlements.month, month);
  const aggRows = await db.select({
    gross: sql<number>`coalesce(sum(gross_amount),0)`,
    beneficiaries: sql<number>`count(*)`,
    approvedSum: sql<number>`coalesce(sum(case when status<>'proposed' then gross_amount else 0 end),0)`,
    proposed: sql<number>`coalesce(sum(case when status='proposed' then 1 else 0 end),0)`,
    approved: sql<number>`coalesce(sum(case when status='approved' then 1 else 0 end),0)`,
    paid: sql<number>`coalesce(sum(case when status='paid' then 1 else 0 end),0)`,
  }).from(monthlyEntitlements).where(whereC).all();
  const agg = aggRows[0];
  const paidRows = await db.select({ p: sql<number>`coalesce(sum(paid_amount),0)` }).from(payouts)
    .innerJoin(monthlyEntitlements, eq(monthlyEntitlements.id, payouts.entitlementId))
    .where(whereC).all();

  const eligible = await eligiblePersonIds(db);
  return {
    month, months, rates: rateRows, eligibleCount: eligible.length,
    totals: { gross: round2(agg.gross), approved: round2(agg.approvedSum), paid: round2(paidRows[0]?.p ?? 0), beneficiaries: agg.beneficiaries },
    dist: { proposed: agg.proposed, approved: agg.approved, paid: agg.paid },
  };
}

const FIN_PAGE = 25;

// صفحة مستحقات (مُصفّحة + بحث بالاسم) — تحمّل صفحة واحدة فقط
export async function financeRows(monthArg: string, q?: string, offset = 0) {
  const prefixes = await requireFinanceView();
  const db = useDb();
  const term = (q ?? "").trim();
  const scopeC = entitlementScopeCond(db, prefixes);
  const parts = [eq(monthlyEntitlements.month, monthArg), term ? like(persons.fullName, `%${term}%`) : undefined, scopeC].filter(Boolean);
  const cond = parts.length > 1 ? and(...parts) : parts[0];

  const page = await db.select({
    id: monthlyEntitlements.id, gross: monthlyEntitlements.grossAmount, status: monthlyEntitlements.status, name: persons.fullName,
  }).from(monthlyEntitlements).innerJoin(persons, eq(persons.id, monthlyEntitlements.personId))
    .where(cond).orderBy(desc(monthlyEntitlements.grossAmount)).limit(FIN_PAGE).offset(offset).all();
  const totalRows = await db.select({ c: sql<number>`count(*)` }).from(monthlyEntitlements)
    .innerJoin(persons, eq(persons.id, monthlyEntitlements.personId)).where(cond).all();

  const ids = page.map((e) => e.id);
  const tracks = await inChunks(ids, (c) => db.select().from(entitlementTracks).where(inArray(entitlementTracks.entitlementId, c)).all());
  const pays = await inChunks(ids, (c) => db.select().from(payouts).where(inArray(payouts.entitlementId, c)).all());

  const items = page.map((e) => ({
    id: e.id, personName: e.name, gross: round2(e.gross), status: e.status as "proposed" | "approved" | "paid",
    tracks: tracks.filter((t) => t.entitlementId === e.id).map((t) => ({ kind: t.kind as "fixed" | "points" | "hours", basis: t.basis, rate: t.rate, amount: round2(t.amount) })),
    paidAmount: pays.find((p) => p.entitlementId === e.id)?.paidAmount != null ? round2(pays.find((p) => p.entitlementId === e.id)!.paidAmount) : null,
  }));
  return { items, total: totalRows[0]?.c ?? 0, offset, pageSize: FIN_PAGE };
}

// مستحقّات الشهر ضمن شجرة الهيكلية — لتفادي اختلاط أسماء المستفيدين المتشابهة عبر الوحدات.
// المستفيد يُنسَب لوحدته الأساسية (home_org_unit_id). معزولٌ بنطاق المستخدم.
export async function financeTreeData(monthArg: string) {
  const prefixes = await requireFinanceView();
  const db = useDb();
  const scopeC = entitlementScopeCond(db, prefixes);
  const cond = scopeC ? and(eq(monthlyEntitlements.month, monthArg), scopeC) : eq(monthlyEntitlements.month, monthArg);

  // ق٣: تستثني الوحداتِ المؤرشفةَ من شجرة الماليّة
  const scopeUnit = prefixes === null ? undefined : or(...prefixes.map((p) => like(orgUnits.path, `${p}%`)));
  const unitCond = and(ne(orgUnits.status, "archived"), ...(scopeUnit ? [scopeUnit] : []));
  const units = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type, parentId: orgUnits.parentId }).from(orgUnits).where(unitCond).all();
  const unitIdSet = new Set(units.map((u) => u.id));

  const rows = await db.select({
    id: monthlyEntitlements.id, gross: monthlyEntitlements.grossAmount, status: monthlyEntitlements.status,
    name: persons.fullName, unitId: persons.homeOrgUnitId,
  }).from(monthlyEntitlements).innerJoin(persons, eq(persons.id, monthlyEntitlements.personId))
    .where(cond).orderBy(desc(monthlyEntitlements.grossAmount)).all();

  const ids = rows.map((e) => e.id);
  const tracks = await inChunks(ids, (c) => db.select().from(entitlementTracks).where(inArray(entitlementTracks.entitlementId, c)).all());
  const pays = await inChunks(ids, (c) => db.select().from(payouts).where(inArray(payouts.entitlementId, c)).all());

  // جذرٌ افتراضيّ لمن لا وحدة له (الإدارة العليا)
  const ROOT = units.find((u) => u.parentId === null || !unitIdSet.has(u.parentId as string))?.id ?? null;
  const leaves = rows.map((e) => ({
    id: e.id, name: e.name, personName: e.name, unitId: e.unitId && unitIdSet.has(e.unitId) ? e.unitId : (ROOT ?? ""),
    gross: round2(e.gross), status: e.status as "proposed" | "approved" | "paid",
    tracks: tracks.filter((t) => t.entitlementId === e.id).map((t) => ({ kind: t.kind as "fixed" | "points" | "hours", basis: t.basis, rate: t.rate, amount: round2(t.amount) })),
    paidAmount: pays.find((p) => p.entitlementId === e.id)?.paidAmount != null ? round2(pays.find((p) => p.entitlementId === e.id)!.paidAmount) : null,
  }));
  return { units, leaves };
}

// احتساب مستحقات الشهر لكل المؤهّلين (يتجاهل من لا مستحق له) — لا يلمس مستحقاً مصروفاً
export async function computeFinanceData(month: string) {
  const u = await requireFinanceAdmin();
  const db = useDb();
  const ids = await eligiblePersonIds(db);
  let computed = 0;
  for (const pid of ids) {
    const tracks = await buildTracks(db, pid, month);
    const gross = tracks.reduce((s, t) => s + t.amount, 0);
    if (gross <= 0) {
      // ق٣: هبط الإجماليُّ إلى صفرٍ (أُلغيت جلساتُه مثلًا) ⇒ نُزيل الترشيحَ غير المصروف/المعتمد بدل تركه شبحًا
      const prev = (await db.select().from(monthlyEntitlements).where(and(eq(monthlyEntitlements.personId, pid), eq(monthlyEntitlements.month, month))).all())[0];
      if (prev && prev.status !== "paid" && prev.status !== "approved") {
        await db.delete(entitlementTracks).where(eq(entitlementTracks.entitlementId, prev.id)).run();
        await db.delete(monthlyEntitlements).where(eq(monthlyEntitlements.id, prev.id)).run();
      }
      continue;
    }
    await computeMonthlyEntitlement(db, pid, month, u.userId);
    computed++;
  }
  return { computed };
}

export async function approveFinanceData(id: string) {
  const u = await requireFinanceAdmin();
  const db = useDb();
  const res = await approveEntitlement(db, id, u.userId);
  return "error" in res ? { error: res.error } : { status: res.status };
}

export async function payoutFinanceData(id: string, paidAmount: number, reference?: string) {
  const u = await requireFinanceAdmin();
  const db = useDb();
  const res = await recordPayout(db, id, paidAmount, u.userId, reference);
  return "error" in res && res.error ? { error: res.error } : { status: "paid" as const, paidAmount };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
