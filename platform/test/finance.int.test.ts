import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { monthlyEntitlements } from '../server/database/schema'
import { computeMonthlyEntitlement, approveEntitlement, recordPayout } from '../server/services/finance'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')
const MONTH = '1447-12'

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0001_points.sql', 'migrations/0002_finance.sql', 'migrations/0003_ala_baseera.sql', 'seed_points.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  // مسجد + أشخاص + تكليفات + سجلات أسبوعية بشهر هجري محدّد
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES
      ('p-amir','أمير','male','active',0),
      ('p-admin','مدير','male','active',0),
      ('p-both','جامع','male','active',0);
    INSERT INTO role_assignments (id,person_id,role,org_unit_id,org_path,term_number,approval_status,created_at) VALUES
      ('ra1','p-amir','amir','m1','/idlib/m1/',1,'approved',0),
      ('ra2','p-admin','admin','idlib','/idlib/',1,'approved',0),
      ('ra3','p-both','amir','m1','/idlib/m1/',1,'approved',0),
      ('ra4','p-both','admin','idlib','/idlib/',1,'approved',0);
    -- مجموع نقاط الشهر للمسجد = 140 + 140 = 280  → 50$
    INSERT INTO weekly_records (id,mosque_id,mosque_path,week_start,hijri_month,scheme_id,total_points,status,locked,created_at) VALUES
      ('w1','m1','/idlib/m1/','2025-12-06','1447-12','scheme-male',140,'layer_approved',0,0),
      ('w2','m1','/idlib/m1/','2025-12-13','1447-12','scheme-male',140,'layer_approved',0,0);
  `)
  return drizzle(sqlite, { schema })
}

describe('finance — المستحق الشهري (ق2/ق7/ق8)', () => {
  it('مسار النقاط: 280 نقطة = 50$ للأمير', async () => {
    const db = makeDb()
    const res = await computeMonthlyEntitlement(db, 'p-amir', MONTH)
    expect(res.grossAmount).toBe(50)
    expect(res.tracks).toHaveLength(1)
    expect(res.tracks[0]).toMatchObject({ kind: 'points', basis: 280, amount: 50 })
  })

  it('مسار مقطوع: 100$ للإدارة العليا', async () => {
    const db = makeDb()
    const res = await computeMonthlyEntitlement(db, 'p-admin', MONTH)
    expect(res.grossAmount).toBe(100)
    expect(res.tracks[0]).toMatchObject({ kind: 'fixed', amount: 100 })
  })

  it('الأوصاف تُجمع: أمير + إدارة = 150$ (ق8)', async () => {
    const db = makeDb()
    const res = await computeMonthlyEntitlement(db, 'p-both', MONTH)
    expect(res.grossAmount).toBe(150)
    expect(res.tracks.map((t) => t.kind).sort()).toEqual(['fixed', 'points'])
  })

  it('الاعتماد ثم الصرف؛ ومنع الصرف قبل الاعتماد', async () => {
    const db = makeDb()
    const ent = await computeMonthlyEntitlement(db, 'p-amir', MONTH)
    // لا صرف قبل الاعتماد
    const early = await recordPayout(db, ent.id!, 50, 'u-admin')
    expect(early.error).toBeDefined()
    // اعتماد ثم صرف فعلي (مع خصم تشغيلي يدوي في المبلغ المصروف)
    const ap = await approveEntitlement(db, ent.id!, 'u-admin')
    expect(ap.status).toBe('approved')
    const pay = await recordPayout(db, ent.id!, 48, 'u-admin', 'حوالة #12')
    expect(pay.status).toBe('paid')
    const after = (await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.id, ent.id!)).all())[0]
    expect(after.status).toBe('paid')
  })

  it('لا يُعاد حساب مستحق مصروف', async () => {
    const db = makeDb()
    const ent = await computeMonthlyEntitlement(db, 'p-amir', MONTH)
    await approveEntitlement(db, ent.id!, 'u')
    await recordPayout(db, ent.id!, 50, 'u')
    const again = await computeMonthlyEntitlement(db, 'p-amir', MONTH)
    expect(again.status).toBe('paid')
    expect(again.note).toContain('مصروف')
  })
})
