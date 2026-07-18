import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { createVenue, createTeacher, createHalaqa, enrollStudent, recordLesson, teacherHoursTrack } from '../server/services/alaBaseera'
import { computeMonthlyEntitlement } from '../server/services/finance'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')
const MONTH = '1447-12'

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0001_points.sql', 'migrations/0002_finance.sql', 'migrations/0003_ala_baseera.sql', 'seed_points.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES
      ('p-teacher','معلّم','male','active',0),
      ('p-amir-teacher','أمير ومعلّم','male','active',0),
      ('s1','طالب1','male','active',0),('s2','طالب2','male','active',0);
    INSERT INTO role_assignments (id,person_id,role,org_unit_id,org_path,term_number,approval_status,created_at) VALUES
      ('ra-at','p-amir-teacher','amir','m1','/idlib/m1/',1,'approved',0);
    INSERT INTO weekly_records (id,mosque_id,mosque_path,week_start,hijri_month,scheme_id,total_points,status,locked,created_at) VALUES
      ('w1','m1','/idlib/m1/','2025-12-06','1447-12','scheme-male',280,'layer_approved',0,0);
  `)
  return drizzle(sqlite, { schema })
}

describe('alaBaseera — الحلقات والتسجيل والدروس', () => {
  it('يمنع ازدواج التسجيل ويحترم السعة', async () => {
    const db = makeDb()
    const v = await createVenue(db, { type: 'institute', name: 'معهد الفردوس', genderTrack: 'female' })
    const t = await createTeacher(db, { personId: 'p-teacher' })
    const h = await createHalaqa(db, { name: 'حلقة 1', venueId: v.id, teacherId: t.id, capacity: 1 })

    const e1 = await enrollStudent(db, h.id, 's1')
    expect(e1.id).toBeDefined()
    const dup = await enrollStudent(db, h.id, 's1')
    expect(dup.error).toContain('مسجَّل')
    const full = await enrollStudent(db, h.id, 's2')
    expect(full.error).toContain('مكتملة')
  })

  it('يحسب مسار الساعات: 10 ساعات × 2$ = 20$', async () => {
    const db = makeDb()
    const t = await createTeacher(db, { personId: 'p-teacher' })
    const v = await createVenue(db, { type: 'mosque', name: 'مسجد' })
    const h = await createHalaqa(db, { name: 'ح', venueId: v.id, teacherId: t.id })
    await recordLesson(db, { halaqaId: h.id, teacherId: t.id, durationHours: 6, hijriMonth: MONTH, lessonTitle: 'المجلس 1' })
    await recordLesson(db, { halaqaId: h.id, teacherId: t.id, durationHours: 4, hijriMonth: MONTH })
    const track = await teacherHoursTrack(db, 'p-teacher', MONTH)
    expect(track).toMatchObject({ hours: 10, rate: 2, amount: 20 })
  })

  it('المالية تجمع الأوصاف: أمير (50$) + معلّم (20$) = 70$ (ق8)', async () => {
    const db = makeDb()
    const t = await createTeacher(db, { personId: 'p-amir-teacher' })
    const v = await createVenue(db, { type: 'mosque', name: 'مسجد' })
    const h = await createHalaqa(db, { name: 'ح', venueId: v.id, teacherId: t.id })
    await recordLesson(db, { halaqaId: h.id, teacherId: t.id, durationHours: 10, hijriMonth: MONTH })

    const ent = await computeMonthlyEntitlement(db, 'p-amir-teacher', MONTH)
    expect(ent.grossAmount).toBe(70) // 280 نقطة=50$ + 10 ساعات=20$
    expect(ent.tracks.map((x) => x.kind).sort()).toEqual(['hours', 'points'])
  })
})
