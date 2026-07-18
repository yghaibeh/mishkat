// منطق وحدة «على بصيرة» (خادم فقط) — المعلّم/الحلقة/المكان/الجلسة (ق8/ق9).
import { and, eq, desc, like, inArray, or, sql, isNull } from "drizzle-orm";
import { useDb, getCloudflareEnv } from "./utils/db";
import { venues, teachers, halaqat, enrollments, lessonSessions, persons, users, rateSchemes, weeklyHalaqaRecords, halaqaGroupActivities, studentEvaluations, orgUnits, lessonAttachments, lessonAttendance, curriculumProgress, roleAssignments } from "./database/schema";
import { hijriMonthKey, hijriDateStr, weekStartSaturday, weekHijriRange } from "./utils/week";
import { currentUser } from "./auth.server";
import { isGlobalAdmin, type AuthUser } from "./utils/context";
import {
  createVenue, createTeacher, createHalaqa, enrollStudent,
} from "./services/alaBaseera";
import { addGroupActivity, upsertWeeklyHalaqaRecord, addStudentEvaluation } from "./services/halaqaWeekly";

async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  return u;
}

// هل تقع الوحدةُ ضمن نطاق المستخدم؟ (إدارةٌ عليا ⇒ نعم؛ وإلا مسارُ إحدى تكاليفه يغطّيها) — ق٣
async function inAlaBaseeraScope(u: NonNullable<Awaited<ReturnType<typeof currentUser>>>, db: ReturnType<typeof useDb>, orgUnitId: string | null | undefined): Promise<boolean> {
  if (u.assignments.some((a) => a.role === "admin")) return true;
  if (!orgUnitId) return false; // غير الإدارة يلزمه وحدةٌ محدَّدةٌ ضمن نطاقه
  const ou = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, orgUnitId)).all())[0];
  if (!ou) return false;
  return u.assignments.some((a) => a.orgPath && ou.path.startsWith(a.orgPath));
}

// عمليات الكتابة: الإدارة العليا أو أي أمير مسجد
async function requireAlaBáseeraManage() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const isAdmin = u.assignments.some((a) => a.role === "admin");
  const isAmir = u.assignments.some((a) => a.role === "amir");
  if (!isAdmin && !isAmir) throw new Error("يحتاج دور أمير مسجد أو إدارة عليا");
  return u;
}

async function currentHourlyRate(db: ReturnType<typeof useDb>) {
  const rows = await db.select().from(rateSchemes).where(and(eq(rateSchemes.kind, "hourly_rate"), eq(rateSchemes.active, true)))
    .orderBy(desc(rateSchemes.validFrom)).all();
  return rows[0]?.amount ?? 0;
}

const HALAQAT_PAGE = 20;

async function count(query: { all: () => Promise<Array<{ c: number }>> }) {
  const rows = await query.all();
  return rows[0]?.c ?? 0;
}

// بادئات نطاق المستخدم على الشجرة — القسم للإدارة العليا، وإلا مسارات تكليفاته (عزل القسم)
function userScopePrefixes(u: AuthUser, section?: string): string[] {
  if (isGlobalAdmin(u)) return [`/${section === "women" ? "women" : "men"}/`];
  const paths = [...new Set(u.assignments.map((a) => a.orgPath).filter(Boolean))];
  return paths.length ? paths : ["/__none__/"]; // لا نطاق ⇒ لا شيء
}

// معرّفات الحلقات ضمن نطاق المستخدم — عبر مكان الحلقة (venue.orgUnitId) ومساره في الشجرة.
// يُغلق تسرّب الحلقات عبر القسم/المحافظة (كل حلقة تظهر فقط لمن يغطّي وحدتها).
async function inScopeHalaqaIds(db: ReturnType<typeof useDb>, u: AuthUser, section?: string): Promise<string[]> {
  const prefixes = userScopePrefixes(u, section);
  const rows = await db.select({ id: halaqat.id }).from(halaqat)
    .innerJoin(venues, eq(venues.id, halaqat.venueId))
    .innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId))
    .where(or(...prefixes.map((p) => like(orgUnits.path, `${p}%`))))
    .all();
  return rows.map((r) => r.id);
}

// مؤشرات الوحدة عبر COUNT/SUM في SQL — لا يحمّل أي صفوف. يتوسّع لعشرات الآلاف.
export async function alaBaseeraData(section?: string) {
  const u = await requireUser();
  const db = useDb();
  const rate = await currentHourlyRate(db);

  // عزل النطاق: لا تُحتسب إلا حلقات ضمن شجرة المستخدم (قسمه) — لا كل حلقات المشروع
  const ids = await inScopeHalaqaIds(db, u, section);
  if (!ids.length) return { rate, month: null, kpis: { halaqat: 0, teachers: 0, students: 0, hoursMonth: 0, hoursValue: 0 } };

  const scoped = await db.select({ id: halaqat.id, teacherId: halaqat.teacherId }).from(halaqat).where(inArray(halaqat.id, ids)).all();
  const teacherCount = new Set(scoped.map((h) => h.teacherId)).size;
  const eCount = await count(db.select({ c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))));
  const monthRow = await db.select({ m: sql<string | null>`max(hijri_month)` }).from(lessonSessions).where(inArray(lessonSessions.halaqaId, ids)).all();
  const month = (monthRow[0]?.m as string | null) ?? null;
  const hoursRow = month
    ? await db.select({ h: sql<number>`coalesce(sum(duration_hours),0)` }).from(lessonSessions).where(and(eq(lessonSessions.hijriMonth, month), inArray(lessonSessions.halaqaId, ids))).all()
    : null;
  const hoursMonth = hoursRow ? Math.round((hoursRow[0]?.h ?? 0) * 10) / 10 : 0;

  return {
    rate,
    month,
    kpis: {
      halaqat: ids.length, teachers: teacherCount, students: eCount,
      hoursMonth, hoursValue: Math.round(hoursMonth * rate * 100) / 100,
    },
  };
}

