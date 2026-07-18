import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { orgUnits, weeklyRecords } from '../server/database/schema'
import { syncEntries } from '../server/services/records'
import { computeMonthlyEntitlement } from '../server/services/finance'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')

function makeDb() {
  const sqlite = new Database(':memory:')
  for (const f of ['migrations/0000_init.sql', 'migrations/0001_points.sql', 'migrations/0002_finance.sql', 'migrations/0003_ala_baseera.sql', 'seed_points.sql']) {
    sqlite.exec(readFileSync(resolve(dbDir, f), 'utf8'))
  }
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة','active',0),
      ('m1','idlib','/idlib/m1/','mosque','male','مسجد 1','active',0);
    INSERT INTO persons (id,full_name,gender,status,created_at) VALUES ('p-amir','أمير','male','active',0);
    INSERT INTO role_assignments (id,person_id,role,org_unit_id,org_path,term_number,approval_status,created_at)
      VALUES ('ra','p-amir','amir','m1','/idlib/m1/',1,'approved',0);
  `)
  return drizzle(sqlite, { schema })
}

// regression: الشهر الهجري يُحسب آلياً عند الإدخال ويصل للمالية (الفجوة المُصلَحة)
describe('تكامل الشهر الهجري — من الإدخال إلى المالية', () => {
  it('syncEntries يملأ hijriMonth آلياً، والمالية تجده', async () => {
    const db = makeDb()
    const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, 'm1')).all())[0]

    await syncEntries(db, mosque, { userId: 'p-amir', canEditLocked: false, committee: null }, [
      { clientUuid: 'h1', weekStart: '2025-12-06', day: 'sat', activityTypeId: 'm_ala_baseera', count: 2, shuraConfirmed: true, recordedAt: 1 },
    ])

    // الشهر الهجري حُسب آلياً (لم يُضبط يدوياً) = 1447-06
    const rec = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, 'm1')).all())[0]
    expect(rec.hijriMonth).toBe('1447-06')
    expect(rec.totalPoints).toBe(4)

    // المالية تجد نقاط الشهر المحسوب وتحوّلها لمال (4 × 50/280 = 0.71$)
    const ent = await computeMonthlyEntitlement(db, 'p-amir', '1447-06')
    expect(ent.grossAmount).toBe(0.71)
    expect(ent.tracks.find((t) => t.kind === 'points')?.basis).toBe(4)
  })
})
