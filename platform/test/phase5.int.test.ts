import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { participants } from '../server/database/schema'
import { addDonation, addExpense, mosqueBalance } from '../server/services/mosqueFinance'
import { quorumMet, decisionResult, createMeeting, setAttendance, meetingQuorum, recordDecision } from '../server/services/meetings'
import { createPlan, addPlanItem, setItemStatus, planProgress } from '../server/services/plans'
import { createCircle, addStudent, addProgress, studentMemorizedAyahs } from '../server/services/tahfeez'
import { addGroupActivity } from '../server/services/halaqaWeekly'
import { createCompetition, addProgram, registerParticipant, recordScore, qualifyTop, selectWinner } from '../server/services/competition'
import { mosquesNeedingReminder, queueEntryReminders } from '../server/services/notifications'
import { issueRefreshToken, rotateRefreshToken, isRateLimited, recordFailedAttempt, resetAttempts } from '../server/services/authTokens'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')
const DAY = 86_400_000

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['0000_init', '0001_points', '0002_finance', '0003_ala_baseera', '0004_competition', '0005_governance', '0006_phase5_platform']) {
    sqlite.exec(readFileSync(resolve(dbDir, `migrations/${f}.sql`), 'utf8'))
  }
  sqlite.exec(readFileSync(resolve(dbDir, 'seed_points.sql'), 'utf8'))
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0),
      ('m2','idlib','/idlib/m2/','mosque','male','مسجد 2','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES
      ('pa','أحمد','male','active',0),('pb','بلال','male','active',0),('pam','أمير','male','active',0);
  `)
  return drizzle(sqlite, { schema })
}

describe('mosqueFinance — المالية الداخلية', () => {
  it('الميزان = التبرعات − المصروفات', async () => {
    const db = makeDb()
    await addDonation(db, { mosqueId: 'm1', amount: 100 })
    await addDonation(db, { mosqueId: 'm1', amount: 50 })
    await addExpense(db, { mosqueId: 'm1', amount: 30 })
    expect(await mosqueBalance(db, 'm1')).toEqual({ totalDonations: 150, totalExpenses: 30, balance: 120 })
  })
})

describe('meetings — النصاب والقرار (المادة 18)', () => {
  it('النصاب 50%+1', () => {
    expect(quorumMet(3, 5)).toBe(true)
    expect(quorumMet(2, 5)).toBe(false)
  })
  it('القرار: الأغلبية، والتعادل يرجّحه صوت الأمير', () => {
    expect(decisionResult(3, 2)).toBe('passed')
    expect(decisionResult(2, 3)).toBe('failed')
    expect(decisionResult(2, 2, true)).toBe('passed')
    expect(decisionResult(2, 2, false)).toBe('failed')
  })
  it('يحسب النصاب والقرار في قاعدة البيانات', async () => {
    const db = makeDb()
    const m = await createMeeting(db, { mosqueId: 'm1', scheduledAt: 1, memberCount: 5 })
    await setAttendance(db, m.id, 'pa', true)
    await setAttendance(db, m.id, 'pb', true)
    await setAttendance(db, m.id, 'pam', true)
    expect((await meetingQuorum(db, m.id) as any).met).toBe(true)
    const d = await recordDecision(db, { meetingId: m.id, title: 'قرار', votesFor: 2, votesAgainst: 2, totalVoters: 4, amirVoteFor: true })
    expect(d.result).toBe('passed')
  })
})

describe('plans — خطط اللجان', () => {
  it('نسبة الإنجاز', async () => {
    const db = makeDb()
    const p = await createPlan(db, { orgUnitId: 'm1', committee: 'dawah', yearHijri: '1447', title: 'خطة' })
    const i1 = await addPlanItem(db, p.id, 'بند 1')
    await addPlanItem(db, p.id, 'بند 2')
    await addPlanItem(db, p.id, 'بند 3')
    await setItemStatus(db, i1.id, 'done')
    expect(await planProgress(db, p.id)).toEqual({ total: 3, done: 1, pct: 33 })
  })
})

describe('tahfeez — التحفيظ', () => {
  it('إجمالي الآيات المحفوظة', async () => {
    const db = makeDb()
    const c = await createCircle(db, { mosqueId: 'm1', name: 'حلقة' })
    const s = await addStudent(db, c.id, 'pa')
    await addProgress(db, { studentId: s.id, fromAyah: 1, toAyah: 10 })
    await addProgress(db, { studentId: s.id, fromAyah: 11, toAyah: 15 })
    expect(await studentMemorizedAyahs(db, s.id)).toBe(15)
  })
})

describe('halaqaWeekly — الأنشطة الجماعية (حتى 5)', () => {
  it('يمنع تجاوز خمسة أنشطة للأسبوع', async () => {
    const db = makeDb()
    for (let i = 1; i <= 5; i++) {
      const r = await addGroupActivity(db, { halaqaId: 'h1', weekStart: '2025-12-06', description: `نشاط ${i}` })
      expect(r.seq).toBe(i)
    }
    const sixth = await addGroupActivity(db, { halaqaId: 'h1', weekStart: '2025-12-06', description: 'سادس' })
    expect(sixth.error).toContain('الحدّ الأقصى')
  })
})

describe('competition — التأهيل والفائز', () => {
  it('يؤهّل الأعلى ويختار الفائز', async () => {
    const db = makeDb()
    const comp = await createCompetition(db, { name: 'م' })
    const prog = await addProgram(db, { competitionId: comp.id, monthHijri: '1447-07', track: 'worship', title: 'ن' })
    const pa = await registerParticipant(db, { competitionId: comp.id, personId: 'pa', mosqueId: 'm1', age: 25 })
    const pb = await registerParticipant(db, { competitionId: comp.id, personId: 'pb', mosqueId: 'm1', age: 30 })
    await recordScore(db, { participantId: pa.id!, programId: prog.id, points: 20 })
    await recordScore(db, { participantId: pb.id!, programId: prog.id, points: 10 })

    const top = await qualifyTop(db, comp.id, 1)
    expect(top[0].personId).toBe('pa')
    expect((await db.select().from(participants).where(eq(participants.id, pa.id!)).all())[0].status).toBe('qualified')

    const winner = await selectWinner(db, comp.id)
    expect(winner.personId).toBe('pa')
    expect((await db.select().from(participants).where(eq(participants.id, pa.id!)).all())[0].status).toBe('winner')
  })
})

describe('notifications — تذكير الإدخال', () => {
  it('يرصد المساجد المتأخرة ويضع تذكيراً لأميرها', async () => {
    const db = makeDb()
    const asOf = 10 * DAY
    db.$client.exec(`
      INSERT INTO weekly_records (id,mosque_id,mosque_path,week_start,scheme_id,total_points,status,locked,last_entry_at,created_at)
        VALUES ('w1','m1','/idlib/m1/','2025-12-06','scheme-male',5,'draft',0,${asOf - 3 * DAY},0);
      INSERT INTO role_assignments (id,person_id,role,org_unit_id,org_path,term_number,approval_status,created_at)
        VALUES ('ra','pam','amir','m1','/idlib/m1/',1,'approved',0);
      INSERT INTO person_contacts (person_id,phone,telegram) VALUES ('pam',NULL,'123');
    `)
    const due = await mosquesNeedingReminder(db, '2025-12-06', asOf)
    expect(due.map((m) => m.id).sort()).toEqual(['m1', 'm2']) // m1 متأخر 3 أيام، m2 بلا سجل
    const q = await queueEntryReminders(db, '2025-12-06', asOf)
    expect(q.queued).toBe(1) // m1 له أمير؛ m2 بلا أمير
  })
})

describe('authTokens — تصلّب المصادقة', () => {
  it('تدوير رمز التحديث يُبطل القديم', async () => {
    const db = makeDb()
    const t1 = await issueRefreshToken(db, 'u1')
    const r = await rotateRefreshToken(db, t1)
    expect(r.userId).toBe('u1')
    expect(r.refreshToken).toBeTruthy()
    const again = await rotateRefreshToken(db, t1)
    expect(again.error).toBeDefined()
  })
  it('حدّ محاولات الدخول (5/15د)', async () => {
    const db = makeDb()
    const T = 1_000_000
    for (let i = 0; i < 5; i++) await recordFailedAttempt(db, 'k', T)
    expect(await isRateLimited(db, 'k', T)).toBe(true)
    await resetAttempts(db, 'k')
    expect(await isRateLimited(db, 'k', T)).toBe(false)
  })
})
