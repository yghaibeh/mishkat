import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from '../server/database/schema'
import { orgUnits } from '../server/database/schema'
import { createOrgUnit, importMosques } from '../server/services/orgUnits'
import { parseMosqueCsv } from '../server/utils/csv'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = resolve(here, '../server/database')

function makeDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(readFileSync(resolve(dbDir, 'migrations/0000_init.sql'), 'utf8'))
  sqlite.exec(`INSERT INTO org_units (id,parent_id,path,type,gender_track,name,status,created_at)
    VALUES ('idlib',NULL,'/idlib/','rabita','male','رابطة إدلب','active',0);`)
  return drizzle(sqlite, { schema })
}

describe('createOrgUnit — المسار المادّي', () => {
  it('يحسب مسار الابن من الأب', async () => {
    const db = makeDb()
    const bloc = await createOrgUnit(db, { parentId: 'idlib', type: 'bloc', genderTrack: 'male', name: 'كتلة' })
    expect(bloc.path).toBe(`/idlib/${bloc.id}/`)
    const mosque = await createOrgUnit(db, { parentId: bloc.id, type: 'mosque', genderTrack: 'male', name: 'مسجد' })
    expect(mosque.path).toBe(`/idlib/${bloc.id}/${mosque.id}/`)
  })
})

describe('parseMosqueCsv', () => {
  it('يحلّل الأسطر ويتجاهل الترويسة ويكتشف الجنس', () => {
    const { rows, errors } = parseMosqueCsv('name,gender,district\nالفاروق,male,الشمال\nالتقوى,نساء,\n,male,خطأ')
    expect(rows.length).toBe(2)
    expect(rows[0]).toEqual({ name: 'الفاروق', genderTrack: 'male', district: 'الشمال' })
    expect(rows[1].genderTrack).toBe('female')
    expect(errors.length).toBe(1)
  })
})

describe('importMosques', () => {
  it('ينشئ المساجد تحت الأب', async () => {
    const db = makeDb()
    const sq = await createOrgUnit(db, { parentId: 'idlib', type: 'square', genderTrack: 'male', name: 'مربع' })
    const { rows } = parseMosqueCsv('الفاروق,male\nالتقوى,female')
    const created = await importMosques(db, sq.id, rows)
    expect(created.length).toBe(2)
    const all = await db.select().from(orgUnits).where(eq(orgUnits.type, 'mosque')).all()
    expect(all.length).toBe(2)
    expect(all.every((m) => m.path.startsWith(sq.path))).toBe(true)
  })
})
