// منطق التهيئة الإدارية (خادم فقط) — للإدارة العليا حصراً.
import { and, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { orgUnits, persons, users, roleAssignments, weeklyRecords, assets, supervisionVisits } from "./database/schema";
import { hashPassword } from "./utils/auth";
import { writeAudit } from "./utils/audit";
import { createOrgUnit } from "./services/orgUnits";
import { currentUser } from "./auth.server";
import { isGlobalAdmin, type AuthUser } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { userCaps } from "./permissions.server";

// رؤوسُ الطبقات التي لها نطاقٌ إداريّ (رأسُ القسم كان ناقصاً فيخرج نطاقه فارغاً فلا يدير شيئاً)
const SUPERVISOR_ROLES = ["section_head", "rabita", "square"];

// حارس مُقيَّد بالنطاق: يتطلّب القدرة، ويُرجع المستخدم وبادئات نطاقه (null = عالمي/الإدارة العليا).
async function requireScopedCap(cap: string): Promise<{ u: AuthUser; prefixes: string[] | null }> {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, cap)) throw new Error("لا تملك هذه الصلاحية");
  const prefixes = isGlobalAdmin(u)
    ? null
    : [...new Set(u.assignments.filter((a) => SUPERVISOR_ROLES.includes(a.role)).map((a) => a.orgPath))];
  return { u, prefixes };
}

// بوّابةُ القراءة الإداريّة: تكفي **أيُّ** قدرةِ إدارةٍ (لا admin.view وحدَها) — فمن يملك
// إنشاءَ وحدةٍ أو مستخدمٍ يلزمه أن يقرأ هيكليّته ومستخدميه، وإلّا فقدرتُه ميّتة (بلاغ الميدان ٢٠٢٦-٠٧-١٨).
const ADMIN_READ_CAPS = ["admin.view", "orgUnit.manage", "user.manage", "audit.view"];
async function requireAdminRead(): Promise<{ u: AuthUser; prefixes: string[] | null }> {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!ADMIN_READ_CAPS.some((cap) => hasCap(c, cap))) throw new Error("لا تملك هذه الصلاحية");
  const prefixes = isGlobalAdmin(u)
    ? null
    : [...new Set(u.assignments.filter((a) => SUPERVISOR_ROLES.includes(a.role)).map((a) => a.orgPath))];
  return { u, prefixes };
}

// يتحقّق أن المسار ضمن نطاق المستخدم (يرمي إن خرج عنه). null = عالمي.
function assertScope(prefixes: string[] | null, targetPath: string) {
  if (prefixes === null) return;
  if (!prefixes.some((p) => targetPath.startsWith(p))) throw new Error("خارج نطاقك");
}

// شخصٌ ضمن النطاق إن كان له تكليفٌ مساره داخل نطاق المستخدم.
async function assertPersonInScope(prefixes: string[] | null, personId: string) {
  if (prefixes === null) return;
  const db = useDb();
  const ras = await db.select({ op: roleAssignments.orgPath }).from(roleAssignments).where(eq(roleAssignments.personId, personId)).all();
  if (!ras.some((r) => prefixes.some((p) => r.op.startsWith(p)))) throw new Error("خارج نطاقك");
}

async function inChunks<T>(ids: string[], fn: (c: string[]) => Promise<T[]>, size = 80): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await fn(ids.slice(i, i + size))));
  return out;
}
const USERS_PAGE = 25;

export async function adminListOrgUnits() {
  const { prefixes } = await requireAdminRead();
  const db = useDb();
  const rows = await db.select().from(orgUnits).where(ne(orgUnits.status, "archived")).all();
  const scoped = prefixes === null ? rows : rows.filter((o) => prefixes.some((p) => o.path.startsWith(p)));
  const ids = new Set(scoped.map((o) => o.id));
  // جذور الشجرة الفرعية: إن كان الأب خارج النطاق، اجعل parentId=null كي تظهر الوحدة كجذر في الشجرة
  return scoped.map((o) => ({ id: o.id, name: o.name, type: o.type, parentId: o.parentId && ids.has(o.parentId) ? o.parentId : null, genderTrack: o.genderTrack, path: o.path, governorate: o.governorate, district: o.district }));
}

