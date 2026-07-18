import { and, eq, inArray } from 'drizzle-orm'
import {
  competitions, monthlyPrograms, participants, participantScores,
  centralExams, examResults, orgUnits,
} from '../database/schema'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// المسابقة (المرحلة 4): تسجيل المشتركين، نقاطهم الشهرية بنظام الأعذار، الاختبارات، الترتيب.

const MIN_AGE = 15
const MAX_AGE = 40

export async function createCompetition(db: Db, input: { name: string; startMonth?: string; endMonth?: string; qualificationMonth?: string; prizePool?: number }) {
  const id = crypto.randomUUID()
  await db.insert(competitions).values({
    id, name: input.name, startMonth: input.startMonth ?? null, endMonth: input.endMonth ?? null,
    qualificationMonth: input.qualificationMonth ?? null, prizePool: input.prizePool ?? null,
    status: 'active', createdAt: Date.now(),
  }).run()
  return { id }
}

export async function addProgram(db: Db, input: { competitionId: string; monthHijri: string; track: string; title: string; maxPoints?: number }) {
  const id = crypto.randomUUID()
  await db.insert(monthlyPrograms).values({
    id, competitionId: input.competitionId, monthHijri: input.monthHijri, track: input.track,
    title: input.title, maxPoints: input.maxPoints ?? 0,
  }).run()
  return { id }
}

export async function addExam(db: Db, input: { competitionId: string; title: string; dateHijri?: string; maxScore?: number }) {
  const id = crypto.randomUUID()
  await db.insert(centralExams).values({
    id, competitionId: input.competitionId, title: input.title, dateHijri: input.dateHijri ?? null,
    maxScore: input.maxScore ?? 100, createdAt: Date.now(),
  }).run()
  return { id }
}

// تسجيل مشترك: السن 15–40، ومرتبط بمسجد (شرط الدخول)، وبلا تكرار
export async function registerParticipant(db: Db, input: { competitionId: string; personId: string; mosqueId: string; age: number }, actorUserId?: string): Promise<{ id?: string; error?: string }> {
  if (input.age < MIN_AGE || input.age > MAX_AGE) return { error: `السن خارج النطاق المسموح (${MIN_AGE}–${MAX_AGE})` }
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.mosqueId)).all())[0]
  if (!mosque || mosque.type !== 'mosque' || mosque.status === 'archived') return { error: 'يلزم الالتحاق بمسجدٍ نشط' } // ج٤
  const dup = await db.select().from(participants).where(and(
    eq(participants.competitionId, input.competitionId), eq(participants.personId, input.personId),
  )).all()
  if (dup[0]) return { error: 'مسجَّل في هذه المسابقة' }
  const id = crypto.randomUUID()
  await db.insert(participants).values({
    id, competitionId: input.competitionId, personId: input.personId, mosqueId: input.mosqueId,
    ageAtRegistration: input.age, status: 'active', createdAt: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'register_participant', entity: 'participant', entityId: id, after: { personId: input.personId, mosqueId: input.mosqueId } })
  return { id }
}

// رصد نقاط نشاط شهري للمشترك (upsert) — مع حالة العذر
export async function recordScore(db: Db, input: { participantId: string; programId: string; points: number; excuseStatus?: 'none' | 'excused' }, actorUserId?: string) {
  const existing = await db.select().from(participantScores).where(and(
    eq(participantScores.participantId, input.participantId), eq(participantScores.programId, input.programId),
  )).all()
  const excuse = input.excuseStatus ?? 'none'
  if (existing[0]) {
    await db.update(participantScores).set({ points: input.points, excuseStatus: excuse, recordedBy: actorUserId ?? null })
      .where(eq(participantScores.id, existing[0].id)).run()
    return { id: existing[0].id, updated: true }
  }
  const id = crypto.randomUUID()
  await db.insert(participantScores).values({
    id, participantId: input.participantId, programId: input.programId, points: input.points,
    excuseStatus: excuse, recordedBy: actorUserId ?? null, createdAt: Date.now(),
  }).run()
  return { id, updated: false }
}

