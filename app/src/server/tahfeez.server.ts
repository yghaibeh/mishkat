// منطق وحدة «التحفيظ» (خادم فقط) — حلقات التحفيظ والطلاب والمتابعة، مرتبطة بالمسجد مباشرةً.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { selectByIdChunks } from "./utils/chunks";
import { tahfeezCircles, tahfeezStudents, tahfeezProgress, persons, orgUnits, circles as circlesTbl } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { requireMosqueAccess, requireMosqueManage } from "./utils/scope";
import { mirrorStudentToRegistry, mirrorRemoval } from "./services/studentBridge";

async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  return u;
}
async function count(query: { all: () => Promise<Array<{ c: number }>> }) {
  return (await query.all())[0]?.c ?? 0;
}

export async function tahfeezData(mosqueId: string) {
  await requireMosqueAccess(mosqueId);
  const db = useDb();
  const circles = await db.select().from(tahfeezCircles).where(and(eq(tahfeezCircles.mosqueId, mosqueId), eq(tahfeezCircles.status, "active"))).orderBy(desc(tahfeezCircles.createdAt)).all();
  const circleIds = circles.map((c) => c.id);

  const studentRows = await selectByIdChunks(circleIds, (b) => db.select({ id: tahfeezStudents.id, circleId: tahfeezStudents.circleId }).from(tahfeezStudents)
    .where(and(inArray(tahfeezStudents.circleId, b), eq(tahfeezStudents.status, "active"))).all()); // ف٨
  const studentIds = studentRows.map((s) => s.id);
  // ف٨: مسجدٌ بمئة طالبٍ فأكثر كان يكسر اللوحة (حدّ متغيّرات D1) — عدٌّ بدفعات
  let progress = 0;
  for (let i = 0; i < studentIds.length; i += 90) {
    progress += await count(db.select({ c: sql<number>`count(*)` }).from(tahfeezProgress).where(inArray(tahfeezProgress.studentId, studentIds.slice(i, i + 90))));
  }

  const teacherIds = [...new Set(circles.map((c) => c.teacherPersonId).filter(Boolean) as string[])];
  const tNames = teacherIds.length
    ? await db.select({ id: persons.id, name: persons.fullName }).from(persons).where(inArray(persons.id, teacherIds)).all()
    : [];
  const tName = new Map(tNames.map((t) => [t.id, t.name]));
  const perCircle = new Map<string, number>();
  for (const s of studentRows) perCircle.set(s.circleId, (perCircle.get(s.circleId) ?? 0) + 1);

  const items = circles.map((c) => ({
    id: c.id, name: c.name,
    teacherName: c.teacherPersonId ? tName.get(c.teacherPersonId) ?? "—" : "بدون معلّم",
    students: perCircle.get(c.id) ?? 0,
  }));
  return { kpis: { circles: circles.length, students: studentRows.length, progress }, items };
}

export async function createTahfeezCircleData(input: { mosqueId: string; name: string; teacherPersonId?: string }) {
  await requireMosqueManage(input.mosqueId);
  const db = useDb();
  // ف١٠: الإنشاء المباشر كان يُنتج حلقةً بلا صفّ سجلٍّ فلا مسارَ لأرشفتها أبدًا — السجلُّ مصدرُ الحقيقة،
  // فنُنشئ صفَّه أوّلًا والتوأمَ بمعرّفه الاشتقاقيّ (كما في bridgeCircle)
  const mosque = (await db.select({ g: orgUnits.genderTrack }).from(orgUnits).where(eq(orgUnits.id, input.mosqueId)).all())[0];
  const registryId = crypto.randomUUID();
  const name = input.name.trim();
  await db.insert(circlesTbl).values({
    id: registryId, mosqueId: input.mosqueId, type: "tahfeez", genderTrack: mosque?.g === "female" ? "female" : "male", name,
    teacherPersonId: input.teacherPersonId || null, capacity: null, notes: null, status: "active", createdAt: Date.now(),
  }).run();
  const id = `tc-${registryId}`;
  await db.insert(tahfeezCircles).values({
    id, mosqueId: input.mosqueId, name,
    teacherPersonId: input.teacherPersonId || null, createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

async function tahfeezCircleInScope(circleId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const circle = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, circleId)).all())[0];
  if (!circle) throw new Error("الحلقة غير موجودة");
  if (circle.status !== "active") throw new Error("الحلقة مؤرشفة — لا إدخال عليها"); // ف٢
  const isAdmin = u.assignments.some((a) => a.role === "admin");
  const isAmir = u.assignments.some((a) => a.role === "amir" && a.orgUnitId === circle.mosqueId);
  // معلّم الحلقة يدير طلابه بنفسه — ٩٠٪ من الإدخال عنده (توجيه اللجنة)؛
  // ويُشترط تكليفٌ نشطٌ واحدٌ على الأقلّ (ف٢): إنهاءُ أدواره كلِّها يقطع المنفذ ولو بقي اسمُه على الحلقة
  const isTeacher = !!circle.teacherPersonId && circle.teacherPersonId === u.personId && u.assignments.length > 0;
  if (!isAdmin && !isAmir && !isTeacher) throw new Error("لإدارة الحلقة: المعلّم أو أمير المسجد");
  return circle;
}