export async function adminUpdateOrgUnit(input: { id: string; name?: string; genderTrack?: "male" | "female"; governorate?: string | null; district?: string | null }) {
  const { u: a, prefixes } = await requireScopedCap("orgUnit.manage");
  const db = useDb();
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.id)).all())[0];
  if (!ou) return { error: "الوحدة غير موجودة" as const };
  assertScope(prefixes, ou.path);
  await db.update(orgUnits).set({
    name: input.name ?? ou.name,
    // ط٢: المسارُ مشتقٌّ من القسم دومًا (كتأسيس 0053) — لا نقبل قيمةً مستقلّةً تُعيد الانفصال
    genderTrack: ou.section === "women" ? "female" : "male",
    governorate: input.governorate === undefined ? ou.governorate : input.governorate,
    district: input.district === undefined ? ou.district : input.district,
  }).where(eq(orgUnits.id, input.id)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "update_org_unit", entity: "org_unit", entityId: input.id, after: { name: input.name, governorate: input.governorate, district: input.district } });
  return { ok: true as const };
}

// نقل وحدة (re-parent) — يحدّث المسار المادّي للوحدة وكل فروعها + المراجع المنسوخة (org_path/mosque_path)
export async function adminMoveOrgUnit(input: { id: string; newParentId: string }) {
  const { u: a, prefixes } = await requireScopedCap("orgUnit.manage");
  const db = useDb();
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.id)).all())[0];
  if (!ou) return { error: "الوحدة غير موجودة" as const };
  if (input.newParentId === input.id) return { error: "اختر أبًا مختلفًا" as const };
  const np = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.newParentId)).all())[0];
  if (!np) return { error: "الوحدة الأب غير موجودة" as const };
  assertScope(prefixes, ou.path);   // الوحدة المنقولة في النطاق
  assertScope(prefixes, np.path);   // والوجهة في النطاق
  if (np.path.startsWith(ou.path)) return { error: "لا يمكن نقل وحدة داخل أحد فروعها" as const };

  const oldPath = ou.path;
  const oldLen = oldPath.length;
  const newPath = `${np.path}${ou.id}/`;
  const likeOld = `${oldPath}%`;
  // تحديث المسار المادّي للوحدة وكل فروعها + المراجع المنسوخة (عبر باني drizzle — db.run(sql) لا ينفّذ هنا)
  await db.update(orgUnits).set({ path: sql`${newPath} || substr(path, ${oldLen + 1})` }).where(like(orgUnits.path, likeOld)).run();
  await db.update(orgUnits).set({ parentId: np.id }).where(eq(orgUnits.id, ou.id)).run();
  await db.update(roleAssignments).set({ orgPath: sql`${newPath} || substr(org_path, ${oldLen + 1})` }).where(like(roleAssignments.orgPath, likeOld)).run();
  await db.update(weeklyRecords).set({ mosquePath: sql`${newPath} || substr(mosque_path, ${oldLen + 1})` }).where(like(weeklyRecords.mosquePath, likeOld)).run();
  // ط٢: مسّرْ بقيّةَ الأعمدة المنسوخة أيضًا — كان النقلُ يتركها فتنجرف عزلةُ النطاق (أصلٌ يختفي/يتسرّب، سجلٌّ نسائيٌّ يُخطئ)
  await db.update(weeklyRecords).set({ unitPath: sql`${newPath} || substr(unit_path, ${oldLen + 1})` }).where(like(weeklyRecords.unitPath, likeOld)).run();
  await db.update(assets).set({ orgPath: sql`${newPath} || substr(org_path, ${oldLen + 1})` }).where(like(assets.orgPath, likeOld)).run();
  await db.update(supervisionVisits).set({ submitterPath: sql`${newPath} || substr(submitter_path, ${oldLen + 1})` }).where(like(supervisionVisits.submitterPath, likeOld)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "move_org_unit", entity: "org_unit", entityId: input.id, before: { path: oldPath }, after: { path: newPath } });
  return { ok: true as const };
}

export async function adminArchiveOrgUnit(input: { id: string }) {
  const { u: a, prefixes } = await requireScopedCap("orgUnit.manage");
  const db = useDb();
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.id)).all())[0];
  if (!ou) return { error: "الوحدة غير موجودة" as const };
  assertScope(prefixes, ou.path);
  const kids = (await db.select({ c: sql<number>`count(*)` }).from(orgUnits).where(and(eq(orgUnits.parentId, input.id), ne(orgUnits.status, "archived"))).all())[0]?.c ?? 0;
  if (kids > 0) return { error: "انقل أو أرشِف الوحدات التابعة أولًا" as const };
  await db.update(orgUnits).set({ status: "archived" }).where(eq(orgUnits.id, input.id)).run();
  // ط٢: أنهِ تكاليفَ الوحدة المؤرشفة (لا يبقى أحدٌ «أميرًا» لمسجدٍ مؤرشف)
  await db.update(roleAssignments).set({ endDate: Date.now() }).where(and(eq(roleAssignments.orgUnitId, input.id), isNull(roleAssignments.endDate))).run();
  await writeAudit(db, { actorUserId: a.userId, action: "archive_org_unit", entity: "org_unit", entityId: input.id, after: { status: "archived" } });
  return { ok: true as const };
}

