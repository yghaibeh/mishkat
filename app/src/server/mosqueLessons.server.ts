// دروس/محاضرات المسجد (الوثيقة ٢٦ §د — من أفكار «مجلس»): عنوان/وصف/مكان/موعد/مدّة/مادّة مرتبطة،
// كشفُ تعارض المواعيد، جلساتُ اليوم والقادم والمُلقاة، حضورٌ لكلّ درس، وطباعة كشف.
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { mosqueLessons, mosqueLessonAttendance, orgUnits, circles, circleStudents, materials } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";

const MIN = 60_000;

// صلاحية إدارة دروس المسجد: أميره، أو طبقةٌ تغطّيه، أو الإدارة
async function canManageLessons(mosqueId: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { u: null, mosque: null, ok: false as const };
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque) return { u, mosque: null, ok: false as const };
  const ok = isGlobalAdmin(u)
    || u.assignments.some((a) => a.role === "amir" && a.orgUnitId === mosqueId)
    || u.assignments.some((a) => ["section_head", "rabita", "square"].includes(a.role) && mosque.path.startsWith(a.orgPath));
  return { u, mosque, ok };
}

// كشف التعارض: تداخلٌ زمنيٌّ لدرسٍ آخر (غير ملغيّ) في نفس المسجد
export async function lessonConflictData(input: { mosqueId: string; startsAt: number; durationMin: number; excludeId?: string }) {
  const db = useDb();
  const end = input.startsAt + input.durationMin * MIN;
  const dayStart = input.startsAt - 24 * 60 * MIN;
  const near = await db.select().from(mosqueLessons).where(and(
    eq(mosqueLessons.mosqueId, input.mosqueId),
    gte(mosqueLessons.startsAt, dayStart), lt(mosqueLessons.startsAt, end),
  )).all();
  const clash = near.find((l) =>
    l.id !== input.excludeId && l.status !== "cancelled" &&
    l.startsAt < end && (l.startsAt + l.durationMin * MIN) > input.startsAt);
  return clash ? { conflict: { id: clash.id, title: clash.title, startsAt: clash.startsAt } } : { conflict: null };
}

export async function saveLessonData(input: {
  id?: string; mosqueId: string; title: string; description?: string; place?: string;
  startsAt: number; durationMin: number; materialId?: string; force?: boolean;
}) {
  const db = useDb();
  const { u, ok } = await canManageLessons(input.mosqueId);
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!ok) return { error: "إدارة الدروس لأمير المسجد أو الإدارة" as const };
  if (!input.title.trim()) return { error: "عنوان الدرس مطلوب" as const };
  if (input.durationMin < 5 || input.durationMin > 600) return { error: "المدّة بين ٥ و٦٠٠ دقيقة" as const };

  // كشف التعارض — تحذيرٌ غير مانع (يؤكّد بـforce: قاعتان مثلًا)
  const { conflict } = await lessonConflictData({ mosqueId: input.mosqueId, startsAt: input.startsAt, durationMin: input.durationMin, excludeId: input.id });
  if (conflict && !input.force) return { conflictWith: { title: conflict.title, startsAt: conflict.startsAt } };

  if (input.materialId) {
    const m = (await db.select({ id: materials.id }).from(materials).where(eq(materials.id, input.materialId)).all())[0];
    if (!m) return { error: "المادّة المرتبطة غير موجودة" as const };
  }
  const now = Date.now();
  if (input.id) {
    const l = (await db.select().from(mosqueLessons).where(eq(mosqueLessons.id, input.id)).all())[0];
    if (!l || l.mosqueId !== input.mosqueId) return { error: "الدرس غير موجود" as const };
    await db.update(mosqueLessons).set({
      title: input.title.trim(), description: input.description?.trim() || null, place: input.place?.trim() || null,
      startsAt: input.startsAt, durationMin: input.durationMin, materialId: input.materialId ?? null, updatedAt: now,
    }).where(eq(mosqueLessons.id, input.id)).run();
    return { ok: true as const, id: input.id };
  }
  const id = crypto.randomUUID();
  await db.insert(mosqueLessons).values({
    id, mosqueId: input.mosqueId, title: input.title.trim(), description: input.description?.trim() || null,
    place: input.place?.trim() || null, startsAt: input.startsAt, durationMin: input.durationMin,
    materialId: input.materialId ?? null, status: "scheduled", createdBy: u.userId, createdAt: now, updatedAt: now,
  }).run();
  return { ok: true as const, id };
}

export async function setLessonStatusData(input: { id: string; status: "scheduled" | "confirmed" | "delivered" | "cancelled" }) {
  const db = useDb();
  const l = (await db.select().from(mosqueLessons).where(eq(mosqueLessons.id, input.id)).all())[0];
  if (!l) return { error: "الدرس غير موجود" as const };
  const { ok } = await canManageLessons(l.mosqueId);
  if (!ok) return { error: "لا صلاحية" as const };
  await db.update(mosqueLessons).set({ status: input.status, updatedAt: Date.now() }).where(eq(mosqueLessons.id, input.id)).run();
  return { ok: true as const };
}

export type LessonItem = {
  id: string; title: string; description: string | null; place: string | null;
  startsAt: number; durationMin: number; status: string; materialTitle: string | null; attendees: number;
};