// طلاب حلقة تحفيظ (أسماء نصّية حرّة — خصوصية)
export async function tahfeezStudentsData(circleId: string) {
  await tahfeezCircleInScope(circleId);
  const db = useDb();
  const rows = await db.select().from(tahfeezStudents)
    .where(and(eq(tahfeezStudents.circleId, circleId), eq(tahfeezStudents.status, "active")))
    .orderBy(tahfeezStudents.createdAt).all();
  return rows.map((s) => ({ id: s.id, name: s.studentName || "—" }));
}

export async function addTahfeezStudentData(input: { circleId: string; name: string }) {
  await tahfeezCircleInScope(input.circleId);
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(tahfeezStudents).values({ id, circleId: input.circleId, personId: "", studentName: input.name.trim(), status: "active", createdAt: Date.now() }).run();
  // جسر الطلاب (0050): مرآةٌ في سجلّ الحلقات ليتطابق العدّ
  await mirrorStudentToRegistry(db, { id, circleId: input.circleId, studentName: input.name.trim(), personId: null });
  return { ok: true as const, id };
}

export async function removeTahfeezStudentData(input: { id: string }) {
  const db = useDb();
  const s = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.id, input.id)).all())[0];
  if (!s) return { error: "الطالب غير موجود" as const };
  await tahfeezCircleInScope(s.circleId);
  await db.update(tahfeezStudents).set({ status: "left" }).where(eq(tahfeezStudents.id, input.id)).run();
  await mirrorRemoval(db, input.id, "tahfeez");
  return { ok: true as const };
}

// ===== متابعة حفظ الطالب (F4) — سجلّ تقدّم (المقطع/الآيات/التقييم) =====
async function tahfeezStudentInScope(studentId: string) {
  const db = useDb();
  const s = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.id, studentId)).all())[0];
  if (!s) throw new Error("الطالب غير موجود");
  await tahfeezCircleInScope(s.circleId);
  return s;
}

export async function tahfeezProgressData(studentId: string) {
  await tahfeezStudentInScope(studentId);
  const db = useDb();
  const rows = await db.select().from(tahfeezProgress).where(eq(tahfeezProgress.studentId, studentId)).orderBy(desc(tahfeezProgress.createdAt)).all();
  const ayahs = rows.reduce((sum, r) => sum + (r.fromAyah != null && r.toAyah != null ? (r.toAyah - r.fromAyah + 1) : 0), 0);
  return {
    memorizedAyahs: ayahs,
    items: rows.map((r) => ({ id: r.id, scope: r.scope, fromAyah: r.fromAyah, toAyah: r.toAyah, rating: r.rating, dateHijri: r.dateHijri })),
  };
}