export async function adminCreateOrgUnit(input: {
  parentId: string | null; type: string; section?: string; genderTrack: string; name: string; governorate?: string; district?: string;
}) {
  const { u, prefixes } = await requireScopedCap("orgUnit.manage");
  const db = useDb();
  if (input.parentId) {
    const parent = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.parentId)).all())[0];
    if (!parent) return { error: "الوحدة الأب غير موجودة" as const };
    assertScope(prefixes, parent.path);   // الإنشاء تحت أبٍ ضمن النطاق
  } else if (prefixes !== null) {
    return { error: "لا يمكنك إنشاء وحدة جذرية" as const };
  }
  try {
    const res = await createOrgUnit(db, input, u.userId); // القسم يُورَّث من الأب ويُتحقَّق تناسق النوع/القسم
    return { ok: true as const, id: res.id };
  } catch (e) {
    return { error: (e as Error).message || "تعذّر الإنشاء" as const };
  }
}

export async function adminCreateUserWithRole(input: {
  fullName: string; login: string; password: string; gender: "male" | "female";
  role: string; orgUnitId: string; portfolio?: string;
}) {
  const { u: granter, prefixes } = await requireScopedCap("user.manage");
  // ق٣: رأس القسم يملك قدراتٍ عابرةً للنطاق (مكتبةٌ عامّة…) فلا يمنحه إلا الإدارة العليا — كمنع دور admin
  if (!isGlobalAdmin(granter) && (input.role === "admin" || input.role === "section_head")) return { error: "منح هذا الدور للإدارة العليا فقط" as const };
  const db = useDb();
  const exists = (await db.select().from(users).where(eq(users.login, input.login)).all())[0];
  if (exists) return { error: "اسم الدخول مستخدم" as const };
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0];
  if (!ou) return { error: "الوحدة التنظيمية غير موجودة" as const };
  assertScope(prefixes, ou.path);   // منح الدور ضمن النطاق فقط

  const personId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = Date.now();
  await db.insert(persons).values({
    id: personId, fullName: input.fullName, gender: input.gender, birthYearHijri: null,
    homeOrgUnitId: ou.id, status: "active", createdAt: now,
  }).run();
  await db.insert(users).values({
    id: userId, personId, login: input.login, passwordHash: await hashPassword(input.password),
    lastLogin: null, mfaSecret: null, mfaEnabled: false, createdAt: now,
  }).run();
  await db.insert(roleAssignments).values({
    id: crypto.randomUUID(), personId, role: input.role, orgUnitId: ou.id, orgPath: ou.path,
    portfolio: input.portfolio ?? null, startDate: now, endDate: null, termNumber: 1,
    approvalStatus: "approved", approvedBy: granter.userId, createdAt: now,
  }).run();
  return { ok: true as const, login: input.login };
}

/* ===== لوحة المستخدمين (CRUD كامل) ===== */

