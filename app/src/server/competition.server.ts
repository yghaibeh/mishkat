// منطق وحدة المسابقة (خادم فقط) — لوحة ترتيب متوسّعة عبر SQL (لا تحميل كل المشتركين).
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { competitions, monthlyPrograms, centralExams, participants, participantScores, examResults, persons } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { registerParticipant, addProgram, addExam, recordScore, recordExamResult, qualifyTop, selectWinner } from "./services/competition";

async function requireAdmin() {
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) throw new Error("إدارة المسابقة للإدارة العليا");
  return u;
}
async function count(query: { all: () => Promise<Array<{ c: number }>> }) {
  return (await query.all())[0]?.c ?? 0;
}

const PAGE = 25;

export async function competitionData() {
  await requireAdmin();
  const db = useDb();
  const comp = (await db.select().from(competitions).orderBy(desc(competitions.createdAt)).limit(1).all())[0] ?? null;
  if (!comp) return { competition: null, kpis: { participants: 0, qualified: 0, programs: 0, exams: 0 }, prizePool: 0 };
  const [partN, qualN, progN, examN] = await Promise.all([
    count(db.select({ c: sql<number>`count(*)` }).from(participants).where(eq(participants.competitionId, comp.id))),
    count(db.select({ c: sql<number>`sum(case when status in ('qualified','winner') then 1 else 0 end)` }).from(participants).where(eq(participants.competitionId, comp.id))),
    count(db.select({ c: sql<number>`count(*)` }).from(monthlyPrograms).where(eq(monthlyPrograms.competitionId, comp.id))),
    count(db.select({ c: sql<number>`count(*)` }).from(centralExams).where(eq(centralExams.competitionId, comp.id))),
  ]);
  return {
    competition: { id: comp.id, name: comp.name, startMonth: comp.startMonth, endMonth: comp.endMonth, status: comp.status, prizePool: comp.prizePool ?? 0 },
    kpis: { participants: partN, qualified: qualN, programs: progN, exams: examN },
  };
}

// لوحة الترتيب: مجموع النقاط الشهرية + الاختبارات، عبر SQL مع ترقيم وبحث (الأعذار لا تُخصم).
export async function leaderboardPage(competitionId: string, q?: string, offset = 0) {
  await requireAdmin();
  const db = useDb();
  const term = (q ?? "").trim();
  const nameFilter = term ? sql`AND per.full_name LIKE ${"%" + term + "%"}` : sql``;

  const rows = (await db.all(sql`
    SELECT p.id AS id, per.full_name AS name, COALESCE(o.name,'—') AS mosque, p.status AS status,
      COALESCE(ps.pts,0) AS monthly, COALESCE(er.pts,0) AS exam,
      (COALESCE(ps.pts,0)+COALESCE(er.pts,0)) AS total
    FROM participants p
    JOIN persons per ON per.id = p.person_id
    LEFT JOIN org_units o ON o.id = p.mosque_id
    LEFT JOIN (SELECT participant_id, SUM(points) pts FROM participant_scores GROUP BY participant_id) ps ON ps.participant_id = p.id
    LEFT JOIN (SELECT participant_id, SUM(score) pts FROM exam_results GROUP BY participant_id) er ON er.participant_id = p.id
    WHERE p.competition_id = ${competitionId} ${nameFilter}
    ORDER BY total DESC, p.created_at ASC
    LIMIT ${PAGE} OFFSET ${offset}
  `)) as Array<{ id: string; name: string; mosque: string; status: string; monthly: number; exam: number; total: number }>;

  const totalRows = (await db.all(sql`
    SELECT count(*) AS c FROM participants p JOIN persons per ON per.id = p.person_id
    WHERE p.competition_id = ${competitionId} ${nameFilter}
  `)) as Array<{ c: number }>;

  const items = rows.map((r, i) => ({
    rank: offset + i + 1, id: r.id, name: r.name, mosque: r.mosque, status: r.status,
    monthly: r.monthly, exam: r.exam, total: r.total,
  }));
  return { items, total: totalRows[0]?.c ?? 0, offset, pageSize: PAGE };
}

export async function registerParticipantData(input: { competitionId: string; personId: string; mosqueId: string; age: number }) {
  const u = await requireAdmin();
  const res = await registerParticipant(useDb(), input, u.userId);
  return "error" in res && res.error ? { error: res.error } : { ok: true as const };
}

