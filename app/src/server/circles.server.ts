// منطق حلقات المسجد (خادم فقط). المسجد قد يحوي عدة حلقات بأنواع مختلفة.
import { and, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { circles, circleStudents, orgUnits, persons, tahfeezCircles, halaqat, venues, teachers, roleAssignments } from "./database/schema";
import { writeAudit } from "./utils/audit";
import { currentUser } from "./auth.server";
import { canAccessPath, type AuthUser } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { circleAllowsGender, type CircleType, type GenderTrack } from "../lib/circles";
import { mirrorStudentToTahfeez, mirrorRemoval, syncCircleTwins } from "./services/studentBridge";

const CIRCLE_TYPES: CircleType[] = ["tahfeez", "rashidi", "ala_baseera", "ilmiyya"];

// يتطلّب القدرة + يُرجع المستخدم. (عزل النطاق يُفحص لكل مسجد على حدة عبر canAccessPath)
async function requireCircleCap(cap: string): Promise<AuthUser> {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const c = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(c, cap)) throw new Error("لا تملك هذه الصلاحية");
  return u;
}

// يتحقّق أن المسجد ضمن نطاق المستخدم (الإدارة/المنطقة/المربع/أمير المسجد نفسه)
async function mosqueInScope(u: AuthUser, mosqueId: string) {
  const db = useDb();
  const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!m) throw new Error("المسجد غير موجود");
  if (!canAccessPath(u, m.path)) throw new Error("خارج نطاقك");
  return m;
}

// حلقات مسجدٍ بعينه (مع اسم المعلّم) — معزولة بالنطاق
export async function circlesForMosque(mosqueId: string) {
  const u = await requireCircleCap("circles.view");
  await mosqueInScope(u, mosqueId);
  const db = useDb();
  const rows = await db.select().from(circles)
    .where(and(eq(circles.mosqueId, mosqueId), ne(circles.status, "archived"))).all();
  const teacherIds = [...new Set(rows.map((r) => r.teacherPersonId).filter(Boolean))] as string[];
  const teachers = teacherIds.length
    ? await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, teacherIds)).all()
    : [];
  const tName = new Map(teachers.map((t) => [t.id, t.name]));
  // عدد الطلاب النشطين لكل حلقة
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db.select({ c: circleStudents.circleId, n: sql<number>`count(*)` }).from(circleStudents)
        .where(and(inArray(circleStudents.circleId, ids), eq(circleStudents.status, "active"))).groupBy(circleStudents.circleId).all()
    : [];
  const cmap = new Map(counts.map((x) => [x.c, x.n]));
  return rows
    .map((r) => ({
      id: r.id, mosqueId: r.mosqueId, type: r.type, genderTrack: r.genderTrack, name: r.name,
      teacherPersonId: r.teacherPersonId, teacherName: r.teacherPersonId ? tName.get(r.teacherPersonId) ?? null : null,
      capacity: r.capacity, notes: r.notes, students: cmap.get(r.id) ?? 0, createdAt: r.createdAt,
    }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "ar"));
}

// يتحقّق أن الحلقة ضمن نطاق المستخدم (عبر مسجدها) ويُرجعها
async function circleInScope(u: AuthUser, circleId: string) {
  const db = useDb();
  const c = (await db.select().from(circles).where(eq(circles.id, circleId)).all())[0];
  if (!c) throw new Error("الحلقة غير موجودة");
  await mosqueInScope(u, c.mosqueId);
  return c;
}

// طلاب حلقةٍ بعينها (أسماء نصّية — خصوصية)
export async function studentsForCircle(circleId: string) {
  const u = await requireCircleCap("circles.view");
  await circleInScope(u, circleId);
  const db = useDb();
  const rows = await db.select().from(circleStudents)
    .where(and(eq(circleStudents.circleId, circleId), eq(circleStudents.status, "active")))
    .orderBy(circleStudents.createdAt).all();
  return rows.map((s) => ({ id: s.id, name: s.name, notes: s.notes }));
}

export async function addCircleStudent(input: { circleId: string; name: string; notes?: string | null }) {
  const u = await requireCircleCap("circles.manage");
  await circleInScope(u, input.circleId);
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(circleStudents).values({
    id, circleId: input.circleId, name: input.name.trim(), notes: input.notes?.trim() || null,
    status: "active", createdAt: Date.now(),
  }).run();
  // جسر الطلاب (0050): مرآةُ الطالب في وحدة التحفيظ فورًا — لا «لا طلاب» بعد اليوم
  await mirrorStudentToTahfeez(db, { id, circleId: input.circleId, name: input.name.trim(), personId: null });
  await writeAudit(db, { actorUserId: u.userId, action: "add_circle_student", entity: "circle_student", entityId: id, after: { circleId: input.circleId, name: input.name } });
  return { ok: true as const, id };
}