// قائمة الحلقات مُصفّحة وقابلة للبحث — مُقيَّدة بنطاق المستخدم (عزل القسم).
export async function listHalaqat(q?: string, offset = 0, section?: string) {
  const u = await requireUser();
  const db = useDb();
  const term = (q ?? "").trim();
  const scopeIds = await inScopeHalaqaIds(db, u, section);
  if (!scopeIds.length) return { items: [], total: 0, offset, pageSize: HALAQAT_PAGE };
  const filter = and(eq(halaqat.status, "active"), inArray(halaqat.id, scopeIds), term ? like(halaqat.name, `%${term}%`) : undefined);

  const page = await db.select().from(halaqat).where(filter)
    .orderBy(desc(halaqat.createdAt)).limit(HALAQAT_PAGE).offset(offset).all();
  const total = await count(db.select({ c: sql<number>`count(*)` }).from(halaqat).where(filter));

  const ids = page.map((h) => h.id);
  const teacherIds = [...new Set(page.map((h) => h.teacherId))];
  const venueIds = [...new Set(page.map((h) => h.venueId))];

  const ts = teacherIds.length
    ? await db.select({ id: teachers.id, name: persons.fullName }).from(teachers)
        .innerJoin(persons, eq(persons.id, teachers.personId)).where(inArray(teachers.id, teacherIds)).all()
    : [];
  const vs = venueIds.length ? await db.select().from(venues).where(inArray(venues.id, venueIds)).all() : [];
  const enr = ids.length
    ? await db.select({ h: enrollments.halaqaId, c: sql<number>`count(*)` }).from(enrollments)
        .where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))).groupBy(enrollments.halaqaId).all()
    : [];
  const hrs = ids.length
    ? await db.select({ h: lessonSessions.halaqaId, s: sql<number>`coalesce(sum(duration_hours),0)` }).from(lessonSessions)
        .where(inArray(lessonSessions.halaqaId, ids)).groupBy(lessonSessions.halaqaId).all()
    : [];

  const tName = new Map(ts.map((t) => [t.id, t.name]));
  const vName = new Map(vs.map((v) => [v.id, v.name]));
  const sCount = new Map(enr.map((e) => [e.h, e.c]));
  const hHours = new Map(hrs.map((x) => [x.h, x.s]));

  const items = page.map((h) => ({
    id: h.id, name: h.name, teacherName: tName.get(h.teacherId) ?? "—", venueName: vName.get(h.venueId) ?? "—",
    genderTrack: h.genderTrack, capacity: h.capacity,
    students: sCount.get(h.id) ?? 0, hours: Math.round((hHours.get(h.id) ?? 0) * 10) / 10,
  }));
  return { items, total, offset, pageSize: HALAQAT_PAGE };
}

// الحلقات ضمن شجرة الهيكلية (منطقة→مربع→مسجد/حلقة نسائية) — لتفادي اختلاط الأسماء المتشابهة.
// تُرجع وحدات النطاق + الحلقات منسوبةً لوحدتها (venue.orgUnitId)؛ يبني العميل الشجرة من parentId.
// عتبة التحوّل للوضع الكسول: فوقها لا نُحمّل كل الأوراق دفعةً، بل عند فتح كل وحدة.
const TREE_LAZY_THRESHOLD = 500;

type TreeHalaqa = { id: string; name: string; unitId: string; genderTrack: string | null; capacity: number | null; teacherName: string; students: number; hours: number };

// أوراق «على بصيرة» لوحدةٍ واحدة (venue.orgUnitId === unitId) — لتحميل الشجرة الكسول.
export async function unitHalaqatLeavesData(unitId: string) {
  const u = await requireUser();
  const db = useDb();
  const prefixes = userScopePrefixes(u);
  const unit = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!unit || !prefixes.some((p) => unit.path.startsWith(p))) return { halaqat: [] as TreeHalaqa[] };

  const hRows = await db.select({ id: halaqat.id, name: halaqat.name, teacherId: halaqat.teacherId, unitId: venues.orgUnitId, genderTrack: halaqat.genderTrack, capacity: halaqat.capacity })
    .from(halaqat).innerJoin(venues, eq(venues.id, halaqat.venueId))
    .where(and(eq(venues.orgUnitId, unitId), eq(halaqat.status, "active"))).all();
  const ids = hRows.map((h) => h.id);
  const teacherIds = [...new Set(hRows.map((h) => h.teacherId))];
  const ts = teacherIds.length
    ? await db.select({ id: teachers.id, name: persons.fullName }).from(teachers).innerJoin(persons, eq(persons.id, teachers.personId)).where(inArray(teachers.id, teacherIds)).all()
    : [];
  const enr = ids.length
    ? await db.select({ h: enrollments.halaqaId, c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))).groupBy(enrollments.halaqaId).all()
    : [];
  const hrs = ids.length
    ? await db.select({ h: lessonSessions.halaqaId, s: sql<number>`coalesce(sum(duration_hours),0)` }).from(lessonSessions).where(inArray(lessonSessions.halaqaId, ids)).groupBy(lessonSessions.halaqaId).all()
    : [];
  const tName = new Map(ts.map((t) => [t.id, t.name]));
  const sCount = new Map(enr.map((e) => [e.h, e.c]));
  const hHours = new Map(hrs.map((x) => [x.h, x.s]));
  return {
    halaqat: hRows.map((h): TreeHalaqa => ({
      id: h.id, name: h.name, unitId: h.unitId as string, genderTrack: h.genderTrack, capacity: h.capacity,
      teacherName: tName.get(h.teacherId) ?? "—",
      students: sCount.get(h.id) ?? 0, hours: Math.round((hHours.get(h.id) ?? 0) * 10) / 10,
    })),
  };
}

export async function halaqatTreeData(section?: string) {
  const u = await requireUser();
  const db = useDb();
  const prefixes = userScopePrefixes(u, section);
  const scopeOr = or(...prefixes.map((p) => like(orgUnits.path, `${p}%`)));

  const units = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type, parentId: orgUnits.parentId })
    .from(orgUnits).where(scopeOr).all();

  // عدّ الأوراق لكل وحدة (GROUP BY) — رخيصٌ ويكفي للشارات وقرار التحوّل الكسول
  const countRows = await db.select({ unitId: venues.orgUnitId, c: sql<number>`count(*)` })
    .from(halaqat).innerJoin(venues, eq(venues.id, halaqat.venueId)).innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId))
    .where(and(scopeOr, eq(halaqat.status, "active"))).groupBy(venues.orgUnitId).all();
  const total = countRows.reduce((s, r) => s + Number(r.c), 0);

  // فوق العتبة: وضعٌ كسول — نُعيد الأعداد فقط، وتُحمَّل أوراق كل وحدة عند فتحها
  if (total > TREE_LAZY_THRESHOLD) {
    const counts: Record<string, number> = {};
    for (const r of countRows) counts[r.unitId as string] = Number(r.c);
    // نشر العدّ للأصول ليظهر في شارات الفروع العليا
    const byId = new Map(units.map((x) => [x.id, x]));
    const subtree: Record<string, number> = {};
    for (const un of units) {
      let cur: typeof un | undefined = un;
      const own = counts[un.id] ?? 0;
      if (!own) continue;
      while (cur) { subtree[cur.id] = (subtree[cur.id] ?? 0) + own; cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    }
    return { units, halaqat: [] as TreeHalaqa[], lazy: true as const, counts: subtree };
  }

  const hRows = await db.select({ id: halaqat.id, name: halaqat.name, teacherId: halaqat.teacherId, unitId: venues.orgUnitId, genderTrack: halaqat.genderTrack, capacity: halaqat.capacity })
    .from(halaqat).innerJoin(venues, eq(venues.id, halaqat.venueId)).innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId))
    .where(and(scopeOr, eq(halaqat.status, "active"))).all();

  const ids = hRows.map((h) => h.id);
  const teacherIds = [...new Set(hRows.map((h) => h.teacherId))];
  const ts = teacherIds.length
    ? await db.select({ id: teachers.id, name: persons.fullName }).from(teachers).innerJoin(persons, eq(persons.id, teachers.personId)).where(inArray(teachers.id, teacherIds)).all()
    : [];
  const enr = ids.length
    ? await db.select({ h: enrollments.halaqaId, c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))).groupBy(enrollments.halaqaId).all()
    : [];
  const hrs = ids.length
    ? await db.select({ h: lessonSessions.halaqaId, s: sql<number>`coalesce(sum(duration_hours),0)` }).from(lessonSessions).where(inArray(lessonSessions.halaqaId, ids)).groupBy(lessonSessions.halaqaId).all()
    : [];
  const tName = new Map(ts.map((t) => [t.id, t.name]));
  const sCount = new Map(enr.map((e) => [e.h, e.c]));
  const hHours = new Map(hrs.map((x) => [x.h, x.s]));

  return {
    units,
    lazy: false as const,
    counts: undefined as Record<string, number> | undefined,
    halaqat: hRows.map((h): TreeHalaqa => ({
      id: h.id, name: h.name, unitId: h.unitId as string, genderTrack: h.genderTrack, capacity: h.capacity,
      teacherName: tName.get(h.teacherId) ?? "—",
      students: sCount.get(h.id) ?? 0, hours: Math.round((hHours.get(h.id) ?? 0) * 10) / 10,
    })),
  };
}