// قائمة المستخدمين مُصفّحة + بحث بالاسم/الدخول، مع أدوارهم ونطاقاتهم
export async function adminListUsers(q?: string, offset = 0) {
  const { prefixes } = await requireAdminRead();
  const db = useDb();
  const term = (q ?? "").trim();
  const search = term ? or(like(persons.fullName, `%${term}%`), like(users.login, `%${term}%`)) : undefined;

  // عزل النطاق: اقصر القائمة على الأشخاص الذين لهم تكليفٌ ضمن شجرة المستخدم.
  // عبر استعلام فرعي في SQL (لا قائمة معرّفات) — يتوسّع لمئات الأمراء دون تجاوز حدّ معاملات D1.
  let scopeCond = undefined as ReturnType<typeof inArray> | undefined;
  if (prefixes !== null) {
    const scopeOr = or(...prefixes.map((p) => like(roleAssignments.orgPath, `${p}%`)));
    scopeCond = inArray(persons.id, db.select({ id: roleAssignments.personId }).from(roleAssignments).where(scopeOr));
  }
  const cond = scopeCond && search ? and(scopeCond, search) : (scopeCond ?? search);

  const page = await db.select({
    uid: users.id, pid: persons.id, name: persons.fullName, login: users.login,
    gender: persons.gender, status: persons.status, statusReason: persons.statusReason, lastLogin: users.lastLogin,
  }).from(users).innerJoin(persons, eq(persons.id, users.personId))
    .where(cond).orderBy(desc(users.createdAt)).limit(USERS_PAGE).offset(offset).all();
  const totalRows = await db.select({ c: sql<number>`count(*)` }).from(users)
    .innerJoin(persons, eq(persons.id, users.personId)).where(cond).all();

  const pids = page.map((r) => r.pid);
  const ras = pids.length ? await inChunks(pids, (c) => db.select().from(roleAssignments).where(inArray(roleAssignments.personId, c)).all()) : [];
  const ouIds = [...new Set(ras.map((r) => r.orgUnitId))];
  const ous = ouIds.length ? await inChunks(ouIds, (c) => db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, c)).all()) : [];
  const ouName = new Map(ous.map((o) => [o.id, o.name]));

  const items = page.map((u) => ({
    personId: u.pid, userId: u.uid, name: u.name, login: u.login, gender: u.gender, status: u.status, statusReason: u.statusReason, lastLogin: u.lastLogin,
    roles: ras.filter((r) => r.personId === u.pid).map((r) => ({ id: r.id, role: r.role, scope: ouName.get(r.orgUnitId) ?? "—", pending: r.approvalStatus === "pending" })),
  }));
  return { items, total: totalRows[0]?.c ?? 0, offset, pageSize: USERS_PAGE };
}

// مستخدمو وحدةٍ بعينها (تحميل كسول لعقدة في شجرة المستخدمين) — معزول بالنطاق
export async function adminUnitUsers(unitId: string) {
  const { prefixes } = await requireAdminRead();
  const db = useDb();
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!unit) return [];
  assertScope(prefixes, unit.path);
  const ras = await db.select().from(roleAssignments).where(and(eq(roleAssignments.orgUnitId, unitId), isNull(roleAssignments.endDate))).all();
  const pids = [...new Set(ras.map((r) => r.personId))];
  if (!pids.length) return [];
  const prows = await inChunks(pids, (c) => db.select({ pid: persons.id, name: persons.fullName, gender: persons.gender, status: persons.status, statusReason: persons.statusReason }).from(persons).where(inArray(persons.id, c)).all());
  const urows = await inChunks(pids, (c) => db.select({ pid: users.personId, uid: users.id, login: users.login, lastLogin: users.lastLogin }).from(users).where(inArray(users.personId, c)).all());
  const allRas = await inChunks(pids, (c) => db.select().from(roleAssignments).where(inArray(roleAssignments.personId, c)).all());
  const ouIds = [...new Set(allRas.map((r) => r.orgUnitId))];
  const ous = ouIds.length ? await inChunks(ouIds, (c) => db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, c)).all()) : [];
  const ouName = new Map(ous.map((o) => [o.id, o.name]));
  const uByPid = new Map(urows.map((u) => [u.pid, u]));
  return prows.filter((p) => uByPid.has(p.pid)).map((p) => {
    const u = uByPid.get(p.pid)!;
    return {
      personId: p.pid, userId: u.uid, name: p.name, login: u.login, gender: p.gender, status: p.status, statusReason: p.statusReason, lastLogin: u.lastLogin,
      roles: allRas.filter((r) => r.personId === p.pid && !r.endDate).map((r) => ({ id: r.id, role: r.role, scope: ouName.get(r.orgUnitId) ?? "—", pending: r.approvalStatus === "pending" })),
    };
  });
}

export async function adminUpdateUser(input: { personId: string; fullName?: string; login?: string; gender?: "male" | "female" }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  await assertPersonInScope(prefixes, input.personId);
  const db = useDb();
  const person = (await db.select().from(persons).where(eq(persons.id, input.personId)).all())[0];
  if (!person) return { error: "المستخدم غير موجود" as const };
  if (input.login) {
    const clash = (await db.select().from(users).where(eq(users.login, input.login)).all())[0];
    if (clash && clash.personId !== input.personId) return { error: "اسم الدخول مستخدم" as const };
    await db.update(users).set({ login: input.login }).where(eq(users.personId, input.personId)).run();
  }
  await db.update(persons).set({
    fullName: input.fullName ?? person.fullName, gender: input.gender ?? person.gender,
  }).where(eq(persons.id, input.personId)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "update_user", entity: "person", entityId: input.personId, after: { fullName: input.fullName, login: input.login } });
  return { ok: true as const };
}