export async function addTahfeezProgressData(input: { studentId: string; scope?: string; fromAyah?: number; toAyah?: number; rating?: number }) {
  await tahfeezStudentInScope(input.studentId);
  const db = useDb();
  const { hijriDateStr } = await import("./utils/week");
  const id = crypto.randomUUID();
  await db.insert(tahfeezProgress).values({
    id, studentId: input.studentId, scope: input.scope?.trim() || null,
    fromAyah: input.fromAyah ?? null, toAyah: input.toAyah ?? null, rating: input.rating ?? null,
    dateHijri: hijriDateStr(new Date()), createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

export async function removeTahfeezProgressData(input: { id: string }) {
  const db = useDb();
  const p = (await db.select().from(tahfeezProgress).where(eq(tahfeezProgress.id, input.id)).all())[0];
  if (!p) return { error: "السجلّ غير موجود" as const };
  await tahfeezStudentInScope(p.studentId);
  await db.delete(tahfeezProgress).where(eq(tahfeezProgress.id, input.id)).run();
  return { ok: true as const };
}

// ===== المرحلة ب — سجلّ التحفيظ اليوميّ (حضور + حفظ + مراجعة + تجويد + مصاحب) =====
import { tahfeezSessions, tahfeezDailyRecords } from "./database/schema";
import { hijriDateStr } from "./utils/week";
import { validAyahRange, validPageRange, surahName } from "@/lib/quran";

// نطاق التسجيل اليوميّ: أمير المسجد أو الإدارة أو معلّم الحلقة نفسه
async function tahfeezTeachScope(circleId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const circle = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, circleId)).all())[0];
  if (!circle) throw new Error("الحلقة غير موجودة");
  if (circle.status !== "active") throw new Error("الحلقة مؤرشفة — لا إدخال عليها"); // ف٢
  const isAdmin = u.assignments.some((a) => a.role === "admin");
  const isAmir = u.assignments.some((a) => a.role === "amir" && a.orgUnitId === circle.mosqueId);
  const isTeacher = !!circle.teacherPersonId && circle.teacherPersonId === u.personId && u.assignments.length > 0; // ف٢
  if (!isAdmin && !isAmir && !isTeacher) throw new Error("لسجلّ التحفيظ اليوميّ: المعلّم أو أمير المسجد");
  return { circle, u };
}

type DailyRec = typeof tahfeezDailyRecords.$inferSelect;
function shapeRec(r: DailyRec | undefined) {
  return {
    attendance: r?.attendance ?? "present",
    hifzMode: r?.hifzMode ?? "surah", hifzSurah: r?.hifzSurah ?? null,
    hifzScope: r?.hifzScope ?? "", hifzFrom: r?.hifzFrom ?? null, hifzTo: r?.hifzTo ?? null, hifzGrade: r?.hifzGrade ?? null,
    reviewMode: r?.reviewMode ?? "surah", reviewSurah: r?.reviewSurah ?? null,
    reviewScope: r?.reviewScope ?? "", reviewFrom: r?.reviewFrom ?? null, reviewTo: r?.reviewTo ?? null, reviewGrade: r?.reviewGrade ?? null,
    tajweedGrade: r?.tajweedGrade ?? null, companionKind: r?.companionKind ?? "", companion: r?.companion ?? "", note: r?.note ?? "",
  };
}

// جلسة اليوم للحلقة + كشف الطلاب بسجلّاتهم (مُهيّأ حضورًا)
export async function tahfeezSessionData(circleId: string, dateHijri?: string) {
  const { circle, u } = await tahfeezTeachScope(circleId);
  const db = useDb();
  const date = dateHijri || hijriDateStr(new Date());
  let sess = (await db.select().from(tahfeezSessions).where(and(eq(tahfeezSessions.circleId, circleId), eq(tahfeezSessions.dateHijri, date))).all())[0];
  if (!sess) {
    const id = crypto.randomUUID();
    await db.insert(tahfeezSessions).values({ id, circleId, dateHijri: date, mosqueId: circle.mosqueId, createdBy: u.userId, createdAt: Date.now() }).run();
    sess = (await db.select().from(tahfeezSessions).where(eq(tahfeezSessions.id, id)).all())[0];
  }
  const students = await db.select().from(tahfeezStudents).where(and(eq(tahfeezStudents.circleId, circleId), eq(tahfeezStudents.status, "active"))).orderBy(tahfeezStudents.createdAt).all();
  const recs = await db.select().from(tahfeezDailyRecords).where(eq(tahfeezDailyRecords.sessionId, sess.id)).all();
  const byStudent = new Map(recs.map((r) => [r.studentId, r]));
  return {
    sessionId: sess.id, dateHijri: date, circleName: circle.name,
    students: students.map((s) => ({ id: s.id, name: s.studentName || "—", record: shapeRec(byStudent.get(s.id)) })),
  };
}