// حلقات «على بصيرة» الخاصة بمسجد واحد (تبويب على بصيرة داخل صفحة المسجد) — مفلترة عبر venue.orgUnitId.
export async function mosqueHalaqatData(mosqueId: string, offset = 0) {
  const { requireMosqueAccess } = await import("./utils/scope");
  await requireMosqueAccess(mosqueId);
  const db = useDb();
  const vrows = await db.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.orgUnitId, mosqueId)).all();
  const venueIds = vrows.map((v) => v.id);
  if (!venueIds.length) return { kpis: { halaqat: 0, students: 0, hours: 0 }, items: [], total: 0, offset, pageSize: HALAQAT_PAGE };

  const filter = and(inArray(halaqat.venueId, venueIds), eq(halaqat.status, "active"));
  const allIds = (await db.select({ id: halaqat.id }).from(halaqat).where(filter).all()).map((h) => h.id);
  const total = allIds.length;
  const students = allIds.length
    ? await count(db.select({ c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, allIds))))
    : 0;
  const hoursRow = allIds.length
    ? await db.select({ h: sql<number>`coalesce(sum(duration_hours),0)` }).from(lessonSessions).where(inArray(lessonSessions.halaqaId, allIds)).all()
    : null;
  const hours = hoursRow ? Math.round((hoursRow[0]?.h ?? 0) * 10) / 10 : 0;

  const page = await db.select().from(halaqat).where(filter).orderBy(desc(halaqat.createdAt)).limit(HALAQAT_PAGE).offset(offset).all();
  const teacherIds = [...new Set(page.map((h) => h.teacherId))];
  const ts = teacherIds.length
    ? await db.select({ id: teachers.id, name: persons.fullName }).from(teachers).innerJoin(persons, eq(persons.id, teachers.personId)).where(inArray(teachers.id, teacherIds)).all()
    : [];
  const ids = page.map((h) => h.id);
  const enr = ids.length
    ? await db.select({ h: enrollments.halaqaId, c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))).groupBy(enrollments.halaqaId).all()
    : [];
  const tName = new Map(ts.map((t) => [t.id, t.name]));
  const vName = new Map(vrows.map((v) => [v.id, v.name]));
  const sCount = new Map(enr.map((e) => [e.h, e.c]));
  const items = page.map((h) => ({
    id: h.id, name: h.name, teacherName: tName.get(h.teacherId) ?? "—", venueName: vName.get(h.venueId) ?? "—",
    genderTrack: h.genderTrack, capacity: h.capacity, students: sCount.get(h.id) ?? 0,
  }));
  return { kpis: { halaqat: total, students, hours }, items, total, offset, pageSize: HALAQAT_PAGE };
}

export async function createVenueData(input: { type: string; name: string; orgUnitId?: string; genderTrack?: string }) {
  const u = await requireAlaBáseeraManage();
  const db = useDb();
  // ق٣: أميرٌ لا يُنشئ مكانًا خارج نطاقه — كان أيُّ أميرٍ يُنشئ مكانًا لأيّ وحدة (وحتى القسم الآخر)
  if (input.orgUnitId && !(await inAlaBaseeraScope(u, db, input.orgUnitId))) return { error: "الوحدة خارج نطاقك" as const };
  const res = await createVenue(db, input);
  return { ok: true as const, id: res.id };
}

export async function createTeacherData(input: { personId: string; qualification?: string }) {
  await requireAlaBáseeraManage();
  const res = await createTeacher(useDb(), input);
  return { ok: true as const, id: res.id };
}

// إنشاءُ حلقة: يُختار معلّمٌ قائم (teacherId) أو يُنشأ حسابٌ جديدٌ للمعلّم (newTeacher: اسم+دخول+كلمة مرور)
// فيديرَ حلقتَه بنفسه. المعلّمُ دائمًا حسابٌ مربوطٌ (لا اسمٌ نصّيّ) — يليق بالطريقة العالميّة.
export async function createHalaqaData(input: { name: string; venueId: string; teacherId?: string; genderTrack?: string; capacity?: number; curriculum?: string; newTeacher?: { fullName: string; login: string; password: string } }) {
  const u = await requireAlaBáseeraManage();
  const db = useDb();
  // ق٣: الحلقةُ لا تُنشأ إلا في مكانٍ يقع ضمن نطاق المُنشئ (يمنع حقن حلقةٍ في وحدة/قسم آخر)
  const venue = (await db.select().from(venues).where(eq(venues.id, input.venueId)).all())[0];
  if (!venue) return { error: "المكان غير موجود" as const };
  if (!(await inAlaBaseeraScope(u, db, venue.orgUnitId))) return { error: "المكان خارج نطاقك" as const };
  let teacherId = input.teacherId;
  let newAccount: { login: string } | undefined;
  if (input.newTeacher) {
    if (!venue.orgUnitId) return { error: "لا يمكن إنشاءُ حسابِ معلّمٍ لمكانٍ بلا وحدةٍ تنظيميّة" as const };
    const gender = input.genderTrack === "female" ? "female" : "male";
    const { provisionTeacher } = await import("./services/provisioning");
    try {
      const t = await provisionTeacher(db, { mosqueOrgUnitId: venue.orgUnitId, fullName: input.newTeacher.fullName, gender, login: input.newTeacher.login, password: input.newTeacher.password, createdBy: u.userId });
      teacherId = t.teacherId; newAccount = { login: t.login };
    } catch (e) { return { error: (e as Error).message } as { error: string }; }
  }
  if (!teacherId) return { error: "اختر معلّمًا قائمًا أو أنشئ حسابًا جديدًا للمعلّم" as const };
  const res = await createHalaqa(db, { name: input.name, venueId: input.venueId, teacherId, genderTrack: input.genderTrack, capacity: input.capacity, curriculum: input.curriculum });
  return { ok: true as const, id: res.id, newAccount };
}

