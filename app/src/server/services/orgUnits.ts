import { eq } from 'drizzle-orm'
import { orgUnits } from '../database/schema'
import { buildChildPath } from '../utils/orgPath'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'
import type { MosqueRow } from '../utils/csv'

export interface NewOrgUnit {
  parentId: string | null
  type: string
  section?: string       // men | women — للجذور فقط؛ الأبناء يرثونه من الأب
  genderTrack?: string   // ق٢: مُهملٌ — يُشتقّ من القسم دومًا (أُبقي اختياريًّا لتوافق المستدعين)
  name: string
  city?: string
  governorate?: string   // رمز المحافظة (lib/syria-regions)
  district?: string      // رمز المنطقة/القضاء
}

// تناسق النوع مع القسم: المسجد للذكور فقط، والحلقة للنساء فقط (الفصل التام بنيويًّا)
function assertTypeSection(type: string, section: string) {
  if (type === 'mosque' && section !== 'men') throw new Error('المسجد لا يُنشأ إلا في قسم الذكور')
  if (type === 'halaqa' && section !== 'women') throw new Error('الحلقة لا تُنشأ إلا في قسم النساء')
}

// ينشئ وحدة تنظيمية ويحسب مسارها المادّي من الأب؛ القسم يُورَّث من الأب (أو يُعطى للجذر)
export async function createOrgUnit(db: Db, input: NewOrgUnit, actorUserId?: string): Promise<{ id: string; path: string; section: string }> {
  let parentPath: string | null = null
  let section = input.section ?? 'men'
  if (input.parentId) {
    const p = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.parentId)).all())[0]
    if (!p) throw new Error('الوحدة الأب غير موجودة')
    parentPath = p.path
    section = p.section   // الأبناء يرثون قسم الأب دائمًا — لا عبور بين القسمين
  }
  assertTypeSection(input.type, section)
  // ق٢: المسار الجنسيّ مشتقٌّ من القسم حصرًا — مصدرُ حقيقةٍ واحدٌ فلا تنافر (هجرة 0053 أصلحت القديم)
  const genderTrack = section === 'women' ? 'female' : 'male'
  const id = crypto.randomUUID()
  const path = buildChildPath(parentPath, id)
  await db.insert(orgUnits).values({
    id, parentId: input.parentId ?? null, path, type: input.type, section, genderTrack,
    name: input.name, city: input.city ?? null,
    governorate: input.governorate ?? null, district: input.district ?? null,
    status: 'active', createdAt: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'create_org_unit', entity: 'org_unit', entityId: id, after: { name: input.name, type: input.type, section, path } })
  return { id, path, section }
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
