import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { orgUnits, weeklyRecords } from '../server/database/schema'
import { syncEntries, approveRecord, setLock } from '../server/services/records'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')

// بدائل لمتغيرات Nuxt العامة أثناء الاختبار
if (!(globalThis as any).createError) {
  ;(globalThis as any).createError = (e: any) => Object.assign(new Error(e?.statusMessage || 'error'), e)
}

function makeDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(readFileSync(resolve(dbDir, 'migrations/0000_init.sql'), 'utf8'))
  sqlite.exec(readFileSync(resolve(dbDir, 'migrations/0001_points.sql'), 'utf8'))
  sqlite.exec(readFileSync(resolve(dbDir, 'seed_points.sql'), 'utf8'))
  sqlite.exec(`
    INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at) VALUES
      ('idlib',NULL,'/idlib/','rabita','male','رابطة إدلب','active',0),
      ('bloc-north','idlib','/idlib/bloc-north/','bloc','male','كتلة الشمال','active',0),
      ('sq-1','bloc-north','/idlib/bloc-north/sq-1/','square','male','مربع 1','active',0),
      ('m-farouq','sq-1','/idlib/bloc-north/sq-1/m-farouq/','mosque','male','الفاروق','active',0),
      ('m-taqwa','sq-1','/idlib/bloc-north/sq-1/m-taqwa/','mosque','female','التقوى','active',0);
  `)
  return drizzle(sqlite, { schema })
}
const W = '2024-01-06'
const mosque = async (db: any, id: string) => (await db.select().from(orgUnits).where(eq(orgUnits.id, id)).all())[0]
const rec = async (db: any, id: string) => (await db.select().from(weeklyRecords).where(eq(weeklyRecords.mosqueId, id)).all())[0]
const caps = { userId: 'u-amir', canEditLocked: false, committee: null }

describe('syncEntries — مزامنة السجل اليومي', () => {
  it('يحسب النقاط، يستثني بلا شورى، idempotent، آخر كتابة تكسب، ويحترم القفل', async () => {
    const db = makeDb()
    const m = await mosque(db, 'm-farouq')

    // درسان «على بصيرة» (وزن 2، شورى) = 4؛ + دروس بلا شورى (مُستثنى)
    let r = await syncEntries(db, m, caps, [
      { clientUuid: 'c1', weekStart: W, day: 'sat', activityTypeId: 'm_ala_baseera', count: 2, shuraConfirmed: true, recordedAt: 1000 },
      { clientUuid: 'c2', weekStart: W, day: 'sat', activityTypeId: 'm_lessons', count: 3, shuraConfirmed: false, recordedAt: 1000 },
    ])
    expect(r.applied).toBe(2)
    expect(r.records[0].totalPoints).toBe(4)

    // idempotency: نفس client_uuid يُرفض
    r = await syncEntries(db, m, caps, [
      { clientUuid: 'c1', weekStart: W, day: 'sat', activityTypeId: 'm_ala_baseera', count: 9, shuraConfirmed: true, recordedAt: 5000 },
    ])
    expect(r.applied).toBe(0)
    expect(r.rejected[0].reason).toContain('idempotent')
    expect((await rec(db, 'm-farouq')).totalPoints).toBe(4)

    // آخر كتابة تكسب: نسخة أقدم تُرفض، أحدث تُحدّث
    r = await syncEntries(db, m, caps, [
      { clientUuid: 'c3', weekStart: W, day: 'sat', activityTypeId: 'm_ala_baseera', count: 5, shuraConfirmed: true, recordedAt: 500 },
    ])
    expect(r.rejected[0].reason).toContain('أقدم')
    r = await syncEntries(db, m, caps, [
      { clientUuid: 'c4', weekStart: W, day: 'sat', activityTypeId: 'm_ala_baseera', count: 1, shuraConfirmed: true, recordedAt: 2000 },
    ])
    expect(r.applied).toBe(1)
    expect((await rec(db, 'm-farouq')).totalPoints).toBe(2) // 1 × 2

    // قفل الأسبوع (ق5): المباشر يضيف فقط ولا يعدّل
    await setLock(db, await rec(db, 'm-farouq'), 'u', true)
    r = await syncEntries(db, m, caps, [
      { clientUuid: 'c5', weekStart: W, day: 'sat', activityTypeId: 'm_ala_baseera', count: 9, shuraConfirmed: true, recordedAt: 9000 }, // تعديل → مرفوض
      { clientUuid: 'c6', weekStart: W, day: 'sun', activityTypeId: 'm_media', count: 1, shuraConfirmed: true, recordedAt: 9000 }, // إضافة → مقبول
    ])
    expect(r.applied).toBe(1)
    expect(r.rejected.some((x) => x.reason.includes('مقفل'))).toBe(true)
    expect((await rec(db, 'm-farouq')).totalPoints).toBe(3) // 2 + 1
  })

  it('يرفض نشاطاً لا يخص مسار جنس المسجد (ق6)', async () => {
    const db = makeDb()
    const male = await mosque(db, 'm-farouq')
    const r = await syncEntries(db, male, caps, [
      { clientUuid: 'x1', weekStart: W, day: 'sat', activityTypeId: 'f_dawah_visit', count: 1, shuraConfirmed: true, recordedAt: 1 },
    ])
    expect(r.applied).toBe(0)
    expect(r.rejected[0].reason).toContain('مسار')

    const female = await mosque(db, 'm-taqwa')
    const r2 = await syncEntries(db, female, caps, [
      { clientUuid: 'x2', weekStart: W, day: 'sat', activityTypeId: 'f_dawah_visit', count: 1, shuraConfirmed: true, recordedAt: 1 },
    ])
    expect(r2.applied).toBe(1)
    expect(r2.records[0].totalPoints).toBe(1)
  })
})

describe('approveRecord — سلسلة الاعتماد (ق1)', () => {
  it('مسودة → اعتماد الأمير → اعتماد أعلى طبقة، ويمنع التخطّي', async () => {
    const db = makeDb()
    const m = await mosque(db, 'm-farouq')
    await syncEntries(db, m, caps, [
      { clientUuid: 'a1', weekStart: W, day: 'sat', activityTypeId: 'm_family_meeting', count: 1, shuraConfirmed: true, recordedAt: 1 },
    ])

    let res = await approveRecord(db, await rec(db, 'm-farouq'), { isAmir: true, isLayer: false, isAdmin: false, userId: 'u-amir' })
    expect(res.status).toBe('amir_approved')

    // طبقة غير مخوّلة لا تستطيع الاعتماد النهائي
    res = await approveRecord(db, await rec(db, 'm-farouq'), { isAmir: false, isLayer: false, isAdmin: false, userId: 'x' })
    expect(res.error).toBeDefined()
    expect(res.status).toBe('amir_approved')

    // أعلى طبقة مفعّلة تعتمد نهائياً
    res = await approveRecord(db, await rec(db, 'm-farouq'), { isAmir: false, isLayer: true, isAdmin: false, userId: 'u-sq' })
    expect(res.status).toBe('layer_approved')
  })
})