// دروس المسجد مقسومةً: اليوم / القادم / المُلقاة (آخر ٣٠)
export async function mosqueLessonsData(mosqueId: string) {
  const db = useDb();
  const { u, ok } = await canManageLessons(mosqueId);
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!ok) return { error: "لا صلاحية" as const };
  const rows = await db.select().from(mosqueLessons).where(eq(mosqueLessons.mosqueId, mosqueId)).all();
  const attAll = rows.length
    ? await db.select({ lessonId: mosqueLessonAttendance.lessonId }).from(mosqueLessonAttendance)
        .where(inArray(mosqueLessonAttendance.lessonId, rows.map((r) => r.id).slice(0, 500))).all()
    : [];
  const attCount = new Map<string, number>();
  for (const a of attAll) attCount.set(a.lessonId, (attCount.get(a.lessonId) ?? 0) + 1);

  const matIds = [...new Set(rows.map((r) => r.materialId).filter(Boolean))] as string[];
  const mats = matIds.length ? await db.select({ id: materials.id, title: materials.title }).from(materials).where(inArray(materials.id, matIds)).all() : [];
  const matById = new Map(mats.map((m) => [m.id, m.title]));

  const now = Date.now();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + 24 * 60 * MIN;
  const toItem = (l: typeof rows[number]): LessonItem => ({
    id: l.id, title: l.title, description: l.description, place: l.place,
    startsAt: l.startsAt, durationMin: l.durationMin, status: l.status,
    materialTitle: l.materialId ? (matById.get(l.materialId) ?? null) : null,
    attendees: attCount.get(l.id) ?? 0,
  });
  const active = rows.filter((l) => l.status !== "cancelled");
  return {
    today: active.filter((l) => l.startsAt >= dayStart.getTime() && l.startsAt < dayEnd && l.status !== "delivered").sort((a, b) => a.startsAt - b.startsAt).map(toItem),
    upcoming: active.filter((l) => l.startsAt >= dayEnd && l.status !== "delivered").sort((a, b) => a.startsAt - b.startsAt).slice(0, 30).map(toItem),
    delivered: active.filter((l) => l.status === "delivered").sort((a, b) => b.startsAt - a.startsAt).slice(0, 30).map(toItem),
  };
}

/* ===== الحضور ===== */
export async function lessonAttendanceData(lessonId: string) {
  const db = useDb();
  const l = (await db.select().from(mosqueLessons).where(eq(mosqueLessons.id, lessonId)).all())[0];
  if (!l) return { error: "الدرس غير موجود" as const };
  const { ok } = await canManageLessons(l.mosqueId);
  if (!ok) return { error: "لا صلاحية" as const };
  const att = await db.select().from(mosqueLessonAttendance).where(eq(mosqueLessonAttendance.lessonId, lessonId)).all();
  // كشف طلاب حلقات المسجد — اقتراحاتٌ للإضافة السريعة
  const cs = await db.select({ id: circles.id }).from(circles).where(and(eq(circles.mosqueId, l.mosqueId), eq(circles.status, "active"))).all();
  const students = cs.length
    ? await db.select({ name: circleStudents.name, personId: circleStudents.personId }).from(circleStudents)
        .where(and(inArray(circleStudents.circleId, cs.map((c) => c.id)), eq(circleStudents.status, "active"))).all()
    : [];
  const present = new Set(att.map((a) => a.name));
  return {
    lesson: { id: l.id, title: l.title, startsAt: l.startsAt },
    attendees: att.map((a) => ({ id: a.id, name: a.name, present: a.present })).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    suggestions: [...new Set(students.map((s) => s.name))].filter((n) => !present.has(n)).sort((a, b) => a.localeCompare(b, "ar")),
  };
}

export async function addLessonAttendeeData(input: { lessonId: string; name: string }) {
  const db = useDb();
  const l = (await db.select().from(mosqueLessons).where(eq(mosqueLessons.id, input.lessonId)).all())[0];
  if (!l) return { error: "الدرس غير موجود" as const };
  const { ok } = await canManageLessons(l.mosqueId);
  if (!ok) return { error: "لا صلاحية" as const };
  const name = input.name.trim();
  if (!name) return { error: "الاسم مطلوب" as const };
  // ربطٌ بالهوية إن طابق طالبَ حلقةٍ معروفًا
  const cs = await db.select({ id: circles.id }).from(circles).where(eq(circles.mosqueId, l.mosqueId)).all();
  const match = cs.length
    ? (await db.select().from(circleStudents).where(and(inArray(circleStudents.circleId, cs.map((c) => c.id)), eq(circleStudents.name, name))).all())[0]
    : undefined;
  try {
    await db.insert(mosqueLessonAttendance).values({
      id: crypto.randomUUID(), lessonId: input.lessonId, personId: match?.personId ?? null, name, present: true, createdAt: Date.now(),
    }).run();
  } catch { return { error: "مُسجَّلٌ أصلًا" as const }; }
  return { ok: true as const };
}

export async function removeLessonAttendeeData(id: string) {
  const db = useDb();
  const a = (await db.select().from(mosqueLessonAttendance).where(eq(mosqueLessonAttendance.id, id)).all())[0];
  if (!a) return { ok: true as const };
  const l = (await db.select().from(mosqueLessons).where(eq(mosqueLessons.id, a.lessonId)).all())[0];
  if (l) {
    const { ok } = await canManageLessons(l.mosqueId);
    if (!ok) return { error: "لا صلاحية" as const };
  }
  await db.delete(mosqueLessonAttendance).where(eq(mosqueLessonAttendance.id, id)).run();
  return { ok: true as const };
}