type DailyInput = {
  studentId: string; attendance: string;
  hifzMode?: string; hifzSurah?: number; hifzScope?: string; hifzFrom?: number; hifzTo?: number; hifzGrade?: number;
  reviewMode?: string; reviewSurah?: number; reviewScope?: string; reviewFrom?: number; reviewTo?: number; reviewGrade?: number;
  tajweedGrade?: number; companionKind?: string; companion?: string; note?: string;
};
// يبني قيم قسمٍ (حفظ/مراجعة) مع التحقّق من النطاق (سورة/آية أو صفحات) — يُبطِل الإدخال غير الصالح بلا رفض
function scopeVals(mode: string | undefined, surah: number | undefined, from: number | undefined, to: number | undefined) {
  const m = mode === "page" ? "page" : "surah";
  if (m === "surah") {
    // نُبقي السورة (اختيارٌ صريح)، ونُبطِل نطاق الآيات إن كان غير صالحٍ (مثل آيةٍ تتجاوز عدد آيات السورة)
    const ok = !!(surah && validAyahRange(surah, from, to));
    return { mode: "surah", surah: surah ?? null, scope: surah ? surahName(surah) : null, from: ok ? (from ?? null) : null, to: ok ? (to ?? null) : null };
  }
  const ok = validPageRange(from, to);
  return { mode: "page", surah: null, scope: "صفحات", from: ok ? (from ?? null) : null, to: ok ? (to ?? null) : null };
}

// حفظ سجلّ اليوم (upsert لكلّ طالب)
export async function saveTahfeezDailyData(input: { sessionId: string; records: DailyInput[] }) {
  const db = useDb();
  const sess = (await db.select().from(tahfeezSessions).where(eq(tahfeezSessions.id, input.sessionId)).all())[0];
  if (!sess) return { error: "الجلسة غير موجودة" as const };
  await tahfeezTeachScope(sess.circleId);
  const now = Date.now();
  let saved = 0;
  for (const r of input.records) {
    const h = scopeVals(r.hifzMode, r.hifzSurah, r.hifzFrom, r.hifzTo);
    const rv = scopeVals(r.reviewMode, r.reviewSurah, r.reviewFrom, r.reviewTo);
    const vals = {
      attendance: r.attendance || "present",
      hifzMode: h.mode, hifzSurah: h.surah, hifzScope: h.scope, hifzFrom: h.from, hifzTo: h.to, hifzGrade: r.hifzGrade ?? null,
      reviewMode: rv.mode, reviewSurah: rv.surah, reviewScope: rv.scope, reviewFrom: rv.from, reviewTo: rv.to, reviewGrade: r.reviewGrade ?? null,
      tajweedGrade: r.tajweedGrade ?? null, companionKind: r.companionKind?.trim() || null, companion: r.companion?.trim() || null, note: r.note?.trim() || null,
    };
    const existing = (await db.select({ id: tahfeezDailyRecords.id }).from(tahfeezDailyRecords)
      .where(and(eq(tahfeezDailyRecords.sessionId, input.sessionId), eq(tahfeezDailyRecords.studentId, r.studentId))).all())[0];
    if (existing) await db.update(tahfeezDailyRecords).set(vals).where(eq(tahfeezDailyRecords.id, existing.id)).run();
    else await db.insert(tahfeezDailyRecords).values({ id: crypto.randomUUID(), sessionId: input.sessionId, studentId: r.studentId, ...vals, createdAt: now }).run();
    saved++;
  }
  return { ok: true as const, saved };
}

// سجلّ الطالب التراكميّ (لإدارته + أساس اطّلاع وليّ الأمر لاحقًا)
export async function tahfeezStudentHistoryData(studentId: string) {
  const db = useDb();
  const s = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.id, studentId)).all())[0];
  if (!s) return { error: "الطالب غير موجود" as const };
  await tahfeezTeachScope(s.circleId);
  const recs = await db.select().from(tahfeezDailyRecords).where(eq(tahfeezDailyRecords.studentId, studentId)).all();
  const sessIds = [...new Set(recs.map((r) => r.sessionId))];
  const sessions = sessIds.length ? await db.select({ id: tahfeezSessions.id, dateHijri: tahfeezSessions.dateHijri }).from(tahfeezSessions).where(inArray(tahfeezSessions.id, sessIds)).all() : [];
  const sDate = new Map(sessions.map((x) => [x.id, x.dateHijri]));
  const present = recs.filter((r) => r.attendance === "present").length;
  const absent = recs.filter((r) => r.attendance === "absent").length;
  const rows = recs
    .map((r) => ({ dateHijri: sDate.get(r.sessionId) ?? "—", ...shapeRec(r) }))
    .sort((a, b) => (b.dateHijri).localeCompare(a.dateHijri));
  return { name: s.studentName || "—", summary: { days: recs.length, present, absent }, rows };
}