export async function recordExamResult(db: Db, input: { examId: string; participantId: string; score: number }) {
  const existing = await db.select().from(examResults).where(and(
    eq(examResults.examId, input.examId), eq(examResults.participantId, input.participantId),
  )).all()
  if (existing[0]) {
    await db.update(examResults).set({ score: input.score }).where(eq(examResults.id, existing[0].id)).run()
    return { id: existing[0].id, updated: true }
  }
  const id = crypto.randomUUID()
  await db.insert(examResults).values({ id, examId: input.examId, participantId: input.participantId, score: input.score, createdAt: Date.now() }).run()
  return { id, updated: false }
}

// الترتيب العام: مجموع النقاط الشهرية + درجات الاختبارات. الأعذار لا تُؤثر (لا تُخصم).
export async function leaderboard(db: Db, competitionId: string) {
  const parts = await db.select().from(participants).where(eq(participants.competitionId, competitionId)).all()
  if (!parts.length) return []
  const ids = parts.map((p) => p.id)
  const scores = await db.select().from(participantScores).where(inArray(participantScores.participantId, ids)).all()
  const exams = await db.select().from(examResults).where(inArray(examResults.participantId, ids)).all()

  const rows = parts.map((p) => {
    const ps = scores.filter((s) => s.participantId === p.id)
    const monthlyPoints = ps.reduce((s, x) => s + x.points, 0)
    const examPoints = exams.filter((e) => e.participantId === p.id).reduce((s, x) => s + x.score, 0)
    const excusedCount = ps.filter((x) => x.excuseStatus === 'excused').length
    return { participantId: p.id, personId: p.personId, mosqueId: p.mosqueId, monthlyPoints, examPoints, total: monthlyPoints + examPoints, excusedCount }
  })
  rows.sort((a, b) => b.total - a.total)
  return rows.map((r, i) => ({ rank: i + 1, ...r }))
}

// التأهيل: أعلى N في الترتيب يصبحون «متأهلين» (التصفية النهائية) — ذرّيّةٌ ومُدوَّنة (تدقيق الرصد)
export async function qualifyTop(db: Db, competitionId: string, topN: number, actorUserId?: string) {
  const board = await leaderboard(db, competitionId)
  const top = board.slice(0, topN)
  const stmts: unknown[] = top.map((row) => db.update(participants).set({ status: 'qualified' }).where(eq(participants.id, row.participantId)))
  stmts.push(db.update(competitions).set({ status: 'qualifying' }).where(eq(competitions.id, competitionId)))
  if (stmts.length) await db.batch(stmts as unknown as Parameters<typeof db.batch>[0])
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'qualify_top', entity: 'competition', entityId: competitionId, after: { topN, qualified: top.map((r) => r.participantId) } })
  return top.map((r) => ({ participantId: r.participantId, personId: r.personId, total: r.total }))
}

// اختيار الفائز (صاحب الترتيب الأول) وإغلاق المسابقة — ذرّيّةٌ ومُدوَّنة (أعلى الأحداث أثرًا)
export async function selectWinner(db: Db, competitionId: string, actorUserId?: string) {
  const board = await leaderboard(db, competitionId)
  if (!board.length) return { error: 'لا مشتركون' }
  const winner = board[0]
  await db.batch([
    db.update(participants).set({ status: 'winner' }).where(eq(participants.id, winner.participantId)),
    db.update(competitions).set({ status: 'closed' }).where(eq(competitions.id, competitionId)),
  ] as unknown as Parameters<typeof db.batch>[0])
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'select_winner', entity: 'competition', entityId: competitionId, after: { participantId: winner.participantId, personId: winner.personId, total: winner.total } })
  return { participantId: winner.participantId, personId: winner.personId, total: winner.total }
}