export async function enrollStudentData(halaqaId: string, personId: string) {
  await halaqaInScope(halaqaId);   // أمير المكان أو المدرّس المالك أو الإدارة
  const res = await enrollStudent(useDb(), halaqaId, personId);
  return "error" in res && res.error ? { error: res.error } : { ok: true as const };
}

// ===== التقييم الأسبوعي للحلقة (ملاحظات الإشراف + الأنشطة الجماعية + تقييم الطلاب) =====

// أدوار المستخدم تجاه حلقةٍ بعينها — أساسٌ للفصل بين «الإدخال» (المعلّم/الأمير) و«الإشراف» (المدير/المشرف)
async function halaqaRoles(halaqaId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const h = (await db.select().from(halaqat).where(eq(halaqat.id, halaqaId)).all())[0];
  if (!h) throw new Error("الحلقة غير موجودة");
  const v = (await db.select().from(venues).where(eq(venues.id, h.venueId)).all())[0];
  const unitPath = v?.orgUnitId ? (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, v.orgUnitId)).all())[0]?.path ?? null : null;
  const t = (await db.select({ personId: teachers.personId }).from(teachers).where(eq(teachers.id, h.teacherId)).all())[0];
  const isAdmin = u.assignments.some((a) => a.role === "admin");
  const isAmir = !!v?.orgUnitId && u.assignments.some((a) => a.role === "amir" && a.orgUnitId === v.orgUnitId);
  const isSupervisor = !!unitPath && u.assignments.some((a) => (a.role === "rabita" || a.role === "square") && unitPath.startsWith(a.orgPath));
  const isOwnerTeacher = !!t && t.personId === u.personId;
  return { u, h, v, unitPath, isAdmin, isAmir, isSupervisor, isOwnerTeacher };
}

// نطاق الإدخال/التحرير: المعلّم المالك أو أمير المكان فقط (المدير/المشرف لا يُدخلان — منعاً للغش)
async function halaqaInScope(halaqaId: string) {
  const r = await halaqaRoles(halaqaId);
  if (!r.isOwnerTeacher && !r.isAmir) throw new Error("الإدخال للمعلّم المالك أو أمير المكان فقط");
  return r.h;
}

// نطاق الإشراف: مدير عليا أو مشرف (مربع/منطقة) يغطّي الوحدة — للموافقة/الرفض والتقرير العام
async function halaqaSupervise(halaqaId: string) {
  const r = await halaqaRoles(halaqaId);
  if (!r.isAdmin && !r.isSupervisor) throw new Error("الإشراف للإدارة أو المشرف ضمن النطاق");
  return r.h;
}

// صلاحيّاتُ المستخدم تجاه حلقةٍ (للواجهة): هل يُدخل (معلّم مالك/أمير المكان) أو يُشرف (مدير/مشرف)؟
// canManage بلا المدير — توحيدًا مع قاعدة الإدخال الفعليّة (halaqaInScope: «المدير/المشرف لا
// يُدخلان منعًا للغش»): كانت الواجهةُ تعرض للمدير نماذجَ إدخالٍ سيرفضها الخادمُ أصلًا (بلاغ المالك).
export async function halaqaAccessData(halaqaId: string) {
  const r = await halaqaRoles(halaqaId);
  return { canManage: r.isAmir || r.isOwnerTeacher, canSupervise: r.isAdmin || r.isSupervisor };
}

// نطاق القراءة (التقرير العام): أيّ صلةٍ بالحلقة (إدخال أو إشراف)
async function halaqaReadable(halaqaId: string) {
  const r = await halaqaRoles(halaqaId);
  if (!r.isAdmin && !r.isSupervisor && !r.isAmir && !r.isOwnerTeacher) throw new Error("لا صلاحية");
  return r;
}

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return weekStart;
  return weekStartSaturday(new Date());
}

// لوحة الأسبوع لحلقة واحدة — ملاحظات + أنشطة جماعية + طلاب مع تقييم آخر درس
export async function weeklyHalaqaData(halaqaId: string, weekStart?: string) {
  await halaqaInScope(halaqaId);
  const db = useDb();
  const ws = resolveWeekStart(weekStart);

  const rec = (await db.select().from(weeklyHalaqaRecords)
    .where(and(eq(weeklyHalaqaRecords.halaqaId, halaqaId), eq(weeklyHalaqaRecords.weekStart, ws))).all())[0];

  const activities = await db.select().from(halaqaGroupActivities)
    .where(and(eq(halaqaGroupActivities.halaqaId, halaqaId), eq(halaqaGroupActivities.weekStart, ws)))
    .orderBy(halaqaGroupActivities.seq).all();

  // آخر درس مُسجّل للحلقة — هدف تقييم الطلاب
  const lastLesson = (await db.select({ id: lessonSessions.id, title: lessonSessions.lessonTitle, dateHijri: lessonSessions.dateHijri })
    .from(lessonSessions).where(eq(lessonSessions.halaqaId, halaqaId)).orderBy(desc(lessonSessions.createdAt)).limit(1).all())[0] ?? null;

  // الطلاب المسجّلون + درجاتهم في آخر درس
  const enr = await db.select({ id: enrollments.id, personId: enrollments.personId, studentName: enrollments.studentName }).from(enrollments)
    .where(and(eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, "active"))).all();
  const personIds = enr.map((e) => e.personId).filter(Boolean);
  const pNames = personIds.length
    ? await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, personIds)).all()
    : [];
  const nameOf = new Map(pNames.map((p) => [p.id, p.name]));
  const enrIds = enr.map((e) => e.id);
  const evals = lastLesson && enrIds.length
    ? await db.select({ enrollmentId: studentEvaluations.enrollmentId, score: studentEvaluations.score, note: studentEvaluations.note, externalActivities: studentEvaluations.externalActivities })
        .from(studentEvaluations).where(and(eq(studentEvaluations.lessonSessionId, lastLesson.id), inArray(studentEvaluations.enrollmentId, enrIds))).all()
    : [];
  const evalOf = new Map(evals.map((e) => [e.enrollmentId, e]));

  const students = enr.map((e) => ({
    enrollmentId: e.id, name: (e.personId && nameOf.get(e.personId)) || e.studentName || "—",
    score: evalOf.get(e.id)?.score ?? null, note: evalOf.get(e.id)?.note ?? null,
    externalActivities: evalOf.get(e.id)?.externalActivities ?? null,
  }));

  return {
    weekStart: ws, weekLabel: weekHijriRange(ws),
    notes: { supervisorNotes: rec?.supervisorNotes ?? "", adminNotes: rec?.adminNotes ?? "" },
    activities: activities.map((a) => ({ id: a.id, seq: a.seq, description: a.description, dateHijri: a.dateHijri })),
    lastLesson: lastLesson ? { id: lastLesson.id, title: lastLesson.title || "درس", dateHijri: lastLesson.dateHijri } : null,
    students,
  };
}

