// الاختبارات والواجبات (الوثيقة ٢٦ §خ — من «مجلس»): بناء أسئلة MCQ/صح-خطأ، نشرٌ ووقت تسليم،
// تسليمٌ واحدٌ لكلّ طالبٍ بتصحيحٍ آليٍّ فوريّ، ودرجاتٌ للطالب وللمنشئ.
import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { selectByIdChunks } from "./utils/chunks";
import { exams, examQuestions, examSubmissions, circles, circleStudents, notifications } from "./database/schema";
import { currentUser } from "./auth.server";
import { creatableScopes, scopeStudentPersons } from "./activities.server";

type U = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

async function canManageExam(u: U, scopeKind: string, scopeId: string) {
  const scopes = await creatableScopes(u);
  return scopes.some((s) => s.kind === scopeKind && s.id === scopeId);
}

/* ===== إنشاء اختبار/واجب مع أسئلته دفعةً واحدة ===== */
export async function createExamData(input: {
  scopeKind: "circle" | "mosque"; scopeId: string; kind: "exam" | "homework";
  title: string; description?: string; dueAt?: number;
  questions: Array<{ kind: "mcq" | "tf"; text: string; options?: string[]; correct: string; points?: number }>;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!(await canManageExam(u, input.scopeKind, input.scopeId))) return { error: "الاختبار ضمن حلقاتك أو مسجدك فقط" as const };
  if (!input.title.trim()) return { error: "العنوان مطلوب" as const };
  if (!input.questions.length) return { error: "أضف سؤالًا واحدًا على الأقلّ" as const };
  for (const q of input.questions) {
    if (!q.text.trim()) return { error: "نصّ السؤال مطلوب" as const };
    if (q.kind === "mcq") {
      const opts = q.options ?? [];
      if (opts.length < 2) return { error: "خياران على الأقلّ لكلّ سؤال اختيار" as const };
      const idx = Number(q.correct);
      if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) return { error: "حدّد الإجابة الصحيحة" as const };
    } else if (q.correct !== "true" && q.correct !== "false") {
      return { error: "حدّد صح/خطأ" as const };
    }
  }
  // نطاق المسجد للاستعلام
  const mosqueId = input.scopeKind === "mosque" ? input.scopeId
    : ((await db.select({ m: circles.mosqueId }).from(circles).where(eq(circles.id, input.scopeId)).all())[0]?.m ?? null);

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(exams).values({
    id, scopeKind: input.scopeKind, scopeId: input.scopeId, mosqueId, kind: input.kind,
    title: input.title.trim(), description: input.description?.trim() || null,
    publishAt: null, dueAt: input.dueAt ?? null, status: "draft",
    createdBy: u.personId, createdByName: u.fullName, createdAt: now,
  }).run();
  let sort = 0;
  for (const q of input.questions) {
    await db.insert(examQuestions).values({
      id: crypto.randomUUID(), examId: id, sortOrder: sort++, kind: q.kind, text: q.text.trim(),
      options: q.kind === "mcq" ? JSON.stringify(q.options ?? []) : null, correct: q.correct, points: q.points ?? 1,
    }).run();
  }
  return { ok: true as const, id };
}

/* ===== نشر — يفتح التسليم ويُشعر الطلاب ===== */
export async function publishExamData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const e = (await db.select().from(exams).where(eq(exams.id, id)).all())[0];
  if (!e) return { error: "الاختبار غير موجود" as const };
  if (!(await canManageExam(u, e.scopeKind, e.scopeId))) return { error: "لا صلاحية" as const };
  const now = Date.now();
  await db.update(exams).set({ status: "published", publishAt: now }).where(eq(exams.id, id)).run();
  const students = await scopeStudentPersons(e.scopeKind, e.scopeId);
  for (const pid of students) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: pid, channel: "inapp", kind: "exam_published",
      payload: JSON.stringify({ examId: id, title: e.title, kind: e.kind, dueAt: e.dueAt }),
      status: "queued", createdAt: now, sentAt: null,
    }).run();
  }
  return { ok: true as const, notified: students.length };
}

/* ===== اختباراتي (الطالب): المنشورة في نطاقاتي مع حالة تسليمي ===== */
export async function myExamsData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const memberships = await db.select().from(circleStudents)
    .where(and(eq(circleStudents.personId, u.personId), eq(circleStudents.status, "active"))).all();
  const memberCircleIds = [...new Set(memberships.map((m) => m.circleId))];
  if (!memberCircleIds.length) return { items: [] };
  // ف٧: أرشفةُ الحلقة تُسقط اختباراتها
  const cs = await selectByIdChunks(memberCircleIds, (b) => db.select().from(circles).where(and(inArray(circles.id, b), eq(circles.status, "active"))).all());
  const circleIds = cs.map((c) => c.id);
  const mosqueIds = [...new Set(cs.map((c) => c.mosqueId))];
  const now = Date.now();
  const list = (await db.select().from(exams).where(eq(exams.status, "published")).all())
    .filter((e) => (e.scopeKind === "circle" && circleIds.includes(e.scopeId)) || (e.scopeKind === "mosque" && mosqueIds.includes(e.scopeId)));
  if (!list.length) return { items: [] };
  const subs = await selectByIdChunks(list.map((e) => e.id), (b) => db.select().from(examSubmissions)
    .where(and(eq(examSubmissions.personId, u.personId), inArray(examSubmissions.examId, b))).all()); // ف٨
  const subBy = new Map(subs.map((s) => [s.examId, s]));
  return {
    items: list.map((e) => ({
      id: e.id, title: e.title, kind: e.kind, description: e.description, dueAt: e.dueAt,
      overdue: !!e.dueAt && now > e.dueAt,
      mySubmission: subBy.get(e.id) ? { score: subBy.get(e.id)!.score, maxScore: subBy.get(e.id)!.maxScore, submittedAt: subBy.get(e.id)!.submittedAt } : null,
    })).sort((a, b) => (a.mySubmission ? 1 : 0) - (b.mySubmission ? 1 : 0) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)),
  };
}