export async function removeCircleStudent(input: { id: string }) {
  const u = await requireCircleCap("circles.manage");
  const db = useDb();
  const s = (await db.select().from(circleStudents).where(eq(circleStudents.id, input.id)).all())[0];
  if (!s) return { error: "الطالب غير موجود" as const };
  await circleInScope(u, s.circleId);
  await db.update(circleStudents).set({ status: "left" }).where(eq(circleStudents.id, input.id)).run();
  await mirrorRemoval(db, input.id, "registry");
  await writeAudit(db, { actorUserId: u.userId, action: "remove_circle_student", entity: "circle_student", entityId: input.id, after: { status: "left" } });
  return { ok: true as const };
}

// الجسر (0049 — إصلاح «أضفتُ حلقاتٍ وكلّه مصفّر»): حلقةُ السجلّ تُنشئ امتدادَها في وحدتها
// المتخصّصة فورًا — تحفيظ ⇒ صفّ tahfeez_circles (سجلّ التحفيظ اليوميّ)، وعلى بصيرة ⇒ حلقة
// halaqat بمكان المسجد ومعلّمه (الدروس بالساعة). معرّفاتٌ اشتقاقيّةٌ ثابتة ⇒ لا ازدواج.
export async function bridgeCircle(
  db: ReturnType<typeof useDb>,
  mosque: { id: string; name: string; genderTrack: string },
  c: { id: string; type: string; name: string; genderTrack: string; teacherPersonId: string | null },
): Promise<{ notice?: string }> {
  if (c.type === "tahfeez") {
    // الوجود بالمعرّف الاشتقاقيّ أو الاسم — وإلا تكرّر الجسرُ بعد إعادة التسمية فاصطدم بالمفتاح
    const exists = (await db.select({ id: tahfeezCircles.id }).from(tahfeezCircles)
      .where(or(eq(tahfeezCircles.id, `tc-${c.id}`), and(eq(tahfeezCircles.mosqueId, mosque.id), eq(tahfeezCircles.name, c.name)))).all())[0];
    if (!exists) {
      await db.insert(tahfeezCircles).values({
        id: `tc-${c.id}`, mosqueId: mosque.id, name: c.name, teacherPersonId: c.teacherPersonId, createdAt: Date.now(),
      }).run();
    }
    return {};
  }
  if (c.type === "ala_baseera") {
    if (!c.teacherPersonId) {
      return { notice: "عيّن معلّمَ الحلقة ليكتمل ربطُها بوحدة «على بصيرة» (الدروس بالساعة)" };
    }
    // مكان المسجد — يُنشأ إن لم يوجد
    let venue = (await db.select().from(venues).where(eq(venues.orgUnitId, mosque.id)).all())[0];
    if (!venue) {
      const vid = `v-${mosque.id}`;
      await db.insert(venues).values({ id: vid, type: "mosque", name: mosque.name, orgUnitId: mosque.id, genderTrack: mosque.genderTrack, createdAt: Date.now() }).run();
      venue = (await db.select().from(venues).where(eq(venues.id, vid)).all())[0];
    }
    // كيان المعلّم — يُنشأ إن لم يوجد
    let teacher = (await db.select().from(teachers).where(eq(teachers.personId, c.teacherPersonId)).all())[0];
    if (!teacher) {
      const tid = `t-${c.teacherPersonId}`;
      await db.insert(teachers).values({ id: tid, personId: c.teacherPersonId, hourlyRateId: null, active: true, createdAt: Date.now() }).run();
      teacher = (await db.select().from(teachers).where(eq(teachers.id, tid)).all())[0];
    }
    const exists = (await db.select({ id: halaqat.id }).from(halaqat)
      .where(or(eq(halaqat.id, `h-${c.id}`), and(eq(halaqat.venueId, venue.id), eq(halaqat.name, c.name)))).all())[0];
    if (!exists) {
      await db.insert(halaqat).values({
        id: `h-${c.id}`, name: c.name, venueId: venue.id, teacherId: teacher.id,
        genderTrack: c.genderTrack, curriculum: "baseera", capacity: 30, status: "active", createdAt: Date.now(),
      }).run();
    }
    return {};
  }
  return {};
}

