import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import {
  createCompetition, addProgram, addExam, registerParticipant,
  recordScore, recordExamResult, leaderboard,
} from '../server/services/competition'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0004_competition.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES
      ('a','أحمد','male','active',0),('b','بلال','male','active',0),('c','صغير','male','active',0);
  `)
  return drizzle(sqlite, { schema })
}

describe('competition — التسجيل والشروط', () => {
  it('يفرض السن 15–40 والالتحاق بمسجد ويمنع التكرار', async () => {
    const db = makeDb()
    const comp = await createCompetition(db, { name: 'المسجد المؤثر' })
    const ok = await registerParticipant(db, { competitionId: comp.id, personId: 'a', mosqueId: 'm1', age: 25 })
    expect(ok.id).toBeDefined()

    const young = await registerParticipant(db, { competitionId: comp.id, personId: 'c', mosqueId: 'm1', age: 12 })
    expect(young.error).toContain('السن')

    const noMosque = await registerParticipant(db, { competitionId: comp.id, personId: 'b', mosqueId: 'idlib', age: 30 })
    expect(noMosque.error).toContain('مسجد')

    const dup = await registerParticipant(db, { competitionId: comp.id, personId: 'a', mosqueId: 'm1', age: 25 })
    expect(dup.error).toContain('مسجَّل')
  })
})

describe('competition — النقاط والأعذار والترتيب', () => {
  it('الأعذار لا تُؤثر في الجدول، والترتيب بالمجموع (نقاط + اختبار)', async () => {
    const db = makeDb()
    const comp = await createCompetition(db, { name: 'م' })
    const prog = await addProgram(db, { competitionId: comp.id, monthHijri: '1447-07', track: 'worship', title: 'صلاة الجماعة', maxPoints: 30 })
    const exam = await addExam(db, { competitionId: comp.id, title: 'الاختبار الأول', maxScore: 100 })

    const pa = await registerParticipant(db, { competitionId: comp.id, personId: 'a', mosqueId: 'm1', age: 25 })
    const pb = await registerParticipant(db, { competitionId: comp.id, personId: 'b', mosqueId: 'm1', age: 30 })

    await recordScore(db, { participantId: pa.id!, programId: prog.id, points: 20 })
    await recordScore(db, { participantId: pb.id!, programId: prog.id, points: 10 })
    await recordExamResult(db, { examId: exam.id, participantId: pa.id!, score: 50 })
    await recordExamResult(db, { examId: exam.id, participantId: pb.id!, score: 80 })

    // a: 20+50=70 ، b: 10+80=90 → b أولاً
    let board = await leaderboard(db, comp.id)
    expect(board[0].personId).toBe('b')
    expect(board[0].total).toBe(90)
    expect(board[1].total).toBe(70)

    // عذر مقبول (0 نقطة، excused) لا يخفض مجموع a
    await recordScore(db, { participantId: pa.id!, programId: prog.id, points: 20, excuseStatus: 'excused' })
    board = await leaderboard(db, comp.id)
    const aRow = board.find((r) => r.personId === 'a')!
    expect(aRow.total).toBe(70)        // لم ينخفض
    expect(aRow.excusedCount).toBe(1)
  })
})