/* ===== تقييم الحلقات الدوريّ (ملاحظة المجرِّب + قرار اللجنة): ترتيبٌ بالحضور والإنجاز ===== */
// آخر ٣٠ يومًا: نسبة الحضور + متوسّط العلامات (حفظ/مراجعة/تجويد) ⇒ درجةٌ مركّبة (٦٠٪ حضور + ٤٠٪ علامات).
// mosqueId ⇒ حلقات ذلك المسجد (الأمير)؛ وبدونه ⇒ كلّ حلقات نطاق المشرف (مربع/منطقة/إدارة).
export async function circleRankingsData(mosqueId?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };

  let pool: Array<{ id: string; name: string; mosqueName: string }> = [];
  if (mosqueId) {
    const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
    if (!m) return { error: "المسجد غير موجود" as const };
    const ok = isGlobalAdmin(u)
      || u.assignments.some((a) => a.orgUnitId === mosqueId)
      || u.assignments.some((a) => ["section_head", "rabita", "square"].includes(a.role) && m.path.startsWith(a.orgPath));
    if (!ok) return { error: "خارج نطاقك" as const };
    const tc = await db.select().from(tahfeezCircles).where(and(eq(tahfeezCircles.mosqueId, mosqueId), eq(tahfeezCircles.status, "active"))).all();
    pool = tc.map((c) => ({ id: c.id, name: c.name, mosqueName: m.name }));
  } else {
    const { supervisableCirclesData } = await import("./supervision.server");
    const { items } = await supervisableCirclesData();
    pool = items.filter((i) => i.kind === "tahfeez").map((i) => ({ id: i.id, name: i.name, mosqueName: i.mosqueName }));
  }
  if (!pool.length) return { items: [], periodDays: 30 };

  const since = Date.now() - 30 * 86_400_000;
  const ids = pool.map((c) => c.id);
  const sessions: Array<typeof tahfeezSessions.$inferSelect> = [];
  for (let i = 0; i < ids.length; i += 90) {
    sessions.push(...(await db.select().from(tahfeezSessions)
      .where(inArray(tahfeezSessions.circleId, ids.slice(i, i + 90))).all()));
  }
  const recent = sessions.filter((s) => s.createdAt >= since);
  const sessByCircle = new Map<string, string[]>();
  for (const s of recent) { if (!sessByCircle.has(s.circleId)) sessByCircle.set(s.circleId, []); sessByCircle.get(s.circleId)!.push(s.id); }
  const allSessIds = recent.map((s) => s.id);
  const records: Array<typeof tahfeezDailyRecords.$inferSelect> = [];
  for (let i = 0; i < allSessIds.length; i += 90) {
    records.push(...(await db.select().from(tahfeezDailyRecords)
      .where(inArray(tahfeezDailyRecords.sessionId, allSessIds.slice(i, i + 90))).all()));
  }
  const circleOfSession = new Map(recent.map((s) => [s.id, s.circleId]));

  const items = pool.map((c) => {
    const recs = records.filter((r) => circleOfSession.get(r.sessionId) === c.id);
    const total = recs.length;
    const present = recs.filter((r) => r.attendance === "present").length;
    const grades = recs.flatMap((r) => [r.hifzGrade, r.reviewGrade, r.tajweedGrade].filter((g): g is number => g != null));
    const attendancePct = total ? Math.round((present / total) * 100) : 0;
    const avgGrade = grades.length ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : 0;
    const sessionsCount = sessByCircle.get(c.id)?.length ?? 0;
    // الدرجة المركّبة: ٦٠٪ حضور + ٤٠٪ علامات — وصفر جلساتٍ = صفر (حلقةٌ خاملة)
    const score = sessionsCount ? Math.round(attendancePct * 0.6 + avgGrade * 0.4) : 0;
    return { id: c.id, name: c.name, mosqueName: c.mosqueName, sessionsCount, attendancePct, avgGrade, score };
  }).sort((a, b) => b.score - a.score || b.sessionsCount - a.sessionsCount);

  return { items, periodDays: 30 };
}