export async function createCircle(input: {
  mosqueId: string; type: string; genderTrack: GenderTrack; name: string;
  teacherPersonId?: string | null; capacity?: number | null; notes?: string | null;
}) {
  const u = await requireCircleCap("circles.manage");
  const mosque = await mosqueInScope(u, input.mosqueId);
  if (!CIRCLE_TYPES.includes(input.type as CircleType)) return { error: "نوع حلقة غير صالح" as const };
  if (!circleAllowsGender(input.type, input.genderTrack)) return { error: "هذا النوع لا يدعم هذا المسار" as const };
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(circles).values({
    id, mosqueId: input.mosqueId, type: input.type, genderTrack: input.genderTrack, name: input.name,
    teacherPersonId: input.teacherPersonId ?? null, capacity: input.capacity ?? null, notes: input.notes ?? null,
    status: "active", createdAt: Date.now(),
  }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "create_circle", entity: "circle", entityId: id, after: { mosqueId: input.mosqueId, type: input.type, name: input.name } });
  // الجسر: امتداد الحلقة في وحدتها المتخصّصة فورًا (0049)
  const bridge = await bridgeCircle(db, mosque, { id, type: input.type, name: input.name, genderTrack: input.genderTrack, teacherPersonId: input.teacherPersonId ?? null });
  return { ok: true as const, id, notice: bridge.notice };
}

export async function updateCircle(input: {
  id: string; name?: string; genderTrack?: GenderTrack; teacherPersonId?: string | null;
  capacity?: number | null; notes?: string | null;
}) {
  const u = await requireCircleCap("circles.manage");
  const db = useDb();
  const cur = (await db.select().from(circles).where(eq(circles.id, input.id)).all())[0];
  if (!cur) return { error: "الحلقة غير موجودة" as const };
  await mosqueInScope(u, cur.mosqueId);
  const genderTrack = input.genderTrack ?? (cur.genderTrack as GenderTrack);
  if (!circleAllowsGender(cur.type, genderTrack)) return { error: "هذا النوع لا يدعم هذا المسار" as const };
  const newTeacher = input.teacherPersonId === undefined ? cur.teacherPersonId : input.teacherPersonId;
  await db.update(circles).set({
    name: input.name ?? cur.name,
    genderTrack,
    teacherPersonId: newTeacher,
    capacity: input.capacity === undefined ? cur.capacity : input.capacity,
    notes: input.notes === undefined ? cur.notes : input.notes,
  }).where(eq(circles.id, input.id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "update_circle", entity: "circle", entityId: input.id, after: { name: input.name } });
  // تعيينُ معلّمٍ لحلقة «على بصيرة» يُكمل جسرَها المؤجَّل (0049)
  if (newTeacher && cur.type === "ala_baseera") {
    const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, cur.mosqueId)).all())[0];
    if (mosque) await bridgeCircle(db, mosque, { id: cur.id, type: cur.type, name: input.name ?? cur.name, genderTrack, teacherPersonId: newTeacher });
  }
  // مزامنة التوأم (غ٨): الاسم/المعلّم ينعكسان على الامتداد المتخصّص — البحث بالاسم القديم (cur) قبل التبديل
  await syncCircleTwins(db, cur, {
    name: input.name,
    teacherPersonId: input.teacherPersonId === undefined ? undefined : input.teacherPersonId,
  });
  return { ok: true as const };
}

export async function archiveCircle(input: { id: string }) {
  const u = await requireCircleCap("circles.manage");
  const db = useDb();
  const cur = (await db.select().from(circles).where(eq(circles.id, input.id)).all())[0];
  if (!cur) return { error: "الحلقة غير موجودة" as const };
  await mosqueInScope(u, cur.mosqueId);
  await db.update(circles).set({ status: "archived" }).where(eq(circles.id, input.id)).run();
  // مزامنة التوأم (غ٨): الأرشفةُ تُخفي الامتدادَ من الإشراف والترتيب والتذكيرات أيضًا
  await syncCircleTwins(db, cur, { archived: true });
  await writeAudit(db, { actorUserId: u.userId, action: "archive_circle", entity: "circle", entityId: input.id, after: { status: "archived" } });
  return { ok: true as const };
}

// خيارات معلّمي المسجد (غ٢): أصحاب تكليف teacher/amir ضمن مسار المسجد + معلّمو حلقاتٍ قائمون —
// لمُنتقي «المعلّم» في بطاقة الحلقة (يُكمل جسرَي التحفيظ وعلى بصيرة).
export async function mosqueTeacherOptionsData(mosqueId: string) {
  const u = await requireCircleCap("circles.view");
  await mosqueInScope(u, mosqueId);
  const db = useDb();
  // معلّمو/أمراء هذا المسجد بعينه + معلّمو حلقاته القائمون
  const assigns = (await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.approvalStatus, "approved"), eq(roleAssignments.orgUnitId, mosqueId),
  )).all()).filter((a) => !a.endDate && (a.role === "teacher" || a.role === "amir"));
  const direct = assigns.map((a) => a.personId);
  const existing = (await db.select({ p: circles.teacherPersonId }).from(circles)
    .where(and(eq(circles.mosqueId, mosqueId), ne(circles.status, "archived"))).all())
    .map((r) => r.p).filter(Boolean) as string[];
  const ids = [...new Set([...direct, ...existing])];
  if (!ids.length) return { items: [] };
  const people = await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, ids)).all();
  return { items: people.map((p) => ({ personId: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "ar")) };
}