// ملاحظاتُ المشرف/الإدارة على الحلقة ليست للمعلّم (العدسة ع٦ — كان المعلّم يحرّر ملاحظاتِ المشرف
// على نفسه، تدقيق ٣٣ فئة أ-٥): المشرفُ المغطّي أو الأمير أو الإدارة حصراً.
export async function saveWeeklyNotesData(input: { halaqaId: string; weekStart?: string; supervisorNotes?: string; adminNotes?: string }) {
  const r = await halaqaRoles(input.halaqaId);
  if (!r.isAdmin && !r.isSupervisor && !r.isAmir) throw new Error("الملاحظات للمشرف أو الأمير أو الإدارة — لا للمعلّم");
  const ws = resolveWeekStart(input.weekStart);
  await upsertWeeklyHalaqaRecord(useDb(), input.halaqaId, ws, { supervisorNotes: input.supervisorNotes ?? "", adminNotes: input.adminNotes ?? "" });
  return { ok: true as const };
}

export async function addGroupActivityData(input: { halaqaId: string; weekStart?: string; description: string; dateHijri?: string }) {
  await halaqaInScope(input.halaqaId);
  const ws = resolveWeekStart(input.weekStart);
  const res = await addGroupActivity(useDb(), { halaqaId: input.halaqaId, weekStart: ws, description: input.description.trim(), dateHijri: input.dateHijri });
  return res.error ? { error: res.error } : { ok: true as const, id: res.id };
}

export async function removeGroupActivityData(input: { id: string }) {
  const db = useDb();
  const a = (await db.select().from(halaqaGroupActivities).where(eq(halaqaGroupActivities.id, input.id)).all())[0];
  if (!a) return { error: "النشاط غير موجود" as const };
  await halaqaInScope(a.halaqaId);
  await db.delete(halaqaGroupActivities).where(eq(halaqaGroupActivities.id, input.id)).run();
  return { ok: true as const };
}

// تقييم طالب في آخر درس — score 0..100 (اختياري) + ملاحظة. يستبدل التقييم السابق لنفس الدرس.
export async function setStudentEvaluationData(input: { halaqaId: string; enrollmentId: string; lessonSessionId: string; score?: number; note?: string; externalActivities?: string }) {
  await halaqaInScope(input.halaqaId);
  const db = useDb();
  await db.delete(studentEvaluations)
    .where(and(eq(studentEvaluations.enrollmentId, input.enrollmentId), eq(studentEvaluations.lessonSessionId, input.lessonSessionId))).run();
  await addStudentEvaluation(db, { enrollmentId: input.enrollmentId, lessonSessionId: input.lessonSessionId, score: input.score, note: input.note, externalActivities: input.externalActivities });
  return { ok: true as const };
}

export async function recordLessonData(input: { halaqaId: string; durationHours: number; lessonTitle?: string; majlis?: string; attendanceCount?: number; selfEval?: number; companionActivities?: string; attendance?: Array<{ enrollmentId: string; state: "present" | "absent" | "excused" }>; clientUuid?: string }) {
  const h = await halaqaInScope(input.halaqaId);   // المعلّم المالك أو أمير المكان فقط
  if (!(input.durationHours > 0)) return { error: "مدة الدرس يجب أن تكون أكبر من صفر" as const };
  const db = useDb();
  // idempotency للعمل دون اتصال: إعادة إرسال نفس الدرس لا تُنشئ جلسةً ثانية
  if (input.clientUuid) {
    const dup = (await db.select({ id: lessonSessions.id }).from(lessonSessions).where(eq(lessonSessions.clientUuid, input.clientUuid)).all())[0];
    if (dup) return { ok: true as const, id: dup.id };
  }
  const now = new Date();
  const id = crypto.randomUUID();
  // كشف الحضور (حاضر/غائب/مستأذن) لكل طالبة — يُشتقّ عدد الحاضرات منه إن مُرِّر
  const att = (input.attendance ?? []).filter((a) => ["present", "absent", "excused"].includes(a.state));
  const presentCount = att.length ? att.filter((a) => a.state === "present").length : (input.attendanceCount ?? null);
  await db.insert(lessonSessions).values({
    id, halaqaId: input.halaqaId, teacherId: h.teacherId, durationHours: input.durationHours,
    dateHijri: hijriDateStr(now), hijriMonth: hijriMonthKey(now),
    lessonTitle: input.lessonTitle?.trim() || null, majlis: input.majlis?.trim() || null,
    attendanceCount: presentCount, selfEval: input.selfEval ?? null,
    companionActivities: input.companionActivities?.trim() || null,
    status: "recorded", clientUuid: input.clientUuid ?? null, createdAt: now.getTime(),
  }).run();
  if (att.length) {
    await db.insert(lessonAttendance).values(att.map((a) => ({
      id: crypto.randomUUID(), lessonSessionId: id, enrollmentId: a.enrollmentId, state: a.state, note: null, createdAt: now.getTime(),
    }))).run();
  }
  return { ok: true as const, id };   // id لربط المرفقات
}

// كشف الحضور المجمّع للحلقة — لكل طالبة: عدد الحضور/الغياب/الاستئذان (بكبسة زر).
export async function halaqaRosterData(halaqaId: string) {
  await halaqaInScope(halaqaId);
  const db = useDb();
  const roster = await db.select({ id: enrollments.id, name: enrollments.studentName, personId: enrollments.personId, status: enrollments.status })
    .from(enrollments).where(and(eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, "active"))).all();
  const enrIds = roster.map((r) => r.id);
  const lessonsCount = (await db.select({ c: sql<number>`count(*)` }).from(lessonSessions).where(eq(lessonSessions.halaqaId, halaqaId)).all())[0]?.c ?? 0;
  const agg = enrIds.length
    ? await db.select({ e: lessonAttendance.enrollmentId, state: lessonAttendance.state, c: sql<number>`count(*)` })
        .from(lessonAttendance).where(inArray(lessonAttendance.enrollmentId, enrIds)).groupBy(lessonAttendance.enrollmentId, lessonAttendance.state).all()
    : [];
  const by = new Map<string, { present: number; absent: number; excused: number }>();
  for (const r of roster) by.set(r.id, { present: 0, absent: 0, excused: 0 });
  for (const a of agg) { const rec = by.get(a.e); if (rec && (a.state in rec)) (rec as Record<string, number>)[a.state] = a.c; }
  return {
    lessonsCount,
    students: roster.map((r) => ({ id: r.id, name: r.name ?? "—", ...(by.get(r.id) ?? { present: 0, absent: 0, excused: 0 }) })),
  };
}