/* ===== حلقاتي التحفيظيّة (توسعة قاعدة إدخال المعلّم — توجيه اللجنة) ===== */
// كلّ حلقات التحفيظ التي أُعلّمها، بمسجدها وعدد طلابها — منفذُ المعلّم الكامل في «حلقاتي».
export async function myTahfeezCirclesData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const mine = await db.select().from(tahfeezCircles).where(and(eq(tahfeezCircles.teacherPersonId, u.personId), eq(tahfeezCircles.status, "active"))).all();
  if (!mine.length) return { items: [] };
  const mosqueIds = [...new Set(mine.map((c) => c.mosqueId))];
  const mosques = mosqueIds.length
    ? await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, mosqueIds)).all()
    : [];
  const mBy = new Map(mosques.map((m) => [m.id, m.name]));
  const counts = await db.select({ c: tahfeezStudents.circleId, n: sql<number>`count(*)` }).from(tahfeezStudents)
    .where(and(inArray(tahfeezStudents.circleId, mine.map((c) => c.id)), eq(tahfeezStudents.status, "active")))
    .groupBy(tahfeezStudents.circleId).all();
  const cBy = new Map(counts.map((x) => [x.c, x.n]));
  return {
    items: mine.map((c) => ({
      id: c.id, name: c.name, mosqueId: c.mosqueId, mosqueName: mBy.get(c.mosqueId) ?? "—",
      students: cBy.get(c.id) ?? 0,
    })).sort((a, b) => a.name.localeCompare(b.name, "ar")),
  };
}

/* ===== «تقدّمي في الحفظ» (غ٣) — الطالب يرى سجلَّه بنفسه عبر هويّته ===== */
export async function myStudentProgressData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  // صفوفي كطالب تحفيظ (الجسر 0050 ينسخ person_id للمرايا)
  const myRows = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.personId, u.personId)).all())
    .filter((s) => s.status === "active");
  if (!myRows.length) return { items: [] };
  const circleIds = [...new Set(myRows.map((s) => s.circleId))];
  const cs = await db.select().from(tahfeezCircles).where(inArray(tahfeezCircles.id, circleIds)).all();
  const cBy = new Map(cs.map((c) => [c.id, c]));
  const mosqueIds = [...new Set(cs.map((c) => c.mosqueId))];
  const mos = mosqueIds.length ? await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, mosqueIds)).all() : [];
  const mBy = new Map(mos.map((m) => [m.id, m.name]));

  const items = [] as Array<{
    circleName: string; mosqueName: string;
    attendancePct: number; sessions: number; avgGrade: number | null;
    recent: Array<{ dateHijri: string; attendance: string; hifz: string | null; hifzGrade: number | null; review: string | null; reviewGrade: number | null; tajweedGrade: number | null }>;
  }>;
  for (const s of myRows) {
    const recs = (await db.select({
      r: tahfeezDailyRecords, dateHijri: tahfeezSessions.dateHijri, sAt: tahfeezSessions.createdAt,
    }).from(tahfeezDailyRecords)
      .innerJoin(tahfeezSessions, eq(tahfeezSessions.id, tahfeezDailyRecords.sessionId))
      .where(eq(tahfeezDailyRecords.studentId, s.id)).all())
      .sort((a, b) => b.sAt - a.sAt);
    const total = recs.length;
    const present = recs.filter((x) => x.r.attendance === "present").length;
    const grades = recs.flatMap((x) => [x.r.hifzGrade, x.r.reviewGrade, x.r.tajweedGrade].filter((g): g is number => g != null));
    const circle = cBy.get(s.circleId);
    const scope = (mode: string | null, surah: number | null, from: number | null, to: number | null) => {
      if (!surah && !from && !to) return null;
      const range = from || to ? ` ${from ?? ""}${to ? `–${to}` : ""}` : "";
      return mode === "page" ? `ص${range}` : `${surah ? surahName(surah) : ""}${range}`;
    };
    items.push({
      circleName: circle?.name ?? "—", mosqueName: circle ? (mBy.get(circle.mosqueId) ?? "—") : "—",
      attendancePct: total ? Math.round((present / total) * 100) : 0,
      sessions: total,
      avgGrade: grades.length ? Math.round(grades.reduce((a, g) => a + g, 0) / grades.length) : null,
      recent: recs.slice(0, 10).map((x) => ({
        dateHijri: x.dateHijri, attendance: x.r.attendance,
        hifz: scope(x.r.hifzMode, x.r.hifzSurah, x.r.hifzFrom, x.r.hifzTo), hifzGrade: x.r.hifzGrade,
        review: scope(x.r.reviewMode, x.r.reviewSurah, x.r.reviewFrom, x.r.reviewTo), reviewGrade: x.r.reviewGrade,
        tajweedGrade: x.r.tajweedGrade,
      })),
    });
  }
  return { items };
}