// دورة حياة الحساب: تجميد (disabled) / إلغاء ناعم (deleted) / إعادة تفعيل (active).
// أيُّ حالةٍ غير active ترفع session_epoch ⇒ إبطالُ كلّ جلسات الحساب لحظيًّا (خروجٌ فوريّ).
export async function adminSetUserStatus(input: { personId: string; status: "active" | "disabled" | "deleted"; reason?: string }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  await assertPersonInScope(prefixes, input.personId);
  const db = useDb();
  const now = Date.now();
  const reason = input.status === "active" ? null : (input.reason?.trim() || null);
  await db.update(persons).set({
    status: input.status, statusReason: reason, statusChangedBy: a.userId, statusChangedAt: now,
  }).where(eq(persons.id, input.personId)).run();
  if (input.status !== "active") {
    await db.update(users).set({ sessionEpoch: sql`${users.sessionEpoch} + 1` }).where(eq(users.personId, input.personId)).run();
  }
  // ط٢: الإلغاءُ الناعم يُنهي تكاليفَ الشخص (لا يبقى شبحًا في توجيه الإشعارات ولا في الاعتماد)
  if (input.status === "deleted") {
    await db.update(roleAssignments).set({ endDate: now }).where(and(eq(roleAssignments.personId, input.personId), isNull(roleAssignments.endDate))).run();
  }
  await writeAudit(db, { actorUserId: a.userId, action: "set_user_status", entity: "person", entityId: input.personId, after: { status: input.status, reason } });
  return { ok: true as const };
}

export async function adminResetPassword(input: { personId: string; password: string }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  await assertPersonInScope(prefixes, input.personId);
  if (input.password.length < 6) return { error: "كلمة المرور قصيرة" as const };
  const db = useDb();
  // تغيير كلمة المرور يُبطل الجلسات القائمة (رفع session_epoch) — ممارسةٌ أمنيّةٌ قياسية
  await db.update(users).set({ passwordHash: await hashPassword(input.password), sessionEpoch: sql`${users.sessionEpoch} + 1` }).where(eq(users.personId, input.personId)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "reset_password", entity: "user", entityId: input.personId, after: {} });
  return { ok: true as const };
}

export async function adminUpdateRole(input: { assignmentId: string; role: string; orgUnitId: string }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  if (!isGlobalAdmin(a) && (input.role === "admin" || input.role === "section_head")) return { error: "منح هذا الدور للإدارة العليا فقط" as const }; // ق٣
  const db = useDb();
  const cur = (await db.select().from(roleAssignments).where(eq(roleAssignments.id, input.assignmentId)).all())[0];
  if (!cur) return { error: "التكليف غير موجود" as const };
  assertScope(prefixes, cur.orgPath);   // التكليف الحالي في النطاق
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0];
  if (!ou) return { error: "الوحدة التنظيمية غير موجودة" as const };
  assertScope(prefixes, ou.path);       // والوجهة في النطاق
  await db.update(roleAssignments).set({ role: input.role, orgUnitId: ou.id, orgPath: ou.path }).where(eq(roleAssignments.id, input.assignmentId)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "update_role", entity: "role_assignment", entityId: input.assignmentId, after: { role: input.role, orgUnitId: ou.id } });
  return { ok: true as const };
}

export async function adminApproveRole(input: { assignmentId: string }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  const db = useDb();
  const cur = (await db.select().from(roleAssignments).where(eq(roleAssignments.id, input.assignmentId)).all())[0];
  if (!cur) return { error: "التكليف غير موجود" as const };
  assertScope(prefixes, cur.orgPath);
  await db.update(roleAssignments).set({ approvalStatus: "approved", approvedBy: a.userId }).where(eq(roleAssignments.id, input.assignmentId)).run();
  return { ok: true as const };
}

export async function adminRemoveRole(input: { assignmentId: string }) {
  const { u: a, prefixes } = await requireScopedCap("user.manage");
  const db = useDb();
  const cur = (await db.select().from(roleAssignments).where(eq(roleAssignments.id, input.assignmentId)).all())[0];
  if (!cur) return { error: "التكليف غير موجود" as const };
  assertScope(prefixes, cur.orgPath);
  await db.update(roleAssignments).set({ endDate: Date.now() }).where(eq(roleAssignments.id, input.assignmentId)).run();
  await writeAudit(db, { actorUserId: a.userId, action: "remove_role", entity: "role_assignment", entityId: input.assignmentId, after: { ended: true } });
  return { ok: true as const };
}