// حضور درسٍ بعينه (لعرضه/تعديله)
export async function lessonAttendanceData(lessonSessionId: string) {
  const db = useDb();
  const l = (await db.select().from(lessonSessions).where(eq(lessonSessions.id, lessonSessionId)).all())[0];
  if (!l) return { items: [] as Array<{ enrollmentId: string; state: string }> };
  await halaqaInScope(l.halaqaId);
  const items = await db.select({ enrollmentId: lessonAttendance.enrollmentId, state: lessonAttendance.state }).from(lessonAttendance).where(eq(lessonAttendance.lessonSessionId, lessonSessionId)).all();
  return { items };
}

// ===== لوحة المدرّس: حلقاتي =====

// يضمن وجود سجلّ معلّم لهذا الشخص ويعيد teacherId
async function ensureTeacherForPerson(personId: string): Promise<string> {
  const db = useDb();
  const existing = (await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.personId, personId)).all())[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(teachers).values({ id, personId, active: true, createdAt: Date.now() }).run();
  return id;
}

// نطاق المدرّس: المستخدم له دور teacher
async function requireTeacher() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  if (!u.assignments.some((a) => a.role === "teacher")) throw new Error("يحتاج دور مدرّس/محفّظ");
  return u;
}

// حلقات المدرّس الحالي + تقرير موجز (عدد الطلاب + الدروس/الساعات لكل حلقة)
export async function myCirclesData() {
  const u = await requireTeacher();
  const db = useDb();
  const tid = (await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.personId, u.personId)).all())[0]?.id ?? null;
  if (!tid) return { kpis: { circles: 0, students: 0, hours: 0, lessons: 0 }, items: [] };

  const hs = await db.select().from(halaqat).where(and(eq(halaqat.teacherId, tid), eq(halaqat.status, "active"))).orderBy(desc(halaqat.createdAt)).all();
  const ids = hs.map((h) => h.id);
  const vNames = hs.length
    ? await db.select({ id: venues.id, name: venues.name }).from(venues).where(inArray(venues.id, hs.map((h) => h.venueId))).all()
    : [];
  const vName = new Map(vNames.map((v) => [v.id, v.name]));
  const enr = ids.length
    ? await db.select({ h: enrollments.halaqaId, c: sql<number>`count(*)` }).from(enrollments)
        .where(and(eq(enrollments.status, "active"), inArray(enrollments.halaqaId, ids))).groupBy(enrollments.halaqaId).all()
    : [];
  const les = ids.length
    ? await db.select({ h: lessonSessions.halaqaId, c: sql<number>`count(*)`, s: sql<number>`coalesce(sum(duration_hours),0)` })
        .from(lessonSessions).where(inArray(lessonSessions.halaqaId, ids)).groupBy(lessonSessions.halaqaId).all()
    : [];
  const sCount = new Map(enr.map((e) => [e.h, e.c]));
  const lCount = new Map(les.map((e) => [e.h, e.c]));
  const lHours = new Map(les.map((e) => [e.h, e.s]));

  const items = hs.map((h) => ({
    id: h.id, name: h.name, curriculum: h.curriculum, genderTrack: h.genderTrack,
    venueName: vName.get(h.venueId) ?? "—", capacity: h.capacity,
    students: sCount.get(h.id) ?? 0, lessons: lCount.get(h.id) ?? 0,
    hours: Math.round((lHours.get(h.id) ?? 0) * 10) / 10,
  }));
  return {
    kpis: {
      circles: hs.length,
      students: items.reduce((s, i) => s + i.students, 0),
      lessons: items.reduce((s, i) => s + i.lessons, 0),
      hours: Math.round(items.reduce((s, i) => s + i.hours, 0) * 10) / 10,
    },
    items,
  };
}

// إنشاء حلقة جديدة للمدرّس — تُربط بمكانٍ على وحدته الإشرافية (المربع) فيراها المشرف
export async function createMyHalaqaData(input: { name: string; curriculum: string; genderTrack?: string; capacity?: number }) {
  const u = await requireTeacher();
  const db = useDb();
  const tid = await ensureTeacherForPerson(u.personId);
  // الوحدة الإشرافية = وحدة تكليف المدرّس (مربع غالباً)
  const orgUnitId = u.assignments.find((a) => a.role === "teacher")?.orgUnitId || null;
  const gender = input.genderTrack === "female" ? "female" : "male";
  // مكان مخصّص لهذه الحلقة مرتبط بالوحدة المشرفة (بلا حاجة لأمير)
  const venueRes = await createVenue(db, { type: "home", name: `حلقة ${input.name.trim()}`, orgUnitId: orgUnitId ?? undefined, genderTrack: gender });
  const id = crypto.randomUUID();
  await db.insert(halaqat).values({
    id, name: input.name.trim(), venueId: venueRes.id, teacherId: tid,
    genderTrack: gender, curriculum: input.curriculum || "baseera",
    capacity: input.capacity && input.capacity > 0 ? input.capacity : 30, createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

// ===== طلاب الحلقة بأسماء نصّية حرّة (خصوصية) — للمدرّس وأمير المكان والإدارة =====
export async function halaqaStudentsData(halaqaId: string) {
  await halaqaInScope(halaqaId);
  const db = useDb();
  const rows = await db.select({ id: enrollments.id, personId: enrollments.personId, studentName: enrollments.studentName, status: enrollments.status })
    .from(enrollments).where(and(eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, "active"))).orderBy(enrollments.createdAt).all();
  const personIds = rows.map((r) => r.personId).filter(Boolean);
  const pNames = personIds.length
    ? await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, personIds)).all()
    : [];
  const nameOf = new Map(pNames.map((p) => [p.id, p.name]));
  return rows.map((r) => ({ id: r.id, name: (r.personId && nameOf.get(r.personId)) || r.studentName || "—" }));
}

export async function addHalaqaStudentData(input: { halaqaId: string; name: string }) {
  await halaqaInScope(input.halaqaId);
  const db = useDb();
  const name = input.name.trim();
  // إعادةُ إرسال الطابور دون اتصالٍ قد تكرّر الطلب — الاسمُ النشطُ نفسُه في الحلقة نفسِها لا يُزدوج (ف١٠)
  const dup = (await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.halaqaId, input.halaqaId), eq(enrollments.studentName, name), eq(enrollments.status, "active"))).all())[0];
  if (dup) return { ok: true as const, id: dup.id };
  const id = crypto.randomUUID();
  await db.insert(enrollments).values({ id, halaqaId: input.halaqaId, personId: "", studentName: name, status: "active", createdAt: Date.now() }).run();
  return { ok: true as const, id };
}