// حفظٌ بالحلقة والتاريخ (غ٤ — أوفلاين): get-or-create للجلسة ثم حفظٌ upsert — إعادة الإرسال آمنة.
export async function saveTahfeezDailyByCircleData(input: { circleId: string; dateHijri: string; records: DailyInput[] }) {
  const sess = await tahfeezSessionData(input.circleId, input.dateHijri);
  return saveTahfeezDailyData({ sessionId: sess.sessionId, records: input.records });
}

/* ===== صفحة وليّ الأمر (غ٥ — المرحلة د) ===== */
// المعلّم/الأمير يولّد رابطًا سرّيًّا للطالب يفتح صفحةَ متابعةٍ للقراءة فقط.
export async function guardianLinkData(studentId: string) {
  const db = useDb();
  const s = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.id, studentId)).all())[0];
  if (!s) return { error: "الطالب غير موجود" as const };
  await tahfeezTeachScope(s.circleId); // المعلّم أو الأمير أو الإدارة
  let token = s.guardianToken;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    await db.update(tahfeezStudents).set({ guardianToken: token }).where(eq(tahfeezStudents.id, studentId)).run();
  }
  return { ok: true as const, token, studentName: s.studentName };
}

// عرضٌ عامّ بالرمز (بلا جلسة): بيانات الطالب نفسه فقط — لا أسماء طلابٍ آخرين ولا هيكل.
export async function guardianViewData(token: string) {
  const db = useDb();
  if (!token || token.length < 16) return { error: "رابطٌ غير صالح" as const };
  const s = (await db.select().from(tahfeezStudents).where(eq(tahfeezStudents.guardianToken, token)).all())[0];
  if (!s || s.status !== "active") return { error: "الرابط غير صالحٍ أو أُلغي" as const };
  const circle = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, s.circleId)).all())[0];
  if (!circle || circle.status !== "active") return { error: "الرابط غير صالحٍ أو أُلغي" as const }; // ف٢: أرشفةُ الحلقة تُميت الرابط
  const mosque = (await db.select({ name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.id, circle.mosqueId)).all())[0];
  const recs = (await db.select({ r: tahfeezDailyRecords, dateHijri: tahfeezSessions.dateHijri, sAt: tahfeezSessions.createdAt })
    .from(tahfeezDailyRecords)
    .innerJoin(tahfeezSessions, eq(tahfeezSessions.id, tahfeezDailyRecords.sessionId))
    .where(eq(tahfeezDailyRecords.studentId, s.id)).all())
    .sort((a, b) => b.sAt - a.sAt);
  const total = recs.length;
  const present = recs.filter((x) => x.r.attendance === "present").length;
  const grades = recs.flatMap((x) => [x.r.hifzGrade, x.r.reviewGrade, x.r.tajweedGrade].filter((g): g is number => g != null));
  const scope = (mode: string | null, surah: number | null, from: number | null, to: number | null) => {
    if (!surah && !from && !to) return null;
    const range = from || to ? ` ${from ?? ""}${to ? `–${to}` : ""}` : "";
    return mode === "page" ? `ص${range}` : `${surah ? surahName(surah) : ""}${range}`;
  };
  return {
    studentName: s.studentName ?? "—", circleName: circle?.name ?? "—", mosqueName: mosque?.name ?? "—",
    attendancePct: total ? Math.round((present / total) * 100) : 0, sessions: total,
    avgGrade: grades.length ? Math.round(grades.reduce((a, g) => a + g, 0) / grades.length) : null,
    recent: recs.slice(0, 15).map((x) => ({
      dateHijri: x.dateHijri, attendance: x.r.attendance,
      hifz: scope(x.r.hifzMode, x.r.hifzSurah, x.r.hifzFrom, x.r.hifzTo), hifzGrade: x.r.hifzGrade,
      review: scope(x.r.reviewMode, x.r.reviewSurah, x.r.reviewFrom, x.r.reviewTo), reviewGrade: x.r.reviewGrade,
      tajweedGrade: x.r.tajweedGrade, note: x.r.note,
    })),
  };
}
