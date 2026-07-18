import { eq } from 'drizzle-orm'
import { orgUnits } from '../database/schema'
import { buildChildPath } from '../utils/orgPath'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'
import type { MosqueRow } from '../utils/csv'

export interface NewOrgUnit {
  parentId: string | null
  type: string
  genderTrack: string
  name: string
  city?: string
  district?: string
}

// ينشئ وحدة تنظيمية ويحسب مسارها المادّي من الأب
export async function createOrgUnit(db: Db, input: NewOrgUnit, actorUserId?: string): Promise<{ id: string; path: string }> {
  let parentPath: string | null = null
  if (input.parentId) {
    const p = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.parentId)).all())[0]
    if (!p) throw new Error('الوحدة الأب غير موجودة')
    parentPath = p.path
  }
  const id = crypto.randomUUID()
  const path = buildChildPath(parentPath, id)
  await db.insert(orgUnits).values({
    id, parentId: input.parentId ?? null, path, type: input.type, genderTrack: input.genderTrack,
    name: input.name, city: input.city ?? null, district: input.district ?? null,
    status: 'active', createdAt: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'create_org_unit', entity: 'org_unit', entityId: id, after: { name: input.name, type: input.type, path } })
  return { id, path }
}

// استيراد دفعة مساجد تحت وحدة أب (عادةً مربع)
export async function importMosques(db: Db, parentId: string, rows: MosqueRow[], actorUserId?: string) {
  const created: Array<{ id: string; name: string }> = []
  for (const row of rows) {
    const { id } = await createOrgUnit(db, {
      parentId, type: 'mosque', genderTrack: row.genderTrack, name: row.name, district: row.district,
    }, actorUserId)
    created.push({ id, name: row.name })
  }
  return created
}