export async function removeHalaqaStudentData(input: { id: string }) {
  const db = useDb();
  const e = (await db.select().from(enrollments).where(eq(enrollments.id, input.id)).all())[0];
  if (!e) return { error: "الطالب غير موجود" as const };
  await halaqaInScope(e.halaqaId);
  await db.update(enrollments).set({ status: "left" }).where(eq(enrollments.id, input.id)).run();
  return { ok: true as const };
}

// ===== دروس الحلقة (قائمة «ما درّسه») + تعديل/أرشفة الحلقة (المدرّس/أمير المكان/الإدارة) =====
export async function halaqaLessonsData(halaqaId: string) {
  const r = await halaqaReadable(halaqaId);
  const canManage = r.isOwnerTeacher || r.isAmir;
  const canSupervise = r.isAdmin || r.isSupervisor;
  const db = useDb();
  const rows = await db.select().from(lessonSessions).where(eq(lessonSessions.halaqaId, halaqaId)).orderBy(desc(lessonSessions.createdAt)).limit(50).all();
  const ids = rows.map((l) => l.id);
  const atts = ids.length ? await db.select().from(lessonAttachments).where(inArray(lessonAttachments.lessonSessionId, ids)).all() : [];
  const byLesson = new Map<string, { id: string; url: string; caption: string | null }[]>();
  for (const a of atts) {
    const arr = byLesson.get(a.lessonSessionId) ?? [];
    arr.push({ id: a.id, url: `/media/${a.r2Key}`, caption: a.caption });
    byLesson.set(a.lessonSessionId, arr);
  }
  // توزيع الحضور (حاضر/غائب/مستأذن) لكل درس
  const attRows = ids.length ? await db.select({ l: lessonAttendance.lessonSessionId, state: lessonAttendance.state, c: sql<number>`count(*)` }).from(lessonAttendance).where(inArray(lessonAttendance.lessonSessionId, ids)).groupBy(lessonAttendance.lessonSessionId, lessonAttendance.state).all() : [];
  const attByLesson = new Map<string, { present: number; absent: number; excused: number }>();
  for (const a of attRows) { const rec = attByLesson.get(a.l) ?? { present: 0, absent: 0, excused: 0 }; if (a.state in rec) (rec as Record<string, number>)[a.state] = a.c; attByLesson.set(a.l, rec); }
  // أسماء مَن اعتمد الدروس (يظهر في السجل)
  const approverIds = [...new Set(rows.map((l) => l.approvedBy).filter(Boolean) as string[])];
  const apRows = approverIds.length ? await db.select({ uid: users.id, name: persons.fullName }).from(users).innerJoin(persons, eq(persons.id, users.personId)).where(inArray(users.id, approverIds)).all() : [];
  const apName = new Map(apRows.map((r) => [r.uid, r.name]));
  return {
    canManage, canSupervise,
    items: rows.map((l) => ({
      id: l.id, title: l.lessonTitle || "درس", majlis: l.majlis, dateHijri: l.dateHijri, durationHours: l.durationHours,
      attendanceCount: l.attendanceCount, selfEval: l.selfEval, companionActivities: l.companionActivities,
      status: l.status, rejectionReason: l.rejectionReason, attachments: byLesson.get(l.id) ?? [],
      attendance: attByLesson.get(l.id) ?? null,
      approvedByName: l.approvedBy ? (apName.get(l.approvedBy) ?? null) : null,
    })),
  };
}

// موافقة/رفض الدرس — مدير أو مشرف ضمن النطاق فقط (المعلّم لا يعتمد نفسه)
// عند الاعتماد يُسجَّل مَن اعتمد (approvedBy) ليظهر اسمه في السجل.

