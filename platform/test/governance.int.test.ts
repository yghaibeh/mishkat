import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { roleAssignments } from '../server/database/schema'
import {
  assignTerm, termsEndingSoon, amirVacancies,
  requestResignation, decideResignation, overdueResignations,
  addDays, addYears, TERM_YEARS,
} from '../server/services/governance'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')
const T0 = 1_700_000_000_000 // وقت مرجعي ثابت

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0005_governance.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0),
      ('m2','idlib','/idlib/m2/','mosque','male','مسجد 2','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES ('p1','شخص','male','active',0);
  `)
  return drizzle(sqlite, { schema })
}

describe('governance — دورة الإدارة (الباب الخامس)', () => {
  it('يفرض حدّ الدورتين بنفس الحقيبة', async () => {
    const db = makeDb()
    const t1 = await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: T0 })
    expect(t1.termNumber).toBe(1)
    expect(t1.endDate).toBe(addYears(T0, TERM_YEARS))

    const t2 = await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: addYears(T0, 2) })
    expect(t2.termNumber).toBe(2)

    const t3 = await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: addYears(T0, 4) })
    expect(t3.error).toContain('الحد الأقصى')
  })

  it('يرصد الدورات المنتهية قريباً (3 أشهر)', async () => {
    const db = makeDb()
    await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: T0 }) // تنتهي بعد سنتين
    const asOfNearEnd = addDays(addYears(T0, TERM_YEARS), -30) // قبل الانتهاء بشهر
    expect((await termsEndingSoon(db, asOfNearEnd)).length).toBe(1)
    const asOfEarly = addDays(T0, 30) // مبكراً جداً
    expect((await termsEndingSoon(db, asOfEarly)).length).toBe(0)
  })

  it('يكشف شواغر الأمراء', async () => {
    const db = makeDb()
    await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: T0 })
    const vac = await amirVacancies(db, addDays(T0, 1))
    expect(vac.map((m) => m.id)).toEqual(['m2']) // m1 مشغول، m2 شاغر
  })

  it('الاستقالة: مهلة شهر، والقبول يُنهي التكليف، والتأخر يُرصد', async () => {
    const db = makeDb()
    const t = await assignTerm(db, { personId: 'p1', role: 'amir', orgUnitId: 'm1', startDate: T0 })
    const req = await requestResignation(db, t.id!, 'p1', 'سبب', T0)
    expect(req.decisionDeadline).toBe(addDays(T0, 30))

    // متأخرة قبل البتّ
    expect((await overdueResignations(db, addDays(T0, 31))).length).toBe(1)

    // القبول يضبط نهاية التكليف
    const dec = await decideResignation(db, req.id, true, 'admin', addDays(T0, 10))
    expect(dec.status).toBe('accepted')
    const ra = (await db.select().from(roleAssignments).where(eq(roleAssignments.id, t.id!)).all())[0]
    expect(ra.endDate).toBe(addDays(T0, 10))

    // بعد البتّ لم تعد متأخرة
    expect((await overdueResignations(db, addDays(T0, 31))).length).toBe(0)
  })
})
