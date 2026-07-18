import { and, eq } from 'drizzle-orm'
import { meetings, meetingAttendance, decisions } from '../database/schema'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// الاجتماعات والقرارات (المادة 18): النصاب 50%+1، الشورى ملزمة، صوت الأمير مرجِّح عند التعادل.

export function quorumMet(present: number, memberCount: number): boolean {
  return present * 2 > memberCount // أغلبية مطلقة (50% + 1)
}

// نتيجة القرار: يمرّ إن زادت أصوات القبول؛ وعند التعادل يرجّح صوت الأمير
export function decisionResult(votesFor: number, votesAgainst: number, amirVoteFor?: boolean | null): 'passed' | 'failed' {
  if (votesFor > votesAgainst) return 'passed'
  if (votesFor < votesAgainst) return 'failed'
  return amirVoteFor ? 'passed' : 'failed'
}

export async function createMeeting(db: Db, input: { mosqueId: string; type?: string; calledBy?: string; scheduledAt: number; memberCount: number }) {
  const id = crypto.randomUUID()
  await db.insert(meetings).values({
    id, mosqueId: input.mosqueId, type: input.type ?? 'periodic', calledBy: input.calledBy ?? null,
    scheduledAt: input.scheduledAt, memberCount: input.memberCount, createdAt: Date.now(),
  }).run()
  return { id }
}

export async function setAttendance(db: Db, meetingId: string, personId: string, present: boolean) {
  const existing = await db.select().from(meetingAttendance).where(and(
    eq(meetingAttendance.meetingId, meetingId), eq(meetingAttendance.personId, personId),
  )).all()
  if (existing[0]) {
    await db.update(meetingAttendance).set({ present }).where(eq(meetingAttendance.id, existing[0].id)).run()
    return { id: existing[0].id }
  }
  const id = crypto.randomUUID()
  await db.insert(meetingAttendance).values({ id, meetingId, personId, present }).run()
  return { id }
}

export async function meetingQuorum(db: Db, meetingId: string) {
  const m = (await db.select().from(meetings).where(eq(meetings.id, meetingId)).all())[0]
  if (!m) return { error: 'الاجتماع غير موجود' as const }
  const att = await db.select().from(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId)).all()
  const present = att.filter((a) => a.present).length
  return { present, memberCount: m.memberCount, met: quorumMet(present, m.memberCount) }
}

export async function recordDecision(db: Db, input: {
  meetingId: string; title: string; kind?: 'binding' | 'advisory';
  votesFor: number; votesAgainst: number; totalVoters: number; amirVoteFor?: boolean; note?: string
}, actorUserId?: string) {
  const result = decisionResult(input.votesFor, input.votesAgainst, input.amirVoteFor)
  const id = crypto.randomUUID()
  await db.insert(decisions).values({
    id, meetingId: input.meetingId, title: input.title, kind: input.kind ?? 'binding',
    votesFor: input.votesFor, votesAgainst: input.votesAgainst, totalVoters: input.totalVoters,
    amirVoteFor: input.amirVoteFor ?? null, result, note: input.note ?? null,
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'record_decision', entity: 'decision', entityId: id, after: { title: input.title, result } })
  return { id, result }
}