// اعتمادُ الدرس المفرد للأقرب لا لأيّ مغطٍّ (ق1-د معمَّمةً على الدروس — قرار المالك ٢٠٢٦-٠٧-١٨:
// «اعتمده: المدير العام» على درسِ حلقةٍ خرقٌ للطبقة الأقرب): أميرُ المكان يُقرّ دروسَ حلقات
// مسجده؛ وإلا فالطبقةُ الإشرافيّةُ الأقربُ للوحدة؛ والإدارةُ عند شغورِهما معًا فقط (كسر زجاج).
async function halaqaLessonApprover(halaqaId: string) {
  const r = await halaqaRoles(halaqaId);
  if (r.isAmir) return r;
  const db = useDb();
  const amirExists = !!r.v?.orgUnitId && (await db.select({ id: roleAssignments.id }).from(roleAssignments)
    .where(and(eq(roleAssignments.orgUnitId, r.v.orgUnitId), eq(roleAssignments.role, "amir"),
      isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()).length > 0;
  if (r.unitPath) {
    const { approverLayerFor } = await import("./services/approvalRouting");
    const layer = await approverLayerFor(db, r.unitPath);
    if (layer.kind === "layer" && r.u.assignments.some((a) => a.orgUnitId === layer.unitId)) return r;
    if (layer.kind === "vacant" && !amirExists && r.isAdmin) return r; // كسرُ الزجاج عند شغور الجميع
  } else if (r.isAdmin && !amirExists) {
    return r; // حلقةٌ بلا وحدةٍ مرتبطة (مكانٌ حرّ) — الإدارةُ وليّةُ من لا وليَّ له
  }
  throw new Error("اعتمادُ الدرس لأمير المكان أو الطبقة الإشرافيّة الأقرب");
}

export async function setLessonStatusData(input: { lessonId: string; status: "approved" | "rejected"; reason?: string }) {
  const db = useDb();
  const l = (await db.select().from(lessonSessions).where(eq(lessonSessions.id, input.lessonId)).all())[0];
  if (!l) return { error: "الدرس غير موجود" as const };
  await halaqaLessonApprover(l.halaqaId);
  const u = await currentUser();
  await db.update(lessonSessions).set({
    status: input.status,
    rejectionReason: input.status === "rejected" ? (input.reason?.trim() || "بلا سبب") : null,
    approvedBy: input.status === "approved" ? (u?.userId ?? null) : null,
  }).where(eq(lessonSessions.id, input.lessonId)).run();

  // تحديثٌ آليّ لتقدّم المنهج: عند اعتماد درسٍ له مجلس، تُعلَّم الطالبات الحاضرات «أكملن المجلس»
  if (input.status === "approved" && l.majlis) {
    const present = await db.select({ e: lessonAttendance.enrollmentId }).from(lessonAttendance)
      .where(and(eq(lessonAttendance.lessonSessionId, l.id), eq(lessonAttendance.state, "present"))).all();
    const now = Date.now();
    for (const p of present) {
      // upsert يدويّ (احترامًا لأي إعداد Drizzle): امسح ثم أدرج «مكتمل»
      await db.delete(curriculumProgress).where(and(eq(curriculumProgress.enrollmentId, p.e), eq(curriculumProgress.manhajKey, l.majlis))).run();
      await db.insert(curriculumProgress).values({ id: crypto.randomUUID(), enrollmentId: p.e, manhajKey: l.majlis, status: "completed", source: "auto", dateHijri: l.dateHijri, updatedAt: now }).run();
    }
  }
  return { ok: true as const };
}

// مصفوفة تقدّم المنهج للحلقة: لكل طالبة، المجالس المكتملة + نسبة الإنجاز.
export async function halaqaCurriculumData(halaqaId: string) {
  await halaqaReadable(halaqaId); // قراءةٌ متاحة للمشرف/المدير/المالك ضمن النطاق
  const db = useDb();
  const roster = await db.select({ id: enrollments.id, name: enrollments.studentName })
    .from(enrollments).where(and(eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, "active"))).all();
  const enrIds = roster.map((r) => r.id);
  // المجالس المطروقة في هذه الحلقة (من الدروس)
  const majalisRows = await db.selectDistinct({ m: lessonSessions.majlis }).from(lessonSessions).where(and(eq(lessonSessions.halaqaId, halaqaId), sql`majlis is not null`)).all();
  const majalis = majalisRows.map((x) => x.m).filter(Boolean) as string[];
  const prog = enrIds.length ? await db.select({ e: curriculumProgress.enrollmentId, m: curriculumProgress.manhajKey, s: curriculumProgress.status }).from(curriculumProgress).where(inArray(curriculumProgress.enrollmentId, enrIds)).all() : [];
  const byStudent = new Map<string, Map<string, string>>();
  for (const r of roster) byStudent.set(r.id, new Map());
  for (const p of prog) byStudent.get(p.e)?.set(p.m, p.s);
  return {
    majalis,
    students: roster.map((r) => {
      const cell = byStudent.get(r.id)!;
      const done = majalis.filter((m) => cell.get(m) === "completed").length;
      return { id: r.id, name: r.name ?? "—", progress: majalis.length ? Math.round((done / majalis.length) * 100) : 0, cells: majalis.map((m) => ({ majlis: m, status: cell.get(m) ?? "not_started" })) };
    }),
  };
}

// تعديلٌ يدويّ لحالة طالبةٍ في مجلس
export async function setCurriculumProgressData(input: { halaqaId: string; enrollmentId: string; manhajKey: string; status: "not_started" | "in_progress" | "completed" }) {
  await halaqaReadable(input.halaqaId); // المشرف/المدير/المعلّم ضمن النطاق يعدّل التقدّم
  const db = useDb();
  await db.delete(curriculumProgress).where(and(eq(curriculumProgress.enrollmentId, input.enrollmentId), eq(curriculumProgress.manhajKey, input.manhajKey))).run();
  if (input.status !== "not_started") await db.insert(curriculumProgress).values({ id: crypto.randomUUID(), enrollmentId: input.enrollmentId, manhajKey: input.manhajKey, status: input.status, source: "manual", dateHijri: null, updatedAt: Date.now() }).run();
  return { ok: true as const };
}

// تقرير عامّ للحلقة (إحصاءات بلا أسماء طلاب) — للمدير/المشرف/الأمير/المعلّم
export async function circleGeneralReportData(halaqaId: string) {
  const r = await halaqaReadable(halaqaId);
  const db = useDb();
  const h = r.h;
  const students = await count(db.select({ c: sql<number>`count(*)` }).from(enrollments).where(and(eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, "active"))));
  const lessons = await db.select().from(lessonSessions).where(eq(lessonSessions.halaqaId, halaqaId)).all();
  const approved = lessons.filter((l) => l.status === "approved");
  const evals = approved.map((l) => l.selfEval).filter((x): x is number => x != null);
  const teacherName = (await db.select({ name: persons.fullName }).from(teachers).innerJoin(persons, eq(persons.id, teachers.personId)).where(eq(teachers.id, h.teacherId)).all())[0]?.name ?? "—";
  return {
    name: h.name, curriculum: h.curriculum, genderTrack: h.genderTrack, teacherName,
    students, lessonsTotal: lessons.length, lessonsApproved: approved.length,
    lessonsPending: lessons.filter((l) => l.status === "recorded").length,
    hoursApproved: Math.round(approved.reduce((s, l) => s + l.durationHours, 0) * 10) / 10,
    avgSelfEval: evals.length ? Math.round((evals.reduce((s, x) => s + x, 0) / evals.length) * 10) / 10 : null,
    avgAttendance: (() => { const a = approved.map((l) => l.attendanceCount).filter((x): x is number => x != null); return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; })(),
  };
}

// مرفقات: تُحفَظ ميتاداتا هنا، والملفّ في R2 (يُرفع عبر مسار /api/media/upload)
export async function addLessonAttachmentData(input: { lessonSessionId: string; r2Key: string; caption?: string; contentType?: string }) {
  const db = useDb();
  const l = (await db.select().from(lessonSessions).where(eq(lessonSessions.id, input.lessonSessionId)).all())[0];
  if (!l) return { error: "الدرس غير موجود" as const };
  await halaqaInScope(l.halaqaId);
  const id = crypto.randomUUID();
  await db.insert(lessonAttachments).values({ id, lessonSessionId: input.lessonSessionId, r2Key: input.r2Key, caption: input.caption?.trim() || null, contentType: input.contentType || null, createdAt: Date.now() }).run();
  return { ok: true as const, id };
}

export async function removeLessonAttachmentData(input: { id: string }) {
  const db = useDb();
  const a = (await db.select().from(lessonAttachments).where(eq(lessonAttachments.id, input.id)).all())[0];
  if (!a) return { error: "المرفق غير موجود" as const };
  const l = (await db.select().from(lessonSessions).where(eq(lessonSessions.id, a.lessonSessionId)).all())[0];
  if (l) await halaqaInScope(l.halaqaId);
  await db.delete(lessonAttachments).where(eq(lessonAttachments.id, input.id)).run();
  // الملفّ في R2 يُحذف من المسار (env متاح هناك)
  const env = getCloudflareEnv() as { MEDIA?: { delete: (k: string) => Promise<void> } } | undefined;
  if (env?.MEDIA) await env.MEDIA.delete(a.r2Key).catch(() => {});
  return { ok: true as const, r2Key: a.r2Key };
}

export async function updateMyHalaqaData(input: { id: string; name?: string; curriculum?: string; capacity?: number }) {
  await halaqaInScope(input.id);
  const db = useDb();
  const patch: Record<string, unknown> = {};
  if (input.name && input.name.trim().length >= 2) patch.name = input.name.trim();
  if (input.curriculum) patch.curriculum = input.curriculum;
  if (input.capacity && input.capacity > 0) patch.capacity = input.capacity;
  if (Object.keys(patch).length) await db.update(halaqat).set(patch).where(eq(halaqat.id, input.id)).run();
  return { ok: true as const };
}

export async function archiveMyHalaqaData(input: { id: string }) {
  await halaqaInScope(input.id);
  const db = useDb();
  await db.update(halaqat).set({ status: "archived" }).where(eq(halaqat.id, input.id)).run();
  return { ok: true as const };
}
