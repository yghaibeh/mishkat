import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { monthlyMosqueReport } from '../server/services/reports'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')
const MONTH = '1447-12'

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0001_points.sql', 'seed_points.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0);
    INSERT INTO weekly_records (id,mosque_id,mosque_path,week_start,hijri_month,scheme_id,total_points,status,locked,created_at) VALUES
      ('w1','m1','/idlib/m1/','2025-12-06','1447-12','scheme-male',5,'layer_approved',0,0),
      ('w2','m1','/idlib/m1/','2025-12-13','1447-12','scheme-male',4,'layer_approved',0,0);
    INSERT INTO daily_entries (id,client_uuid,weekly_record_id,mosque_id,week_start,day,activity_type_id,count,points,shura_confirmed,recorded_at,synced_at) VALUES
      ('d1','u1','w1','m1','2025-12-06','sat','m_ala_baseera',2,4,1,1,1),
      ('d2','u2','w1','m1','2025-12-06','sat','m_family_meeting',1,1,1,1,1),
      ('d3','u3','w2','m1','2025-12-13','sun','m_lessons',2,4,1,1,1),
      ('d4','u4','w2','m1','2025-12-13','sun','m_media',3,3,0,1,1);
  `)
  return drizzle(sqlite, { schema })
}

describe('reports — التقرير الشهري للمسجد', () => {
  it('يجمع النقاط الأسبوعية وتفصيل الأنشطة والقيمة المالية', async () => {
    const db = makeDb()
    const r = await monthlyMosqueReport(db, 'm1', MONTH)

    expect(r.monthTotal).toBe(9)            // 5 + 4
    expect(r.weeksCount).toBe(2)
    expect(r.monthlyTarget).toBe(140)       // 70 × 2
    expect(r.achievementPct).toBe(6)        // 9/140
    expect(r.money).toBe(1.61)              // 9 × 50/280
    expect(r.allApproved).toBe(true)
    expect(r.weeks).toHaveLength(2)

    // الإدخال بلا شورى (m_media) مستثنى من تفصيل الأنشطة
    expect(r.activities.find((a) => a.name.includes('إعلامي'))).toBeUndefined()
    const ala = r.activities.find((a) => a.name.includes('بصيرة'))
    expect(ala).toMatchObject({ times: 2, points: 4 })
    expect(r.activities).toHaveLength(3)
  })

  it('شهر بلا سجلات: مجموع صفر', async () => {
    const db = makeDb()
    const r = await monthlyMosqueReport(db, 'm1', '1447-01')
    expect(r.monthTotal).toBe(0)
    expect(r.weeksCount).toBe(0)
    expect(r.allApproved).toBe(false)
  })
})
