// منطق وحدة «اللجان» (خادم فقط) — لجان أسرة المسجد وخططها (المواد 24–33)، مرتبطة بالمسجد مباشرةً.
import { and, asc, eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { committees, committeePlans, orgUnits } from "./database/schema";
import { currentUser } from "./auth.server";
import { requireMosqueAccess, requireMosqueManage } from "./utils/scope";
import type { AuthUser } from "./utils/context";

async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  return u;
}

// مَن يُدير لجنةً: الإدارةُ العليا، أو أميرُ مسجدها، أو مسؤولُ اللجنة نفسُه (يدير خطّتَه). فصلٌ نظيفٌ للنطاق.
function canManageCommittee(u: AuthUser, committee: { mosqueId: string; headPersonId?: string | null }): boolean {
  if (u.assignments.some((a) => a.role === "admin")) return true;
  if (u.assignments.some((a) => a.role === "amir" && a.orgUnitId === committee.mosqueId)) return true;
  if (committee.headPersonId && committee.headPersonId === u.personId) return true;
  return false;
}
async function count(query: { all: () => Promise<Array<{ c: number }>> }) {
  return (await query.all())[0]?.c ?? 0;
}

export async function committeesData(mosqueId: string) {
  await requireMosqueAccess(mosqueId);
  const db = useDb();
  const rows = await db.select().from(committees)
    .where(and(eq(committees.mosqueId, mosqueId), eq(committees.status, "active")))
    .orderBy(asc(committees.type), asc(committees.createdAt)).all();
  const ids = rows.map((c) => c.id);

  const plans = ids.length
    ? await db.select().from(committeePlans).where(inArray(committeePlans.committeeId, ids)).orderBy(asc(committeePlans.createdAt)).all()
    : [];
  const plansByComm = new Map<string, Array<{ id: string; title: string; recurring: boolean; monthHijri: string | null; status: string }>>();
  for (const p of plans) {
    const arr = plansByComm.get(p.committeeId) ?? [];
    arr.push({ id: p.id, title: p.title, recurring: p.recurring, monthHijri: p.monthHijri, status: p.status });
    plansByComm.set(p.committeeId, arr);
  }

  const items = rows.map((c) => ({
    id: c.id, name: c.name, type: c.type,
    headName: c.headName || null,
    hasHeadAccount: !!c.headPersonId,   // هل لمسؤول اللجنة حسابُ دخولٍ مربوط؟
    plans: plansByComm.get(c.id) ?? [],
  }));
  return {
    kpis: { committees: rows.length, withHead: rows.filter((c) => !!c.headName).length, planItems: plans.length },
    items,
  };
}

// «لجنتي» — لجانُ مسؤول اللجنة (headPersonId = هو)، مع خططها. نطاقُه لجنتُه وحدها.
export async function myCommitteesData() {
  const u = await requireUser();
  const db = useDb();
  const rows = await db.select().from(committees).where(and(eq(committees.headPersonId, u.personId), eq(committees.status, "active"))).orderBy(asc(committees.createdAt)).all();
  const ids = rows.map((c) => c.id);
  const plans = ids.length ? await db.select().from(committeePlans).where(inArray(committeePlans.committeeId, ids)).orderBy(asc(committeePlans.createdAt)).all() : [];
  const byComm = new Map<string, Array<{ id: string; title: string; recurring: boolean; monthHijri: string | null; status: string }>>();
  for (const p of plans) { const arr = byComm.get(p.committeeId) ?? []; arr.push({ id: p.id, title: p.title, recurring: p.recurring, monthHijri: p.monthHijri, status: p.status }); byComm.set(p.committeeId, arr); }
  return { items: rows.map((c) => ({ id: c.id, name: c.name, type: c.type, headName: c.headName || null, plans: byComm.get(c.id) ?? [] })) };
}

export async function createCommitteeData(input: { mosqueId: string; name: string; type: "main" | "sub"; headName?: string }) {
  await requireMosqueManage(input.mosqueId);
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(committees).values({
    id, mosqueId: input.mosqueId, name: input.name.trim(), type: input.type,
    headName: input.headName?.trim() || null, status: "active", createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

// إسنادُ مسؤول اللجنة: إمّا اسمٌ نصّيّ (headName)، أو إنشاءُ حسابِ دخولٍ له (newHead) ليطّلع على لجنته ويُديرها.
export async function assignCommitteeHeadData(input: { committeeId: string; headName?: string; newHead?: { fullName: string; login: string; password: string } }) {
  const u = await requireUser();
  const db = useDb();
  const committee = (await db.select().from(committees).where(eq(committees.id, input.committeeId)).all())[0];
  if (!committee) throw new Error("اللجنة غير موجودة");
  const isAdmin = u.assignments.some((a) => a.role === "admin");
  const isAmir = u.assignments.some((a) => a.role === "amir" && a.orgUnitId === committee.mosqueId);
  if (!isAdmin && !isAmir) throw new Error("يحتاج دور أمير المسجد");
  if (input.newHead) {
    const { provisionCommitteeHead } = await import("./services/provisioning");
    const ou = (await db.select({ gt: orgUnits.genderTrack }).from(orgUnits).where(eq(orgUnits.id, committee.mosqueId)).all())[0];
    const gender = ou?.gt === "female" ? "female" : "male";
    try {
      const r = await provisionCommitteeHead(db, { committeeId: input.committeeId, mosqueOrgUnitId: committee.mosqueId, fullName: input.newHead.fullName, gender, login: input.newHead.login, password: input.newHead.password, createdBy: u.userId });
      return { ok: true as const, newAccount: { login: r.login } };
    } catch (e) { return { error: (e as Error).message } as { error: string }; }
  }
  await db.update(committees).set({ headName: input.headName?.trim() || null }).where(eq(committees.id, input.committeeId)).run();
  return { ok: true as const };
}

export async function addCommitteePlanData(input: { committeeId: string; title: string; recurring?: boolean; monthHijri?: string | null }) {
  const u = await requireUser();
  const db = useDb();
  const committee = (await db.select().from(committees).where(eq(committees.id, input.committeeId)).all())[0];
  if (!committee) throw new Error("اللجنة غير موجودة");
  if (!canManageCommittee(u, committee)) throw new Error("يحتاج دور أمير المسجد أو مسؤول اللجنة");
  const recurring = !!input.recurring;
  const id = crypto.randomUUID();
  await db.insert(committeePlans).values({
    id, committeeId: input.committeeId, title: input.title.trim(),
    recurring, monthHijri: recurring ? null : (input.monthHijri || null),
    status: "planned", createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

export async function setCommitteePlanStatusData(input: { planId: string; status: "planned" | "done" | "cancelled" }) {
  const u = await requireUser();
  const db = useDb();
  const plan = (await db.select().from(committeePlans).where(eq(committeePlans.id, input.planId)).all())[0];
  if (!plan) throw new Error("الخطة غير موجودة");
  const committee = (await db.select().from(committees).where(eq(committees.id, plan.committeeId)).all())[0];
  if (!committee || !canManageCommittee(u, committee)) throw new Error("يحتاج دور أمير المسجد أو مسؤول اللجنة");
  await db.update(committeePlans).set({ status: input.status }).where(eq(committeePlans.id, input.planId)).run();
  return { ok: true as const };
}