/* ===== أسئلة الاختبار للطالب (بلا إجاباتٍ صحيحة!) ===== */
export async function examQuestionsData(examId: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const e = (await db.select().from(exams).where(eq(exams.id, examId)).all())[0];
  if (!e || e.status !== "published") return { error: "الاختبار غير متاح" as const };
  const members = await scopeStudentPersons(e.scopeKind, e.scopeId);
  const manager = await canManageExam(u, e.scopeKind, e.scopeId);
  if (!members.includes(u.personId) && !manager) return { error: "الاختبار ليس ضمن حلقاتك" as const };
  const qs = (await db.select().from(examQuestions).where(eq(examQuestions.examId, examId)).all())
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    exam: { id: e.id, title: e.title, kind: e.kind, description: e.description, dueAt: e.dueAt },
    questions: qs.map((q) => ({ id: q.id, kind: q.kind, text: q.text, options: q.options ? JSON.parse(q.options) as string[] : null, points: q.points })),
  };
}

/* ===== تسليمٌ واحدٌ بتصحيحٍ آليّ ===== */
export async function submitExamData(input: { examId: string; answers: Record<string, string> }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const e = (await db.select().from(exams).where(eq(exams.id, input.examId)).all())[0];
  if (!e || e.status !== "published") return { error: "الاختبار غير متاح" as const };
  if (e.dueAt && Date.now() > e.dueAt) return { error: "انتهى وقت التسليم" as const };
  const members = await scopeStudentPersons(e.scopeKind, e.scopeId);
  if (!members.includes(u.personId)) return { error: "الاختبار ليس ضمن حلقاتك" as const };
  const prior = (await db.select({ id: examSubmissions.id }).from(examSubmissions)
    .where(and(eq(examSubmissions.examId, input.examId), eq(examSubmissions.personId, u.personId))).all())[0];
  if (prior) return { error: "سلّمتَ هذا الاختبار من قبل" as const };

  // التصحيح الآليّ
  const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, input.examId)).all();
  let score = 0, maxScore = 0;
  for (const q of qs) {
    maxScore += q.points;
    if ((input.answers[q.id] ?? "") === q.correct) score += q.points;
  }
  const now = Date.now();
  await db.insert(examSubmissions).values({
    id: crypto.randomUUID(), examId: input.examId, personId: u.personId, personName: u.fullName,
    answers: JSON.stringify(input.answers), score, maxScore, submittedAt: now,
  }).run();
  await db.insert(notifications).values({
    id: crypto.randomUUID(), personId: e.createdBy, channel: "inapp", kind: "exam_submitted",
    payload: JSON.stringify({ examId: e.id, title: e.title, student: u.fullName, score, maxScore }),
    status: "queued", createdAt: now, sentAt: null,
  }).run();
  return { ok: true as const, score, maxScore };
}

/* ===== متابعة المنشئ: اختباراتي + الدرجات ===== */
export async function myCreatedExamsData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const scopes = await creatableScopes(u);
  const mine = (await db.select().from(exams).all())
    .filter((e) => e.createdBy === u.personId || scopes.some((s) => s.kind === e.scopeKind && s.id === e.scopeId))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  if (!mine.length) return { items: [] };
  const subs = await db.select().from(examSubmissions).where(inArray(examSubmissions.examId, mine.map((e) => e.id))).all();
  const byExam = new Map<string, typeof subs>();
  for (const s of subs) { if (!byExam.has(s.examId)) byExam.set(s.examId, []); byExam.get(s.examId)!.push(s); }
  const items = [] as Array<{
    id: string; title: string; kind: string; status: string; dueAt: number | null; createdAt: number; expected: number;
    submissions: Array<{ personName: string | null; score: number; maxScore: number; submittedAt: number }>;
  }>;
  for (const e of mine) {
    const expected = (await scopeStudentPersons(e.scopeKind, e.scopeId)).length;
    items.push({
      id: e.id, title: e.title, kind: e.kind, status: e.status, dueAt: e.dueAt, createdAt: e.createdAt, expected,
      submissions: (byExam.get(e.id) ?? []).map((s) => ({ personName: s.personName, score: s.score, maxScore: s.maxScore, submittedAt: s.submittedAt }))
        .sort((a, b) => b.score - a.score),
    });
  }
  return { items };
}

export async function closeExamData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const e = (await db.select().from(exams).where(eq(exams.id, id)).all())[0];
  if (!e) return { error: "الاختبار غير موجود" as const };
  if (!(await canManageExam(u, e.scopeKind, e.scopeId))) return { error: "لا صلاحية" as const };
  await db.update(exams).set({ status: "closed" }).where(eq(exams.id, id)).run();
  return { ok: true as const };
}