// إنشاء مسابقة جديدة (F7) — الإدارة العليا. تُصبح المسابقة الحالية فوراً.
export async function createCompetitionData(input: { name: string; startMonth?: string; endMonth?: string; prizePool?: number }) {
  await requireAdmin();
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(competitions).values({
    id, name: input.name.trim(),
    startMonth: input.startMonth?.trim() || null, endMonth: input.endMonth?.trim() || null,
    qualificationMonth: null, prizePool: input.prizePool ?? 0, status: "active", createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

// تغيير حالة المسابقة — انتقالاتٌ أماميّةٌ فقط (ج٤): active→qualifying→closed، لا إعادةَ فتحٍ للمغلقة
const STATUS_RANK: Record<string, number> = { active: 0, qualifying: 1, closed: 2 };
export async function setCompetitionStatusData(input: { id: string; status: "active" | "qualifying" | "closed" }) {
  await requireAdmin();
  const db = useDb();
  const cur = (await db.select().from(competitions).where(eq(competitions.id, input.id)).all())[0];
  if (!cur) return { error: "المسابقة غير موجودة" as const };
  if ((STATUS_RANK[input.status] ?? 0) < (STATUS_RANK[cur.status] ?? 0)) return { error: "لا يمكن إرجاع حالة المسابقة" as const };
  await db.update(competitions).set({ status: input.status }).where(eq(competitions.id, input.id)).run();
  return { ok: true as const };
}

/* ===== إدارةُ المسابقة (ج٤ — وصْلُ منطقٍ كان معرَّفًا بلا واجهةٍ تستدعيه) ===== */

// البرامج والاختبارات والمشتركون — لشبكة الرصد
export async function competitionManageData(competitionId: string) {
  await requireAdmin();
  const db = useDb();
  const progs = await db.select().from(monthlyPrograms).where(eq(monthlyPrograms.competitionId, competitionId)).orderBy(asc(monthlyPrograms.monthHijri)).all();
  const exams = await db.select().from(centralExams).where(eq(centralExams.competitionId, competitionId)).orderBy(desc(centralExams.createdAt)).all();
  const parts = await db.select({ id: participants.id, personId: participants.personId, name: persons.fullName, status: participants.status })
    .from(participants).innerJoin(persons, eq(persons.id, participants.personId))
    .where(eq(participants.competitionId, competitionId)).orderBy(asc(persons.fullName)).all();
  const pIds = parts.map((p) => p.id);
  const scores = pIds.length ? await db.select().from(participantScores).where(inArray(participantScores.participantId, pIds)).all() : [];
  const exResults = pIds.length ? await db.select().from(examResults).where(inArray(examResults.participantId, pIds)).all() : [];
  return {
    programs: progs.map((p) => ({ id: p.id, monthHijri: p.monthHijri, track: p.track, title: p.title, maxPoints: p.maxPoints })),
    exams: exams.map((e) => ({ id: e.id, title: e.title, dateHijri: e.dateHijri, maxScore: e.maxScore })),
    participants: parts,
    scores: scores.map((s) => ({ participantId: s.participantId, programId: s.programId, points: s.points, excuseStatus: s.excuseStatus })),
    examResults: exResults.map((r) => ({ participantId: r.participantId, examId: r.examId, score: r.score })),
  };
}

export async function addProgramData(input: { competitionId: string; monthHijri: string; track: string; title: string; maxPoints?: number }) {
  await requireAdmin();
  const res = await addProgram(useDb(), input);
  return { ok: true as const, id: res.id };
}
export async function addExamData(input: { competitionId: string; title: string; dateHijri?: string; maxScore?: number }) {
  await requireAdmin();
  const res = await addExam(useDb(), input);
  return { ok: true as const, id: res.id };
}
export async function recordScoreData(input: { participantId: string; programId: string; points: number; excuseStatus?: "none" | "excused" }) {
  const u = await requireAdmin();
  const db = useDb();
  const prog = (await db.select().from(monthlyPrograms).where(eq(monthlyPrograms.id, input.programId)).all())[0];
  if (!prog) return { error: "البرنامج غير موجود" as const };
  if (input.points < 0 || (prog.maxPoints > 0 && input.points > prog.maxPoints)) return { error: `النقاط بين ٠ و${prog.maxPoints}` as const };
  await recordScore(db, input, u.userId);
  return { ok: true as const };
}
export async function recordExamResultData(input: { examId: string; participantId: string; score: number }) {
  await requireAdmin();
  const db = useDb();
  const ex = (await db.select().from(centralExams).where(eq(centralExams.id, input.examId)).all())[0];
  if (!ex) return { error: "الاختبار غير موجود" as const };
  if (input.score < 0 || input.score > ex.maxScore) return { error: `الدرجة بين ٠ و${ex.maxScore}` as const };
  await recordExamResult(db, input);
  return { ok: true as const };
}
export async function qualifyTopData(input: { competitionId: string; topN: number }) {
  const u = await requireAdmin();
  const top = await qualifyTop(useDb(), input.competitionId, input.topN, u.userId);
  return { ok: true as const, qualified: top.length };
}
export async function selectWinnerData(input: { competitionId: string }) {
  const u = await requireAdmin();
  const res = await selectWinner(useDb(), input.competitionId, u.userId);
  return "error" in res ? { error: res.error as string } : { ok: true as const, personId: res.personId };
}
